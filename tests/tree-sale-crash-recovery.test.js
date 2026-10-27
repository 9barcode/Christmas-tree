import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handleFactory} from '../worker/factory.js';
import {catalog} from '../src/factory-model.js';

// Restart discards the client instance and reopens a file-backed SQLite DB.
// Only localStorage, committed database records and the simulated provider survive.
async function setup(t){
 const dir=mkdtempSync(join(tmpdir(),'tree-crash-')),file=join(dir,'state.sqlite');
 let sql=new DatabaseSync(file),failFinalization=false;
 const open=()=>{sql=new DatabaseSync(file);sql.exec('PRAGMA foreign_keys=ON');};
 sql.exec('PRAGMA foreign_keys=ON');
 for(const name of readdirSync(new URL('../migrations/tree/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../migrations/tree/'+name,import.meta.url),'utf8'));
 const token='b'.repeat(64),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
 sql.prepare("INSERT INTO tree_users(id,toss_user_key) VALUES('user','anon:crash-test')").run();
 sql.prepare('INSERT INTO tree_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash,'user','2099-01-01T00:00:00Z');
 for(const a of catalog){
  sql.prepare('INSERT INTO tree_factory_collection VALUES(?,?,?)').run('user',a.id,Date.now());
  sql.prepare('INSERT INTO tree_factory_items(id,user_id,asset_id,value,placed,source,created_at) VALUES(?,?,?,1,1,?,?)').run(a.id,'user',a.id,'seed:'+a.id,Date.now());
 }
 const DB={prepare(query){let values=[];return {query,bind(...v){values=v;return this;},async first(){return sql.prepare(query).get(...values)??null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...values).changes)}};}};},async batch(statements){
  if(failFinalization&&statements.some(s=>s.query.startsWith('UPDATE tree_factory_items SET sold_at='))){failFinalization=false;throw Error('simulated termination before inventory finalization');}
  sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}
 }};
 const provider={keys:0,executions:0,statusChecks:0,paid:false,loseExecuteResponse:false};
 const env={DB,REWARDED_AD_GROUP_ID:'reward',INTER_AD_GROUP_ID:'inter',TOSS_PROMOTION_MODE:'live',TOSS_PROMOTION_CODE_TREE_SALE:'LIVE_TREE',TOSS_MTLS:{async fetch(url,options){
  const body=JSON.parse(options.body);
  if(url.endsWith('/get-key')){provider.keys++;return Response.json({resultType:'SUCCESS',success:{key:'durable-provider-key'}});}
  assert.equal(body.key,'durable-provider-key');
  if(url.endsWith('/execution-result')){provider.statusChecks++;return Response.json({resultType:'SUCCESS',success:provider.paid?'SUCCESS':'PENDING'});}
  provider.executions++;provider.paid=true;
  if(provider.loseExecuteResponse){provider.loseExecuteResponse=false;throw new DOMException('response lost after transfer','TimeoutError');}
  return Response.json({resultType:'SUCCESS',success:{key:body.key}});
 }}};
 const storage=new Map(),journal='tree.factory.pending.user';
 const source=readFileSync(new URL('../src/factory-client.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'');
 async function send(path,body){const r=await handleFactory(new Request('https://test/api/v3/'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error),{code:data.error});return data;}
 function client(loseClaimResponse=false){return new Function('request','ensureMissionSession','clientError','localStorage',source+';return {recoverFactoryAd,claimFactoryTree};')(
  async(path,body)=>{const result=await send(path.replace('/api/v3/',''),body);if(loseClaimResponse&&path.endsWith('/claim'))throw Error('app terminated before response');return result;},
  async()=>({userId:'user'}),e=>e,{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)});
 }
 async function reserve(earned=true){const gate=await send('ads/reserve',{purpose:'tree-sale'});const saved={...gate,...(earned?{proof:{requestId:gate.requestId,adGroupId:gate.adGroupId,eventType:'userEarnedReward',rewarded:true,displayed:true,dismissed:false}}:{})};storage.set(journal,JSON.stringify(saved));return saved;}
 function restart(){sql.close();open();return client();}
 async function assertSold(){const state=await send('state');assert.equal(state.items.length,0);assert.equal(state.collection.length,30);assert.equal(state.treeSalePending,false);assert.equal(provider.executions,1);assert.equal(provider.keys,1);assert.equal(sql.prepare("SELECT count(*) n FROM tree_factory_payments WHERE purpose='tree-sale'").get().n,1);assert.equal(sql.prepare('SELECT count(*) n FROM tree_factory_items WHERE sold_at IS NOT NULL').get().n,30);}
 t.after(()=>{sql.close();rmSync(dir,{recursive:true,force:true});});
 return {send,reserve,client,restart,assertSold,provider,storage,journal,get sql(){return sql;},failFinalize(){failFinalization=true;}};
}

