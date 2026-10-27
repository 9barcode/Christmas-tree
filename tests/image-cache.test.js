import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createImageCache} from '../src/image-cache.js';
test('image decodes are shared, bounded and retryable after failure',async()=>{
 let calls=0,fail=false;
 const cache=createImageCache({maxEntries:1,create:()=>({naturalWidth:100,naturalHeight:100,async decode(){calls++;if(fail)throw Error('offline');}})});
 const a=cache.load('a');assert.equal(cache.load('a'),a);await a;
 await cache.load('b');await cache.load('a');assert.equal(calls,3);
 cache.clear();fail=true;await assert.rejects(cache.load('bad'),/offline/);
 fail=false;await cache.load('bad');assert.equal(calls,5);
});
test('asset worker caches only allowlisted local art; APIs and ad responses bypass it',async()=>{
 const handlers={},saved=new Map();let network=0,quota=false;
 const cache={async match(key){return saved.get(typeof key==='string'?key:key.url)?.clone();},async put(key,r){if(quota)throw Error('quota');saved.set(typeof key==='string'?key:key.url,r);},async keys(){return [...saved.keys()].map(url=>({url}));},async delete(key){return saved.delete(key.url);}};
 const source=readFileSync(new URL('../asset-cache-worker.js',import.meta.url),'utf8').replace('__ASSET_VERSION__','test').replace('__ASSET_PATHS__',JSON.stringify(['/assets/tree.png']));
 vm.runInNewContext(source,{URL,Headers,Response,AbortSignal,self:{location:{href:'https://app.test/asset-cache-worker.js'},addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>cache},fetch:async()=>{network++;return new Response('image',{headers:{'content-type':'image/png'}});}});
 function request(url){let result;const tasks=[];handlers.fetch({request:new Request(url),respondWith:p=>result=p,waitUntil:p=>tasks.push(p)});return {get result(){return result;},tasks};}
 for(const url of ['https://app.test/api/v3/state','https://ads.test/ad.png','https://app.test/assets/private.png','https://app.test/assets/tree.png?account=other'])assert.equal(request(url).result,undefined);
 let event=request('https://app.test/assets/tree.png');assert.equal(await (await event.result).text(),'image');await Promise.all(event.tasks);
 event=request('https://app.test/assets/tree.png');assert.equal(await (await event.result).text(),'image');assert.equal(network,1);
 saved.clear();quota=true;event=request('https://app.test/assets/tree.png');assert.equal(await (await event.result).text(),'image');await Promise.all(event.tasks);assert.equal(network,2);
});
