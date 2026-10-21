import {request,ensureMissionSession} from './mission-client.js';
import {loadServiceConfig} from './service-config.js';
const messages={
 slot_unavailable:'트리 상태가 바뀌었어요. 새로 불러와 주세요.',tree_full:'장식 30개를 모두 모았어요.',
 credit_unavailable:'트리를 완성한 뒤 포인트를 교환할 수 있어요.',resume_payment:'교환을 확인 중이에요. 광고를 다시 보지 않고 결과를 확인해 주세요.',
 ad_not_configured:'광고 연결을 준비하고 있어요.',limit_or_request_pending:'오늘 장식을 모두 모았거나 다른 광고를 처리 중이에요. 트리 상태를 확인해 주세요.',
 request_expired:'광고 요청이 만료됐어요. 다시 시도해 주세요.',ad_not_completed:'광고 시청 완료를 확인해 주세요.',
 exchange_not_configured:'포인트 교환을 준비하고 있어요. 완성한 트리는 보관돼요.',positions_conflict:'다른 화면에서 배치가 바뀌었어요. 최신 배치를 불러왔어요.',
 unauthorized:'사용자 인증을 다시 확인해 주세요.',service_unavailable:'서버에 연결하지 못했어요. 잠시 후 다시 눌러 주세요.',
};
async function call(path,body){
 try{return await request('/api/v2'+path,body);}catch(error){error.message=messages[error.code]||error.message;throw error;}
}
export const loadBM=()=>call('/state');
export const recoverExchanges=()=>call('/exchanges/recover',{});
export const completeTree=slot=>call('/trees/complete',{slot});
export const savePositions=(slot,revision,positions)=>call('/trees/positions',{slot,revision,positions});
async function journalKey(){return 'tree.bm.pending.'+(await ensureMissionSession()).userId;}
const rejected=new Set(['request_not_found','request_expired','ad_not_completed','request_conflict']);
export async function recoverAd(){
 const key=await journalKey(),raw=localStorage.getItem(key);
 if(!raw)return;
 let saved;try{saved=JSON.parse(raw);}catch{localStorage.removeItem(key);return;}
 if(!saved.proof){
  // Another tab may still be showing this ad. Do not cancel its live reservation.
  if(saved.expiresAt>Date.now())throw Error('광고 요청이 진행 중이에요. 기존 화면을 확인하거나 잠시 후 다시 시도해 주세요.');
  await call('/ads/cancel',{requestId:saved.requestId});localStorage.removeItem(key);return;
 }
 try{await call('/ads/complete',saved.proof);localStorage.removeItem(key);}catch(error){if(rejected.has(error.code))localStorage.removeItem(key);throw error;}
}
export async function performAd(purpose,slot){
 await recoverAd();
 const reservation=await call('/ads/reserve',{purpose,slot}),key=await journalKey();
 let completed=false;
 try{
  localStorage.setItem(key,JSON.stringify({requestId:reservation.requestId,expiresAt:reservation.expiresAt}));
  const sdk=await import('./native-promotions.js');
  const result=await (purpose==='earn-decoration'?sdk.showNativeInterstitial:sdk.showNativeRewarded)({adGroupId:reservation.adGroupId});
  const proof={requestId:reservation.requestId,...result};
  localStorage.setItem(key,JSON.stringify({requestId:reservation.requestId,proof}));
  completed=true;
  await call('/ads/complete',proof);localStorage.removeItem(key);
 }catch(error){
  if(!completed){try{await call('/ads/cancel',{requestId:reservation.requestId});localStorage.removeItem(key);}catch{/* Recover on next launch. */}}
  else if(rejected.has(error.code))localStorage.removeItem(key);
  throw error;
 }
}
export async function preloadBMAds(){
 const [{ads},sdk]=await Promise.all([loadServiceConfig(),import('./native-promotions.js')]);
 await Promise.allSettled([ads.interstitialAdGroupId,ads.rewardedAdGroupId].filter(Boolean).map(id=>sdk.preloadNativeAd(id)));
}
