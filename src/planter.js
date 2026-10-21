// The front lip follows the painted oval opening instead of a horizontal cut.
export const RIM_CURVE=[[0,.08],[.1,.13],[.25,.175],[.5,.19],[.75,.175],[.9,.13],[1,.08]];
export function planterPolygon(front){return [...RIM_CURVE,...(front?[[1,1],[0,1]]:[[1,0],[0,0]])];}
export function planterClipPath(front){return `polygon(${planterPolygon(front).map(([x,y])=>`${x*100}% ${y*100}%`).join(',')})`;}
export function clipPlanter(ctx,x,y,w,h,front){ctx.beginPath();planterPolygon(front).forEach(([px,py],i)=>ctx[i?'lineTo':'moveTo'](x+px*w,y+py*h));ctx.closePath();ctx.clip();}