test('restart halfway through ad: no payout, all 30 decorations remain',async t=>{
 const h=await setup(t);await h.reserve(false);await h.restart().recoverFactoryAd();
 const state=await h.send('state');assert.equal(state.items.filter(i=>i.placed).length,30);assert.equal(state.payments.length,0);assert.equal(h.provider.executions,0);
});
test('restart immediately after earned event, before ad dismissal/server completion: same sale finishes',async t=>{
 const h=await setup(t);await h.reserve();await h.restart().recoverFactoryAd();await h.assertSold();
});
test('restart after server accepts earned proof, before claim is sent: sale finishes once',async t=>{
 const h=await setup(t),saved=await h.reserve();await h.send('ads/complete',saved.proof);
 await h.restart().recoverFactoryAd();await h.assertSold();
});
test('restart after successful claim but before its response arrives: no second payout or deletion',async t=>{
 const h=await setup(t),saved=await h.reserve();await h.send('ads/complete',saved.proof);
 await assert.rejects(h.client(true).claimFactoryTree(saved.requestId),/app terminated/);assert.equal(h.storage.has(h.journal),true);
 await h.restart().recoverFactoryAd();await h.assertSold();assert.equal(h.storage.has(h.journal),false);
});
test('restart after provider transfer but before result is received: original key recovers payment',async t=>{
 const h=await setup(t),saved=await h.reserve();await h.send('ads/complete',saved.proof);h.provider.loseExecuteResponse=true;
 const first=await h.client().claimFactoryTree(saved.requestId);assert.equal(first.treeSalePending,true);assert.equal(first.items.length,30);
 h.restart();await h.send('recover',{});await h.assertSold();assert.equal(h.provider.statusChecks,1);
});
test('restart after successful payout before decoration transaction: consumes 30 once',async t=>{
 const h=await setup(t),saved=await h.reserve();await h.send('ads/complete',saved.proof);h.failFinalize();
 await assert.rejects(h.client().claimFactoryTree(saved.requestId));assert.equal(h.provider.paid,true);
 assert.equal(h.sql.prepare('SELECT finalized_at FROM tree_factory_payments').get().finalized_at,null);
 await h.restart().recoverFactoryAd();await h.assertSold();await h.send('recover',{});await h.assertSold();
});
test('server restart leaves active lease: retry waits for expiry without issuing another transfer',async t=>{
 const h=await setup(t),saved=await h.reserve();await h.send('ads/complete',saved.proof);h.provider.loseExecuteResponse=true;
 await h.client().claimFactoryTree(saved.requestId);
 h.sql.prepare("UPDATE tree_factory_payments SET lease_token='interrupted',lease_until=?").run(Date.now()+45000);
 h.restart();const waiting=await h.send('recover',{});assert.equal(waiting.treeSalePending,true);assert.equal(h.provider.executions,1);
 h.sql.prepare('UPDATE tree_factory_payments SET lease_until=0').run();await h.send('recover',{});await h.assertSold();
});
test('restart after earned proof expires before server acceptance: no payout, decorations stay',async t=>{
 const h=await setup(t);await h.reserve();h.sql.prepare('UPDATE tree_factory_ad_gates SET expires_at=0').run();
 await assert.rejects(h.restart().recoverFactoryAd(),e=>e.code==='request_expired');
 const state=await h.send('state');assert.equal(state.items.filter(i=>i.placed).length,30);assert.equal(state.payments.length,0);assert.equal(h.provider.executions,0);
});
