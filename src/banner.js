import {loadServiceConfig} from './service-config.js';

const initialized=new WeakMap();
function initialize(sdk){
 if(initialized.has(sdk))return initialized.get(sdk);
 const ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Banner initialization timeout')),10000);
  const finish=error=>{clearTimeout(timer);error?reject(error):resolve()};
  try{sdk.initialize({callbacks:{onInitialized:()=>finish(),onInitializationFailed:error=>finish(error||Error('Banner initialization failed'))}})}catch(error){finish(error)}
 });
 initialized.set(sdk,ready);ready.catch(()=>initialized.delete(sdk));return ready;
}

// One inline SDK-owned slot: no refresh timers, rewards, or fake ad markup.
export function createBanner({region,target,configKey='bannerTextAdGroupId',loadConfig=loadServiceConfig,loadSdk=()=>import('./native-banner.js').then(m=>m.TossAds)}){
 let generation=0,attached=null,timer=null;
 const destroy=slot=>{try{slot?.destroy()}catch{/* Optional advertising must not interrupt the home. */}};
 function stop(){generation++;clearTimeout(timer);timer=null;const old=attached;attached=null;destroy(old);region.hidden=true;target.replaceChildren()}
 async function start(){
  stop();const id=generation;
  const current=()=>id===generation&&region.isConnected;
  let handle=null,failed=false;
  const fail=()=>{if(!current()||failed)return;failed=true;clearTimeout(timer);timer=null;region.hidden=true;const old=handle;handle=null;if(attached===old)attached=null;destroy(old);target.replaceChildren()};
  try{
   const {ads}=await loadConfig(),adGroupId=ads?.[configKey];if(!current()||!adGroupId)return;
   const sdk=await loadSdk();if(!current()||!sdk?.initialize?.isSupported?.()||!sdk?.attachBanner?.isSupported?.())return;
   await initialize(sdk);if(!current())return;
   // SDK needs a measurable, empty, full-width container before attachment.
   region.hidden=false;
   timer=setTimeout(fail,15000);
   handle=sdk.attachBanner(adGroupId,target,{theme:'light',tone:'blackAndWhite',variant:'expanded',callbacks:{
    onAdRendered:()=>{if(current()&&!failed){clearTimeout(timer);timer=null;}},
    onNoFill:fail,onAdFailedToRender:fail
   }});
   if(!current()||failed){destroy(handle);return;}
   attached=handle;
  }catch{fail()}
 }
 return {start,stop};
}

export function startLoadingBanners(){
 if(new URLSearchParams(location.search).get('preview')==='1')return ()=>{};
 // Never show the same placement twice if console IDs were accidentally duplicated.
 const loadConfig=async()=>{const {ads}=await loadServiceConfig();return {ads:{...ads,bannerImageAdGroupId:ads.bannerImageAdGroupId===ads.bannerTextAdGroupId?'':ads.bannerImageAdGroupId}}};
 const banners=['bannerTextAdGroupId','bannerImageAdGroupId'].map(configKey=>{
  const region=document.querySelector(`[data-banner="${configKey}"]`);return region?createBanner({region,target:region.querySelector('.banner-target'),configKey,loadConfig}):null;
 }).filter(Boolean);
 const stop=()=>{window.removeEventListener('pagehide',stop);banners.forEach(b=>b.stop())};
 window.addEventListener('pagehide',stop);
 banners.forEach(b=>{b.start().catch(()=>b.stop())});return stop;
}

export function startHomeBanner(){
 if(new URLSearchParams(location.search).get('preview')==='1')return;
 const region=document.querySelector('body > .banner-region'),target=region?.querySelector('.banner-target');
 if(!region||!target)return;
 const banner=createBanner({region,target});
 const start=()=>{banner.start().catch(()=>banner.stop())};
 window.addEventListener('pagehide',()=>banner.stop());
 window.addEventListener('pageshow',event=>{if(event.persisted)start()});
 start();
}
