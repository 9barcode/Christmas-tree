import test from 'node:test';
import assert from 'node:assert/strict';
import {startFactoryScene} from '../src/factory-scene.js';

function harness(t,{decode=()=>Promise.resolve()}={}){
 const keys=['document','matchMedia','MutationObserver'];
 const saved=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 class Element{
  constructor(){this.children=[];this.dataset={};this.style={};}
  setAttribute(){}
  append(child){this.children.push(child);child.parent=this;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  decode(){return decode();}
 }
 const doc=new EventTarget();doc.hidden=false;doc.body={dataset:{page:'factory'}};doc.createElement=()=>new Element();
 const motion=new EventTarget();motion.matches=false;let observer,disconnected=false,producing=false;
 globalThis.document=doc;globalThis.matchMedia=()=>motion;
 globalThis.MutationObserver=class{constructor(fn){observer=fn;}observe(){}disconnect(){disconnected=true;}};
 const scene=new Element();scene.classList={contains:name=>name==='producing'?producing:name==='stopped'};
 const painting={src:'original.png'},stop=startFactoryScene(scene,painting),actors=scene.children[0];
 t.after(()=>{stop();for(const [key,d] of Object.entries(saved)){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}});
 return {doc,motion,painting,actors,scene,stop,get disconnected(){return disconnected;},produce(value){producing=value;observer();}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('independent layers start only during production, including the daily limit',async t=>{
 const h=harness(t);assert.equal(h.actors.hidden,true);await settle();
 assert.equal(h.painting.src,'original.png','the original painting is never replaced');
 assert.equal(h.actors.hidden,true);assert.equal(h.actors.dataset.running,'false');
 h.produce(true);assert.equal(h.actors.hidden,false);assert.equal(h.actors.dataset.running,'true','stopped limit does not suppress the final production');
 h.produce(false);assert.equal(h.actors.hidden,true);assert.equal(h.actors.dataset.running,'false','skipping restores the exact original painting');
 h.produce(true);h.doc.hidden=true;h.doc.dispatchEvent(new Event('visibilitychange'));
 assert.equal(h.actors.dataset.running,'false');
 h.doc.hidden=false;h.doc.dispatchEvent(new Event('visibilitychange'));
 assert.equal(h.actors.dataset.running,'true');
 h.motion.matches=true;h.motion.dispatchEvent(new Event('change'));assert.equal(h.actors.dataset.running,'false');
 h.motion.matches=false;h.motion.dispatchEvent(new Event('change'));assert.equal(h.actors.dataset.running,'true');
 h.stop();assert.equal(h.disconnected,true);assert.equal(h.scene.children.length,0);assert.equal(h.actors.dataset.running,'false');
});

test('a missing sprite preserves the original painting instead of an empty scene',async t=>{
 const h=harness(t,{decode:()=>Promise.reject(Error('missing asset'))});h.produce(true);await settle();
 assert.equal(h.painting.src,'original.png');assert.equal(h.actors.hidden,true);assert.equal(h.actors.dataset.running,'false');
});

test('leaving while assets load cannot reattach an abandoned scene',async t=>{
 let complete;const pending=new Promise(resolve=>{complete=resolve;});
 const h=harness(t,{decode:()=>pending});h.stop();complete();await settle();
 assert.equal(h.painting.src,'original.png');assert.equal(h.scene.children.length,0);
});
