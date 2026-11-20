const CACHE="tribu-gbe-v3";
const CORE=["./","./manifest.webmanifest","./icon-192.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith("tribu-gbe-")&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.pathname.includes("/api/")||u.origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./"))));});
self.addEventListener("notificationclick",e=>{e.notification.close();const url=e.notification.data?.url||"./";e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const c of list){if("focus" in c){c.navigate(url);return c.focus();}}return clients.openWindow(url);}));});
