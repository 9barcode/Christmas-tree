import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildApiBase,defaultApiBaseUrl} from '../scripts/api-config.mjs';
import {readApiResponse} from '../src/api-response.js';

test('release without a repository variable targets Treemoa, development stays local',()=>{
 assert.equal(buildApiBase('',{release:true}),defaultApiBaseUrl);
 assert.equal(buildApiBase('  ',{release:true}),defaultApiBaseUrl);
 assert.equal(buildApiBase(''), '');
 assert.equal(buildApiBase(' https://example.com/ ',{release:true}),'https://example.com');
});
test('release rejects malformed or path-prefixed API addresses before packaging',()=>{
 for(const value of ['treemoa.example.com','http://example.com','https://example.com/api','https://example.com?test=1','https://example.com#test','https://user:pass@example.com']){
  assert.throws(()=>buildApiBase(value,{release:true}),/TREE_API_BASE_URL/);
 }
});
test('HTML app-shell responses become actionable errors instead of Safari JSON syntax errors',async()=>{
 const response=new Response('<!doctype html><html>app</html>',{status:200,headers:{'content-type':'text/html'}});
 await assert.rejects(readApiResponse(response),error=>error.code==='invalid_api_response'&&error.status===200&&error.cause instanceof SyntaxError);
 assert.deepEqual(await readApiResponse(Response.json({service:'treemoa'})),{service:'treemoa'});
});
