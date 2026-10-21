import {missionConfig} from './config.js';
import {advanceMissionPayment} from './mission-payments.js';

const sha256=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
const kstDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const yesterday=date=>new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
export async function bodyOf(request) {
  const text=await request.text();
  if(text.length>4096)throw Error('invalid_request');
  try{return JSON.parse(text)}catch{throw Error('invalid_request')}
}
export function headers(request,env) {
  const result={'Cache-Control':'no-store','Vary':'Origin'};
  const app=(env.TOSS_APP_NAME||'christmas-tree-decorating').trim();
  const allowed=new Set(['http://localhost:4173',...['apps','private-apps','web','private-web'].map(kind=>'https://'+app+'.'+kind+'.tossmini.com'),
    ...(env.ALLOWED_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean)]);
  const origin=request.headers.get('Origin');
  if(origin && !allowed.has(origin))return null;
  if(origin)Object.assign(result,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type, authorization'});
  return result;
}
export async function currentUser(request,env) {
  const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  if(!token)return null;
  return env.DB.prepare('SELECT u.id,u.toss_user_key FROM tree_sessions s JOIN tree_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(await sha256(token),new Date().toISOString()).first();
}
async function login(request,env) {
  if(!env.TOSS_MTLS)throw Error('toss_mtls_not_configured');
  const body=await bodyOf(request);
  if(typeof body.hash!=='string'||! /^[a-zA-Z0-9_+\/=-]{16,256}$/.test(body.hash))throw Error('invalid_hash');
  const response=await env.TOSS_MTLS.fetch('https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/users/anon-key/verify',{
    method:'POST',headers:{'content-type':'application/json','x-anon-key':body.hash},signal:AbortSignal.timeout(10000),
  });
  const payload=await response.json();
  if(!response.ok||payload.resultType!=='SUCCESS'||![true,'true'].includes(payload.success))throw Error('invalid_hash');
  const key='anon:'+body.hash;
  await env.DB.prepare('INSERT INTO tree_users(id,toss_user_key) VALUES(?,?) ON CONFLICT(toss_user_key) DO NOTHING').bind(crypto.randomUUID(),key).run();
  const user=await env.DB.prepare('SELECT id FROM tree_users WHERE toss_user_key = ?').bind(key).first();
  const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
  const expiresAt=new Date(Date.now()+7*86400000).toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM tree_sessions WHERE user_id = ? AND expires_at <= ?').bind(user.id,new Date().toISOString()),
    env.DB.prepare('INSERT INTO tree_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(token),user.id,expiresAt),
  ]);
  return {token,expiresAt,userId:user.id};
}
async function claim(env,user,day) {
  if(![15,30].includes(day))throw Error('invalid_day');
  const mission=await env.DB.prepare('SELECT * FROM tree_promotion_missions WHERE user_id = ? AND day = ?').bind(user.id,day).first();
  if(!mission)throw Error('mission_not_earned');
  // Always resume an existing payment before reading changed settings.
  let payment=await env.DB.prepare("SELECT * FROM tree_mission_payments WHERE user_id = ? AND day = ? AND state NOT IN ('succeeded','failed') ORDER BY created_at LIMIT 1").bind(user.id,day).first();
  if(payment)return advanceMissionPayment(env,user,payment.id);
  // Repair any interrupted finalization before attempting another payment.
  const success=await env.DB.prepare("SELECT * FROM tree_mission_payments WHERE user_id = ? AND day = ? AND state = 'succeeded'").bind(user.id,day).all();
  for(const saved of success.results)await advanceMissionPayment(env,user,saved.id);
  const updated=await env.DB.prepare('SELECT * FROM tree_promotion_missions WHERE user_id = ? AND day = ?').bind(user.id,day).first();
  const config=missionConfig(env,day);
  if(updated.paid_at||(config.mode==='test'&&updated.tested_at))return {state:'succeeded',mode:updated.paid_at?'live':'test'};
  if(!env.TOSS_MTLS||!config.code)throw Error('mission_not_configured');
  const now=Date.now(), id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO tree_mission_payments(id,user_id,day,mode,promotion_code,amount,state,created_at,updated_at) VALUES(?,?,?,?,?,?,'creating',?,?) ON CONFLICT DO NOTHING")
    .bind(id,user.id,day,config.mode,config.code,mission.amount,now,now).run();
  payment=await env.DB.prepare("SELECT * FROM tree_mission_payments WHERE user_id = ? AND day = ? AND mode = ? AND state <> 'failed'").bind(user.id,day,config.mode).first();
  return advanceMissionPayment(env,user,payment.id);
}
async function recover(env,user) {
  const rows=await env.DB.prepare('SELECT day FROM tree_promotion_missions WHERE user_id = ? AND paid_at IS NULL ORDER BY day').bind(user.id).all();
  for(const row of rows.results) {
    try{await claim(env,user,row.day)}catch{console.warn('[tree.promotion]',{day:row.day,event:'recovery_pending'})}
  }
}
async function missionView(env,user) {
  const rows=await env.DB.prepare('SELECT day,amount,paid_at,tested_at FROM tree_promotion_missions WHERE user_id = ? ORDER BY day').bind(user.id).all();
  return {missions:rows.results.map(row=>({day:row.day,amount:row.amount,status:row.paid_at?'paid':'earned',tested:!!row.tested_at}))};
}
async function attendance(request,env,user,context) {
  const body=await bodyOf(request), slot=body.treeId;
  if(!Number.isInteger(slot)||slot<1||slot>5)throw Error('invalid_tree');
  const adId=String(env.REWARDED_AD_GROUP_ID||'').trim();
  if(!adId||body.adGroupId!==adId||body.eventType!=='userEarnedReward')throw Error('reward_not_recognized');
  const date=kstDate(), marker=crypto.randomUUID(), previous=yesterday(date);
  // Date and counts are server-derived, never accepted from client local storage.
  const result=await env.DB.batch([
    // Each slot can be started independently; a verified ad is still required above.
    env.DB.prepare('INSERT INTO tree_mission_progress(user_id,slot) VALUES(?,?) ON CONFLICT DO NOTHING')
      .bind(user.id,slot),
    env.DB.prepare('UPDATE tree_mission_progress SET completed = CASE WHEN last_date = ? OR last_date IS NULL THEN completed+1 ELSE 1 END,last_date = ?,request_id = ? WHERE user_id = ? AND slot = ? AND completed < 30 AND (last_date IS NULL OR last_date < ?)')
      .bind(previous,date,marker,user.id,slot,date),
    ...[15,30].map(day=>env.DB.prepare('INSERT INTO tree_promotion_missions(user_id,day,amount,earned_at) SELECT user_id,?,?,? FROM tree_mission_progress WHERE user_id = ? AND slot = ? AND request_id = ? AND completed = ? ON CONFLICT(user_id,day) DO NOTHING')
      .bind(day,missionConfig(env,day).amount,Date.now(),user.id,slot,marker,day)),
  ]);
  const progress=await env.DB.prepare('SELECT slot,completed,last_date FROM tree_mission_progress WHERE user_id = ? AND slot = ?').bind(user.id,slot).first();
  if(!progress)throw Error('tree_locked');
  if(result[1]?.meta?.changes===1||progress.last_date===date) {
    const work=recover(env,user);
    if(context)context.waitUntil(work);else await work;
  }
  return {recorded:result[1]?.meta?.changes===1,progress};
}
export async function handleMissions(request,env,context) {
  const path=new URL(request.url).pathname;
  if(!['/api/auth/anonymous','/api/attendance','/api/promotions','/api/promotions/recover','/api/promotions/claim'].includes(path))return null;
  const cors=headers(request,env);
  if(!cors)return Response.json({error:'origin_not_allowed'},{status:403});
  const reply=(body,status=200)=>Response.json(body,{status,headers:cors});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!==(path==='/api/promotions'?'GET':'POST'))return reply({error:'method_not_allowed'},405);
  try {
    if(path==='/api/auth/anonymous')return reply(await login(request,env));
    const user=await currentUser(request,env);
    if(!user||!user.toss_user_key.startsWith('anon:'))return reply({error:'unauthorized'},401);
    if(path==='/api/attendance')return reply(await attendance(request,env,user,context));
    if(path==='/api/promotions/recover'){await recover(env,user);return reply(await missionView(env,user))}
    if(path==='/api/promotions/claim'){const body=await bodyOf(request);const payment=await claim(env,user,body.day);return reply({state:payment.state,mode:payment.mode})}
    return reply(await missionView(env,user));
  } catch(error) {
    const allowed=['invalid_request','invalid_hash','invalid_day','invalid_tree','reward_not_recognized','tree_locked','mission_not_earned','mission_not_configured','toss_mtls_not_configured'];
    const code=allowed.includes(error.message)?error.message:'promotion_unavailable';
    console.warn('[tree.mission]',{path,code});
    return reply({error:code,message:'프로모션 연결 상태를 확인해 주세요. 지급 기록은 보관됩니다.'},['invalid_request','invalid_day','invalid_tree'].includes(code)?400:code==='invalid_hash'?401:503);
  }
}
