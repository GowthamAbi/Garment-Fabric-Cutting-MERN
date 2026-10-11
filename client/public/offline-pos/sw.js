const CACHE='ugs-offline-pos-v2',FILES=['/offline-pos/','/offline-pos/index.html','/offline-pos/app.js','/offline-pos/drafts.js','/offline-pos/receipt.js','/offline-pos/style.css'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ugs-offline-pos-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!FILES.includes(url.pathname))return;event.respondWith(caches.match(url.pathname).then(response=>response||fetch(event.request)));});
