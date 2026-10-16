import {DOT_INTERVAL_MS,loadingText,waitForHomeReady} from './loading-state.js';
const splash=document.querySelector('.loading-screen');
const copy=document.querySelector('.loading-copy');
const retry=document.querySelector('.loading-retry');
const home=document.querySelector('.home');
let step=0;
const timer=setInterval(()=>{step++;copy.textContent=loadingText(step)},DOT_INTERVAL_MS);
function stop(){clearInterval(timer);splash.classList.add('is-stopped')}
retry.addEventListener('click',()=>location.reload());
async function decodeImage(img){if(img.decode)await img.decode();else if(!img.complete)await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject});if(!img.naturalWidth)throw new Error('이미지를 불러오지 못했어요.');}
try {
  await waitForHomeReady([
    // Module resolves only after state restore, manifest validation, current tree and earned decorations render.
    ()=>import('./home.js'),
    ()=>Promise.all([...home.querySelectorAll('img')].map(decodeImage)),
  ]);
  // Home has now mounted. Wait for its visible slot thumbnails too, not all future/unearned art.
  await waitForHomeReady([()=>Promise.all([...home.querySelectorAll('img')].map(decodeImage))]);
  // Wait for a paint opportunity, not an invented minimum loading duration.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  stop();home.inert=false;home.removeAttribute('aria-hidden');
  document.body.classList.remove('is-loading');splash.remove();window.dispatchEvent(new Event('tree:home-ready'));
} catch(error) {
  stop();copy.textContent='화면을 준비하지 못했어요. 다시 시도해 주세요.';
  splash.setAttribute('aria-label','로딩 실패');retry.hidden=false;
  console.error('Home initialization failed:',error);
}
window.addEventListener('pagehide',stop,{once:true});
