const CACHE="tribu-gbe-v1";
const CORE=["/","/manifest.webmanifest"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.pathname.startsWith("/api/"))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match("/"))));});
self.addEventListener("push",e=>{let d={title:"Tribu Gbê",body:"Une nouvelle information est disponible.",url:"/"};try{d={...d,...e.data.json()}}catch(_){}e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:d.icon||"/icon-192.png",badge:d.badge||"/icon-192.png",data:{url:d.url||"/"},vibrate:[120,60,120]}));});
self.addEventListener("notificationclick",e=>{e.notification.close();const url=e.notification.data?.url||"/";e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const c of list){if("focus" in c){c.navigate(url);return c.focus();}}return clients.openWindow(url);}));});
