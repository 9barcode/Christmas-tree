// Production is indicated only by the oven light; the approved painting stays still.
export function startFactoryScene(scene){
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const effect=document.createElement('div');
 effect.className='factory-fire-stage';effect.hidden=true;effect.setAttribute('aria-hidden','true');
 const glow=document.createElement('div');glow.className='factory-fire-pulse';effect.append(glow);scene.append(effect);
 let disposed=false;
 function sync(){
  const running=!disposed&&!document.hidden&&!motion.matches&&document.body.dataset.page==='factory'&&scene.classList.contains('producing');
  effect.hidden=!running;
 }
 const observer=new MutationObserver(sync);
 observer.observe(scene,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);sync();
 return ()=>{disposed=true;sync();observer.disconnect();document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);effect.remove();};
}
