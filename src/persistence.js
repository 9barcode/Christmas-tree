// Keep unsaved state in memory; never discard a completed rewarded attendance.
export function createPersistence({storage,key,onFailure=()=>{},onRecovered=()=>{}}){
 let pending=null;
 function retry(){
  if(pending===null)return true;
  try{storage.setItem(key,pending);pending=null;onRecovered();return true}catch{return false}
 }
 return {
  get pending(){return pending!==null},
  save(value){
   const wasPending=pending!==null;pending=JSON.stringify(value);
   try{storage.setItem(key,pending);pending=null;if(wasPending)onRecovered();return true}
   catch{if(!wasPending)onFailure();return false}
  },retry
 };
}
