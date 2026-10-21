import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPhotoPreparation} from '../src/photo-preparation.js';
test('failed photo preparation retries in the same dialog',async()=>{
 let calls=0,errors=0,busy=0,photo;
 const retry=createPhotoPreparation({prepare:async()=>{if(++calls===1)throw Error('decode');return 'png'},onBusy:()=>busy++,onReady:p=>photo=p,onError:()=>errors++});
 await retry();assert.equal(errors,1);assert.equal(photo,undefined);
 await retry();assert.equal(photo,'png');assert.equal(calls,2);assert.equal(busy,2);
});
test('repeated taps cannot overlap photo preparations',async()=>{
 let finish,calls=0,ready=0;
 const retry=createPhotoPreparation({prepare:()=>{calls++;return new Promise(resolve=>finish=resolve)},onReady:()=>ready++});
 const first=retry();await retry();assert.equal(calls,1);finish('png');await first;assert.equal(ready,1);
});
test('late preparations cannot update a replaced or closed dialog',async()=>{
 let current=true,finish,ready=0;
 const retry=createPhotoPreparation({prepare:()=>new Promise(resolve=>finish=resolve),isCurrent:()=>current,onReady:()=>ready++});
 const first=retry();current=false;finish('png');await first;await retry();assert.equal(ready,0);
});
