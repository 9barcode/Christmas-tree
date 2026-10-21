import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPersistence} from '../src/persistence.js';
test('failed storage retains the latest attendance and recovers exactly once',()=>{
 let fail=true,stored,errors=0,recovered=0;
 const p=createPersistence({key:'tree',storage:{setItem(k,v){assert.equal(k,'tree');if(fail)throw Error('quota');stored=v}},onFailure:()=>errors++,onRecovered:()=>recovered++});
 assert.equal(p.save({count:1}),false);assert.equal(p.pending,true);
 assert.equal(p.retry(),false);assert.equal(p.save({count:2}),false);assert.equal(errors,1);
 fail=false;assert.equal(p.retry(),true);assert.deepEqual(JSON.parse(stored),{count:2});assert.equal(p.pending,false);assert.equal(recovered,1);
 p.retry();assert.equal(recovered,1);
});
test('ordinary saves do not replay recovery effects',()=>{
 let recovered=0;const p=createPersistence({key:'tree',storage:{setItem(){}},onRecovered:()=>recovered++});
 assert.equal(p.save({count:30}),true);assert.equal(p.pending,false);assert.equal(recovered,0);
});
