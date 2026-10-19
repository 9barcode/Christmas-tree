import {User,loadFullScreenAd,showFullScreenAd} from '@apps-in-toss/web-framework';
export async function anonymousHash() {
  const key=await User.getAnonymousKey();
  if(!key||typeof key==='string'||key.type!=='HASH'||!key.hash)throw Error('토스 앱에서 사용자 정보를 확인해 주세요.');
  return key.hash;
}
let active=false;
export function showNativeRewarded({adGroupId}) {
  if(active)return Promise.reject(Error('광고가 이미 진행 중이에요.'));
  if(!loadFullScreenAd.isSupported()||!showFullScreenAd.isSupported())return Promise.reject(Error('토스 앱에서 광고를 시청해 주세요.'));
  active=true;
  return new Promise((resolve,reject)=>{
    let ended=false,earned=false,loaded=false,stopLoad=()=>{},stopShow=()=>{};
    let timer=setTimeout(()=>finish(Error('광고 준비 시간이 초과됐어요.')),30000);
    function finish(error){
      if(ended)return;ended=true;clearTimeout(timer);stopLoad();stopShow();active=false;
      if(error)reject(error);else resolve({rewarded:earned,adGroupId,eventType:earned?'userEarnedReward':'dismissed'});
    }
    const fail=()=>finish(Error('광고를 불러오지 못했어요.'));
    try{
      stopLoad=loadFullScreenAd({options:{adGroupId},onError:fail,onEvent:event=>{
        if(ended||loaded||event.type!=='loaded')return;
        loaded=true;clearTimeout(timer);stopLoad();
        timer=setTimeout(()=>finish(Error('광고가 시작되지 않았어요.')),30000);
        try{
          stopShow=showFullScreenAd({options:{adGroupId},onError:fail,onEvent:event=>{
            if(ended)return;
            if(['show','impression'].includes(event.type))clearTimeout(timer);
            if(event.type==='userEarnedReward'){
              earned=true;clearTimeout(timer);timer=setTimeout(()=>finish(),15000);
            }else if(event.type==='dismissed')finish();
            else if(event.type==='failedToShow')fail();
          }});
          if(ended)stopShow();
        }catch{fail()}
      }});
      if(ended||loaded)stopLoad();
    }catch{fail()}
  });
}
