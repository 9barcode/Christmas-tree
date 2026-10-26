import test from 'node:test';
import assert from 'node:assert/strict';
import {startFactoryScene} from '../src/factory-scene.js';

function harness(t){
 const keys=['document','matchMedia','MutationObserver'];
 const saved=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const created=[];
 class Element{
  constructor(){this.children=[];}
  setAttribute(){}
  append(child){this.children.push(child);child.parent=this;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 }
 const doc=new EventTarget();doc.hidden=false;doc.body={dataset:{page:'factory'}};
 doc.createElement=tag=>{created.push(tag);return new Element();};
 const motion=new EventTarget();motion.matches=false;let observer,disconnected=false,producing=false;
 globalThis.document=doc;globalThis.matchMedia=()=>motion;
 globalThis.MutationObserver=class{constructor(fn){observer=fn;}observe(){}disconnect(){disconnected=true;}};
 const scene=new Element();scene.classList={contains:name=>name==='producing'?producing:name==='stopped'};
 const stop=startFactoryScene(scene),effect=scene.children[0];
 t.after(()=>{stop();for(const [key,d] of Object.entries(saved)){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}});
 return {doc,motion,effect,scene,stop,created,get disconnected(){return disconnected;},produce(value){producing=value;observer();}};
}

test('only the oven pulse runs during production and skipping immediately restores the painting',t=>{
 const h=harness(t);
 assert.equal(h.effect.hidden,true);assert.deepEqual(h.created,['div','div'],'no sprite images or canvas are created');
 h.produce(true);assert.equal(h.effect.hidden,false,'final production still pulses even at the daily limit');
 h.produce(false);assert.equal(h.effect.hidden,true);
 h.produce(true);h.doc.hidden=true;h.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(h.effect.hidden,true);
 h.doc.hidden=false;h.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(h.effect.hidden,false);
 h.motion.matches=true;h.motion.dispatchEvent(new Event('change'));assert.equal(h.effect.hidden,true);
 h.motion.matches=false;h.motion.dispatchEvent(new Event('change'));assert.equal(h.effect.hidden,false);
});

test('leaving removes the light effect and disposed observers cannot restart it',t=>{
 const h=harness(t);h.produce(true);h.stop();
 assert.equal(h.disconnected,true);assert.equal(h.scene.children.length,0);assert.equal(h.effect.hidden,true);
 h.produce(true);assert.equal(h.effect.hidden,true);
});
