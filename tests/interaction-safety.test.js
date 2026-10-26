import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/factory-home.js',import.meta.url),'utf8');

test('busy state blocks the app without overwriting each button’s own disabled condition',()=>{
 assert.match(source,/for\(const root of document\.body\.children\)if\(!root\.matches\('\.toast'\)\)root\.inert=value/);
 assert.doesNotMatch(source,/querySelectorAll\([^\n]*button[^\n]*\)\.forEach\(b=>b\.disabled=value\)/);
 assert.match(source,/async function run\(action\)\{if\(busy\)return;setBusy\(true\)/);
});

test('small finger drift remains a tap; intentional movement starts dragging',()=>{
 assert.match(source,/Math\.hypot\(dx,dy\)<16/);
 assert.match(source,/n\.onpointerup=e=>finish\(e,false\)/);
});
