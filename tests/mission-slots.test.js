import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleMissions} from '../worker/missions.js';

test('server accepts independent slots while preserving ad, authentication and daily checks',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const name of ['0001_initial.sql','0002_milestone_promotions.sql'])sql.exec(readFileSync(new URL('../migrations/tree/'+name,import.meta.url),'utf8'));
 const token='a'.repeat(64),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
 sql.prepare('INSERT INTO tree_users(id,toss_user_key) VALUES(?,?)').run('user','anon:test');
 sql.prepare('INSERT INTO tree_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash,'user','2099-01-01T00:00:00Z');
 const DB={prepare(query){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(query).get(...values)??null},async all(){return {results:sql.prepare(query).all(...values)}},async run(){const result=sql.prepare(query).run(...values);return {meta:{changes:Number(result.changes)}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}};
 const env={DB,REWARDED_AD_GROUP_ID:'shared-reward'};
 const send=(body,auth=true)=>handleMissions(new Request('https://test/api/attendance',{method:'POST',headers:{'content-type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}),env);
 try{
  const body={treeId:5,adGroupId:'shared-reward',eventType:'userEarnedReward'};
  assert.equal((await send(body,false)).status,401);
  assert.equal((await send({...body,adGroupId:'wrong'})).status,503);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM tree_mission_progress').get().n,0);
  const first=await send(body);assert.equal(first.status,200);assert.equal((await first.json()).progress.completed,1);
  const again=await send(body);assert.equal((await again.json()).progress.completed,1);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM tree_mission_progress WHERE slot < 5').get().n,0);
  const second=await send({treeId:2,adGroupId:'shared-reward',eventType:'userEarnedReward'});assert.equal(second.status,200);assert.equal((await second.json()).progress.completed,1);
  assert.equal((await send({...body,treeId:6})).status,400);
 }finally{sql.close()}
});
