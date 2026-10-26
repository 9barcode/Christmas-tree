import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
test('deployed 0009 upgrades without deleting balances or replaying successful tree sales',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  const dir=new URL('../migrations/tree/',import.meta.url);
  for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')&&n<'0010').sort())db.exec(readFileSync(new URL(name,dir),'utf8'));
  db.exec("INSERT INTO tree_users(id,toss_user_key) VALUES('u','anon:test'); INSERT INTO tree_factory_ledger VALUES('old','u',50,'tree_sale',1793000000000); INSERT INTO tree_factory_payments(id,user_id,mode,promotion_code,amount,state,created_at,updated_at,purpose) VALUES('p','u','live','code',50,'succeeded',1793000000000,1793000001000,'tree-sale')");
  assert.throws(()=>db.prepare('SELECT business_date FROM tree_factory_payments').get(),/no such column/);
  db.exec(readFileSync(new URL('0010_tree_sale_daily.sql',dir),'utf8'));
  const p=db.prepare('SELECT * FROM tree_factory_payments').get();
  assert.equal(p.business_date,'2026-10-26');assert.equal(p.finalized_at,1793000001000);
  assert.equal(db.prepare('SELECT amount FROM tree_factory_ledger').get().amount,50);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='tree_factory_one_tree_sale'").get(),undefined);
  const insert=db.prepare("INSERT INTO tree_factory_payments(id,user_id,mode,promotion_code,amount,state,created_at,updated_at,purpose,business_date) VALUES(?,'u','live','code',50,'creating',1,1,'tree-sale',?)");
  assert.throws(()=>insert.run('duplicate','2026-10-26'),/UNIQUE/);
  insert.run('tomorrow','2026-10-27');
 }finally{db.close();}
});
