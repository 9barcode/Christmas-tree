import {apiBaseUrl} from './api-base.js';
import {readApiResponse} from './api-response.js';
let session, starting;
export async function request(path,body,authenticated=true) {
  if(authenticated)await ensureMissionSession();
  const response=await fetch(apiBaseUrl.replace(/\/$/,'')+path,{
    method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(authenticated?{authorization:'Bearer '+session.token}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000),credentials:'omit',
  });
  if(response.status===401&&authenticated)session=undefined;
  const payload=await readApiResponse(response);
  if(!response.ok){const error=Error(payload.message||'서버 연결을 확인해 주세요.');error.code=payload.error;error.status=response.status;throw error;}
  return payload;
}
export async function ensureMissionSession(){
  if(session&&Date.parse(session.expiresAt)>Date.now()+60000)return session;
  if(!starting)starting=(async()=>{
    const {anonymousHash}=await import('./native-promotions.js');
    const hash=await anonymousHash();
    const value=await request('/api/auth/anonymous',{hash},false);
    if(typeof value.token!=='string'||typeof value.userId!=='string'||!Number.isFinite(Date.parse(value.expiresAt)))throw Error('사용자 인증을 확인해 주세요.');
    session=value;return session;
  })().finally(()=>{starting=undefined});
  return starting;
}
const kstDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function pendingKey(treeId){return 'tree.pending-attendance.'+session.userId+'.'+treeId}
async function submitPending(treeId){
  const key=pendingKey(treeId);
  const raw=localStorage.getItem(key);
  if(!raw)return false;
  let saved;try{saved=JSON.parse(raw)}catch{localStorage.removeItem(key);return false}
  if(saved.date!==kstDate()){localStorage.removeItem(key);return false}
  await request('/api/attendance',saved.body);
  localStorage.removeItem(key);
  return true;
}
export async function retryMissionAttendance(treeId){
  await ensureMissionSession();
  return submitPending(treeId);
}
export async function recordMissionAttendance(treeId,ad){
  await ensureMissionSession();
  if(ad?.rewarded!==true||ad.eventType!=='userEarnedReward'||!ad.adGroupId)throw Error('광고 시청 완료를 확인해 주세요.');
  const body={treeId,adGroupId:ad.adGroupId,eventType:'userEarnedReward'};
  localStorage.setItem(pendingKey(treeId),JSON.stringify({date:kstDate(),body}));
  await submitPending(treeId);
}
export async function recoverMissions(){return request('/api/promotions/recover',{})}
export async function loadMissions(){return request('/api/promotions')}
