// Independent painted layers move with compositor transforms. No pixel warping.
const ROOT='assets/factory/';
export function startFactoryScene(scene,painting){
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const actors=document.createElement('div');
 actors.className='factory-actors';actors.hidden=true;actors.setAttribute('aria-hidden','true');
 const images=[];
 function image(path,className,parent){
  const img=document.createElement('img');img.src=path;img.className=className;
  img.alt='';img.draggable=false;images.push(img);parent?.append(img);return img;
 }
 const plate=image(ROOT+'workshop-layered.webp','');
 image(ROOT+'santa-worker.webp','factory-worker factory-worker--back',actors);
 const rig=document.createElement('div');rig.className='factory-conveyor-rig';actors.append(rig);
 image(ROOT+'conveyor-frame.webp','factory-conveyor-frame',rig);
 const surface=document.createElement('div');surface.className='factory-belt-surface factory-moving';rig.append(surface);
 // Decode the background tile too, so production never starts with an empty belt.
 image(ROOT+'conveyor-slat.webp','');
 for(const x of [10.15625,32.61719,56.15234,80.56641]){
  const roller=image(ROOT+'conveyor-roller.webp','factory-roller factory-moving',rig);roller.style.left=x+'%';
 }
 const parcels=document.createElement('div');parcels.className='factory-parcels';rig.append(parcels);
 image('assets/thumbnails/gift-burgundy.webp','factory-parcel factory-parcel--one factory-moving',parcels);
 image('assets/thumbnails/gift-green-large.webp','factory-parcel factory-parcel--two factory-moving',parcels);
 image(ROOT+'santa-worker.webp','factory-worker factory-worker--front',actors);
 scene.append(actors);
 let ready=false,disposed=false;
 function sync(){
  const running=ready&&!disposed&&!document.hidden&&!motion.matches&&document.body.dataset.page==='factory'&&scene.classList.contains('producing');
  actors.dataset.running=String(running);
 }
 const observer=new MutationObserver(sync);
 observer.observe(scene,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
 Promise.all(images.map(img=>img.decode())).then(()=>{
  if(disposed)return;
  ready=true;painting.src=plate.src;actors.hidden=false;sync();
 }).catch(()=>{/* Keep the original painting if any layer cannot load. */});
 return ()=>{
  disposed=true;ready=false;sync();observer.disconnect();
  document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);actors.remove();
 };
}
