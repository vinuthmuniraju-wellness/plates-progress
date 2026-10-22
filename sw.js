/* Offline shell for the installable app. Personal data is never cached here: it lives in Google Drive. */
const CACHE="pp-shell-v1";
const SHELL=["./","index.html","config.js","platform.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.endsWith("access-codes.json")) return;
  /* network first so updates arrive; cached copy when offline */
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));
});
