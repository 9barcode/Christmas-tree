
const sha256=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
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
export async function handleMissions(request,env) {
  const path=new URL(request.url).pathname;
  if(path!=='/api/auth/anonymous')return null;
  const cors=headers(request,env);
  if(!cors)return Response.json({error:'origin_not_allowed'},{status:403});
  const reply=(body,status=200)=>Response.json(body,{status,headers:cors});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
  try{return reply(await login(request,env))}
  catch(error) {
    const code=['invalid_request','invalid_hash','toss_mtls_not_configured'].includes(error.message)?error.message:'authentication_unavailable';
    console.warn('[tree.auth]',{path,code});
    return reply({error:code},code==='invalid_request'?400:code==='invalid_hash'?401:503);
  }
}
