import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePhoto,savePhoto} from '../src/photo-save.js';

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
