import {test} from 'node:test';import assert from 'node:assert/strict';
import {loadingText,DOT_INTERVAL_MS,waitForHomeReady} from '../src/loading-state.js';
test('dots advance every 400ms through zero to three then reset',()=>{assert.equal(DOT_INTERVAL_MS,400);assert.deepEqual([0,1,2,3,4].map(loadingText),['트리 꾸미러 가는 중','트리 꾸미러 가는 중.','트리 꾸미러 가는 중..','트리 꾸미러 가는 중...','트리 꾸미러 가는 중'])});
test('home waits for every actual readiness task',async()=>{let complete=false,release;const image=new Promise(r=>release=r);const done=waitForHomeReady([()=>Promise.resolve(),()=>image],1000).then(()=>complete=true);await new Promise(r=>setTimeout(r,5));assert.equal(complete,false);release();await done;assert.equal(complete,true)});
test('failed and stalled tasks fail rather than expose an incomplete home',async()=>{await assert.rejects(waitForHomeReady([()=>Promise.reject(Error('image failed'))]),/image failed/);await assert.rejects(waitForHomeReady([()=>new Promise(()=>{})],5),/초과/)});
