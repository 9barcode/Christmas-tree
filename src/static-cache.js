// Optional enhancement. Never wait for this before opening the app or showing ads.
export function startStaticCache(){
 try{
 if(!globalThis.isSecureContext||!('serviceWorker' in navigator))return;
 const root=new URL('../',import.meta.url);
 navigator.serviceWorker.register(new URL('asset-cache-worker.js',root),{scope:root.pathname,updateViaCache:'none'})
  .then(registration=>{
   const warm=()=>{
    const worker=registration.active;if(!worker)return;
    const urls=[...new Set(performance.getEntriesByType('resource').map(entry=>entry.name))]
     .filter(url=>url.startsWith(new URL('assets/',root).href)).slice(-12);
    worker.postMessage({type:'warm-assets',urls});
   };
   if(registration.active)warm();
   else navigator.serviceWorker.ready.then(warm).catch(()=>{});
  }).catch(()=>{/* Some app WebViews do not support workers; normal loading still works. */});
 }catch{/* Registration can throw synchronously in restricted WebViews too. */}
}
