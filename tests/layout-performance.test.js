import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import bounds from '../src/asset-bounds.js';
import {catalog} from '../src/factory-model.js';
const source=readFileSync(new URL('../src/factory-home.js',import.meta.url),'utf8');
function fixture(save){
 const start=source.indexOf('const before=structuredClone(snapshot);');
 const end=source.indexOf('\n }));',start);
 const body=source.slice(start,end);
 const events=[];const initial={items:[{id:'i',asset_id:'bow-red',placed:0}],revision:7};
 const env={snapshot:structuredClone(initial),item:initial.items[0],a:{kind:'ornament'},byId:{'bow-red':{kind:'ornament'}},defaultPosition:()=>({x:50,y:50}),$:()=>({close:()=>events.push('close')}),setPageAfterAction:()=>events.push('navigate'),renderTree:async()=>events.push('render'),requestAnimationFrame:fn=>fn(),saveLayout:async()=>{events.push('save');await save();}};
 const build=new Function('env','let {snapshot,item,a,byId,defaultPosition,$,setPageAfterAction,renderTree,requestAnimationFrame,saveLayout}=env;return {action:async()=>{'+body+'},state:()=>snapshot}');
 return {...build(env),events};
}
test('placement navigates and paints before a slow server save finishes',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve);const f=fixture(()=>pending);
 const task=f.action();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.events.slice(0,4),['close','navigate','render','save']);
 assert.equal(f.state().items[0].placed,1);finish();await task;
});
test('failed optimistic placement restores the previous layout',async()=>{
 const f=fixture(async()=>{throw Error('offline');});
 await assert.rejects(f.action(),/offline/);
 assert.equal(f.state().items[0].placed,0);assert.equal(f.state().revision,7);
});
test('packaged tree artwork uses cached bounds rather than startup pixel scanning',()=>{
 for(const path of ['assets/trees/tree-green.webp','assets/planters/planter-wood.webp',...catalog.map(a=>a.path)]){
  assert.ok(bounds[path]?.w>0);assert.ok(bounds[path]?.h>0);
  assert.equal(bounds[path].box.split(' ').length,4);
 }
 assert.match(source,/new Map\(Object.entries\(assetBounds\)\)/);
 assert.match(source,/Date.now\(\)-lastRefreshAt<10000/);
});
