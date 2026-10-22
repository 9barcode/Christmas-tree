import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clientError} from '../src/client-errors.js';

test('native timeout errors with read-only messages retain their original cause',()=>{
 const original=new DOMException('The operation timed out.','TimeoutError');
 const result=clientError(original);
 assert.match(result.message,/서버 응답 시간이 초과/);
 assert.equal(result.cause,original);
 assert.equal(original.message,'The operation timed out.');
});

test('translated frozen server errors preserve status and code for recovery',()=>{
 const original=Object.freeze(Object.assign(new Error('expired'),{code:'request_expired',status:409}));
 const result=clientError(original,{request_expired:'다시 시도해 주세요.'});
 assert.equal(result.message,'다시 시도해 주세요.');
 assert.equal(result.code,'request_expired');
 assert.equal(result.status,409);
 assert.equal(result.cause,original);
 assert.equal(original.message,'expired');
});

test('unmapped native and SDK errors are rethrown unchanged',()=>{
 for(const original of [new DOMException('Storage denied','SecurityError'),Object.freeze(new Error('login failed'))]){
  assert.equal(clientError(original),original);
 }
});
