import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextTestDate} from '../src/test-clock.js';
import {initialState,attend} from '../src/state.js';
import {canContinue,settlementFor} from '../src/settlement.js';
test('test days cross months, leap days and years as calendar days',()=>{assert.equal(nextTestDate('2026-10-31'),'2026-11-01');assert.equal(nextTestDate('2028-02-28'),'2028-02-29');assert.equal(nextTestDate('2026-12-31'),'2027-01-01')});
test('test clock follows the real daily attendance and skipped-day rules',()=>{const s=initialState();let date='2026-10-16';assert.ok(attend(s,date,'pink'));assert.equal(canContinue(s.trees[0],date),false);date=nextTestDate(date);assert.ok(attend(s,date,'pink'));assert.equal(s.trees[0].count,2);date=nextTestDate(nextTestDate(date));assert.equal(canContinue(s.trees[0],date),false);assert.equal(settlementFor(s.trees[0],date).amount,3)});
