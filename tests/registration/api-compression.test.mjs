import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {gunzipSync} from 'node:zlib';
import {requestHandler} from '../../src/server/http.mjs';
import {request as httpRequest} from 'node:http';
test('large public API JSON is gzip compressed when supported, and remains readable without compression',async()=>{
 const payload={referencePeople:Array.from({length:100},(_,i)=>({id:`P${i}`,name:'Example minister',denomination:'Go Church'}))};
 const server=createServer(requestHandler({origin:'http://localhost',api:async request=>new URL(request.url).pathname.endsWith('/blob') ? new Response(Buffer.alloc(2048,7),{headers:{'Content-Type':'image/webp'}}) : Response.json(payload),nextHandler:(req,res)=>res.end('page')}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const get=(encoding,path='/api/registration/references')=>new Promise((resolve,reject)=>{httpRequest({hostname:'127.0.0.1',port:server.address().port,path,headers:encoding?{'Accept-Encoding':encoding}:{}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({headers:res.headers,body:Buffer.concat(chunks)}));}).on('error',reject).end();});
 try {
  const compressed=await get('gzip, deflate, br');assert.equal(compressed.headers['content-encoding'],'gzip');assert.match(compressed.headers.vary,/Accept-Encoding/);assert.deepEqual(JSON.parse(gunzipSync(compressed.body)),payload);
  const plain=await get('gzip;q=0');assert.equal(plain.headers['content-encoding'],undefined);assert.deepEqual(JSON.parse(plain.body),payload);assert.ok(compressed.body.length<plain.body.length/3);
  const image=await get('gzip','/api/registration/media/blob');assert.equal(image.headers['content-encoding'],undefined);assert.equal(image.body.length,2048);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('only an exact current roster revision receives immutable public caching',async()=>{
 const {createApi}=await import('../../src/server/api.mjs');const api=createApi({config:{},auth:{actor:async()=>null}});
 const url='https://example.com/api/registration/references';
 const initial=await api(new Request(url));const {rosterVersion}=await initial.json();assert.equal(initial.headers.get('cache-control'),'no-store');
 const current=await api(new Request(`${url}?version=${rosterVersion}`));assert.match(current.headers.get('cache-control'),/immutable/);
 const obsolete=await api(new Request(`${url}?version=old`));assert.equal(obsolete.headers.get('cache-control'),'no-store');assert.equal((await obsolete.json()).rosterVersion,rosterVersion);
});
