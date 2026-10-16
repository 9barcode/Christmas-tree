import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import manifest from '../src/decoration-manifest.js';
test('startup module matches the canonical decoration manifest',async()=>{const canonical=JSON.parse(await readFile(new URL('../assets/decoration-manifest.json',import.meta.url),'utf8'));assert.deepEqual(manifest,canonical);assert.equal(manifest.assets.length,30);});
