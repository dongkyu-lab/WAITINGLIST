const CACHE='flow-offline-v2';
const OFFLINE='/offline.html';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([OFFLINE,'/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png'])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('flow-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Customer data, authentication, mutations, and application scripts are never cached.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match(OFFLINE)));
});
