import {bodyOf,headers,currentUser} from './missions.js';
import {publicAdConfig} from './config.js';
import {advanceExchangePayment} from './exchange-payments.js';
import {sanitizePositions} from '../src/placement.js';
import manifest from '../src/decoration-manifest.js';
const sequence=[...manifest.assets.filter(a=>a.kind==='floor'),...manifest.assets.filter(a=>a.kind==='ornament').sort((a,b)=>a.originalNumber-b.originalNumber),...manifest.assets.filter(a=>a.kind==='lights'),...manifest.assets.filter(a=>a.kind==='topper')];
const dateNow=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const colors=['green','white','pink','blue','gold'];
const fail=code=>{throw Error(code)};
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
async function initialize(env,user){
 await stmt(env,"INSERT INTO tree_bm_slots(user_id,slot,color) VALUES(?,1,'green') ON CONFLICT DO NOTHING",user.id).run();
 await stmt(env,"UPDATE tree_bm_requests SET state='cancelled' WHERE user_id=? AND state='reserved' AND expires_at<=?",user.id,Date.now()).run();
}
async function view(env,user){
 const slots=await stmt(env,'SELECT slot,color,decorations,completed_at,positions_json,positions_revision FROM tree_bm_slots WHERE user_id=? ORDER BY slot',user.id).all();
 const used=await stmt(env,"SELECT slot,count(*) AS n FROM tree_bm_requests WHERE user_id=? AND date=? AND purpose='earn-decoration' AND state='completed' GROUP BY slot",user.id,dateNow()).all();
 const balance=await stmt(env,'SELECT COALESCE(sum(amount),0) AS amount FROM tree_bm_credits WHERE user_id=? AND paid_at IS NULL',user.id).first();
 const payments=await stmt(env,'SELECT p.id,c.slot,p.amount,p.mode,p.state FROM tree_bm_payments p JOIN tree_bm_credits c ON c.id=p.credit_id WHERE p.user_id=? ORDER BY p.created_at DESC LIMIT 30',user.id).all();
 const credits=await stmt(env,'SELECT slot,amount,paid_at FROM tree_bm_credits WHERE user_id=?',user.id).all();
 return {version:2,date:dateNow(),dailyLimitPerTree:10,exchangeMode:String(env.TOSS_PROMOTION_MODE||'live').trim(),balance:balance.amount,slots:slots.results.map(({positions_json,...row})=>({...row,dailyUsed:used.results.find(item=>item.slot===row.slot)?.n||0,positions:JSON.parse(positions_json)})),credits:credits.results,payments:payments.results};
}
function exchangeConfig(env){
 const mode=String(env.TOSS_PROMOTION_MODE||'live').trim(),raw=String(env.TOSS_PROMOTION_CODE_EXCHANGE||'').trim();
 if(!['live','test'].includes(mode)||!raw||!env.TOSS_MTLS||(mode==='live'&&raw.startsWith('TEST_')))fail('exchange_not_configured');
 return {mode,code:mode==='test'&&!raw.startsWith('TEST_')?'TEST_'+raw:raw};
}
async function reserve(env,user,body){
 const {purpose,slot}=body;
 if(!['unlock-slot','earn-decoration','exchange-points'].includes(purpose)||!Number.isInteger(slot)||slot<1||slot>5)fail('invalid_request');
 const tree=await stmt(env,'SELECT * FROM tree_bm_slots WHERE user_id=? AND slot=?',user.id,slot).first();
 if(purpose==='unlock-slot'?(!!tree||slot===1):!tree)fail('slot_unavailable');
 if(purpose==='earn-decoration'&&tree.decorations>=30)fail('tree_full');
 if(purpose==='exchange-points'){
 const {mode}=exchangeConfig(env);
 const credit=await stmt(env,'SELECT id FROM tree_bm_credits WHERE user_id=? AND slot=? AND paid_at IS NULL',user.id,slot).first();
 if(!credit)fail('credit_unavailable');
 const active=await stmt(env,"SELECT id FROM tree_bm_payments WHERE credit_id=? AND state<>'failed' AND (mode=? OR state<>'succeeded')",credit.id,mode).first();
 if(active)fail('resume_payment');
 }
 const ads=publicAdConfig(env),adId=purpose==='earn-decoration'?ads.interstitialAdGroupId:ads.rewardedAdGroupId;
 if(!adId)fail('ad_not_configured');
 const id=crypto.randomUUID(),expires=Date.now()+10*60000,date=dateNow();
 const result=await stmt(env,`INSERT INTO tree_bm_requests(id,user_id,purpose,slot,ad_group_id,date,expires_at)
 SELECT ?,?,?,?,?,?,? WHERE ? <> 'earn-decoration' OR
 (SELECT count(*) FROM tree_bm_requests WHERE user_id=? AND slot=? AND date=? AND purpose='earn-decoration' AND state='completed') < 10
 ON CONFLICT DO NOTHING`,id,user.id,purpose,slot,adId,date,expires,purpose,user.id,slot,date).run();
 if(result.meta.changes!==1)fail('limit_or_request_pending');
 return {requestId:id,purpose,slot,adGroupId:adId,expiresAt:expires};
}
async function finish(env,user,body){
 const r=await stmt(env,'SELECT * FROM tree_bm_requests WHERE id=? AND user_id=?',body.requestId,user.id).first();
 if(!r)fail('request_not_found');
 if(r.state==='completed')return {requestId:r.id,state:'completed'};
 if(r.state!=='reserved'||r.expires_at<=Date.now()||r.date!==dateNow())fail('request_expired');
 if(body.adGroupId!==r.ad_group_id||body.displayed!==true||body.dismissed!==true||
 (r.purpose==='earn-decoration'?body.eventType!=='dismissed':body.eventType!=='userEarnedReward'))fail('ad_not_completed');
 const now=Date.now();
 const gate="EXISTS(SELECT 1 FROM tree_bm_requests WHERE id=? AND user_id=? AND state='reserved' AND expires_at>?)";
 const ops=[];
 if(r.purpose==='unlock-slot')ops.push(stmt(env,`INSERT INTO tree_bm_slots(user_id,slot,color) SELECT ?,?,? WHERE ${gate} ON CONFLICT DO NOTHING`,user.id,r.slot,colors[crypto.getRandomValues(new Uint32Array(1))[0]%5],r.id,user.id,now));
 if(r.purpose==='earn-decoration')ops.push(stmt(env,`UPDATE tree_bm_slots SET decorations=decorations+1 WHERE user_id=? AND slot=? AND decorations<30 AND ${gate} AND (SELECT count(*) FROM tree_bm_requests WHERE user_id=? AND slot=? AND date=? AND purpose='earn-decoration' AND state='completed')<10`,user.id,r.slot,r.id,user.id,now,user.id,r.slot,r.date));
 if(r.purpose==='exchange-points'){
 const {mode,code}=exchangeConfig(env);
 ops.push(stmt(env,`INSERT INTO tree_bm_payments(id,user_id,credit_id,mode,promotion_code,amount,state,created_at,updated_at)
 SELECT ?,?,id,?,?,amount,'creating',?,? FROM tree_bm_credits WHERE user_id=? AND slot=? AND paid_at IS NULL AND ${gate} ON CONFLICT DO NOTHING`,r.id,user.id,mode,code,now,now,user.id,r.slot,r.id,user.id,now));
 }
 // D1 batch is a transaction; changes() binds request consumption to its mutation.
 ops.push(stmt(env,"UPDATE tree_bm_requests SET state='completed',completed_at=? WHERE id=? AND user_id=? AND state='reserved' AND changes()=1",now,r.id,user.id));
 const result=await env.DB.batch(ops);
 if(result[1].meta.changes!==1){
 const saved=await stmt(env,'SELECT state FROM tree_bm_requests WHERE id=?',r.id).first();
 if(saved.state!=='completed')fail('request_conflict');
 }
 return {requestId:r.id,state:'completed'};
}
async function complete(env,user,body){
 if(!Number.isInteger(body.slot)||body.slot<1||body.slot>5)fail('invalid_request');
 await env.DB.batch([
 stmt(env,`INSERT INTO tree_bm_credits(id,user_id,slot,amount,created_at) SELECT ?,user_id,slot,30,? FROM tree_bm_slots WHERE user_id=? AND slot=? AND decorations=30 ON CONFLICT DO NOTHING`,crypto.randomUUID(),Date.now(),user.id,body.slot),
 stmt(env,'UPDATE tree_bm_slots SET completed_at=COALESCE(completed_at,?) WHERE user_id=? AND slot=? AND decorations=30',Date.now(),user.id,body.slot),
 ]);
 const credit=await stmt(env,'SELECT id,amount FROM tree_bm_credits WHERE user_id=? AND slot=?',user.id,body.slot).first();
 if(!credit)fail('tree_incomplete');
 return credit;
}
export async function handleBM(request,env){
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/api/v2/'))return null;
 const cors=headers(request,env);
 if(!cors)return Response.json({error:'origin_not_allowed'},{status:403});
 const reply=(data,status=200)=>Response.json(data,{status,headers:cors});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const routes={'/api/v2/state':'GET','/api/v2/ads/reserve':'POST','/api/v2/ads/complete':'POST','/api/v2/ads/cancel':'POST','/api/v2/trees/complete':'POST','/api/v2/trees/positions':'POST','/api/v2/exchanges/recover':'POST'};
 if(!routes[path])return reply({error:'not_found'},404);
 if(request.method!==routes[path])return reply({error:'method_not_allowed'},405);
 try{
 const user=await currentUser(request,env);
 if(!user||!user.toss_user_key.startsWith('anon:'))return reply({error:'unauthorized'},401);
 await initialize(env,user);
 if(path==='/api/v2/state')return reply(await view(env,user));
 const body=await bodyOf(request);
 if(path==='/api/v2/trees/positions'){
 if(!Number.isInteger(body.slot)||body.slot<1||body.slot>5||!Number.isSafeInteger(body.revision)||body.revision<0||!body.positions||typeof body.positions!=='object'||Array.isArray(body.positions))fail('invalid_request');
 const tree=await stmt(env,'SELECT decorations FROM tree_bm_slots WHERE user_id=? AND slot=?',user.id,body.slot).first();
 if(!tree)fail('slot_unavailable');
 const positions=sanitizePositions(body.positions,sequence,tree.decorations);
 const result=await stmt(env,'UPDATE tree_bm_slots SET positions_json=?,positions_revision=positions_revision+1 WHERE user_id=? AND slot=? AND positions_revision=?',JSON.stringify(positions),user.id,body.slot,body.revision).run();
 if(result.meta.changes!==1)fail('positions_conflict');
 return reply({positions,revision:body.revision+1});
 }
 if(path.endsWith('/reserve'))return reply(await reserve(env,user,body));
 if(path.endsWith('/cancel')){
 await stmt(env,"UPDATE tree_bm_requests SET state='cancelled' WHERE id=? AND user_id=? AND state='reserved'",body.requestId||'',user.id).run();
 return reply({cancelled:true});
 }
 if(path==='/api/v2/trees/complete')return reply(await complete(env,user,body));
 if(path.endsWith('/ads/complete'))return reply(await finish(env,user,body));
 // Explicit recovery also performs the initial transfer. Only server-stored amounts are used.
 const rows=await stmt(env,"SELECT p.id FROM tree_bm_payments p JOIN tree_bm_credits c ON c.id=p.credit_id WHERE p.user_id=? AND (p.state NOT IN ('succeeded','failed') OR (p.state='succeeded' AND p.mode='live' AND c.paid_at IS NULL)) ORDER BY p.created_at LIMIT 5",user.id).all();
 for(const row of rows.results)await advanceExchangePayment(env,user,row.id);
 return reply(await view(env,user));
 }catch(error){
 const codes=['invalid_request','slot_unavailable','tree_full','credit_unavailable','resume_payment','ad_not_configured','limit_or_request_pending','request_not_found','request_expired','ad_not_completed','exchange_not_configured','request_conflict','tree_incomplete','positions_conflict'];
 const code=codes.includes(error.message)?error.message:'service_unavailable';
 console.warn('[tree.bm]',{path,code});
 return reply({error:code},code==='service_unavailable'||code.endsWith('not_configured')?503:409);
 }
}
