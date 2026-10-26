import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/factory-home.js',import.meta.url),'utf8');

test('every tab help entry point opens the same current guide',()=>{
 assert.match(source,/function showGuide\(\)/);
 assert.match(source,/\$\('\.guide-link'\)\.onclick=showGuide/);
 assert.match(source,/button\('\?',showGuide,'help-button'\)/);
 assert.match(source,/공장에서 광고를 보고 하루 기본 10개/);
 assert.match(source,/야근 리워드 광고로 추가 10개/);
 assert.match(source,/완성한 트리를 판매해 벨을 모아요/);
 assert.doesNotMatch(source,/하루 한 번 출석/);
});

test('the tree rewards entry consistently opens the inventory and balance view',()=>{
 assert.match(source,/function showRewards\(\)\{setPage\('inventory'\);\}/);
 assert.match(source,/\$\('\.rewards-link'\)\.onclick=showRewards/);
});
