import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function client(saved,failClaim=false){
 const values=new Map(saved?[['tree.factory.pending.user',JSON.stringify(saved)]]:[]),calls=[];
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const source=readFileSync(new URL('../src/factory-client.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'');
 const api=new Function('request','ensureMissionSession','clientError','localStorage',source+';return {recoverFactoryAd,claimFactoryTree};')(
  async(path,body)=>{calls.push({path,body});if(failClaim&&path.endsWith('/claim'))throw Error('offline');return {};},
  async()=>({userId:'user'}),e=>e,storage);
 return {api,values,calls};
}
const earned={purpose:'tree-sale',requestId:'ad-one',expiresAt:Date.now()+60000,proof:{requestId:'ad-one',adGroupId:'reward',displayed:true,dismissed:false,eventType:'userEarnedReward',rewarded:true}};
test('unfinished ad is cancelled on restart, without any sale request',async()=>{
 const c=client({...earned,proof:undefined});await c.api.recoverFactoryAd();
 assert.deepEqual(c.calls.map(x=>x.path),['/api/v3/ads/cancel']);assert.equal(c.values.size,0);
});
test('earned proof survives restart until the original claim is acknowledged',async()=>{
 const c=client(earned);await c.api.recoverFactoryAd();
 assert.deepEqual(c.calls.map(x=>x.path),['/api/v3/ads/complete','/api/v3/claim']);
 assert.equal(c.calls[1].body.adRequestId,'ad-one');assert.equal(c.values.size,0);
 const failed=client(earned,true);await assert.rejects(failed.api.recoverFactoryAd(),/offline/);assert.equal(failed.values.size,1);
});
test('legacy interstitial close proof cannot resume a tree sale',async()=>{
 const c=client({...earned,proof:{...earned.proof,eventType:'dismissed',rewarded:false}});
 await assert.rejects(c.api.recoverFactoryAd());assert.equal(c.calls.some(x=>x.path.endsWith('/claim')),false);
});
function native(events){
 const source=readFileSync(new URL('../src/native-promotions.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'');
 const loadAd=Object.assign(({onEvent})=>{queueMicrotask(()=>onEvent({type:'loaded'}));return ()=>{};},{isSupported:()=>true});
 const showAd=Object.assign(({onEvent})=>{queueMicrotask(()=>events.forEach(type=>onEvent({type})));return ()=>{};},{isSupported:()=>true});
 return new Function('User','loadFullScreenAd','showFullScreenAd',source+';return {showNativeRewarded};')({},loadAd,showAd);
}
test('partial ad close rejects; earned event is persisted before dismissal',async()=>{
 await assert.rejects(native(['show','dismissed']).showNativeRewarded({adGroupId:'r'}),/시청을 완료/);
 let proof;
 const result=await native(['show','userEarnedReward','dismissed']).showNativeRewarded({adGroupId:'r',onEarned:p=>{proof=p;assert.equal(p.dismissed,false);}});
 assert.equal(proof.rewarded,true);assert.equal(result.rewarded,true);assert.equal(result.dismissed,true);
});
