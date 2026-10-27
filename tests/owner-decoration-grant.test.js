import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const dir=new URL('../migrations/tree/',import.meta.url);
const grant=readFileSync(new URL('0011_owner_missing_decorations.sql',dir),'utf8');
function setup(tie=false){
 const db=new DatabaseSync(':memory:');
 for(const f of readdirSync(dir).filter(f=>f.endsWith('.sql')&&f<'0011').sort())db.exec(readFileSync(new URL(f,dir),'utf8'));
 db.exec("INSERT INTO tree_users(id,toss_user_key) VALUES('a','anon:a'),('b','anon:b'),('c','anon:c'); INSERT INTO tree_factory_items(id,user_id,asset_id,value,placed,source,created_at) VALUES('1','a','reindeer',2,1,'one',1),('2','a','reindeer',2,0,'two',1),('3','b','santa-hat',2,0,'three',1); INSERT INTO tree_factory_ledger VALUES('balance','a',7,'sale',1)");
 if(tie)db.exec("INSERT INTO tree_factory_items(id,user_id,asset_id,value,source,created_at) VALUES('4','b','bow-red',1,'four',1)");
 return db;
}
test('grant fills only the unique leader, preserves existing items and balance, and cannot repeat',()=>{
 const db=setup();try{
  db.exec(grant);
  const audit=db.prepare('SELECT * FROM tree_admin_decoration_grants').get();
  assert.equal(audit.user_id,'a');assert.equal(audit.owned_before,2);assert.equal(audit.inserted_count,29);
  assert.equal(db.prepare("SELECT count(DISTINCT asset_id) AS n FROM tree_factory_items WHERE user_id='a' AND sold_at IS NULL").get().n,30);
  assert.equal(db.prepare("SELECT count(*) AS n FROM tree_factory_collection WHERE user_id='a'").get().n,30);
  assert.equal(db.prepare("SELECT count(*) AS n FROM tree_factory_items WHERE user_id='b'").get().n,1);
  assert.equal(db.prepare("SELECT placed FROM tree_factory_items WHERE id='1'").get().placed,1);
  assert.equal(db.prepare('SELECT amount FROM tree_factory_ledger').get().amount,7);
  db.exec(grant);assert.equal(db.prepare('SELECT count(*) AS n FROM tree_factory_items').get().n,32);
 }finally{db.close();}
});
test('ties and active payouts abort without granting to another account',()=>{
 for(const tie of [true,false]){const db=setup(tie);try{
  if(!tie)db.exec("INSERT INTO tree_factory_payments(id,user_id,mode,promotion_code,amount,state,created_at,updated_at) VALUES('p','a','live','code',50,'pending',1,1)");
  assert.throws(()=>db.exec(grant),/NOT NULL/);
  assert.equal(db.prepare("SELECT count(*) AS n FROM tree_factory_items WHERE source LIKE 'admin:%'").get().n,0);
 }finally{db.close();}}
});
