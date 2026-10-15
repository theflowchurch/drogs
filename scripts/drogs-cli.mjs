#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { extname, basename } from 'node:path';
const args=process.argv.slice(2),options={};const positional=[];
for(let i=0;i<args.length;i++){const arg=args[i];if(arg.startsWith('--')){const [key,...parts]=arg.slice(2).split('=');options[key]=parts.length?parts.join('='):['apply','allow-new','move-existing','help'].includes(key)?true:args[i+1]&&!args[i+1].startsWith('--')?args[++i]:true;}else positional.push(arg);}
const [command,id,file]=positional;
const help=`DROGS management CLI
Set DROGS_API_KEY to an admin-issued key. DROGS_API_URL defaults to https://kuriakecastle.org.
  people [--search=NAME] [--bishop=ID] [--photo-task=missing|replace] [--after=CURSOR]
  person ID
  edit ID --json=fields.json [--bishop=ID] [--revision=REVISION]
  add --json=fields.json --bishop=ID
  photo ID /path/to/photo.jpg [--revision=REVISION]
  import /path/to/pastors.xlsx --bishop=ID [--allow-new] [--move-existing] [--apply]
  progress
  schema
  action NAME --json=payload.json
Import previews by default; --apply commits the whole validated batch. No existing pastors are deleted by imports.`;
if(!command||command==='help'||options.help){console.log(help);process.exit(0);}
try{
 const token=process.env.DROGS_API_KEY;if(!token)throw Error('Set DROGS_API_KEY to your live management key. Create it in /admin/ → API keys.');
 const base=new URL(process.env.DROGS_API_URL||'https://kuriakecastle.org');if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname)))throw Error('Use HTTPS for the API URL.');
 const headers={authorization:`Bearer ${token}`,...(options.revision?{'if-match':String(options.revision)}:{})};let path,method='GET',body;
 const json=async()=>{if(!options.json||options.json===true)throw Error('Supply --json=/path/to/file.json.');return JSON.parse(await readFile(options.json,'utf8'));};
 const query=values=>{const q=new URLSearchParams(Object.entries(values).filter(([,v])=>v!==undefined));return q.size?'?'+q:'';};
 if(command==='people')path='/people'+query({search:options.search,bishopId:options.bishop,photoTask:options['photo-task'],after:options.after,limit:options.limit});
 else if(command==='person'){if(!id)throw Error('Supply a person ID.');path='/people/'+encodeURIComponent(id);}
 else if(['edit','add'].includes(command)){if(command==='edit'&&!id)throw Error('Supply a person ID.');path='/people'+(command==='edit'?'/'+encodeURIComponent(id):'');method=command==='edit'?'PATCH':'POST';body=JSON.stringify({fields:await json(),...(options.bishop?{bishopId:options.bishop}:{})});headers['content-type']='application/json';}
 else if(command==='photo'){
  if(!id||!file)throw Error('Supply a person ID and photo file.');path='/people/'+encodeURIComponent(id)+'/photo';method='PUT';const ext=extname(file).toLowerCase();headers['content-type']={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[ext];if(!headers['content-type'])throw Error('Use JPG, PNG or WebP.');body=await readFile(file);if(body.length>5*1024*1024){const sharp=(await import('sharp')).default;body=await sharp(body).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();headers['content-type']='image/webp';}
 }
 else if(command==='import'){
  if(!id||!options.bishop)throw Error('Supply a sheet file and --bishop=ID.');method='POST';path='/people/import';headers['x-source-filename']=basename(id);const ext=extname(id).toLowerCase();body=await readFile(id);
  if(ext==='.json'){const data=JSON.parse(body);body=JSON.stringify({rows:Array.isArray(data)?data:data.rows,bishopId:options.bishop,allowNew:options['allow-new']===true,moveExisting:options['move-existing']===true,dryRun:options.apply!==true});headers['content-type']='application/json';}
  else {headers['content-type']={'.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.csv':'text/csv'}[ext];if(!headers['content-type'])throw Error('Use XLSX, CSV or JSON.');path+=query({bishopId:options.bishop,allowNew:String(options['allow-new']===true),moveExisting:String(options['move-existing']===true),dryRun:String(options.apply!==true)});}
 }
 else if(command==='progress')path='/photo-progress';else if(command==='schema')path='/schema';
 else if(command==='action'){if(!id)throw Error('Supply an action name.');path='/actions';method='POST';body=JSON.stringify({name:id,payload:await json()});headers['content-type']='application/json';}
 else throw Error('Unknown command. Run with --help.');
 const response=await fetch(new URL('/api/v1'+path,base),{method,headers,body,redirect:'error'});const result=await response.json();if(!response.ok)throw Error(`HTTP ${response.status}: ${result.error||'Request failed'}`);console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.message.replaceAll(process.env.DROGS_API_KEY||'___NO_KEY___','[REDACTED]'));process.exitCode=1;}
