// A cached page is restored without rerunning its module. Recreate disposed effects.
export function pageEffects(start,{target=window,onError=console.error}={}){
 let generation=0,cleanup=null,active=false;
 function stop(){active=false;generation++;cleanup?.();cleanup=null;}
 async function resume(){
  if(active)return;active=true;const id=++generation;
  try{const dispose=await start();if(id!==generation){dispose?.();return;}cleanup=dispose;}
  catch(error){if(id===generation){active=false;onError(error);throw error;}}
 }
 target.addEventListener('pagehide',stop);
 target.addEventListener('pageshow',event=>{if(event.persisted)resume().catch(()=>{});});
 return {start:resume,stop};
}
