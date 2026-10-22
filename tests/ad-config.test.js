import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicAdConfig} from '../worker/config.js';

test('ad IDs are mapped from runtime variables without fallback literals',()=>{
 const values={INTER_AD_GROUP_ID:' interstitial-runtime ',BANNER_TEXT_AD_GROUP_ID:' text-runtime ',BANNER_IMAGE_AD_GROUP_ID:' image-runtime ',REWARDED_AD_GROUP_ID:' rewarded-runtime '};
 const config=publicAdConfig(values);
 assert.deepEqual(config,{interstitialAdGroupId:'interstitial-runtime',bannerTextAdGroupId:'text-runtime',bannerImageAdGroupId:'image-runtime',rewardedAdGroupId:'rewarded-runtime'});
 assert.deepEqual(publicAdConfig({}),{interstitialAdGroupId:'',bannerTextAdGroupId:'',bannerImageAdGroupId:'',rewardedAdGroupId:''});
 assert.equal(publicAdConfig({INTER_AD_GROUP_ID:123}).interstitialAdGroupId,'');
});
test('deploy preserves dashboard variables and never overrides ad IDs from source',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));assert.equal(config.keep_vars,true);
 assert.deepEqual(Object.keys(config.vars||{}).filter(key=>key.includes('AD_GROUP_ID')),[]);
});
test('client reads runtime config including the optional interstitial field',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({ads:publicAdConfig({INTER_AD_GROUP_ID:' new-runtime-id '})})}};
  const {loadServiceConfig}=await import('../src/service-config.js?runtime-config-test');
  assert.equal((await loadServiceConfig()).ads.interstitialAdGroupId,'new-runtime-id');await loadServiceConfig();assert.equal(calls,1);
  globalThis.fetch=async()=>({ok:true,json:async()=>({ads:{}})});
  const old=await import('../src/service-config.js?old-runtime-config-test');assert.equal((await old.loadServiceConfig()).ads.interstitialAdGroupId,'');
 }finally{globalThis.fetch=original}
});

test('all tree slots use the same rewarded ID without allowing caller overrides',async()=>{
 const originalFetch=globalThis.fetch,originalWindow=globalThis.window,calls=[];
 try{
  globalThis.fetch=async()=>({ok:true,json:async()=>({ads:publicAdConfig({REWARDED_AD_GROUP_ID:'shared-reward'})})});
  globalThis.window={treeAds:{showRewarded:async options=>{calls.push(options);return {rewarded:true}}}};
  const {showTreeRewarded}=await import('../src/tree-ads.js');
  for(const id of [1,2,3,4,5]){const result=await showTreeRewarded(id,{adGroupId:'cannot-override'});assert.equal(result.adGroupId,'shared-reward');}
  assert.deepEqual(calls.map(c=>c.treeId),[1,2,3,4,5]);assert.ok(calls.every(c=>c.adGroupId==='shared-reward'));
 }finally{globalThis.fetch=originalFetch;globalThis.window=originalWindow}
});
