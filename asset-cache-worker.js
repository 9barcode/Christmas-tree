// Build injects a content version and an exact local image/font allowlist.
const CACHE='christmas-tree-art-__ASSET_VERSION__';
const ASSETS=new Set(__ASSET_PATHS__);
const ROOT=new URL('./',self.location.href);
const MAX_BYTES=32*1024*1024,MAX_FILE=4*1024*1024,MAX_ENTRIES=48;
let writes=Promise.resolve();
function allowed(request){
 const url=new URL(typeof request==='string'?request:request.url);
 return url.origin===ROOT.origin&&!url.search&&ASSETS.has(url.pathname);
}
async function store(request,response){
 if(!response.ok||response.type==='opaque'||response.headers.get('cache-control')?.includes('no-store'))return;
 const blob=await response.blob();if(blob.size>MAX_FILE)return;
 const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');headers.set('x-tree-cache-bytes',String(blob.size));
 const cache=await caches.open(CACHE);
 await cache.put(request,new Response(blob,{status:200,headers}));
 const keys=await cache.keys();let bytes=0;
 for(const key of keys)bytes+=Number((await cache.match(key)).headers.get('x-tree-cache-bytes'))||0;
 while(keys.length>MAX_ENTRIES||bytes>MAX_BYTES){
  const key=keys.shift();const old=await cache.match(key);
  bytes-=Number(old?.headers.get('x-tree-cache-bytes'))||0;await cache.delete(key);
 }
}
function queueStore(request,response){
 writes=writes.then(()=>store(request,response)).catch(()=>{});return writes;
}
async function image(request,event){
 let cached;try{cached=await (await caches.open(CACHE)).match(request);}catch{/* Quota/private mode fallback. */}
 if(cached)return cached;
 const response=await fetch(request);event.waitUntil(queueStore(request,response.clone()));return response;
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('christmas-tree-art-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})().catch(()=>{})));
self.addEventListener('fetch',event=>{
 if(event.request.method==='GET'&&allowed(event.request))event.respondWith(image(event.request,event));
});
self.addEventListener('message',event=>{
 if(event.data?.type!=='warm-assets'||!Array.isArray(event.data.urls))return;
 event.waitUntil((async()=>{
  for(const url of event.data.urls.slice(0,12)){
   try{if(!allowed(url))continue;const cache=await caches.open(CACHE);if(await cache.match(url))continue;
    const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(8000)});await queueStore(url,response);
   }catch{/* Offline/ad/security data is never cached. */}
  }
 })());
});
