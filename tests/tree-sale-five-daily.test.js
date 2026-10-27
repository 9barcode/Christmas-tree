import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
test('DB atomically caps five daily reservations, serializes pending, preserves history and allows failed retries',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  const dir=new URL('../migrations/tree/',import.meta.url);
  for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')&&n<'0015').sort())db.exec(readFileSync(new URL(name,dir),'utf8'));
  db.exec("INSERT INTO tree_users(id,toss_user_key) VALUES('u','anon:test')");
  db.exec("INSERT INTO tree_factory_payments(id,user_id,mode,promotion_code,amount,state,created_at,updated_at,purpose,business_date,finalized_at) VALUES('old','u','live','code',50,'succeeded',1,1,'tree-sale','2026-10-27',1)");
  db.exec(readFileSync(new URL('0015_tree_sale_daily_guard.sql',dir),'utf8'));
  const insert=db.prepare("INSERT INTO tree_factory_payments(id,user_id,mode,promotion_code,amount,state,created_at,updated_at,purpose,business_date) VALUES(?,'u','live','code',50,'creating',1,1,'tree-sale',?) ON CONFLICT DO NOTHING");
  const finish=db.prepare("UPDATE tree_factory_payments SET state='succeeded',finalized_at=1 WHERE id=?");
  assert.equal(insert.run('second','2026-10-27').changes,1);
  assert.equal(insert.run('parallel','2026-10-27').changes,0);
  db.exec("UPDATE tree_factory_payments SET state='failed' WHERE id='second'");
  for(let i=2;i<=5;i++){assert.equal(insert.run('sale'+i,'2026-10-27').changes,1);finish.run('sale'+i);}
  assert.equal(insert.run('sixth','2026-10-27').changes,0);
  assert.equal(insert.run('tomorrow','2026-10-28').changes,1);finish.run('tomorrow');
  assert.equal(insert.run('no-date',null).changes,0);
  db.exec("INSERT INTO tree_factory_ledger VALUES('tree-sale:u','u',50,'tree_sale',1793000000000)");
  for(let i=1;i<=4;i++){assert.equal(insert.run('legacy'+i,'2026-10-26').changes,1);finish.run('legacy'+i);}
  assert.equal(insert.run('legacy-fifth','2026-10-26').changes,0);
  assert.equal(db.prepare("SELECT amount FROM tree_factory_ledger").get().amount,50);
  assert.equal(db.prepare("SELECT count(*) n FROM tree_factory_payments WHERE state='succeeded' AND business_date='2026-10-27'").get().n,5);
 }finally{db.close();}
});
test('app confirmation stays three lines and uses five-sale policy',()=>{
 const source=readFileSync(new URL('../src/factory-home.js',import.meta.url),'utf8');
 assert.match(source,/트리 판매로 50P · 하루 5회\\n배치한 장식은 사라져요\.\\n도감 기록은 유지돼요\./);
 assert.match(source,/previewState\.treeSold=previewState\.treeSaleCount>=5/);
});
