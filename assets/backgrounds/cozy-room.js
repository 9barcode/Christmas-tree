/* Background motion only. Returns cleanup; no network, no app state or rewards. */
export function startCozySnow(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  canvas.width = 1024; canvas.height = 1536;
  // Visible glass panes, excluding curtains and wooden mullions, in background pixels.
  const panes = [
    [[816,260],[894,260],[894,369],[809,369]],
    [[914,260],[989,260],[997,369],[914,369]],
    [[807,387],[894,387],[894,503],[795,503]],
    [[914,387],[997,387],[1007,503],[914,503]],
    [[794,523],[894,523],[894,666],[786,666]],
    [[915,523],[1008,523],[1017,666],[915,666]],
    [[789,688],[895,688],[895,814],[797,814]],
    [[916,688],[1017,688],[1016,814],[916,814]],
  ];
  const flakes = Array.from({length:44},(_,i)=>({
    x:775+(i*79)%260,y:250+(i*113)%580,
    radius:1.4+(i%5)*.55,speed:18+(i%5)*4,phase:i*1.7
  }));
  let raf=0,last=0,elapsed=0,disposed=false;
  function frame(now){
    if(disposed || document.hidden || reduced.matches){last=0;return;}
    const dt=last?Math.min((now-last)/1000,.06):0;last=now;elapsed+=dt;
    ctx.clearRect(0,0,1024,1536);ctx.save();ctx.beginPath();
    for(const points of panes){ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();}
    ctx.clip();
    for(const f of flakes){
      f.y+=f.speed*dt;if(f.y>825)f.y=245;
      ctx.beginPath();ctx.arc(f.x+Math.sin(elapsed*.4+f.phase)*9,f.y,f.radius,0,Math.PI*2);
      ctx.fillStyle='rgba(245,249,255,.78)';ctx.fill();
    }
    ctx.restore();raf=requestAnimationFrame(frame);
  }
  function restart(){cancelAnimationFrame(raf);last=0;ctx.clearRect(0,0,1024,1536);if(!document.hidden&&!reduced.matches&&!disposed)raf=requestAnimationFrame(frame);}
  document.addEventListener('visibilitychange',restart);reduced.addEventListener('change',restart);restart();
  return ()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',restart);reduced.removeEventListener('change',restart);ctx.clearRect(0,0,1024,1536);};
}
