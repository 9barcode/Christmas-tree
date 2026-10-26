import {bodyOf,headers,currentUser} from './missions.js';

const allowedEndpoints=new Set([
  '/api/v2/state','/api/v2/ads/reserve','/api/v2/ads/complete','/api/v2/ads/cancel',
  '/api/v2/trees/complete','/api/v2/trees/positions','/api/v2/exchanges/recover',
  '/api/v3/state','/api/v3/ads/reserve','/api/v3/ads/complete','/api/v3/ads/cancel',
  '/api/v3/sell','/api/v3/layout','/api/v3/claim','/api/v3/exchange','/api/v3/recover',
]);

export async function handleAnalyticsEvents(request,env){
  const path=new URL(request.url).pathname;
  if(path!=='/api/analytics/events')return null;
  const cors=headers(request,env);
  if(!cors)return Response.json({error:'origin_not_allowed'},{status:403});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const reply=(data,status=200)=>Response.json(data,{status,headers:cors});
  if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
  try{
    const user=await currentUser(request,env);
    if(!user?.toss_user_key?.startsWith('anon:'))return reply({error:'unauthorized'},401);
    const body=await bodyOf(request);
    if(!allowedEndpoints.has(body.endpoint)||!['GET','POST'].includes(body.method)||
      !Number.isInteger(body.status)||body.status<0||body.status>599||
      !Number.isInteger(body.durationMs)||body.durationMs<0||body.durationMs>60000){
      return reply({error:'invalid_request'},400);
    }
    const id=crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO tree_analytics_events(id,user_id,endpoint,method,status,duration_ms) VALUES(?,?,?,?,?,?)'
    ).bind(id,user.id,body.endpoint,body.method,body.status,body.durationMs).run();
    await env.DB.prepare(
      'DELETE FROM tree_analytics_events WHERE user_id=? AND id IN (SELECT id FROM tree_analytics_events WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT -1 OFFSET 10000)'
    ).bind(user.id,user.id).run();
    return new Response(null,{status:204,headers:cors});
  }catch(error){
    const code=error.message==='invalid_request'?'invalid_request':'analytics_unavailable';
    console.warn('[tree.analytics]',{code});
    return reply({error:code},code==='invalid_request'?400:503);
  }
}
