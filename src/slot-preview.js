import {OBJECT_SIZES,defaultPosition,floorDepth} from './placement.js';
import {planterPolygon} from './planter.js';

export async function slotPreview(tree,sequence,geometry,index){
 const layers=[];
 function add(path,kind,p,depth,front){const size=OBJECT_SIZES[kind];layers.push({path,p,size,depth,front})}
 const pot=tree.positions?.__pot??defaultPosition('pot');
 add('assets/planters/planter-wood.png','pot',pot,0,false);
 add(`assets/trees/tree-${tree.color}.png`,'tree',defaultPosition('tree'),1);
 add('assets/planters/planter-wood.png','pot',pot,floorDepth('pot',pot.y),true);
 let floor=0,ornament=0;
 for(const a of sequence.slice(0,tree.count)){
  const n=a.kind==='floor'?floor++:a.kind==='ornament'?ornament++:0;
  const p=['lights','topper'].includes(a.kind)?defaultPosition(a.kind):tree.positions?.[a.id]??defaultPosition(a.kind,n);
  add(a.path,a.kind,p,floorDepth(a.kind,p.y)??(a.kind==='lights'?2:3));
 }
 layers.sort((a,b)=>a.depth-b.depth);
 const body=await Promise.all(layers.map(async(a,i)=>{
  const g=await geometry(a.path),x=a.p.x-a.size.w/2,y=(a.p.y-a.size.h/2)*1.5,w=a.size.w,h=a.size.h*1.5;
  const clip=`slot-${index}-rim-${i}`;
  const points=a.front===undefined?'':planterPolygon(a.front).map(([px,py])=>`${x+px*w},${y+py*h}`).join(' ');
  return `${points?`<defs><clipPath id="${clip}"><polygon points="${points}"/></clipPath></defs>`:''}<g${points?` clip-path="url(#${clip})"`:''}><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${g.box}" preserveAspectRatio="none"><image href="${a.path}" width="${g.w}" height="${g.h}"/></svg></g>`;
 }));
 return `<svg viewBox="0 30 100 105" aria-hidden="true">${body.join('')}</svg>`;
}
