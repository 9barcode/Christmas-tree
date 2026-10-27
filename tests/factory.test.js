import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleFactory} from '../worker/factory.js';
import {catalog,parseFactoryCatalog,drawCatalog,kstDate} from '../src/factory-model.js';
async function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const name of readdirSync(new URL('../migrations/tree/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../migrations/tree/'+name,import.meta.url),'utf8'));
 const token='a'.repeat(64),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
 sql.prepare('INSERT INTO tree_users(id,toss_user_key) VALUES(?,?)').run('user','anon:test');
 sql.prepare('INSERT INTO tree_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash,'user','2099-01-01T00:00:00Z');
 const DB={prepare(query){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(query).get(...values)??null},async all(){return {results:sql.prepare(query).all(...values)}},async run(){const result=sql.prepare(query).run(...values);return {meta:{changes:Number(result.changes)}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const env={DB,REWARDED_AD_GROUP_ID:'reward',INTER_AD_GROUP_ID:'inter',TREE_FACTORY_CATALOG:JSON.stringify(catalog.map(a=>({id:a.id,value:2,weight:1})))};
 async function send(path,body,auth=true){const r=await handleFactory(new Request('https://test/api/v3/'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);return {status:r.status,...await r.json()};}
 async function ad(purpose='produce',details={}){const r=await send('ads/reserve',{purpose,...details});assert.equal(r.status,200,JSON.stringify(r));const interstitial=['produce','sell','tree-sale'].includes(purpose),proof={requestId:r.requestId,adGroupId:r.adGroupId,eventType:interstitial?'dismissed':'userEarnedReward',rewarded:!interstitial,displayed:true,dismissed:true};return {requestId:r.requestId,proof,result:await send('ads/complete',proof)};}
 return {sql,env,send,ad};
}
test('production commits once; daily ten, one overtime, max twenty, KST rollover',async()=>{
 const {sql,send,ad}=await setup();try{
 assert.equal((await send('state',undefined,false)).status,401);
 assert.equal((await send('ads/reserve',{purpose:'overtime'})).error,'daily_limit');
 const first=await ad();assert.equal(first.result.status,200);assert.equal((await send('ads/complete',first.proof)).itemId,first.result.itemId);
 assert.equal((await send('state')).items.length,1);
 for(let i=1;i<10;i++)assert.equal((await ad()).result.status,200);
 assert.equal((await send('ads/reserve',{purpose:'produce'})).error,'daily_limit');
 assert.equal((await ad('overtime')).result.status,200);
 assert.equal((await send('ads/reserve',{purpose:'overtime'})).error,'daily_limit');
 for(let i=10;i<20;i++)await ad();
 const state=await send('state');assert.equal(state.used,20);assert.equal(state.items.length,20);assert.equal(state.limit,20);
 assert.equal((await send('ads/reserve',{purpose:'produce'})).error,'daily_limit');
 sql.prepare("UPDATE tree_factory_requests SET date='2000-01-01'").run();
 const next=await send('state');assert.equal(next.used,0);assert.equal(next.limit,10);assert.equal(next.items.length,20);
 }finally{sql.close();}
});
test('SDK reward is mandatory, sales/collection claims idempotent, layout uses revision and ownership',async()=>{
 const {sql,send,ad}=await setup();try{
 const reservation=await send('ads/reserve',{purpose:'produce'});
 assert.equal((await send('ads/complete',{requestId:reservation.requestId,adGroupId:'reward',eventType:'dismissed',displayed:true,dismissed:true})).error,'ad_not_completed');
 assert.equal((await send('state')).items.length,0);
 await send('ads/cancel',{requestId:reservation.requestId});
 const {result}=await ad(),state=await send('state');const item=state.items[0];
 const body={revision:state.revision,pot:{x:50,y:74},items:[{id:item.id,x:45,y:50}]};
 assert.equal((await send('layout',body)).status,200);
 assert.equal((await send('layout',body)).error,'positions_conflict');
 assert.equal((await send('layout',{...body,revision:1,items:[{id:'not-owned',x:50,y:50}]})).error,'item_unavailable');
 assert.equal((await send('layout',{...body,revision:1,items:[]})).status,200);
 const sale=await ad('sell',{itemId:result.itemId});await send('sell',{itemId:result.itemId,adRequestId:sale.requestId});await send('sell',{itemId:result.itemId,adRequestId:sale.requestId});const sold=await send('state');assert.equal(sold.items.length,0);assert.equal(sold.balance,2);assert.equal(sold.collection.length,1);
 assert.equal((await send('claim',{})).error,'invalid_request');assert.equal((await send('state')).balance,2);
 for(const a of catalog)sql.prepare('INSERT INTO tree_factory_collection VALUES(?,?,?) ON CONFLICT DO NOTHING').run('user',a.id,Date.now());
 assert.equal((await send('claim',{})).error,'invalid_request');assert.equal((await send('claim',{})).error,'invalid_request');
 assert.equal((await send('exchange',{requestId:crypto.randomUUID()})).error,'exchange_not_configured');assert.equal((await send('state')).balance,2);
 }finally{sql.close();}
});
test('catalog rejects missing, unknown, duplicate and invalid pricing; expired ads do not grant',async()=>{
 assert.throws(()=>parseFactoryCatalog('[]'));const rows=catalog.map(a=>({id:a.id,value:1,weight:1}));assert.equal(parseFactoryCatalog(JSON.stringify(rows)).length,30);assert.throws(()=>parseFactoryCatalog(JSON.stringify([...rows.slice(1),rows[1]])));assert.throws(()=>parseFactoryCatalog(JSON.stringify(rows.map(r=>({...r,value:4})))));assert.equal(drawCatalog(rows,()=>0).id,rows[0].id);
 const {sql,env,send}=await setup();try{
 env.TREE_FACTORY_CATALOG='[]';assert.equal((await send('state')).productionReady,false);assert.equal((await send('ads/reserve',{purpose:'produce'})).error,'catalog_not_configured');
 env.TREE_FACTORY_CATALOG=JSON.stringify(rows);const r=await send('ads/reserve',{purpose:'produce'});sql.prepare('UPDATE tree_factory_requests SET expires_at=0 WHERE id=?').run(r.requestId);
 assert.equal((await send('ads/complete',{requestId:r.requestId})).error,'request_expired');assert.equal((await send('state')).items.length,0);
 }finally{sql.close();}
});

test('legacy main-tree layout survives once without minting sale value or a second collection reward',async()=>{
 const {sql,send}=await setup();try{
 sql.prepare("INSERT INTO tree_bm_slots(user_id,slot,color,decorations,positions_json) VALUES('user',1,'green',3,?)").run(JSON.stringify({'gift-burgundy':{x:25,y:70},__pot:{x:51,y:74}}));
 sql.prepare("INSERT INTO tree_bm_slots(user_id,slot,color,decorations) VALUES('user',2,'white',5)").run();
 const s=await send('state');assert.equal(s.items.length,3);assert.equal(s.items[0].value,0);assert.equal(s.items[0].placed,1);assert.equal(s.pot.x,51);assert.equal(s.collection.length,0);
 const moved=await send('layout',{revision:0,pot:{x:52,y:74},items:[]});assert.equal(moved.status,200);
 const next=await send('state');assert.equal(next.items.length,3);assert.equal(next.pot.x,52);assert.equal(next.items.filter(i=>i.placed).length,0);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM tree_bm_slots').get().n,2);
 await send('sell',{itemId:s.items[0].id});assert.equal((await send('state')).balance,0);assert.equal((await send('state')).items.length,3);
 }finally{sql.close();}
});

test('exchange holds only server balance, retries do not debit twice, failed and test transfers refund once',async()=>{
 const {sql,env,send,ad}=await setup();try{
 const r=await ad();const sale=await ad('sell',{itemId:r.result.itemId});await send('sell',{itemId:r.result.itemId,adRequestId:sale.requestId});
 env.TOSS_PROMOTION_CODE_EXCHANGE='LIVE_CODE';env.TOSS_PROMOTION_MODE='live';env.TOSS_MTLS={};
 // Leave provider unreachable: verify durable reservation/recovery using real SQL, with no external payout.
 const exchangeAd=await ad('exchange');const requestId=crypto.randomUUID();const first=await send('exchange',{requestId,adRequestId:exchangeAd.requestId,amount:999});assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.balance,0);assert.equal(first.payments[0].amount,2);
 const again=await send('exchange',{requestId});assert.equal(again.balance,0);assert.equal(again.payments.length,1);
 sql.prepare("UPDATE tree_factory_payments SET state='failed'").run();assert.equal((await send('recover',{})).balance,2);assert.equal((await send('recover',{})).balance,2);
 env.TOSS_PROMOTION_MODE='test';env.TOSS_PROMOTION_CODE_EXCHANGE='TEST_CODE';const testAd=await ad('exchange');await send('exchange',{requestId:crypto.randomUUID(),adRequestId:testAd.requestId});assert.equal((await send('state')).balance,0);
 sql.prepare("UPDATE tree_factory_payments SET state='succeeded' WHERE mode='test'").run();assert.equal((await send('recover',{})).balance,2);assert.equal((await send('recover',{})).balance,2);
 }finally{sql.close();}
});

test('tree sale pays 50P up to five times per KST day, blocks pending/replays and never adds bells',async()=>{
 const {sql,env,send}=await setup();try{
 env.TOSS_PROMOTION_CODE_TREE_SALE='TREE_SALE_CODE';env.TOSS_PROMOTION_CODE_EXCHANGE='ORNAMENT_EXCHANGE_CODE';env.TOSS_PROMOTION_MODE='live';env.TOSS_MTLS={};
 for(const a of catalog)sql.prepare('INSERT INTO tree_factory_collection VALUES(?,?,?)').run('user',a.id,Date.now());
 async function completeSale(){
  const reservation=await send('ads/reserve',{purpose:'tree-sale'});assert.equal(reservation.status,200,JSON.stringify(reservation));
  const gate=await send('ads/complete',{requestId:reservation.requestId,adGroupId:'inter',eventType:'dismissed',rewarded:false,displayed:true,dismissed:true});assert.equal(gate.status,200);
  return send('claim',{adRequestId:reservation.requestId});
 }
 function addPlacedTree(prefix){for(const a of catalog)sql.prepare('INSERT INTO tree_factory_items(id,user_id,asset_id,value,placed,x,y,source,created_at) VALUES(?,?,?,1,1,50,50,?,?)').run(prefix+a.id,'user',a.id,'seed:'+prefix+a.id,Date.now());}
 addPlacedTree('item:');const result=await completeSale();assert.equal(result.status,200,JSON.stringify(result));
 const reserved=sql.prepare("SELECT count(*) AS n FROM tree_factory_items WHERE user_id='user' AND tree_sale_payment_id IS NOT NULL").get();
 assert.equal(reserved.n,30,'exactly the sold ornaments must be bound to the payment');
 const payment=sql.prepare("SELECT amount,promotion_code,purpose,state,business_date FROM tree_factory_payments WHERE user_id='user'").get();assert.equal(payment.amount,50);assert.equal(payment.promotion_code,'TREE_SALE_CODE');assert.equal(payment.purpose,'tree-sale');assert.equal(payment.business_date,kstDate());
 assert.equal(result.balance,0);assert.equal(result.treeSold,false);assert.equal(result.treeSalePending,true);assert.equal(result.items.length,30);
 const state=await send('state');assert.equal((await send('layout',{revision:state.revision,pot:state.pot,items:[]})).error,'payment_in_progress');
 assert.equal((await send('ads/reserve',{purpose:'tree-sale'})).error,'payment_in_progress');
 sql.prepare("UPDATE tree_factory_payments SET state='succeeded' WHERE purpose='tree-sale'").run();const recovered=await send('recover',{});assert.equal(recovered.treeSold,false);assert.equal(recovered.treeSaleCount,1);assert.equal(recovered.treeSalePending,false);assert.equal(recovered.balance,0);assert.equal(recovered.items.length,0);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM tree_factory_items WHERE user_id='user' AND tree_sale_payment_id IS NOT NULL AND sold_at IS NOT NULL").get().n,30);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM tree_factory_collection WHERE user_id='user'").get().n,30);
 assert.equal(sql.prepare("SELECT finalized_at IS NOT NULL AS done FROM tree_factory_payments WHERE purpose='tree-sale'").get().done,1);
 for(let i=2;i<=5;i++){
  addPlacedTree('sale'+i+':');assert.equal((await completeSale()).status,200);
  sql.prepare("UPDATE tree_factory_payments SET state='succeeded' WHERE purpose='tree-sale'").run();
  const done=await send('recover',{});assert.equal(done.treeSaleCount,i);assert.equal(done.treeSold,i===5);assert.equal(done.items.length,0);
 }
 assert.equal(sql.prepare("SELECT sum(amount) AS n FROM tree_factory_payments WHERE purpose='tree-sale'").get().n,250);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM tree_factory_ledger WHERE kind='tree_sale'").get().n,0);
 assert.equal((await send('ads/reserve',{purpose:'tree-sale'})).error,'tree_sale_daily_limit');
 sql.prepare("UPDATE tree_factory_payments SET business_date='2000-01-01' WHERE purpose='tree-sale'").run();assert.equal((await send('state')).treeSold,false);
 addPlacedTree('tomorrow:');const next=await completeSale();assert.equal(next.status,200,JSON.stringify(next));
 assert.equal(sql.prepare("SELECT count(*) AS n FROM tree_factory_payments WHERE purpose='tree-sale'").get().n,6);
 sql.prepare("UPDATE tree_factory_payments SET state='succeeded' WHERE purpose='tree-sale' AND business_date=?").run(kstDate());await send('recover',{});
 assert.equal((await send('state')).treeSaleCount,1);
 assert.equal((await send('ads/reserve',{purpose:'tree-sale'})).error,'tree_not_ready');
 assert.equal((await send('state')).balance,0);
 }finally{sql.close();}
});
