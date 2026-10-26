import {apiBaseUrl} from './api-base.js';
import {readApiResponse} from './api-response.js';
let session, starting;
function reportApiEvent(path,method,status,durationMs){
  if(!session?.token||(!path.startsWith('/api/v2/')&&!path.startsWith('/api/v3/')))return;
  const base=apiBaseUrl.endsWith('/')?apiBaseUrl.slice(0,-1):apiBaseUrl;
  const endpoint=base+'/api/analytics/events';
  const body=JSON.stringify({endpoint:path,method,status,durationMs:Math.min(60000,Math.max(0,Math.round(durationMs)))});
  void fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.token},body,signal:AbortSignal.timeout(5000),credentials:'omit',keepalive:true}).catch(()=>{});
}
export async function request(path,body,authenticated=true) {
  if(authenticated)await ensureMissionSession();
  const method=body===undefined?'GET':'POST',started=performance.now();
  let response;
  try{
    const base=apiBaseUrl.endsWith('/')?apiBaseUrl.slice(0,-1):apiBaseUrl;
    response=await fetch(base+path,{
      method,headers:{'content-type':'application/json',...(authenticated?{authorization:'Bearer '+session.token}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000),credentials:'omit',
    });
  }catch(error){
    if(authenticated)reportApiEvent(path,method,0,performance.now()-started);
    throw error;
  }
  if(authenticated)reportApiEvent(path,method,response.status,performance.now()-started);
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
