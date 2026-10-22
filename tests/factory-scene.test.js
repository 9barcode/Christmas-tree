import test from 'node:test';
import assert from 'node:assert/strict';
import {startFactoryScene} from '../src/factory-scene.js';

function harness(t,{stopped=false,reduced=false}={}){
 const saved=Object.fromEntries(['document','matchMedia','MutationObserver','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const doc=new EventTarget();doc.body={dataset:{page:'factory'}};doc.hidden=false;
 const motion=new EventTarget();motion.matches=reduced;
 const frames=new Map(),calls=[];let sequence=0,observer,disconnected=false,producing=false;
 globalThis.document=doc;globalThis.matchMedia=()=>motion;
 globalThis.requestAnimationFrame=fn=>{frames.set(++sequence,fn);return sequence;};
 globalThis.cancelAnimationFrame=id=>frames.delete(id);
 globalThis.MutationObserver=class{constructor(fn){observer=fn;}observe(){}disconnect(){disconnected=true;}};
 const ctx=new Proxy({}, {get:(_,name)=>(...args)=>calls.push([name,...args]),set:()=>true});
 const canvas={parentElement:{},getContext:()=>ctx},image={decode:()=>Promise.resolve()};
 const stop=startFactoryScene(canvas,image,()=>stopped,()=>producing);
 t.after(()=>{stop();for(const [k,descriptor] of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}});
 return {canvas,calls,doc,motion,frames,stop,get disconnected(){return disconnected;},
  producing(value){producing=value;observer();},
  tick(time){const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(time);},
 };
}

test('production wakes an idle/stopped scene, including the last daily item',async t=>{
 const h=harness(t,{stopped:true});await Promise.resolve();h.tick(0);
 assert.equal(h.canvas.hidden,true);assert.equal(h.frames.size,0);
 h.producing(true);h.tick(100);
 assert.equal(h.canvas.hidden,false);
 const first=h.calls.filter(c=>c[0]==='drawImage').map(c=>c.slice(2));
 assert.equal(h.calls.filter(c=>c[0]==='rotate').length,4,'painted rollers rotate');
 h.calls.length=0;h.tick(300);
 assert.notDeepEqual(h.calls.filter(c=>c[0]==='drawImage').map(c=>c.slice(2)),first,'both Santas change pose over time');
 assert.ok(h.calls.some(c=>c[0]==='lineTo'),'belt joints travel');
 h.producing(false);h.tick(350);
 assert.equal(h.canvas.hidden,true);assert.equal(h.frames.size,0);
});

test('hidden pages and reduced motion stop drawing; visibility restores production',async t=>{
 const h=harness(t);await Promise.resolve();h.producing(true);h.tick(0);
 h.doc.hidden=true;h.doc.dispatchEvent(new Event('visibilitychange'));h.tick(100);
 assert.equal(h.canvas.hidden,true);assert.equal(h.frames.size,0);
 h.doc.hidden=false;h.doc.dispatchEvent(new Event('visibilitychange'));h.tick(200);
 assert.equal(h.canvas.hidden,false);
 h.motion.matches=true;h.motion.dispatchEvent(new Event('change'));h.tick(300);
 assert.equal(h.canvas.hidden,true);assert.equal(h.frames.size,0);
 h.motion.matches=false;h.motion.dispatchEvent(new Event('change'));h.tick(400);
 assert.equal(h.canvas.hidden,false);
 h.stop();assert.equal(h.canvas.hidden,true);assert.equal(h.frames.size,0);assert.equal(h.disconnected,true);
 h.producing(true);assert.equal(h.frames.size,0,'disposed scene cannot restart');
});
