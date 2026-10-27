import {request,ensureMissionSession} from './mission-client.js';
import {clientError} from './client-errors.js';
const messages={item_placed:'트리에 배치된 장식은 판매 목록에서 제외돼요.',collection_incomplete:'도감 장식 30종을 모두 모아야 트리를 판매할 수 있어요.',tree_not_ready:'서로 다른 장식 30개를 트리에 배치해 주세요.',tree_sale_daily_limit:'오늘 트리 판매 보상은 5회까지 받았어요. 내일 다시 도전해 주세요.',duplicate_decoration:'같은 장식은 트리에 하나만 놓을 수 있어요.',exchange_empty:'교환할 벨이 없어요.',ad_in_progress:'광고가 이미 진행 중이에요. 잠시 후 다시 시도해 주세요.',catalog_not_configured:'공장 생산 준비 중이에요. 장식 가격·확률 설정을 기다리고 있어요.',daily_limit:'오늘 생산 기회를 모두 사용했거나 광고가 진행 중이에요.',ad_not_configured:'광고 연결을 준비하고 있어요.',exchange_not_configured:'포인트 교환을 준비하고 있어요.',tree_sale_not_configured:'트리 판매 포인트 지급 설정을 준비하고 있어요.',payment_in_progress:'포인트 지급 결과를 확인 중이에요. 잠시 후 다시 확인해 주세요.',positions_conflict:'다른 화면에서 배치가 바뀌었어요. 최신 상태를 불러올게요.',request_expired:'광고 요청이 만료됐어요. 다시 시도해 주세요.'};
export async function factoryCall(path,body){try{return await request('/api/v3/'+path,body);}catch(e){throw clientError(e,messages);}}
async function journalKey(){return 'tree.factory.pending.'+(await ensureMissionSession()).userId;}
export async function recoverFactoryAd(){
 const key=await journalKey();let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{localStorage.removeItem(key);return null;}
 if(!saved)return null;
 if(!saved.proof){if(saved.expiresAt>Date.now())throw Error('광고가 진행 중이에요. 잠시 후 다시 확인해 주세요.');await factoryCall('ads/cancel',{requestId:saved.requestId});localStorage.removeItem(key);return null;}
 try{const result=await factoryCall('ads/complete',saved.proof);localStorage.removeItem(key);return result;}catch(e){if(['request_expired','request_not_found','ad_not_completed'].includes(e.code))localStorage.removeItem(key);throw e;}
}
export async function factoryAd(purpose,details={}){
 await recoverFactoryAd();const r=await factoryCall('ads/reserve',{purpose,...details}),key=await journalKey();let proof;
 try{
 localStorage.setItem(key,JSON.stringify(r));
 const {showNativeRewarded,showNativeInterstitial}=await import('./native-promotions.js');
 const showAd=['sell','tree-sale','produce'].includes(purpose)?showNativeInterstitial:showNativeRewarded;
 proof={requestId:r.requestId,...await showAd({adGroupId:r.adGroupId})};
 localStorage.setItem(key,JSON.stringify({...r,proof}));
 const result=await factoryCall('ads/complete',proof);localStorage.removeItem(key);return result;
 }catch(e){if(!proof){try{await factoryCall('ads/cancel',{requestId:r.requestId});localStorage.removeItem(key);}catch{/* Recover by expiration. */}}throw e;}
}
