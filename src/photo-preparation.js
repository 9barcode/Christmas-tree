// Retry a fresh preparation without closing the dialog or overlapping requests.
export function createPhotoPreparation({prepare,isCurrent=()=>true,onBusy=()=>{},onReady=()=>{},onError=()=>{}}){
 let pending=false;
 return async()=>{
  if(pending||!isCurrent())return;pending=true;onBusy();
  try{const photo=await prepare();if(isCurrent())onReady(photo);}
  catch(error){if(isCurrent())onError(error);}
  finally{pending=false;}
 };
}
