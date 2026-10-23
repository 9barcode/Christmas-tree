import {layers,rollers,beltWindows} from './factory-scene-layers.js';
const ROOT='assets/factory/original/';
export function startFactoryScene(scene,painting){
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const actors=document.createElement('div');
 actors.className='factory-actors';actors.hidden=true;actors.setAttribute('aria-hidden','true');
 const images=[];
 function preload(path){const img=document.createElement('img');img.src=path;images.push(img);return img;}
 function sprite(layer){
  const img=preload(ROOT+layer.id+'.webp'),[x,y,w,h]=layer.rect;
  img.className='factory-original-sprite factory-original-'+layer.kind+' factory-source-'+layer.id;
  img.alt='';img.draggable=false;
  Object.assign(img.style,{left:x/512*100+'%',top:y/1024*100+'%',width:w/512*100+'%',height:h/1024*100+'%',transformOrigin:layer.origin||'50% 50%'});
  actors.append(img);
 }
 sprite(layers.find(l=>l.id==='conveyor'));
 const moving=layers.filter(l=>['santa','parcel'].includes(l.kind));
 const repair=preload(ROOT+'repair.webp'),tile=preload(ROOT+'belt-tile.webp');
 rollers.forEach((_,i)=>preload(ROOT+'roller-'+i+'.webp'));
 const artwork=document.createElement('div');artwork.className='factory-original-artwork';
 // Repair is restricted to the silhouettes that move, not the background/UI.
 artwork.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 1024" aria-hidden="true">
 <defs>
 <mask id="factory-original-repair" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="1024"><rect width="512" height="1024" fill="black"/>${moving.map(l=>`<path d="${l.path}" fill="white" stroke="white" stroke-width="4"/>`).join('')}</mask>
 <clipPath id="factory-original-belt">${beltWindows.map(d=>`<path d="${d}"/>`).join('')}</clipPath>
 <clipPath id="factory-original-wheel"><circle r=".98"/></clipPath>
 <pattern id="factory-original-slats" patternUnits="userSpaceOnUse" width="38" height="15" patternTransform="matrix(1 -.25 .8 .5 0 460)"><image href="${tile.src}" width="38" height="15" preserveAspectRatio="none"/></pattern>
 </defs>
 <image href="${repair.src}" width="512" height="1024" mask="url(#factory-original-repair)"/>
 <g clip-path="url(#factory-original-belt)"><g class="factory-original-belt-flow"><rect x="-50" width="620" height="1024" fill="url(#factory-original-slats)"/></g></g>
 ${rollers.map(({x,y,rx,ry},i)=>`<g transform="translate(${x} ${y}) scale(${rx} ${ry})" clip-path="url(#factory-original-wheel)"><image class="factory-original-wheel" href="${ROOT}roller-${i}.webp" x="-1" y="-1" width="2" height="2" preserveAspectRatio="none"/></g>`).join('')}
 </svg>`;
 actors.append(artwork);
 layers.filter(l=>l.kind==='static'&&l.id!=='conveyor').forEach(sprite);
 moving.forEach(sprite);scene.append(actors);
 let ready=false,disposed=false;
 function sync(){
  const running=ready&&!disposed&&!document.hidden&&!motion.matches&&document.body.dataset.page==='factory'&&scene.classList.contains('producing');
  actors.dataset.running=String(running);actors.hidden=!running;
 }
 const observer=new MutationObserver(sync);
 observer.observe(scene,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
 Promise.all(images.map(img=>img.decode())).then(()=>{if(disposed)return;ready=true;sync();}).catch(()=>{/* Original painting remains visible on failure. */});
 return ()=>{disposed=true;ready=false;sync();observer.disconnect();document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);actors.remove();};
}
