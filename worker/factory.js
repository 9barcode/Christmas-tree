import {bodyOf,headers,currentUser} from './missions.js';
import {publicAdConfig} from './config.js';
import {catalog,byId,kstDate,parseFactoryCatalog,drawCatalog} from '../src/factory-model.js';
import {clampPosition,defaultPosition} from '../src/placement.js';
import {advanceFactoryPayment} from './factory-payments.js';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const fail=code=>{throw Error(code);};
function configured(env){try{return parseFactoryCatalog(env.TREE_FACTORY_CATALOG);}catch{return null;}}
async function initialize(env,user){
 await q(env,"UPDATE tree_factory_requests SET state='cancelled' WHERE user_id=? AND state='reserved' AND (expires_at<=? OR date<>?)",user.id,Date.now(),kstDate()).run();
 await q(env,"UPDATE tree_factory_ad_gates SET state='cancelled' WHERE user_id=? AND state='reserved' AND (expires_at<=? OR date<>?)",user.id,Date.now(),kstDate()).run();
 await q(env,'INSERT INTO tree_factory_layout(user_id) VALUES(?) ON CONFLICT DO NOTHING',user.id).run();
 const imported=await q(env,'SELECT user_id FROM tree_factory_imports WHERE user_id=?',user.id).first();
 if(!imported){
 const legacy=await q(env,'SELECT decorations,positions_json FROM tree_bm_slots WHERE user_id=? AND slot=1',user.id).first();
 const token=crypto.randomUUID(),now=Date.now(),positions=JSON.parse(legacy?.positions_json||'{}');
 const sequence=[...catalog.filter(a=>a.kind==='floor'),...catalog.filter(a=>a.kind==='ornament').sort((a,b)=>a.originalNumber-b.originalNumber),...catalog.filter(a=>a.kind==='lights'),...catalog.filter(a=>a.kind==='topper')];
 const gate='EXISTS(SELECT 1 FROM tree_factory_imports WHERE user_id=? AND token=?)';
 const ops=[q(env,'INSERT INTO tree_factory_imports VALUES(?,?,?) ON CONFLICT DO NOTHING',user.id,token,now)];let floor=0,ornament=0;
 for(const a of sequence.slice(0,legacy?.decorations||0)){
 const index=a.kind==='floor'?floor++:ornament++,p=positions[a.id]||defaultPosition(a.kind,index);
 ops.push(q(env,`INSERT INTO tree_factory_items(id,user_id,asset_id,value,placed,x,y,source,created_at) SELECT ?,?,?,0,1,?,?,?,? WHERE ${gate} ON CONFLICT DO NOTHING`,crypto.randomUUID(),user.id,a.id,p.x,p.y,'legacy:'+user.id+':'+a.id,now,user.id,token));
 }
 if(positions.__pot)ops.push(q(env,`UPDATE tree_factory_layout SET pot_json=? WHERE user_id=? AND ${gate}`,JSON.stringify(positions.__pot),user.id,user.id,token));
 // Retain the original tables, including slots 2–5 and unpaid v2 credits, without deleting anything.
 await env.DB.batch(ops);
 }
}
async function view(env,user){
 const date=kstDate();
 const [items,col,usage,layout,balance,payments]=await Promise.all([
 q(env,'SELECT id,asset_id,value,placed,x,y FROM tree_factory_items WHERE user_id=? AND sold_at IS NULL ORDER BY created_at,id',user.id).all(),
 q(env,'SELECT asset_id FROM tree_factory_collection WHERE user_id=?',user.id).all(),
 q(env,"SELECT purpose,count(*) AS n FROM tree_factory_requests WHERE user_id=? AND date=? AND state='completed' GROUP BY purpose",user.id,kstDate()).all(),
 q(env,'SELECT * FROM tree_factory_layout WHERE user_id=?',user.id).first(),
 q(env,'SELECT COALESCE(sum(amount),0) AS n FROM tree_factory_ledger WHERE user_id=?',user.id).first(),
 q(env,'SELECT id,amount,mode,state,purpose FROM tree_factory_payments WHERE user_id=? ORDER BY created_at DESC LIMIT 20',user.id).all()]);
 const rows=configured(env),overtime=usage.results.some(r=>r.purpose==='overtime'),used=usage.results.find(r=>r.purpose==='produce')?.n||0;
 const legacySale=await q(env,"SELECT id FROM tree_factory_ledger WHERE id=? AND date(created_at/1000,'unixepoch','+9 hours')=?",'tree-sale:'+user.id,date).first();
 const sales=await q(env,"SELECT count(*) AS n FROM tree_factory_payments WHERE user_id=? AND purpose='tree-sale' AND business_date=? AND state='succeeded'",user.id,date).first();
 const treeSaleCount=sales.n+(legacySale?1:0);
 const treeSalePayment=await q(env,"SELECT state,finalized_at FROM tree_factory_payments WHERE user_id=? AND purpose='tree-sale' AND (state IN ('creating','ready','submitted','pending') OR (state='succeeded' AND finalized_at IS NULL)) ORDER BY created_at DESC LIMIT 1",user.id).first();
 const treeSold=treeSaleCount>=5;
 const treeSalePending=!!treeSalePayment;
 return {version:3,date,used,overtime,limit:overtime?20:10,items:items.results,collection:col.results.map(r=>r.asset_id),balance:balance.n,revision:layout.revision,pot:JSON.parse(layout.pot_json),treeSold,treeSalePending,treeSaleCount,treeSaleDailyLimit:5,catalog:catalog.map(a=>({id:a.id,value:rows?.find(r=>r.id===a.id)?.value??null})),productionReady:!!rows&&!!publicAdConfig(env).interstitialAdGroupId,treeSaleReady:!!env.TOSS_MTLS&&!!env.TOSS_PROMOTION_CODE_TREE_SALE&&!!publicAdConfig(env).rewardedAdGroupId,exchangeReady:!!env.TOSS_MTLS&&!!env.TOSS_PROMOTION_CODE_EXCHANGE&&!!publicAdConfig(env).rewardedAdGroupId,payments:payments.results};
}
function saleIds(body){
 const ids=body.itemIds===undefined?[body.itemId]:body.itemIds;
 if(!Array.isArray(ids)||ids.length<1||ids.length>3||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)fail('invalid_request');
 return [...ids].sort();
}
const saleKey=ids=>ids.length===1?ids[0]:JSON.stringify(ids);
async function saleItems(env,user,ids){
 const rows=(await q(env,`SELECT id,placed FROM tree_factory_items WHERE user_id=? AND sold_at IS NULL AND value>0 AND id IN (${ids.map(()=>'?').join(',')})`,user.id,...ids).all()).results;
 if(rows.length!==ids.length)fail('item_unavailable');
 if(rows.some(i=>i.placed))fail('item_placed');
}
async function unreconciledTreeSale(env,user){
 // Fail closed when a successful 50P payout has no 30 consumed ornaments.
 // This also catches legacy sales recorded as finalized before the inventory was removed.
 return q(env,`SELECT p.id FROM tree_factory_payments p
  WHERE p.user_id=? AND p.purpose='tree-sale' AND p.state='succeeded'
  AND (SELECT count(*) FROM tree_factory_items i
       WHERE i.user_id=p.user_id AND i.tree_sale_payment_id=p.id AND i.sold_at IS NOT NULL)<>30
  LIMIT 1`,user.id).first();
}
async function reserve(env,user,body){
 if(['sell','tree-sale','exchange'].includes(body.purpose)){
  const configuredAd=publicAdConfig(env)[['exchange','tree-sale'].includes(body.purpose)?'rewardedAdGroupId':'interstitialAdGroupId'];if(!configuredAd)fail('ad_not_configured');const ad=configuredAd;
  let itemId=null;
  if(body.purpose==='sell'){
   const ids=saleIds(body);await saleItems(env,user,ids);itemId=saleKey(ids);
  }else if(body.purpose==='tree-sale'){
   if(!env.TOSS_MTLS||!String(env.TOSS_PROMOTION_CODE_TREE_SALE||'').trim())fail('tree_sale_not_configured');
   if(await unreconciledTreeSale(env,user))fail('tree_sale_reconciliation_required');
   const date=kstDate();
   const sales=await q(env,"SELECT count(*) AS n FROM tree_factory_payments WHERE user_id=? AND purpose='tree-sale' AND business_date=? AND state='succeeded'",user.id,date).first();
   const prior=await q(env,"SELECT id FROM tree_factory_ledger WHERE id=? AND date(created_at/1000,'unixepoch','+9 hours')=?",'tree-sale:'+user.id,date).first();if(sales.n+(prior?1:0)>=5)fail('tree_sale_daily_limit');
   if(await q(env,"SELECT id FROM tree_factory_payments WHERE user_id=? AND (state NOT IN ('succeeded','failed') OR (purpose='tree-sale' AND state='succeeded' AND finalized_at IS NULL))",user.id).first())fail('payment_in_progress');
   const count=await q(env,'SELECT count(*) AS n FROM tree_factory_collection WHERE user_id=?',user.id).first();if(count.n!==30)fail('collection_incomplete');
   const placed=await q(env,'SELECT count(DISTINCT asset_id) AS n FROM tree_factory_items WHERE user_id=? AND sold_at IS NULL AND placed=1',user.id).first();if(placed.n!==30)fail('tree_not_ready');
  }else{
   const balance=await q(env,'SELECT COALESCE(sum(amount),0) AS n FROM tree_factory_ledger WHERE user_id=?',user.id).first();if(balance.n<1)fail('exchange_empty');
  }
  const id=crypto.randomUUID(),date=kstDate(),now=Date.now(),expires=now+600000;
  const result=await q(env,"INSERT INTO tree_factory_ad_gates(id,user_id,purpose,item_id,date,ad_group_id,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",id,user.id,body.purpose,itemId,date,ad,expires,now).run();
  if(result.meta.changes!==1)fail('ad_in_progress');return {requestId:id,purpose:body.purpose,itemId,adGroupId:ad,expiresAt:expires};
 }
 if(!['produce','overtime'].includes(body.purpose))fail('invalid_request');
 if(!configured(env))fail('catalog_not_configured');
 const ads=publicAdConfig(env),configuredAd=body.purpose==='produce'?ads.interstitialAdGroupId:ads.rewardedAdGroupId;if(!configuredAd)fail('ad_not_configured');const ad=configuredAd;
 const id=crypto.randomUUID(),date=kstDate(),expires=Date.now()+600000;
 const used="(SELECT count(*) FROM tree_factory_requests WHERE user_id=? AND date=? AND purpose='produce' AND state='completed')";
 const overtime="EXISTS(SELECT 1 FROM tree_factory_requests WHERE user_id=? AND date=? AND purpose='overtime' AND state='completed')";
 const gate=body.purpose==='produce'? `${used}<CASE WHEN ${overtime} THEN 20 ELSE 10 END`:`${used}>=10 AND NOT ${overtime}`;
 const gateArgs=[user.id,date,user.id,date];
 const result=await q(env,`INSERT INTO tree_factory_requests(id,user_id,purpose,date,ad_group_id,expires_at) SELECT ?,?,?,?,?,? WHERE ${gate} ON CONFLICT DO NOTHING`,id,user.id,body.purpose,date,ad,expires,...gateArgs).run();
 if(result.meta.changes!==1)fail('daily_limit');return {requestId:id,adGroupId:ad,expiresAt:expires};
}
async function finish(env,user,body){
 const adGate=await q(env,'SELECT * FROM tree_factory_ad_gates WHERE user_id=? AND id=?',user.id,body.requestId).first();
 if(adGate){
  if(['completed','consumed'].includes(adGate.state))return {requestId:adGate.id,purpose:adGate.purpose};
  if(adGate.state!=='reserved'||adGate.date!==kstDate()||adGate.expires_at<=Date.now())fail('request_expired');
  const valid=['exchange','tree-sale'].includes(adGate.purpose)?body.eventType==='userEarnedReward'&&body.rewarded===true:body.eventType==='dismissed'&&body.rewarded!==true;
  if((body.adGroupId!==adGate.ad_group_id||!valid||body.displayed!==true||(adGate.purpose!=='tree-sale'&&body.dismissed!==true)))fail('ad_not_completed');
  const now=Date.now();const result=await q(env,"UPDATE tree_factory_ad_gates SET state='completed',completed_at=? WHERE id=? AND user_id=? AND state='reserved' AND expires_at>?",now,adGate.id,user.id,now).run();
  if(result.meta.changes!==1)fail('request_expired');
  return {requestId:adGate.id,purpose:adGate.purpose};
 }
 const r=await q(env,'SELECT * FROM tree_factory_requests WHERE user_id=? AND id=?',user.id,body.requestId).first();
 if(!r)fail('request_not_found');if(r.state==='completed')return {itemId:r.result_id};
 if(r.state!=='reserved'||r.date!==kstDate()||r.expires_at<=Date.now())fail('request_expired');
 const rewarded=r.purpose==='overtime';const valid=rewarded?body.eventType==='userEarnedReward'&&body.rewarded===true:body.eventType==='dismissed'&&body.rewarded!==true;
 if((body.adGroupId!==r.ad_group_id||!valid||body.displayed!==true||body.dismissed!==true))fail('ad_not_completed');
 const now=Date.now(),rows=configured(env);if(!rows)fail('catalog_not_configured');
 const draw=r.purpose==='produce'?drawCatalog(rows):null;
 const id=draw?crypto.randomUUID():null;
 const ops=[q(env,"UPDATE tree_factory_requests SET state='completed',completed_at=?,result_id=? WHERE id=? AND user_id=? AND state='reserved' AND expires_at>?",now,id,r.id,user.id,now)];
 if(draw){
  ops.push(q(env,`INSERT INTO tree_factory_items(id,user_id,asset_id,value,source,created_at) SELECT result_id,user_id,?,?,id,? FROM tree_factory_requests WHERE id=? AND user_id=? AND state='completed' AND result_id=? ON CONFLICT DO NOTHING`,draw.id,draw.value,now,r.id,user.id,id));
  ops.push(q(env,`INSERT INTO tree_factory_collection(user_id,asset_id,created_at) SELECT user_id,asset_id,? FROM tree_factory_items WHERE source=? ON CONFLICT DO NOTHING`,now,r.id));
 }
 await env.DB.batch(ops);
 const saved=await q(env,'SELECT result_id FROM tree_factory_requests WHERE id=? AND user_id=?',r.id,user.id).first();return {itemId:saved.result_id};
}
async function sell(env,user,body){
 const ids=saleIds(body);if(typeof body.adRequestId!=='string')fail('invalid_request');
 const gate=await q(env,'SELECT * FROM tree_factory_ad_gates WHERE id=? AND user_id=?',body.adRequestId,user.id).first();
 if(!gate||gate.purpose!=='sell'||gate.item_id!==saleKey(ids)||!['completed','consumed'].includes(gate.state)||gate.date!==kstDate())fail('ad_not_completed');
 if(gate.state==='consumed')return;
 await saleItems(env,user,ids);
 const now=Date.now(),ledger='sale-batch:'+gate.id,marks=ids.map(()=>'?').join(',');
 const eligible=`user_id=? AND id IN (${marks}) AND sold_at IS NULL AND value>0 AND placed=0`;
 const authorized="EXISTS(SELECT 1 FROM tree_factory_ad_gates WHERE id=? AND user_id=? AND state='completed')";
 const results=await env.DB.batch([
  q(env,`INSERT INTO tree_factory_ledger(id,user_id,amount,kind,created_at) SELECT ?,?,sum(value),'sale',? FROM tree_factory_items WHERE ${eligible} AND ${authorized} HAVING count(*)=? ON CONFLICT DO NOTHING`,ledger,user.id,now,user.id,...ids,gate.id,user.id,ids.length),
  q(env,`UPDATE tree_factory_items SET sold_at=? WHERE ${eligible} AND EXISTS(SELECT 1 FROM tree_factory_ledger WHERE id=?) AND ${authorized}`,now,user.id,...ids,ledger,gate.id,user.id),
  q(env,`UPDATE tree_factory_layout SET revision=revision+1 WHERE user_id=? AND EXISTS(SELECT 1 FROM tree_factory_ledger WHERE id=?) AND ${authorized}`,user.id,ledger,gate.id,user.id),
  q(env,"UPDATE tree_factory_ad_gates SET state='consumed' WHERE id=? AND user_id=? AND state='completed' AND EXISTS(SELECT 1 FROM tree_factory_ledger WHERE id=?)",gate.id,user.id,ledger)
 ]);
 if(results[0].meta.changes!==1){await saleItems(env,user,ids);fail('item_unavailable');}
}
async function place(env,user,body){
 if(!Number.isSafeInteger(body.revision)||!Array.isArray(body.items)||body.items.length>30||new Set(body.items.map(i=>i.id)).size!==body.items.length)fail('invalid_request');
 const pendingTreeSale=await q(env,"SELECT id FROM tree_factory_payments WHERE user_id=? AND purpose='tree-sale' AND mode='live' AND state IN ('creating','ready','submitted','pending','succeeded') AND finalized_at IS NULL",user.id).first();if(pendingTreeSale)fail('payment_in_progress');
 const owned=(await q(env,'SELECT id,asset_id FROM tree_factory_items WHERE user_id=? AND sold_at IS NULL',user.id).all()).results;
 const kinds=new Set();
 const clean=body.items.map(i=>{const a=byId[owned.find(o=>o.id===i.id)?.asset_id];if(!a)fail('item_unavailable');if(['lights','topper'].includes(a.kind)){if(kinds.has(a.kind))fail('fixed_item_duplicate');kinds.add(a.kind);}const p=['lights','topper'].includes(a.kind)?defaultPosition(a.kind):clampPosition(a.kind,i.x,i.y);if(!p)fail('invalid_request');return {...i,...p,asset_id:a.id};});
 if(new Set(clean.map(i=>i.asset_id)).size!==clean.length)fail('duplicate_decoration');
 const pot=clampPosition('pot',body.pot?.x,body.pot?.y);if(!pot)fail('invalid_request');
 // A request-scoped revision token gates every mutation, so stale tabs cannot clear a newer layout.
 const revision=body.revision+1,token=JSON.stringify({...pot,token:crypto.randomUUID()});
 const gate='EXISTS(SELECT 1 FROM tree_factory_layout WHERE user_id=? AND revision=? AND pot_json=?)';
 const ops=[q(env,'UPDATE tree_factory_layout SET revision=?,pot_json=? WHERE user_id=? AND revision=?',revision,token,user.id,body.revision),q(env,`UPDATE tree_factory_items SET placed=0 WHERE user_id=? AND ${gate}`,user.id,user.id,revision,token)];
 for(const i of clean)ops.push(q(env,`UPDATE tree_factory_items SET placed=1,x=?,y=? WHERE id=? AND user_id=? AND sold_at IS NULL AND ${gate}`,i.x,i.y,i.id,user.id,user.id,revision,token));
 const results=await env.DB.batch(ops);if(results[0].meta.changes!==1)fail('positions_conflict');
}
async function sellTree(env,user,body){
 if(typeof body.adRequestId!=='string')fail('invalid_request');
 const existing=await q(env,"SELECT id FROM tree_factory_payments WHERE id=? AND user_id=? AND purpose='tree-sale'",user.id+':tree-sale:'+body.adRequestId,user.id).first();
 if(existing){await advanceFactoryPayment(env,user,existing.id);return;}
 if(await unreconciledTreeSale(env,user))fail('tree_sale_reconciliation_required');
 const gate=await q(env,'SELECT * FROM tree_factory_ad_gates WHERE id=? AND user_id=?',body.adRequestId,user.id).first();
 if(!gate||gate.purpose!=='tree-sale'||gate.state!=='completed'||gate.ad_group_id!==publicAdConfig(env).rewardedAdGroupId||gate.date!==kstDate())fail('ad_not_completed');
 const raw=String(env.TOSS_PROMOTION_CODE_TREE_SALE||'').trim();
 // A TEST_ promotion code always uses the provider test protocol, even when the shared exchange mode is live.
 const mode=raw.startsWith('TEST_')?'test':String(env.TOSS_PROMOTION_MODE||'live');
 if(!['live','test'].includes(mode)||!raw||!env.TOSS_MTLS||(mode==='live'&&raw.startsWith('TEST_')))fail('tree_sale_not_configured');
 const count=await q(env,'SELECT count(*) AS n FROM tree_factory_collection WHERE user_id=?',user.id).first();if(count.n!==30)fail('collection_incomplete');
 const date=kstDate();
 const sales=await q(env,"SELECT count(*) AS n FROM tree_factory_payments WHERE user_id=? AND purpose='tree-sale' AND business_date=? AND state='succeeded'",user.id,date).first();
 const prior=await q(env,"SELECT id FROM tree_factory_ledger WHERE id=? AND date(created_at/1000,'unixepoch','+9 hours')=?",'tree-sale:'+user.id,date).first();if(sales.n+(prior?1:0)>=5)fail('tree_sale_daily_limit');
 if(await q(env,"SELECT id FROM tree_factory_payments WHERE user_id=? AND purpose='tree-sale' AND state='succeeded' AND finalized_at IS NULL",user.id).first())fail('payment_in_progress');
 const placed=await q(env,'SELECT count(DISTINCT asset_id) AS n FROM tree_factory_items WHERE user_id=? AND sold_at IS NULL AND placed=1',user.id).first();if(placed.n!==30)fail('tree_not_ready');
 const active=await q(env,"SELECT id FROM tree_factory_payments WHERE user_id=? AND state NOT IN ('succeeded','failed')",user.id).first();if(active)fail('payment_in_progress');
 const id=user.id+':tree-sale:'+body.adRequestId,now=Date.now();
 await env.DB.batch([
  q(env,"INSERT INTO tree_factory_payments(id,user_id,mode,promotion_code,debug_test,amount,state,created_at,updated_at,purpose,business_date) SELECT ?,?,?,?,?,50,'creating',?,?,'tree-sale',? WHERE EXISTS(SELECT 1 FROM tree_factory_ad_gates WHERE id=? AND user_id=? AND purpose='tree-sale' AND state='completed') AND ((SELECT count(*) FROM tree_factory_payments WHERE user_id=? AND purpose='tree-sale' AND business_date=? AND state='succeeded') + (SELECT count(*) FROM tree_factory_ledger WHERE id=? AND date(created_at/1000,'unixepoch','+9 hours')=?))<5 ON CONFLICT DO NOTHING",id,user.id,mode,mode==='test'&&!raw.startsWith('TEST_')?'TEST_'+raw:raw,0,now,now,date,gate.id,user.id,user.id,date,'tree-sale:'+user.id,date),
  q(env,"UPDATE tree_factory_ad_gates SET state='consumed' WHERE id=? AND user_id=? AND state='completed' AND EXISTS(SELECT 1 FROM tree_factory_payments WHERE id=? AND user_id=? AND purpose='tree-sale')",gate.id,user.id,id,user.id),
  q(env,"UPDATE tree_factory_items SET tree_sale_payment_id=? WHERE user_id=? AND sold_at IS NULL AND placed=1 AND tree_sale_payment_id IS NULL AND EXISTS(SELECT 1 FROM tree_factory_payments WHERE id=? AND user_id=? AND purpose='tree-sale')",id,user.id,id,user.id)
 ]);
 const payment=await q(env,'SELECT id FROM tree_factory_payments WHERE id=? AND user_id=?',id,user.id).first();
 if(!payment){const sold=await q(env,"SELECT id FROM tree_factory_ledger WHERE id=? AND date(created_at/1000,'unixepoch','+9 hours')=?",'tree-sale:'+user.id,date).first();if(sales.n+(sold?1:0)>=5)fail('tree_sale_daily_limit');fail('payment_in_progress');}
 await advanceFactoryPayment(env,user,payment.id);
}
async function exchange(env,user,body){
 const mode=String(env.TOSS_PROMOTION_MODE||'live'),raw=String(env.TOSS_PROMOTION_CODE_EXCHANGE||'').trim();
 if(!['live','test'].includes(mode)||!raw||!env.TOSS_MTLS||(mode==='live'&&raw.startsWith('TEST_')))fail('exchange_not_configured');
 const active=await q(env,"SELECT id FROM tree_factory_payments WHERE user_id=? AND state NOT IN ('succeeded','failed')",user.id).first();
 if(active){await advanceFactoryPayment(env,user,active.id);return;}
 if(typeof body.requestId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(body.requestId)||typeof body.adRequestId!=='string')fail('invalid_request');
 const gate=await q(env,'SELECT * FROM tree_factory_ad_gates WHERE id=? AND user_id=?',body.adRequestId,user.id).first();
 if(!gate||gate.purpose!=='exchange'||gate.state!=='completed'||gate.date!==kstDate())fail('ad_not_completed');
 const id=user.id+':'+body.requestId,now=Date.now();
 await env.DB.batch([
 q(env,`INSERT INTO tree_factory_payments(id,user_id,mode,promotion_code,debug_test,amount,state,created_at,updated_at) SELECT ?,?,?,?,?,sum(amount),'creating',?,? FROM tree_factory_ledger WHERE user_id=? AND EXISTS(SELECT 1 FROM tree_factory_ad_gates WHERE id=? AND user_id=? AND purpose='exchange' AND state='completed') HAVING sum(amount)>0 ON CONFLICT DO NOTHING`,id,user.id,mode,mode==='test'&&!raw.startsWith('TEST_')?'TEST_'+raw:raw,0,now,now,user.id,body.adRequestId,user.id),
 q(env,`INSERT INTO tree_factory_ledger(id,user_id,amount,kind,created_at) SELECT 'exchange:'||id,user_id,-amount,'exchange',? FROM tree_factory_payments WHERE id=? ON CONFLICT DO NOTHING`,now,id),
 q(env,`UPDATE tree_factory_ad_gates SET state='consumed' WHERE id=? AND user_id=? AND state='completed' AND EXISTS(SELECT 1 FROM tree_factory_payments WHERE id=? AND user_id=?)`,body.adRequestId,user.id,id,user.id)]);
 const saved=await q(env,'SELECT id FROM tree_factory_payments WHERE id=? AND user_id=?',id,user.id).first();if(saved)await advanceFactoryPayment(env,user,saved.id);
}
export async function handleFactory(request,env,context){
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/v3/'))return null;
 const cors=headers(request,env);if(!cors)return Response.json({error:'origin_not_allowed'},{status:403});
 const reply=(data,status=200)=>Response.json(data,{status,headers:{...cors,'Cache-Control':'no-store'}});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const route=path.slice(8),routes={state:'GET','ads/reserve':'POST','ads/complete':'POST','ads/cancel':'POST',sell:'POST',layout:'POST',claim:'POST',exchange:'POST',recover:'POST'};
 if(!routes[route])return reply({error:'not_found'},404);if(request.method!==routes[route])return reply({error:'method_not_allowed'},405);
 try{
 const user=await currentUser(request,env);if(!user?.toss_user_key?.startsWith('anon:'))return reply({error:'unauthorized'},401);
 await initialize(env,user);if(route==='state')return reply(await view(env,user));const body=await bodyOf(request);
 if(route==='ads/reserve')return reply(await reserve(env,user,body));
 if(route==='ads/complete')return reply(await finish(env,user,body));
 if(route==='ads/cancel'){await q(env,"UPDATE tree_factory_requests SET state='cancelled' WHERE id=? AND user_id=? AND state='reserved'",body.requestId||'',user.id).run();await q(env,"UPDATE tree_factory_ad_gates SET state='cancelled' WHERE id=? AND user_id=? AND state='reserved'",body.requestId||'',user.id).run();}
 if(route==='sell')await sell(env,user,body);
 if(route==='claim'){
 console.info('[tree.sale]',{event:'claim_start'});
 const sale=sellTree(env,user,body);
 context?.waitUntil(sale.catch(()=>{}));
 await sale;
 console.info('[tree.sale]',{event:'claim_processed'});
 }
 if(route==='layout')await place(env,user,body);
 if(route==='exchange')await exchange(env,user,body);
 if(route==='recover'){
 const rows=await q(env,"SELECT id FROM tree_factory_payments WHERE user_id=? ORDER BY created_at DESC LIMIT 5",user.id).all();
 for(const r of rows.results)await advanceFactoryPayment(env,user,r.id);
 }
 return reply(await view(env,user));
 }catch(error){const known=['tree_sale_reconciliation_required','item_placed','invalid_request','exchange_empty','ad_in_progress','collection_incomplete','tree_not_ready','tree_sale_daily_limit','duplicate_decoration','catalog_not_configured','ad_not_configured','daily_limit','request_not_found','request_expired','ad_not_completed','item_unavailable','fixed_item_duplicate','positions_conflict','exchange_not_configured','tree_sale_not_configured','payment_in_progress'];const code=known.includes(error.message)?error.message:'service_unavailable';console.warn('[tree.factory]',{path,code});return reply({error:code},code.endsWith('not_configured')||code==='service_unavailable'?503:409);}
}

