import test from 'node:test';import assert from 'node:assert/strict';
import {createRegistrationRequest} from '../../src/registration/request.mjs';
test('a proxy HTML response is retried once, not through nested retry loops',async()=>{
 let calls=0;const request=createRegistrationRequest({wait:async()=>{},fetcher:async()=>++calls===1?new Response('<html>Check</html>'):Response.json({ok:true})});assert.deepEqual(await request('auth/me'),{ok:true});assert.equal(calls,2);
});
test('a hung read is aborted and settles after a bounded number of attempts',async()=>{
 let calls=0;const request=createRegistrationRequest({wait:async()=>{},fetcher:async(url,{signal})=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));}});
 await assert.rejects(request('auth/me',undefined,{timeoutMs:15}),/taking too long/);assert.equal(calls,2);
});
test('permission errors and writes are not replayed; door and custom upload headers are retained',async()=>{
 let calls=0;const request=createRegistrationRequest({wait:async()=>{},getDoor:()=> 'office',fetcher:async(url,o)=>{calls++;assert.equal(o.headers['X-Kc-Door'],'office');return Response.json({error:'Office access required.'},{status:403});}});
 await assert.rejects(request('settings'),/Office access required/);assert.equal(calls,1);
 const upload=createRegistrationRequest({wait:async()=>{},fetcher:async(url,o)=>{calls++;assert.equal(o.method,'POST');assert.equal(o.headers['Content-Type'],'image/png');throw Error('offline');}});
 await assert.rejects(upload('upload',undefined,{method:'POST',headers:{'Content-Type':'image/png'},body:new Uint8Array([1])}),/unavailable/);assert.equal(calls,2);
});
