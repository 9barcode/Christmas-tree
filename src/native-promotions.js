import {User,loadFullScreenAd,showFullScreenAd} from '@apps-in-toss/web-framework';
export async function anonymousHash(){
 const key=await User.getAnonymousKey();
 if(key?.type!=='HASH'||typeof key.hash!=='string'||!key.hash)throw Error('토스 앱에서 사용자 정보를 확인해 주세요.');
 return key.hash;
}
const prepared=new Map();
let active=false;
export function preloadNativeAd(adGroupId){
 if(!adGroupId||!loadFullScreenAd.isSupported()||!showFullScreenAd.isSupported())return Promise.reject(Error('광고 설정과 토스 앱 버전을 확인해 주세요.'));
 const cached=prepared.get(adGroupId);
 if(cached&&Date.now()-cached.createdAt<45*60000)return cached.promise;
 cached?.stop();
 const entry={createdAt:Date.now(),stop:()=>{}};
 prepared.set(adGroupId,entry);
 entry.promise=new Promise((resolve,reject)=>{
  let done=false;
  const timer=setTimeout(()=>finish(Error('광고 준비 시간이 초과됐어요. 다시 눌러 주세요.')),30000);
  function finish(error){
   if(done)return;done=true;clearTimeout(timer);entry.stop();
   if(error){if(prepared.get(adGroupId)===entry)prepared.delete(adGroupId);reject(error);}else resolve();
  }
  try{
   entry.stop=loadFullScreenAd({options:{adGroupId},onError:()=>finish(Error('광고를 불러오지 못했어요. 다시 눌러 주세요.')),onEvent:event=>{if(event.type==='loaded')finish();}});
   if(done)entry.stop();
  }catch{finish(Error('광고를 불러오지 못했어요.'));}
 });
 return entry.promise;
}
async function showAd(adGroupId,rewarded){
 if(active)throw Error('광고가 이미 진행 중이에요.');
 active=true;
 try{
  await preloadNativeAd(adGroupId);prepared.delete(adGroupId);
  return await new Promise((resolve,reject)=>{
   let ended=false,earned=false,displayed=false,stopShow=()=>{};
   let timer=setTimeout(()=>finish(Error('광고가 시작되지 않았어요.')),30000);
   function finish(error){
    if(ended)return;ended=true;clearTimeout(timer);stopShow();
    if(error){reject(error);return;}
    if(!displayed||(rewarded&&!earned)){reject(Error(rewarded?'보상형 광고 시청을 완료해 주세요.':'광고 표시를 확인하지 못했어요.'));return;}
    const result={adGroupId,displayed:true,dismissed:true,eventType:rewarded?'userEarnedReward':'dismissed'};
    if(rewarded)result.rewarded=true;
    resolve(result);
   }
   try{
    stopShow=showFullScreenAd({options:{adGroupId},onError:()=>finish(Error('광고를 표시하지 못했어요.')),onEvent:event=>{
     if(ended)return;
     if(['show','impression'].includes(event.type)){displayed=true;clearTimeout(timer);timer=setTimeout(()=>finish(Error('광고 종료를 확인하지 못했어요.')),5*60000);}
     else if(event.type==='userEarnedReward')earned=true;
     else if(event.type==='dismissed')finish();
     else if(event.type==='failedToShow')finish(Error('광고를 표시하지 못했어요.'));
    }});
    if(ended)stopShow();
   }catch{finish(Error('광고를 표시하지 못했어요.'));}
  });
 }finally{
  active=false;
  preloadNativeAd(adGroupId).catch(()=>{});
 }
}
export const showNativeRewarded=({adGroupId})=>showAd(adGroupId,true);
export const showNativeInterstitial=({adGroupId})=>showAd(adGroupId,false);
