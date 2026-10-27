import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/factory-home.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/factory.css',import.meta.url),'utf8');

test('every tab help entry point opens the same current guide',()=>{
 assert.match(source,/function showGuide\(\)/);
 assert.match(source,/function guideCard\(image,title,description\)/);
 assert.match(source,/\$\('\.guide-link'\)\.onclick=showGuide/);
 assert.match(source,/button\('\?',showGuide,'help-button'\)/);
 assert.match(source,/장식을 모아 트리를 꾸며요/);
 assert.match(source,/추가 장식도 모을 수 있어요/);
 assert.doesNotMatch(source,/guideCard\([^\n]*광고/);
 assert.match(source,/완성한 트리는 하루 5회 판매해요/);
 assert.match(source,/guideCard\('assets\/thumbnails\/bell-brass\.webp'/);
 assert.doesNotMatch(source,/하루 한 번 출석/);
});

test('tree utilities show guide and photo sharing without a rewards button',()=>{
 assert.doesNotMatch(html,/class="rewards-link"/);
 assert.match(source,/const share=button\('사진 저장 · 공유',showShare,'photo-link'\)/);
 assert.match(styles,/\.tree-utilities \.guide-link\{grid-column:1;grid-row:1\}/);
 assert.match(styles,/\.tree-utilities \.photo-link\{grid-column:2;grid-row:1/);
 assert.match(styles,/\.tree-utilities \.tree-sale-link\{grid-column:1\/-1;grid-row:2/);
});
