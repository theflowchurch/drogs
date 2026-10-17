import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {canonicalSiteRedirect} from '../src/registration/organization-sites.mjs';
const root=resolve('out');
const base=(process.env.NEXT_PUBLIC_BASE_PATH||'').replace(/\/$/,'');
const port=Number(process.env.PORT||4198);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.txt':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const redirect=canonicalSiteRedirect(url.pathname+url.search,base);
  if(redirect){res.writeHead(308,{Location:redirect});res.end();return}
  if(base && url.pathname!==base && !url.pathname.startsWith(base+'/')){res.writeHead(404);res.end('Not found');return}
  const relative=decodeURIComponent(url.pathname.slice(base.length));
  let file=resolve(root,'.'+relative);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
  if((await stat(file)).isDirectory()){
   if(!url.pathname.endsWith('/')){res.writeHead(308,{Location:url.pathname+'/'+url.search});res.end();return}
   file=resolve(file,'index.html');
  }
  const contents=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});
  res.end(req.method==='HEAD'?undefined:contents);
 }catch{res.writeHead(404);res.end('Not found')}
}).listen(port,'127.0.0.1',()=>console.log(`Next.js export: http://127.0.0.1:${port}${base}/`));
