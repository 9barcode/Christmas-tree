import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pageEffects} from '../src/page-effects.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('cached navigation restarts effects once and disposes previous effects',async()=>{
 const target=new EventTarget();let starts=0,stops=0;
 const effects=pageEffects(async()=>{starts++;return ()=>stops++},{target});
 await effects.start();await effects.start();assert.equal(starts,1);
 target.dispatchEvent(new Event('pagehide'));assert.equal(stops,1);
 const restore=()=>target.dispatchEvent(Object.assign(new Event('pageshow'),{persisted:true}));
 restore();restore();await tick();assert.equal(starts,2);
 effects.stop();assert.equal(stops,2);
});
test('an async effect finishing after navigation is immediately disposed',async()=>{
 const target=new EventTarget();let finish,stops=0;
 const effects=pageEffects(()=>new Promise(resolve=>finish=resolve),{target});
 const ready=effects.start();effects.stop();finish(()=>stops++);await ready;assert.equal(stops,1);
});
test('a failed start can be retried on restore',async()=>{
 const target=new EventTarget();let attempts=0,errors=0;
 const effects=pageEffects(async()=>{if(++attempts===1)throw Error('decode');return ()=>{}},{target,onError:()=>errors++});
 await assert.rejects(effects.start(),/decode/);await effects.start();assert.equal(attempts,2);assert.equal(errors,1);
});
