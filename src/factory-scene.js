// Keep the approved painting: animate its painted surfaces, not replacement art.
const TOP=250,HEIGHT=270;
const beltWindows=[
 [[0,466],[97,440],[97,456],[0,483]],
 [[166,421],[210,409],[210,424],[171,435]],
 [[335,375],[388,361],[390,375],[335,390]],
];

export function startFactoryScene(canvas,image,isStopped,isProducing){
 const ctx=canvas.getContext('2d'),motion=matchMedia('(prefers-reduced-motion: reduce)');
 canvas.width=512;canvas.height=HEIGHT;canvas.hidden=true;
 let frame=0,disposed=false,ready=false,last=-Infinity,started=null;
 const polygon=points=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y-TOP):ctx.moveTo(x,y-TOP));ctx.closePath();ctx.clip();};

 // Inverse-warp scanlines inside the silhouette. The boundary stays anchored,
 // so there are no duplicate hats/hands or exposed holes behind the characters.
 function santa(points,[x,y,w,h],phase,amount){
  ctx.save();polygon(points);
  for(let row=0;row<h;row++){
   const envelope=Math.sin(Math.PI*row/h)**2;
   const nod=Math.sin(phase+row/h*.9)*amount*envelope;
   const gesture=Math.sin(phase*1.6+row/h*3)*amount*.55*envelope;
   ctx.drawImage(image,x,y+row+nod,w,1,x+gesture,y+row-TOP,w,1);
  }
  ctx.restore();
 }

 function conveyor(elapsed){
  // Travel continuously down-left along the belt, never oscillate backwards.
  const offset=(elapsed*.065)%40;
  for(const points of beltWindows){
   ctx.save();polygon(points);
   // Blend moving joints with the original wood grain and painted lighting.
   ctx.fillStyle='#b98543';ctx.globalAlpha=.3;ctx.fillRect(0,110,400,140);
   ctx.globalAlpha=.85;
   for(let x=-40+offset;x<440;x+=40){
    const px=400-x,py=366+x*.275;
    ctx.beginPath();ctx.moveTo(px,py-TOP);ctx.lineTo(px+16,py+14-TOP);
    ctx.strokeStyle='#62401f';ctx.lineWidth=2.2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(px+2,py-TOP);ctx.lineTo(px+18,py+14-TOP);
    ctx.strokeStyle='#edbd73';ctx.lineWidth=1;ctx.stroke();
   }
   ctx.restore();
  }
  // Rotate the actual painted roller faces, including their highlight and hub.
  for(const [x,y,rx,ry] of [[98,510,14,18],[169,488,14,19],[238,464,12,17],[355,429,9,13]]){
   ctx.save();ctx.beginPath();ctx.ellipse(x,y-TOP,rx,ry,0,0,Math.PI*2);ctx.clip();
   ctx.translate(x,y-TOP);ctx.scale(rx,ry);ctx.rotate(-elapsed/260);
   ctx.drawImage(image,x-rx,y-ry,rx*2,ry*2,-1,-1,2,2);ctx.restore();
  }
 }

 function draw(time){
  frame=0;if(disposed)return;
  const producing=isProducing();
  const visible=!document.hidden&&document.body.dataset.page==='factory';
  // Production wins over the daily-limit state on the very last item.
  if(!ready||!visible||motion.matches||(!producing&&isStopped())){canvas.hidden=true;started=null;return;}
  if(!producing){canvas.hidden=true;started=null;return;}
  if(started===null)started=time;
  if(time-last>=1000/30){
   last=time;const elapsed=time-started;canvas.hidden=false;
   ctx.clearRect(0,0,512,HEIGHT);ctx.drawImage(image,0,TOP,512,HEIGHT,0,0,512,HEIGHT);
   conveyor(elapsed);
   santa([[347,444],[359,412],[393,390],[412,363],[461,355],[504,376],[504,511],[390,511]], [340,350,165,162],elapsed/180,4.5);
   santa([[90,374],[98,302],[112,275],[146,260],[175,281],[184,329],[193,378]], [87,258,110,124],elapsed/210+.8,3.5);
   ctx.save();ctx.globalAlpha=.09+.06*Math.sin(elapsed/140);ctx.fillStyle='#fff0a6';
   ctx.shadowColor='#ffd76a';ctx.shadowBlur=18;ctx.beginPath();ctx.ellipse(268,352-TOP,59,60,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  frame=requestAnimationFrame(draw);
 }
 function restart(){cancelAnimationFrame(frame);frame=0;last=-Infinity;if(!disposed&&ready)frame=requestAnimationFrame(draw);}
 // renderFactory adds producing after the response/render. Wake a stopped loop
 // then (including item 10/20), and stop as soon as the animation is skipped.
 const observer=new MutationObserver(restart);
 observer.observe(canvas.parentElement,{attributes:true,attributeFilter:['class']});
 image.decode().then(()=>{if(disposed)return;ready=true;restart();}).catch(()=>{canvas.hidden=true;});
 document.addEventListener('visibilitychange',restart);motion.addEventListener('change',restart);
 return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();canvas.hidden=true;document.removeEventListener('visibilitychange',restart);motion.removeEventListener('change',restart);};
}
