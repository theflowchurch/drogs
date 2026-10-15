import test from 'node:test';import assert from 'node:assert/strict';import {createServer}from'node:http';import{execFile}from'node:child_process';import{promisify}from'node:util';import{mkdtemp,writeFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';
test('CLI sends authenticated edits, raw photos and preview/apply sheet imports without printing its key',async()=>{
 const requests=[],token='drogs_live_cli_test_secret';let fail=false;
 const server=createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);requests.push({url:req.url,method:req.method,headers:req.headers,body:Buffer.concat(chunks)});res.writeHead(fail?403:200,{'content-type':'application/json'});res.end(JSON.stringify(fail?{error:token}:{ok:true}));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const dir=await mkdtemp(`${tmpdir()}/drogs-cli-`),run=promisify(execFile);const env={...process.env,DROGS_API_KEY:token,DROGS_API_URL:`http://127.0.0.1:${server.address().port}`};
 try{
  const fields=`${dir}/fields.json`,photo=`${dir}/portrait.jpg`,sheet=`${dir}/pastors.xlsx`;await writeFile(fields,JSON.stringify({name:'Correct Pastor'}));await writeFile(photo,Buffer.from([255,216,255,217]));await writeFile(sheet,'test-sheet-bytes');
  await run(process.execPath,['scripts/drogs-cli.mjs','edit','P1',`--json=${fields}`,'--bishop=B2'],{env});assert.equal(requests.at(-1).method,'PATCH');assert.deepEqual(JSON.parse(requests.at(-1).body),{fields:{name:'Correct Pastor'},bishopId:'B2'});
  await run(process.execPath,['scripts/drogs-cli.mjs','photo','P1',photo],{env});assert.equal(requests.at(-1).headers['content-type'],'image/jpeg');assert.equal(requests.at(-1).body.length,4);
  await run(process.execPath,['scripts/drogs-cli.mjs','import',sheet,'--bishop=B2','--allow-new'],{env});assert.match(requests.at(-1).url,/dryRun=true/);assert.match(requests.at(-1).url,/allowNew=true/);
  const result=await run(process.execPath,['scripts/drogs-cli.mjs','import','--apply',sheet,'--bishop=B2'],{env});assert.match(requests.at(-1).url,/dryRun=false/);assert.equal(requests.at(-1).headers['x-source-filename'],'pastors.xlsx');assert.ok(!result.stdout.includes(token));assert.ok(requests.every(r=>r.headers.authorization===`Bearer ${token}`));
  fail=true;await assert.rejects(run(process.execPath,['scripts/drogs-cli.mjs','progress'],{env}),e=>!e.stderr.includes(token)&&e.stderr.includes('[REDACTED]'));
 }finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
