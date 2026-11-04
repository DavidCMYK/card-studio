/* Generated at deploy time: __CACHE_VERSION__ is replaced with the commit SHA. */
const CACHE='card-studio-static-__CACHE_VERSION__';
const shell=['./','./index.html','./styles.css','./mobile.css','./dist/app.js',
 './vendor/jszip.min.js','./manifest.webmanifest','./icons/card-192.png','./icons/card-512.png'];
const paths=new Set(shell.map(p=>new URL(p,self.registration.scope).pathname));
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(shell)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys
  .filter(key=>key.startsWith('card-studio-static-')&&key!==CACHE)
  .map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(!paths.has(url.pathname)&&request.mode!=='navigate')return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(request);
   if(response.ok){
    try{
     const cache=await caches.open(CACHE);
     const canonical=new Request(url.origin+url.pathname);
     await cache.put(canonical,response.clone());
    }catch(error){console.warn('Could not cache Card Studio shell asset',error)}
   }
   return response;
  }catch(error){
   const cache=await caches.open(CACHE);
   const fallback=await cache.match(new Request(url.origin+url.pathname))||
    (request.mode==='navigate'?await cache.match(new URL('./',self.registration.scope)):undefined);
   return fallback||Response.error();
  }
 })());
});
