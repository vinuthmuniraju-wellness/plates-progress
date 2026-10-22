/* Plate & Progress — platform layer for the hosted (GitHub Pages) version.
   Signs people in with Google, reads and writes their own Google Drive directly from the browser,
   and talks to the optional AI helper. It exposes the same small interface the app uses
   (window.claude.use(...)) so the app code stays the same everywhere. */
(function(){
  const CFG = window.PP_CONFIG || {};
  const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file";
  const DRIVE = "https://www.googleapis.com/drive/v3";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
  const S = { token:null, exp:0, user:null };
  const hintKey = "pp_login_hint";

  function gisReady(){
    return new Promise((res,rej)=>{
      const t0=Date.now();
      const t=setInterval(()=>{
        if(window.google&&google.accounts&&google.accounts.oauth2){clearInterval(t);res()}
        else if(Date.now()-t0>15000){clearInterval(t);rej({code:"gis_unavailable",message:"Google sign-in didn't load. Check your connection or ad blocker."})}
      },50);
    });
  }
  /* opens Google's sign-in / consent popup; call it from a click */
  async function signIn(){
    if(!CFG.GOOGLE_CLIENT_ID||/PASTE-YOUR/.test(CFG.GOOGLE_CLIENT_ID)) throw {code:"not_configured",message:"The site owner hasn't added the Google client ID in config.js yet."};
    await gisReady();
    let hint=""; try{hint=localStorage.getItem(hintKey)||""}catch(e){}
    return new Promise((res,rej)=>{
      const client=google.accounts.oauth2.initTokenClient({
        client_id:CFG.GOOGLE_CLIENT_ID, scope:SCOPES, prompt:"", login_hint:hint||undefined,
        callback: async r=>{
          if(r.error){rej({code:r.error==="access_denied"?"not_in_manifest":"needs_reauth",message:r.error_description||r.error});return}
          if(!google.accounts.oauth2.hasGrantedAllScopes(r,"https://www.googleapis.com/auth/drive.file")){rej({code:"not_in_manifest",message:"Google Drive access wasn't allowed."});return}
          S.token=r.access_token; S.exp=Date.now()+(Number(r.expires_in||3600)-60)*1000;
          try{
            const u=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:"Bearer "+S.token}}).then(x=>x.json());
            S.user={sub:u.sub,email:(u.email||"").toLowerCase(),name:u.name||u.given_name||"",picture:u.picture||""};
            try{localStorage.setItem(hintKey,S.user.email)}catch(e){}
            res(S.user);
          }catch(e){rej({code:"server_unavailable",message:"Couldn't read your Google profile."})}
        },
        error_callback: e=>rej({code:e&&e.type==="popup_closed"?"cancelled":"needs_reauth",message:(e&&e.message)||"Sign-in was closed."})
      });
      client.requestAccessToken();
    });
  }
  async function token(){
    if(S.token&&Date.now()<S.exp) return S.token;
    S.token=null;
    throw {code:"needs_reauth",message:"Your Google session expired. Tap to continue."};
  }
  function signOut(){
    try{ if(S.token&&window.google) google.accounts.oauth2.revoke(S.token,()=>{}) }catch(e){}
    S.token=null; S.user=null; location.reload();
  }

  async function gfetch(url,opts={}){
    const t=await token();
    let r;
    try{ r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:"Bearer "+t}}) }
    catch(e){ throw {code:"server_unavailable",message:"No connection to Google Drive.",retryable:true} }
    if(r.status===401){S.token=null;throw {code:"needs_reauth",message:"Your Google session expired."}}
    if(r.status===403||r.status===404){const j=await r.json().catch(()=>({}));throw {code:r.status===404?"tool_error":"not_in_manifest",message:(j.error&&j.error.message)||("Drive error "+r.status)}}
    if(!r.ok) throw {code:"server_unavailable",message:"Google Drive error "+r.status,retryable:true};
    return r;
  }
  const b64FromBuf=buf=>{const u=new Uint8Array(buf);let s="";for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
  const bufFromB64=b=>{const s=atob(b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u};

  /* the four Google Drive actions the app uses */
  const driveTools={
    async create_file(inp){
      const type=inp.contentMimeType||"application/octet-stream";
      const meta={name:inp.title,mimeType:type}; if(inp.parentId) meta.parents=[inp.parentId];
      let content;
      if(typeof inp.textContent==="string") content=new Blob([inp.textContent],{type});
      else if(inp.base64Content&&inp.base64Content.$file) content=inp.base64Content.$file.data instanceof Blob?inp.base64Content.$file.data:new Blob([inp.base64Content.$file.data],{type});
      else if(typeof inp.base64Content==="string") content=new Blob([bufFromB64(inp.base64Content)],{type});
      else content=new Blob([],{type});
      const boundary="pp"+Math.random().toString(36).slice(2);
      const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(meta),`\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,content,`\r\n--${boundary}--`]);
      const r=await gfetch(`${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime`,{method:"POST",headers:{"Content-Type":`multipart/related; boundary=${boundary}`},body});
      const f=await r.json(); return {id:f.id,title:f.name,viewUrl:f.webViewLink,modifiedTime:f.modifiedTime};
    },
    async download_file_content(inp){
      const r=await gfetch(`${DRIVE}/files/${encodeURIComponent(inp.fileId)}?alt=media`);
      return {id:inp.fileId,content:b64FromBuf(await r.arrayBuffer())};
    },
    async search_files(inp){
      const m=String(inp.query||"").match(/title\s*=\s*'((?:[^'\\]|\\.)*)'/);
      const q=m?`name = '${m[1]}' and trashed = false and 'me' in owners`:"trashed = false";
      const r=await gfetch(`${DRIVE}/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&pageSize=${Math.min(+inp.pageSize||10,50)}&fields=files(id,name,modifiedTime,webViewLink)`);
      const j=await r.json(); return {files:(j.files||[]).map(f=>({id:f.id,title:f.name,modifiedTime:f.modifiedTime,viewUrl:f.webViewLink}))};
    },
    async trash_file(inp){
      await gfetch(`${DRIVE}/files/${encodeURIComponent(inp.fileId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({trashed:true})});
      return {};
    }
  };
  const mcp={
    async callTool(server,tool,input){ if(!S.user) throw {code:"needs_reauth",message:"Sign in with Google first."}; const f=driveTools[tool]; if(!f) throw {code:"bad_request",message:"Unknown action "+tool}; return {payload:await f(input||{})}; },
    async listTools(){ return {servers:[{server:"Google Drive",authStatus:"connected",tools:Object.keys(driveTools).map(n=>({name:n,description:""}))}],fileArgs:true}; },
    async server(){ return {}; }
  };

  /* small per-person settings kept in this browser (only the id of the data file) */
  function localDb(){
    const k=p=>"pp_db:"+p; const read=p=>{try{const v=localStorage.getItem(k(p));return v?JSON.parse(v):null}catch(e){return null}};
    const doc=path=>({path,id:path.split("/").pop(),
      async get(){const v=read(path);return {id:path.split("/").pop(),exists:!!v,data:()=>v?JSON.parse(JSON.stringify(v)):undefined}},
      async set(v){try{localStorage.setItem(k(path),JSON.stringify(v))}catch(e){}},
      async update(v){const cur=read(path)||{};try{localStorage.setItem(k(path),JSON.stringify({...cur,...v}))}catch(e){}},
      async delete(){try{localStorage.removeItem(k(path))}catch(e){}},
      async acquire(){return {acquired:true}}});
    const collection=path=>({path,
      async get(){const docs=[];try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(k(path)+"/")){const id=key.slice(k(path).length+1);if(!id.includes("/"))docs.push(await doc(path+"/"+id).get())}}}catch(e){}return {docs,size:docs.length,empty:!docs.length}},
      where(){return {get:async()=>({docs:[],size:0,empty:true})}},doc:id=>doc(path+"/"+id)});
    return {doc,collection};
  }

  /* AI helper (optional): the Cloudflare Worker in /worker */
  function makeSample(){
    if(!CFG.AI_ENDPOINT) return null;
    const blobToB64=b=>b.arrayBuffer().then(b64FromBuf);
    async function call(input,opts={}){
      const t=await token().catch(()=>null); if(!t) throw {code:"not_granted",message:"Sign in again to use AI features."};
      const imgs=opts.images?Array.from(opts.images instanceof Blob?[opts.images]:opts.images):[];
      const images=await Promise.all(imgs.map(async b=>({type:b.type||"image/jpeg",data:await blobToB64(b)})));
      let r;
      try{ r=await fetch(CFG.AI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({input,images,modelTier:opts.modelTier||"default",json:!!opts._json}),signal:opts.signal}) }
      catch(e){ throw {code:e&&e.name==="AbortError"?"cancelled":"upstream_error",message:"The AI helper couldn't be reached."} }
      if(r.status===429) throw {code:"rate_limited",message:"Too many requests. Try again in a minute."};
      if(r.status===401||r.status===403) throw {code:"not_granted",message:"The AI helper refused this account."};
      if(!r.ok) throw {code:"upstream_error",message:"AI helper error "+r.status};
      const j=await r.json(); const text=String(j.text||"");
      if(!text.trim()) throw {code:"empty_completion",message:"No answer came back."};
      if(opts.onText) try{opts.onText({text,delta:text})}catch(e){}
      return {text,truncated:!!j.truncated,modelTierApplied:opts.modelTier||"default"};
    }
    const sample=(input,opts)=>call(input,opts||{});
    sample.json=async(input,opts)=>{
      const {text}=await call(input,{...(opts||{}),_json:true});
      const tryP=s=>{try{return JSON.parse(s)}catch(e){return undefined}};
      let v=tryP(text.trim()); if(v!==undefined) return v;
      const fence=text.match(/```(?:json)?\s*([\s\S]*?)```/); if(fence){v=tryP(fence[1]);if(v!==undefined)return v}
      const a=Math.min(...["{","["].map(c=>{const i=text.indexOf(c);return i<0?1e9:i})), b=Math.max(text.lastIndexOf("}"),text.lastIndexOf("]"));
      if(a<1e9&&b>a){v=tryP(text.slice(a,b+1));if(v!==undefined)return v}
      throw {code:"invalid_json",message:"The answer couldn't be read.",text};
    };
    sample.limits=async()=>({maxPromptBytes:262144,images:{maxCount:4,maxInputBytes:5*1024*1024,mediaTypes:["image/jpeg","image/png","image/webp","image/gif"]}});
    return sample;
  }
  const downloads={
    async save({filename,data}){
      const blob=data instanceof Blob?data:new Blob([data]);
      const url=URL.createObjectURL(blob); const a=document.createElement("a");
      a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),4000); return {status:"saved"};
    }
  };

  const userApi={
    async id(){return S.user?"g_"+S.user.sub:null},
    isOwner(){return !!(S.user&&CFG.ADMIN_EMAIL&&S.user.email===String(CFG.ADMIN_EMAIL).toLowerCase())},
    canEdit(){return true}, can(){return true},
    async me(){return S.user?{id:"g_"+S.user.sub,name:S.user.name,email:S.user.email}:{id:null,name:""}}
  };
  const sampleFn=makeSample();
  window.claude={
    async use(name){
      if(name==="downloads") return downloads;
      if(name==="sample") return S.user?sampleFn:null;
      if(!S.user) return null;
      if(name==="user") return userApi;
      if(name==="db") return localDb();
      if(name==="mcp") return mcp;
      return null;
    }
  };
  window.PP={signIn,signOut,get user(){return S.user},get signedIn(){return !!S.user},tokenExpired:()=>!(S.token&&Date.now()<S.exp),config:CFG};

  /* installable app: register the offline shell */
  if("serviceWorker" in navigator&&location.protocol==="https:") window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
})();
