import test from 'node:test';
import assert from 'node:assert/strict';
import {requestJson} from './request.mjs';
test('slow responses within the request budget succeed and preserve server time',async()=>{
 const result=await requestJson('/test',{method:'POST'},{timeoutMs:100,fetchImpl:async()=>{
  await new Promise(resolve=>setTimeout(resolve,15));
  return new Response(JSON.stringify({version:2}),{headers:{'x-server-time':'123'}});
 }});
 assert.deepEqual(result,{data:{version:2},serverTime:123});
});
test('timeout has a stable error and never retries a mutation',async()=>{
 let calls=0;
 await assert.rejects(requestJson('/test',{method:'POST'},{timeoutMs:5,fetchImpl:async(_url,{signal})=>{
  calls++;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 }}),{message:'CONNECTION_TIMEOUT'});
 assert.equal(calls,1);
});
test('definitive rejection preserves its domain code',async()=>{
 await assert.rejects(requestJson('/test',{method:'POST'},{fetchImpl:async()=>new Response(JSON.stringify({error:'VERSION_CONFLICT'}),{status:400})}),error=>error.message==='VERSION_CONFLICT'&&error.definitive===true);
});
