import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPaid,canShare,restartTree} from '../src/tree-actions.js';
import {rewardKey} from '../src/settlement.js';
import {initialState,validateState,attend} from '../src/state.js';
function paid(count=30){const s=initialState();s.trees[0]={color:'green',count,lastDate:'2026-10-14',positions:{a:{x:50,y:50}}};s.trees.push({color:'pink',count:1,lastDate:'2026-10-16'});s.trees[0].rewardRecord={key:rewardKey(s.trees[0],0),status:'paid',amount:465};return s;}
test('sharing requires 30 days and payment for this exact tree record',()=>{const s=paid();assert.ok(canShare(s.trees[0],0));assert.equal(canShare(s.trees[0],1),false);assert.equal(canShare(paid(5).trees[0],0),false);s.trees[0].rewardRecord.status='pending';assert.equal(canShare(s.trees[0],0),false)});
test('restart preserves unlocked slots, clears only selected tree and survives reload',()=>{const s=paid(),other=structuredClone(s.trees[1]);assert.ok(restartTree(s,0,'2026-10-16'));assert.deepEqual(s.trees[1],other);assert.equal(s.trees[0].count,0);assert.deepEqual(s.trees[0].positions,{});assert.equal(isPaid(s.trees[0],0),false);assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))),s);assert.ok(attend(s,'2026-10-16','blue'));assert.equal(s.trees.length,2)});
test('unpaid or unsettled trees cannot be reset',()=>{const s=paid();s.trees[0].rewardRecord.status='pending';assert.equal(restartTree(s,0,'2026-10-16'),false);assert.equal(restartTree(initialState(),0,'2026-10-16'),false)});
test('each new cycle has a distinct payment key even with same dates and count',()=>{const s=paid(5),old=rewardKey(s.trees[0],0);restartTree(s,0,'2026-10-16');s.trees[0].count=5;s.trees[0].lastDate='2026-10-14';assert.notEqual(rewardKey(s.trees[0],0),old)});
