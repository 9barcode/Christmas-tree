import {apiBaseUrl} from './api-base.js';
import {ensureMissionSession} from './mission-client.js';

async function request(path,body) {
  const session=await ensureMissionSession();
  const response=await fetch(apiBaseUrl.replace(/\/$/,'')+path,{
    method:body===undefined?'GET':'POST',
    headers:{'content-type':'application/json',authorization:'Bearer '+session.token},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(45000),
    credentials:'omit',
  });
  const payload=await response.json();
  if(!response.ok)throw Object.assign(Error(payload?.message||'트리 정보를 저장하지 못했어요.'),{code:payload?.error||'request_failed'});
  return payload;
}
export const loadBMState=()=>request('/api/v2/state');
export const reserveBMAd=(purpose,slot)=>request('/api/v2/ads/reserve',{purpose,slot});
export const completeBMAd=(requestId,ad)=>request('/api/v2/ads/complete',{
  requestId,adGroupId:ad.adGroupId,displayed:ad.displayed===true,dismissed:ad.dismissed===true,eventType:ad.eventType,
});
export const cancelBMAd=requestId=>request('/api/v2/ads/cancel',{requestId});
export const completeBMTtree=slot=>request('/api/v2/trees/complete',{slot});
export const recoverBMExchanges=()=>request('/api/v2/exchanges/recover',{});
