// Object centers and sizes use percentages of the fixed room scene, independent of viewport.
export const OBJECT_SIZES={tree:{w:74.8,h:47.3},pot:{w:26,h:11.9},floor:{w:14,h:9},ornament:{w:7,h:6},lights:{w:72.6,h:46.2},topper:{w:13.2,h:6.6}};
export const FLOOR_SIZE=OBJECT_SIZES.floor,ORNAMENT_SIZE=OBJECT_SIZES.ornament;
export const ROOM_BOUNDS={left:1,right:99,top:22,bottom:77.5};
export const POT_BOUNDS={...ROOM_BOUNDS,bottom:81};
export const FLOOR_BOUNDS={...ROOM_BOUNDS,bottom:90};
export const BASE_OBJECTS=[{id:'__pot',kind:'pot'}];
export function clampPosition(kind,x,y,hasTopper=false){const s=OBJECT_SIZES[kind];if(!s||!Number.isFinite(x)||!Number.isFinite(y))return null;const area=kind==='floor'?FLOOR_BOUNDS:kind==='pot'?POT_BOUNDS:ROOM_BOUNDS;return {x:Math.max(area.left+s.w/2,Math.min(area.right-s.w/2,x)),y:Math.max(area.top+(kind==='tree'&&hasTopper?23.5:s.h/2),Math.min(area.bottom-s.h/2,y))};}
export function canPlace(kind,x,y){const p=clampPosition(kind,x,y);return !!p&&Math.abs(p.x-x)<1e-8&&Math.abs(p.y-y)<1e-8;}
export function sanitizePositions(positions,assets,count){const clean={};if(!positions||typeof positions!=='object')return clean;for(const a of [...BASE_OBJECTS,...assets.slice(0,count).filter(a=>!['tree','lights','topper'].includes(a.kind))]){let p=positions[a.id];if(a.id==='__pot'&&p?.x===50&&Math.abs(p.y-70.95)<.001)p=defaultPosition('pot');const bounded=p&&clampPosition(a.kind,p.x,p.y,count===30);if(bounded)clean[a.id]=bounded;}return clean;}
export function placeDecoration(tree,assets,id,x,y){const a=[...BASE_OBJECTS,...assets.slice(0,tree.count)].find(a=>a.id===id);if(!a||['tree','lights','topper'].includes(a.kind)||!canPlace(a.kind,x,y))return false;tree.positions??={};tree.positions[id]={x,y};return true;}
export function defaultPosition(kind,index=0){if(kind==='tree')return {x:50,y:48.5};if(kind==='pot')return {x:50,y:73.95};if(kind==='lights')return {x:50,y:49.05};if(kind==='topper')return {x:50,y:26.8};if(kind==='floor')return [{x:23,y:69},{x:30,y:72},{x:70,y:70},{x:81,y:72},{x:18,y:72},{x:76,y:69}][index%6];if(kind==='ornament'){const points=[];for(const [y,xs] of [[38,[46,54]],[44,[38,46,54,62]],[50,[34,42,50,58,66]],[56,[30,38,46,54,62,70]],[62,[26,34,42,50,58]]])for(const x of xs)points.push({x,y});const p=points[index%points.length];return {x:50+(p.x-50)*1.1,y:48.5+(p.y-45.5)*1.1}};return null;}

// Floor depth follows the bottom edge touching the room floor, not asset order.
export function floorDepth(kind,y){const size=OBJECT_SIZES[kind];if(!['floor','pot'].includes(kind)||!Number.isFinite(y))return null;return Math.round((y+size.h/2)*100)+10;}
