import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePhoto,savePhoto,sharePhoto,CHRISTMAS_GREETING} from '../src/photo-save.js';

test('native photo save invokes SDK with raw base64 and never web download',async()=>{
 const calls=[];
 const photo=await preparePhoto(new Blob(['png']),{native:true,readBase64:async()=> 'cG5n',loadNative:async()=>({saveNativePhoto:async data=>calls.push(data)})});
 assert.equal(await savePhoto(photo,{doc:null,nav:null}),'native');assert.deepEqual(calls,['cG5n']);
});
test('native failure propagates so the dialog can report it and allow retry',async()=>{
 const photo=await preparePhoto(new Blob(['png']),{native:true,readBase64:async()=> 'cG5n',loadNative:async()=>({saveNativePhoto:async()=>{throw Error('FAILED_SAVE')}})});
 await assert.rejects(savePhoto(photo,{doc:null}),/FAILED_SAVE/);
});
test('browser uses file sharing with a prepared PNG and preserves cancellation',async()=>{
 const photo=await preparePhoto(new Blob(['png']),{native:false});let shared;
 assert.equal(await savePhoto(photo,{nav:{canShare:()=>true,share:async data=>{shared=data}},doc:null}),'share');assert.equal(shared.files[0].type,'image/png');assert.deepEqual(Object.keys(shared),['files']);
 await assert.rejects(savePhoto(photo,{nav:{canShare:()=>true,share:async()=>{throw new DOMException('cancel','AbortError')}}}),{name:'AbortError'});
});

test('friend sharing sends the PNG and approved greeting while photo saving stays image-only',async()=>{const photo=await preparePhoto(new Blob(['png']),{native:false});let sent;await sharePhoto(photo,{nav:{canShare:()=>true,share:async payload=>{sent=payload}}});assert.deepEqual(Object.keys(sent).sort(),['files','text']);assert.equal(sent.text,CHRISTMAS_GREETING);assert.equal(sent.files[0],photo.file);assert.equal(sent.text,'당신의 겨울에 따뜻한 순간이 가득하길.\n다가오는 새해에도 건강과 행복이 늘 함께하길 바랍니다.\n메리 크리스마스 🎄');});
