import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicAdConfig} from '../worker/config.js';

test('ad IDs are mapped from runtime variables without fallback literals',()=>{
 const values={INTERSTITIAL_AD_GROUP_ID:' interstitial-runtime ',BANNER_AD_GROUP_ID:' home-runtime ',LOADING_LIST_AD_GROUP_ID:' list-runtime ',LOADING_IMAGE_AD_GROUP_ID:' image-runtime '};
 const config=publicAdConfig(values);
 assert.equal(config.interstitialAdGroupId,'interstitial-runtime');assert.equal(config.bannerAdGroupId,'home-runtime');assert.equal(config.loadingListAdGroupId,'list-runtime');assert.equal(config.loadingImageAdGroupId,'image-runtime');
 const empty=publicAdConfig({});assert.equal(empty.interstitialAdGroupId,'');assert.equal(empty.bannerAdGroupId,'');assert.equal(empty.loadingListAdGroupId,'');assert.equal(empty.loadingImageAdGroupId,'');assert.deepEqual(Object.values(empty.rewardedAdGroupIds),['','','','','']);
 assert.equal(publicAdConfig({INTERSTITIAL_AD_GROUP_ID:123}).interstitialAdGroupId,'');
});
test('deploy preserves dashboard variables and never overrides ad IDs from source',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));assert.equal(config.keep_vars,true);
 assert.deepEqual(Object.keys(config.vars||{}).filter(key=>key.includes('AD_GROUP_ID')),[]);
});
test('client reads runtime config including the optional interstitial field',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({ads:publicAdConfig({INTERSTITIAL_AD_GROUP_ID:' new-runtime-id '})})}};
  const {loadServiceConfig}=await import('../src/service-config.js?runtime-config-test');
  assert.equal((await loadServiceConfig()).ads.interstitialAdGroupId,'new-runtime-id');await loadServiceConfig();assert.equal(calls,1);
  globalThis.fetch=async()=>({ok:true,json:async()=>({ads:{bannerAdGroupId:'',rewardedAdGroupIds:{1:'',2:'',3:'',4:'',5:''}}})});
  const old=await import('../src/service-config.js?old-runtime-config-test');assert.equal((await old.loadServiceConfig()).ads.interstitialAdGroupId,'');
 }finally{globalThis.fetch=original}
});
