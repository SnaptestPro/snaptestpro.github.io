const CACHE_NAME="snaptestpro-v154-fast",urlsToCache=["/","/index.html","/offline.html","/favicon.ico","/styles.css","/theme-picker.css","/creative-dashboard.css","/exam-manager.css","/id-card.css","/script.js","/upgrade.js","/whatsapp-poll-export.js","/student-features.js","/id-card.js","/omr.js","/push-notifications.js","/back-button-guard.js","/subject-resolver.js","/pdf-import.js","/firebase-config.js","/theme-palette.js","/live-theme-effects.js","/theme-manager.js","/icon-192.png","/icon-512.png","/icon-192-maskable.png","/icon-512-maskable.png","/snaptestpro-logo.png","/manifest.webmanifest","/app-bridge.js","/app-ui.js","/app-ui.css","/question-generator.html","/qgen-app.js","/qgen-admin-gate.js","/exam-manager.js","/booklet-print.js","https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js","https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js","https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js","https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js","/screenshot-wide.jpg","/screenshot-narrow.jpg","/owner-app.html","/manifest-owner.webmanifest","/icon-192-owner.png","/icon-512-owner.png","/icon-192-maskable-owner.png","/icon-512-maskable-owner.png"];self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(n=>Promise.allSettled(urlsToCache.map(t=>n.add(t)))).then(()=>self.skipWaiting()))}),self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(n=>Promise.all(n.filter(t=>t!==CACHE_NAME).map(t=>caches.delete(t)))).then(()=>self.clients.claim()))}),self.addEventListener("fetch",e=>{
  const rq=e.request;if(rq.method!=="GET")return;
  const u=new URL(rq.url),same=u.origin===self.location.origin;
  // Versioned/immutable CDN files: ek baar cache me aa gaye to seedha wahin se (network nahi)
  const immutable=/^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.gstatic\.com\/|cdnjs\.cloudflare\.com\/)/.test(rq.url);
  // Firestore/Auth API (cross-origin) ko SW chhuta hi nahi — pehle inki streaming GET bhi SW se guzarti thi
  if(!same&&!immutable)return;
  if(rq.headers.has("range"))return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE_NAME),hit=await c.match(rq);
    if(hit&&immutable)return hit;
    // 'no-cache' = conditional request (304, bahut chhota); pehle 'no-store' har baar poori file dubara download karta tha
    const net=fetch(rq,{cache:"no-cache"}).then(r=>{if(r&&r.ok&&r.status===200){try{c.put(rq,r.clone())}catch(_){}}return r}).catch(()=>hit||(rq.mode==="navigate"?c.match("/offline.html"):Response.error()));
    if(hit){e.waitUntil(net.catch(()=>{}));return hit}
    return net;
  })());
}),
self.addEventListener("notificationclick",e=>{e.notification.close();const n=e.notification.data?.url||"/";e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:!0}).then(t=>{for(const s of t)if(s.url.includes(n)&&"focus"in s)return s.focus();if(self.clients.openWindow)return self.clients.openWindow(n)}))});
