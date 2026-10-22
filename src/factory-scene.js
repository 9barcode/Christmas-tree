// Animate the approved painting itself: no regenerated characters or replacement belt.
// The original scene is restored on every frame, so motion never accumulates.
export function startFactoryScene(canvas,image,isStopped,isProducing){
 const ctx=canvas.getContext('2d'),motion=matchMedia('(prefers-reduced-motion: reduce)');
 canvas.width=512;canvas.height=270;
 let frame=0,disposed=false,last=0;
 const polygon=points=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y-250):ctx.moveTo(x,y-250));ctx.closePath();ctx.clip();};
 function patch(points,rect,dx,dy,scale=1){
  ctx.save();polygon(points);const [x,y,w,h]=rect;
  ctx.translate(x+w/2+dx,y-250+h/2+dy);ctx.scale(scale,scale);ctx.drawImage(image,x,y,w,h,-w/2,-h/2,w,h);ctx.restore();
 }
 function draw(time){
  frame=0;if(disposed)return;
  const visible=!document.hidden&&document.body.dataset.page==='factory';
  if(!visible||motion.matches||isStopped()){canvas.hidden=true;return;}
  if(time-last>=50){
   last=time;canvas.hidden=false;ctx.clearRect(0,0,512,270);ctx.drawImage(image,0,250,512,270,0,0,512,270);
   const pace=isProducing()?3:1,wave=Math.sin(time/1100*pace);
   // Tiny breathing and clipboard motion remain inside the original silhouettes.
   patch([[347,444],[359,412],[393,390],[412,363],[461,355],[504,376],[504,512],[390,511]], [340,350,165,170],0,wave*.65,1+wave*.002);
   patch([[90,374],[98,302],[112,275],[146,260],[175,281],[184,329],[193,378]], [87,258,110,127],0,-wave*.45,1+wave*.002);
   // Move only the belt surface; keep machinery, wheels and boxes in place.
   const delta=Math.sin(time/(isProducing()?110:700))*(isProducing()?2.5:.8);
   for(const points of [[[5,462],[94,438],[97,451],[5,477]],[[167,417],[207,406],[207,419],[171,430]]])patch(points,[0,390,335,120],delta,-delta*.24);
   if(isProducing()){
    ctx.save();ctx.globalAlpha=.16+.09*Math.sin(time/100);ctx.fillStyle='#fff0a6';ctx.shadowColor='#ffd76a';ctx.shadowBlur=18;ctx.beginPath();ctx.ellipse(268,352-250,59,60,0,0,Math.PI*2);ctx.fill();ctx.restore();
   }
  }
  frame=requestAnimationFrame(draw);
 }
 function restart(){cancelAnimationFrame(frame);frame=0;if(!disposed)frame=requestAnimationFrame(draw);}
 image.decode().then(restart).catch(()=>{canvas.hidden=true;});
 document.addEventListener('visibilitychange',restart);motion.addEventListener('change',restart);
 return ()=>{disposed=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',restart);motion.removeEventListener('change',restart);};
}
