import {User, loadFullScreenAd, showFullScreenAd} from '@apps-in-toss/web-framework';

const API_BASE = 'https://treemoa.bluehawhy.workers.dev';
const REWARD_AD_GROUP_ID = __TREE_REWARD_AD_GROUP_ID__;

async function getAnonymousHash() {
  const value = await User.getAnonymousKey();
  if (typeof value === 'string') return value;
  if (value && typeof value.hash === 'string') return value.hash;
  throw new Error('토스 사용자 인증값을 받지 못했어요.');
}
async function request(path, token, body) {
  const response = await fetch(API_BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {'content-type':'application/json', ...(token ? {authorization:'Bearer '+token} : {})},
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(()=>null);
  if (!response.ok) throw new Error(payload?.message || '트리 정보를 불러오지 못했어요. (' + (payload?.error || response.status) + ')');
  return payload;
}
function rewardedAd() {
  if (!REWARD_AD_GROUP_ID) return Promise.reject(new Error('토스 콘솔의 트리모아 보상 광고 그룹 ID를 설정해야 해요.'));
  if (!loadFullScreenAd.isSupported() || !showFullScreenAd.isSupported())
    return Promise.reject(new Error('토스 앱에서 보상 광고를 시청할 수 있어요.'));
  return new Promise((resolve,reject)=>{
    let done=false, loaded=false, earned=false, stopLoad=()=>{}, stopShow=()=>{};
    let timer=setTimeout(()=>finish(new Error('광고 준비 시간이 초과됐어요. 다시 시도해 주세요.')),30000);
    function finish(error) {
      if(done)return; done=true; clearTimeout(timer); stopLoad(); stopShow();
      if(error)reject(error); else resolve({rewarded:true,adGroupId:REWARD_AD_GROUP_ID,eventType:'userEarnedReward'});
    }
    const fail=()=>finish(new Error('광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
    try {
      stopLoad=loadFullScreenAd({options:{adGroupId:REWARD_AD_GROUP_ID},onError:fail,onEvent:event=>{
        if(done||loaded||event.type!=='loaded')return;
        loaded=true;clearTimeout(timer);
        try {
          stopShow=showFullScreenAd({options:{adGroupId:REWARD_AD_GROUP_ID},onError:fail,onEvent:event=>{
            if(done)return;
            if(event.type==='show'||event.type==='impression')clearTimeout(timer);
            else if(event.type==='userEarnedReward'&&!earned){earned=true;clearTimeout(timer);}
            else if(event.type==='dismissed')finish(earned?undefined:new Error('광고를 끝까지 시청해야 출석할 수 있어요.'));
            else if(event.type==='failedToShow')fail();
          }});
        } catch { fail(); }
      }});
    } catch { fail(); }
  });
}
export async function initializeTreemoa() {
  const hash=await getAnonymousHash();
  const session=await request('/api/auth/anonymous',null,{hash});
  const api={
    getState:()=>request('/api/trees',session.token),
    attend:({slot,cycle,ad})=>{
      if(ad?.rewarded!==true) throw new Error('광고 시청을 완료해야 출석할 수 있어요.');
      return request('/api/trees/attendance',session.token,{slot,cycle,adGroupId:ad.adGroupId,eventType:ad.eventType});
    },
    savePositions:({slot,cycle,positions})=>request('/api/trees/positions',session.token,{slot,cycle,positions}),
    getPromotions:()=>request('/api/promotions',session.token),
  };
  window.treemoaApi=api;
  window.treeAds={showRewarded:rewardedAd};
  const initial=await api.getState();
  return {api,state:initial.state,session};
}
