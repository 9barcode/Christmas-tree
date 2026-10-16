// Animate the painted fire itself: no differently coloured flame sprite.
export async function startCozyFire(canvas,image){
 const ctx=canvas.getContext('2d');if(!ctx)return ()=>{};
 const x=0,y=780,w=174,h=200;
 canvas.width=w;canvas.height=h;
 await image.decode();
 const source=document.createElement('canvas');source.width=w;source.height=h;
 const sc=source.getContext('2d',{willReadFrequently:true});sc.drawImage(image,x,y,w,h,0,0,w,h);
 const mask=document.createElement('canvas');mask.width=w;mask.height=h;
 const mc=mask.getContext('2d'),pixels=sc.getImageData(0,0,w,h);
 const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
 for(let py=0;py<h;py++)for(let px=0;px<w;px++){
  const i=(py*w+px)*4,r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
  // Keep brick mortar, the diagonal log and the front log completely still.
  const logEdge=px<76?151-px*.58:107+(px-76)*.3;
  const warm=smooth(25,80,r-g)*smooth(24,85,g)* (1-smooth(.65,.95,b/Math.max(g,1)));
  const flame=warm*smooth(18,55,py)*(1-smooth(logEdge-12,logEdge,py))*(1-smooth(132,165,px));
  const ember=warm*smooth(165,180,py)*(1-smooth(187,198,py))*.22;
  pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;pixels.data[i+3]=Math.round(Math.max(flame,ember)*255);
 }
 mc.putImageData(pixels,0,0);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let raf=0,last=0,time=0,disposed=false;
 function frame(now){
  if(disposed||document.hidden||reduced.matches){ctx.clearRect(0,0,w,h);last=0;return;}
  if(last&&now-last<33){raf=requestAnimationFrame(frame);return;}
  time+=last?Math.min((now-last)/1000,.08):0;last=now;ctx.clearRect(0,0,w,h);
  // Narrow columns travel upwards independently; several incommensurate waves
  // avoid a synchronized breathing loop. Roots stay anchored at the coals.
  for(let px=0;px<w;px+=2){
   const wave=Math.sin(time*3.7+px*.087)*.55+Math.sin(time*6.13-px*.12)*.3+Math.sin(time*1.79+px*.19)*.15;
   const lift=wave*4.2,sway=Math.sin(time*4.3+px*.06)*.8;
   ctx.drawImage(source,px,0,2,160,px+sway,lift,2,160-lift);
  }
  ctx.globalAlpha=.91+Math.sin(time*5.3)*.035+Math.sin(time*8.17)*.025;
  ctx.drawImage(source,0,160,w,40,0,160,w,40);ctx.globalAlpha=1;
  ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';
  raf=requestAnimationFrame(frame);
 }
 function restart(){cancelAnimationFrame(raf);last=0;ctx.clearRect(0,0,w,h);if(!disposed&&!document.hidden&&!reduced.matches)raf=requestAnimationFrame(frame)}
 document.addEventListener('visibilitychange',restart);reduced.addEventListener('change',restart);restart();
 return ()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',restart);reduced.removeEventListener('change',restart);ctx.clearRect(0,0,w,h)};
}
