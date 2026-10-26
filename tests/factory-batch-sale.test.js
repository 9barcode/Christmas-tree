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
 const env={DB,REWARDED_AD_GROUP_ID:'reward',TREE_FACTORY_CATALOG:JSON.stringify(catalog.map(a=>({id:a.id,value:2,weight:1})))};
 async function send(path,body,auth=true){const r=await handleFactory(new Request('https://test/api/v3/'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);return {status:r.status,...await r.json()};}
 async function ad(purpose='produce'){const r=await send('ads/reserve',{purpose});assert.equal(r.status,200,JSON.stringify(r));const proof={requestId:r.requestId,adGroupId:r.adGroupId,eventType:'userEarnedReward',rewarded:true,displayed:true,dismissed:true};return {proof,result:await send('ads/complete',proof)};}
 return {sql,env,send,ad};
}

test('sell 1, 2 or 3 chosen items with one ad, exact totals and replay safety',async()=>{
 for(const count of [1,2,3]){
 const {sql,env,send}=await setup();env.INTER_AD_GROUP_ID='inter';
 try{
 await send('state');
 const ids=Array.from({length:count},(_,i)=>'item-'+i);
 ids.forEach((id,i)=>sql.prepare("INSERT INTO tree_factory_items(id,user_id,asset_id,value,source,created_at) VALUES(?,?,?,?,?,?)").run(id,'user',catalog[i].id,i+1,id,Date.now()));
 const ad=await send('ads/reserve',{purpose:'sell',itemIds:ids});assert.equal(ad.status,200,JSON.stringify(ad));
 assert.equal((await send('ads/complete',{requestId:ad.requestId,adGroupId:'inter',displayed:true,dismissed:true,eventType:'dismissed'})).status,200);
 const body={itemIds:ids,adRequestId:ad.requestId};const sold=await send('sell',body);assert.equal(sold.status,200,JSON.stringify(sold));assert.equal(sold.balance,count*(count+1)/2);
 assert.equal((await send('sell',body)).balance,sold.balance);
 }finally{sql.close();}
 }
});
test('placed, duplicate and oversized selections reject before ad reservation; placed items reject after ad too',async()=>{
 const {sql,env,send}=await setup();env.INTER_AD_GROUP_ID='inter';
 try{
 await send('state');
 sql.prepare("INSERT INTO tree_factory_items(id,user_id,asset_id,value,placed,source,created_at) VALUES('one','user',?,2,1,'one',?)").run(catalog[0].id,Date.now());
 assert.equal((await send('ads/reserve',{purpose:'sell',itemIds:['one']})).error,'item_placed');
 assert.equal(sql.prepare('SELECT count(*) n FROM tree_factory_ad_gates').get().n,0);
 for(const ids of [[],['one','one'],['a','b','c','d']])assert.equal((await send('ads/reserve',{purpose:'sell',itemIds:ids})).error,'invalid_request');
 sql.prepare("UPDATE tree_factory_items SET placed=0").run();
 const ad=await send('ads/reserve',{purpose:'sell',itemIds:['one']});
 await send('ads/complete',{requestId:ad.requestId,adGroupId:'inter',displayed:true,dismissed:true,eventType:'dismissed'});
 sql.prepare("UPDATE tree_factory_items SET placed=1").run();
 assert.equal((await send('sell',{itemIds:['one'],adRequestId:ad.requestId})).error,'item_placed');
 assert.equal(sql.prepare('SELECT count(*) n FROM tree_factory_ledger').get().n,0);
 assert.equal(sql.prepare('SELECT sold_at FROM tree_factory_items').get().sold_at,null);
 }finally{sql.close();}
});
