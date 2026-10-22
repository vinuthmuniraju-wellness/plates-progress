/* ============ Hosted version: workout access codes ============
   Codes are tied to one Google account. The admin creates a code in the app, then adds the line it shows to
   access-codes.json in the GitHub repository. Only a slow hash of "code + email" is published, never the code.
   Turning a code off = delete its line (or add "off": true) and commit. */
async function ppHash(str){
  const enc=new TextEncoder(); const key=await crypto.subtle.importKey("raw",enc.encode(str),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:enc.encode("plate-progress/access/v1"),iterations:150000},key,256);
  return [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
const codeKey=(code,email)=>ppHash(normCode(code)+"|"+String(email||"").trim().toLowerCase());
async function loadCodeList(){
  try{const r=await fetch("access-codes.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)return [];const j=await r.json();return Array.isArray(j)?j:[]}catch(e){return []}
}
async function checkAccess(){
  ACC.checked=false;
  if(ACC.user&&ACC.user.isOwner()){ACC.owner=true;ACC.granted=true;ACC.checked=true;return}
  ACC.owner=false; const list=await loadCodeList(); UI.codes=list;
  const h=S.accessH; const hit=h&&list.find(x=>x&&x.h===h);
  ACC.granted=!!(hit&&!hit.off); ACC.why=h&&!ACC.granted?"revoked":""; ACC.checked=true;
}
async function redeemCode(raw){
  const msg=$("#accMsg"); const say=(h,bad)=>{if(msg)msg.innerHTML=`<span style="color:var(${bad?"--bad":"--good"})">${h}</span>`};
  const c=normCode(raw); if(c.length!==8){say("Codes have 8 letters and numbers, like K7QF-29XM.",true);return}
  say(`<span class="muted">Checking the code…</span>`);
  const email=PP.user&&PP.user.email; const h=await codeKey(c,email); const list=await loadCodeList(); const hit=list.find(x=>x&&x.h===h);
  if(!hit){say(`That code doesn't match your Google account (${esc(email)}). Codes only work for the account they were made for. Check it with the admin.`,true);return}
  if(hit.off){say("This code has been turned off. Ask the admin for a new one.",true);return}
  S.accessH=h; saveState(); await checkAccess();
  UI.tab="workout"; UI._view=null; render(); setTimeout(confetti,120); toast("Workout unlocked. Welcome!");
}
async function adminLoadCodes(){UI.codes=await loadCodeList(); if(UI.tab==="profile") render()}
function maskEmail(e){const [u,d]=String(e).split("@");return (u||"").slice(0,2)+"***@"+(d||"")}
function adminPanel(){
  if(!ACC.owner) return "";
  const list=UI.codes||[]; const nc=UI.newCode;
  const entry=nc?JSON.stringify({h:nc.h,label:nc.label||"",who:maskEmail(nc.email),created:today()}):"";
  return `<section class="panel admin rise">
    <div class="row"><span class="chip">Admin</span><h3>Workout access codes</h3></div>
    <p class="small muted" style="margin:0">Only you see this. Each code works for one Google account. After you create a code, add the line shown to <b>access-codes.json</b> in your GitHub repository; the code starts working once that change is live (usually within a minute).</p>
    <form id="genForm" class="grid g2" novalidate>
      <label class="field"><span>Their Gmail address</span><input id="genEmail" type="email" placeholder="ravi@gmail.com" autocomplete="off"></label>
      <label class="field"><span>Name or note</span><input id="genLabel" placeholder="Ravi" maxlength="40"></label>
      <div class="row"><button class="primary" type="submit">Generate code</button></div>
    </form>
    ${nc?`<div class="newcode"><div><div class="label">Code for ${esc(nc.label||nc.email)}</div><div class="codebig num">${esc(nc.code)}</div><div class="small muted">Works only when signed in as ${esc(nc.email)}. Copy it now; it isn't shown again.</div></div><div class="row"><button class="primary" data-act="copyCode">Copy code</button><button class="wa-out" data-act="shareCode">${ICO_CHAT} Share on WhatsApp</button></div></div>
    <div class="field"><span>Line to add to access-codes.json (inside the [ ] list, separated by commas)</span><textarea id="codeLine" class="copybox" readonly style="min-height:70px">${esc(entry)}</textarea></div>
    <div class="row"><button data-act="copyLine">Copy line</button>${PP.config.ACCESS_FILE_EDIT_URL?`<a class="btn" href="${esc(PP.config.ACCESS_FILE_EDIT_URL)}" target="_blank" rel="noopener">Open access-codes.json on GitHub</a>`:""}</div>`:""}
    ${list.length?`<div class="scroll"><table><thead><tr><th>For</th><th>Account</th><th>Created</th><th>Status</th></tr></thead><tbody>${list.map(c=>`<tr><td>${esc(c.label||"—")}</td><td>${esc(c.who||"—")}</td><td>${esc(c.created||"—")}</td><td>${c.off?`<span class="pill bad">Turned off</span>`:`<span class="pill good">Active</span>`}</td></tr>`).join("")}</tbody></table></div><p class="small muted" style="margin:0">To turn a code off, delete its line from access-codes.json (or add <code>"off": true</code>) and commit.</p>`:`<div class="small muted">No codes published yet.</div>`}
  </section>`;
}
async function adminGenerate(){
  const email=($("#genEmail").value||"").trim().toLowerCase(); const label=($("#genLabel").value||"").trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){toast("Enter the person's Gmail address.");return}
  const code=newCode(); const h=await codeKey(code,email);
  UI.newCode={code,label,email,h}; render(); toast("Code created. Add the line to access-codes.json.");
}
