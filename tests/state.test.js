import {test} from 'node:test';import assert from 'node:assert/strict';
import {initialState,attend,createTree,validateState,localDate} from '../src/state.js';
test('attendance never creates another tree',()=>{const s=initialState();assert.ok(attend(s,'2026-10-16'));assert.equal(s.trees.length,1);assert.equal(s.trees[0].count,1);assert.equal(attend(s,'2026-10-16'),false)});
test('any chosen slot can be created before attendance without filling other slots',()=>{
 const s=initialState();assert.ok(createTree(s,4,'pink'));assert.equal(s.selected,4);assert.deepEqual(s.trees.slice(1,4),[null,null,null]);assert.equal(s.trees[0].count,0);
 assert.ok(attend(s,'2026-10-16'));assert.equal(s.trees[4].count,1);assert.equal(s.trees[3],null);
 const restored=validateState(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored,s);
 assert.ok(createTree(restored,1,'blue'));assert.ok(attend(restored,'2026-10-16'));assert.equal(restored.trees[4].count,1);
});
test('creation does not overwrite existing progress, colour or placements and caps slots at five',()=>{
 const s=initialState();assert.ok(createTree(s,2,'gold'));s.trees[2].positions={gift:{x:25,y:70}};const before=structuredClone(s);
 for(const index of [-1,0,2,5,1.5,NaN])assert.equal(createTree(s,index,'pink'),false);
 assert.deepEqual(s,before);assert.equal(s.trees[0].color,'green');
 for(const index of [4,3,1])assert.ok(createTree(s,index,'white'));assert.equal(s.trees.length,5);
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))),s);
});
test('legacy automatic slots retain earned progress, untouched trees and reward records',()=>{
 const s=initialState();s.trees[0]={color:'green',count:1,lastDate:'2026-10-16',positions:{a:{x:20,y:70}},rewardRecord:{status:'pending'}};s.trees.push({color:'pink',count:0,lastDate:null});
 assert.deepEqual(validateState(structuredClone(s)),s);
});
test('each tree completes at 30 and cannot advance further',()=>{const s=initialState();for(let i=0;i<30;i++)attend(s,`day-${i}`);assert.equal(s.trees[0].count,30);assert.equal(attend(s,'day-31'),false);assert.equal(s.trees.length,1)});
test('invalid persisted state resets safely and empty selection falls back to first tree',()=>{
 assert.deepEqual(validateState({version:1,trees:[]}),initialState());assert.deepEqual(validateState({version:1,trees:[null]}),initialState());
 const s=initialState();createTree(s,4,'blue');s.selected=2;assert.equal(validateState(s).selected,0);assert.equal(attend(s,'2026-10-16'),false);
 assert.equal(localDate(new Date('2026-10-15T15:01:00Z')),'2026-10-16');
});
