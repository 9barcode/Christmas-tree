import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBanner,rectanglesOverlap} from '../src/banner.js';
import {publicAdConfig} from '../worker/config.js';
import {readFileSync} from 'node:fs';

function fixture({sdk,configKey='bannerTextAdGroupId',ads={bannerTextAdGroupId:'banner'},loadSdk}={}){
 const region={hidden:true,isConnected:true},target={replaceChildren(){}};
 return {region,target,banner:createBanner({region,target,configKey,loadConfig:async()=>({ads}),loadSdk:loadSdk||(async()=>sdk)})};
}
function fakeSdk(attach){
 const calls={init:0,attach:0,destroy:0};
 const sdk={initialize({callbacks}){calls.init++;callbacks.onInitialized()},attachBanner(id,target,options){calls.attach++;attach?.(options.callbacks,id);return {destroy(){calls.destroy++}}}};
 sdk.initialize.isSupported=()=>true;sdk.attachBanner.isSupported=()=>true;return {sdk,calls};
}
test('configured inline banner initializes once and destroys on leave',async()=>{
 const {sdk,calls}=fakeSdk(cb=>cb.onAdRendered());const f=fixture({sdk});
 await f.banner.start();assert.equal(f.region.hidden,false);assert.equal(calls.init,1);assert.equal(calls.attach,1);
 f.banner.stop();assert.equal(f.region.hidden,true);assert.equal(calls.destroy,1);
 await f.banner.start();assert.equal(calls.init,1);assert.equal(calls.attach,2);f.banner.stop();assert.equal(calls.destroy,2);
});
test('unconfigured or unsupported banner stays collapsed',async()=>{
 let loads=0;const empty=fixture({ads:{},loadSdk:async()=>loads++});await empty.banner.start();assert.equal(loads,0);assert.equal(empty.region.hidden,true);
 const {sdk,calls}=fakeSdk();sdk.initialize.isSupported=()=>false;const f=fixture({sdk});await f.banner.start();assert.equal(f.region.hidden,true);assert.equal(calls.init,0);
});
test('no fill and render failure destroy the slot and leave no blank region',async()=>{
 for(const name of ['onNoFill','onAdFailedToRender']){
  const {sdk,calls}=fakeSdk(cb=>cb[name]({}));const f=fixture({sdk});await f.banner.start();assert.equal(f.region.hidden,true);assert.equal(calls.destroy,1);f.banner.stop();assert.equal(calls.destroy,1);
 }
});
test('leaving during SDK initialization cannot attach a late banner',async()=>{
 const {sdk,calls}=fakeSdk();let callbacks;sdk.initialize=Object.assign(options=>{callbacks=options.callbacks},{isSupported:()=>true});
 const f=fixture({sdk}),ready=f.banner.start();await new Promise(resolve=>setImmediate(resolve));f.banner.stop();callbacks.onInitialized();await ready;
 assert.equal(calls.attach,0);assert.equal(f.region.hidden,true);
});
test('loading list and image slots share SDK initialization but use their own IDs',async()=>{
 const ids=[];const {sdk,calls}=fakeSdk((cb,id)=>{ids.push(id);cb.onAdRendered()});
 const ads={bannerTextAdGroupId:'text-id',bannerImageAdGroupId:'image-id'};
 const list=fixture({sdk,ads,configKey:'bannerTextAdGroupId'}),image=fixture({sdk,ads,configKey:'bannerImageAdGroupId'});
 await Promise.all([list.banner.start(),image.banner.start()]);assert.deepEqual(ids,['text-id','image-id']);assert.equal(calls.init,1);
 list.banner.stop();image.banner.stop();assert.equal(calls.destroy,2);
});
test('config failures do not block or expose an empty advertisement',async()=>{
 const region={hidden:true,isConnected:true},banner=createBanner({region,target:{replaceChildren(){}},loadConfig:async()=>{throw Error('offline')}});
 await banner.start();assert.equal(region.hidden,true);
});
test('public config exposes only banner IDs, not promotion credentials',()=>{
 const c=publicAdConfig({BANNER_AD_GROUP_ID:' text ',BANNER_IMG_AD_GROUP_ID:' image ',TOSS_PROMOTION_CODE_DAY_15:'private'});
 assert.equal(c.bannerTextAdGroupId,'text');assert.equal(c.bannerImageAdGroupId,'image');assert.equal(JSON.stringify(c).includes('private'),false);
});
test('tree utility visibility is affected only when a banner physically overlaps it',()=>{
 const utilities={left:10,top:700,right:390,bottom:790,width:380,height:90};
 const bannerBelow={left:0,top:810,right:400,bottom:900,width:400,height:90};
 const bannerBehindUtilities={left:0,top:760,right:400,bottom:850,width:400,height:90};
 assert.equal(rectanglesOverlap(utilities,bannerBelow),false);
 assert.equal(rectanglesOverlap(utilities,bannerBehindUtilities),true);
 assert.equal(rectanglesOverlap(utilities,{left:0,top:0,right:400,bottom:0,width:400,height:0}),false);
});
test('advertising never belongs to the photographed scene',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),home=html.slice(html.indexOf('<main '),html.indexOf('</main>'));
 assert.equal(home.includes('banner-target'),false);assert.equal((html.match(/class="banner-target"/g)||[]).length,3);
 const js=readFileSync(new URL('../src/factory-home.js',import.meta.url),'utf8');assert.ok(js.includes("home.querySelectorAll('.pot-back,.tree,.pot,.ornament,.floor-item')"));
});
