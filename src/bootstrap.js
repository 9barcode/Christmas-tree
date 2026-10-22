import {loadServiceConfig} from './service-config.js';
import {startHomeBanner,startLoadingBanners} from './banner.js';
// Ad adapters can request current Worker settings without rebuilding the AIT.
window.treeServiceConfig = {load: loadServiceConfig};
import {DOT_INTERVAL_MS,loadingText,waitForHomeReady} from './loading-state.js';
const splash=document.querySelector('.loading-screen');
const copy=document.querySelector('.loading-copy');
const retry=document.querySelector('.loading-retry');
const home=document.querySelector('.home');
const stopLoadingBanners=startLoadingBanners();
let step=0;
let stage='홈 코드 및 기본 이미지';
const timer=setInterval(()=>{step++;copy.textContent=loadingText(step)},DOT_INTERVAL_MS);
function stop(){clearInterval(timer);splash.classList.add('is-stopped')}
retry.addEventListener('click',()=>location.reload());
async function decodeImage(img){if(img.decode)await img.decode();else if(!img.complete)await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject});if(!img.naturalWidth)throw new Error(`이미지 준비 실패: ${img.getAttribute('src')}`);}
try {
  await waitForHomeReady([
    // Module resolves only after state restore, manifest validation, current tree and earned decorations render.
    ()=>import('./bm-home.js'),
    ()=>Promise.all([...home.querySelectorAll('img')].map(decodeImage)),
  ]);
  stage='홈 슬롯 이미지';
  // Home has now mounted. Wait for its visible slot thumbnails too, not all future/unearned art.
  await waitForHomeReady([()=>Promise.all([...home.querySelectorAll('img')].map(decodeImage))]);
  stage='홈 표시';
  // Wait for a paint opportunity, not an invented minimum loading duration.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  stop();home.inert=false;home.removeAttribute('aria-hidden');
  stopLoadingBanners();document.body.classList.remove('is-loading');splash.remove();window.dispatchEvent(new Event('tree:home-ready'));
  // Advertising is optional: it never blocks home readiness or loading recovery.
  startHomeBanner();
} catch(error) {
  stopLoadingBanners();
  stop();copy.textContent='화면을 준비하지 못했어요. 다시 시도해 주세요.';
  splash.setAttribute('aria-label','로딩 실패');retry.hidden=false;
  const detail=document.createElement('p');detail.className='loading-error-detail';detail.style.cssText='font:12px/1.5 system-ui,sans-serif;overflow-wrap:anywhere;max-width:90vw;margin:12px auto;color:#73472e';detail.textContent=`확인 단계: ${stage} / ${error?.name||'Error'}: ${error?.message||'원인 확인 필요'}`;retry.after(detail);
  console.error('Home initialization failed:',error);
}
window.addEventListener('pagehide',stop,{once:true});
