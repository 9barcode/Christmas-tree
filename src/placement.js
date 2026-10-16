// Coordinates are percentages of the 2:3 home canvas, independent of screen size.
export const FLOOR_SIZE={w:14,h:9},ORNAMENT_SIZE={w:7,h:6};
const TREE=[[50,26],[56,34],[63,42],[72,52],[82,65],[18,65],[28,52],[37,42],[44,34]];
function inPolygon(x,y,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))inside=!inside}return inside;}
export function canPlace(kind,x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return false;const size=kind==='floor'?FLOOR_SIZE:ORNAMENT_SIZE;const left=x-size.w/2,right=x+size.w/2,top=y-size.h/2,bottom=y+size.h/2;if(kind==='floor'){return left>=10&&right<=90&&top>=64&&bottom<=77&&!(right>38&&left<62&&bottom>64.5&&top<75.5)}if(kind!=='ornament')return false;return [[left,top],[right,top],[left,bottom],[right,bottom]].every(([px,py])=>inPolygon(px,py,TREE));}
export function sanitizePositions(positions,assets,count){const clean={};if(!positions||typeof positions!=='object')return clean;for(const a of assets.slice(0,count)){const p=positions[a.id];if(p&&canPlace(a.kind,p.x,p.y))clean[a.id]={x:p.x,y:p.y}}return clean;}
export function placeDecoration(tree,assets,id,x,y){const a=assets.slice(0,tree.count).find(a=>a.id===id);if(!a||!canPlace(a.kind,x,y))return false;tree.positions??={};tree.positions[id]={x,y};return true;}
export function defaultPosition(kind,index){if(kind==='floor')return [{x:23,y:69},{x:30,y:72},{x:70,y:70},{x:81,y:72},{x:18,y:72},{x:76,y:69}][index];const points=[];for(const y of [38,44,50,56,62])for(const x of [26,34,42,50,58,66,74])if(canPlace('ornament',x,y))points.push({x,y});return points[index%points.length];}
export const TREE_OUTLINE=TREE.map(p=>p.join(',')).join(' ');
