// Run on the deployed server with its normal environment, or create a key in /admin/.
import { mkdir, open } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { configuration } from '../src/server/config.mjs';
import { createPool } from '../src/server/database.mjs';
import { createKeyService } from '../src/server/api-keys.mjs';
if(process.argv.includes('--help')){console.log('Create a key in /admin/ → API keys, or run on the server: npm run api:key -- --name=Agent --days=90');process.exit(0);}
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const n=arg.indexOf('=');if(!arg.startsWith('--')||n<0)throw Error('Use --name=value arguments.');return[arg.slice(2,n),arg.slice(n+1)];}));
if(args.help!==undefined){console.log('Run on the server: node scripts/create-management-key.mjs --name="Photo CLI agent" --days=90 --output=.private/photo-agent-key.json [--email=APPROVED_OFFICE_EMAIL]');process.exit(0);}
if(!process.env.DB_HOST||!process.env.SESSION_SECRET){console.error('Create a live key in https://kuriakecastle.org/admin/ → API keys → Select full data management access. This server-only issuer requires the deployed application environment.');process.exit(1);}
const config=configuration(),pool=createPool(config);let handle;
try{
 const email=(args.email||config.admins[0]).toLowerCase();if(!config.admins.includes(email))throw Error('Choose a configured office email.');
 const [[account]]=await pool.execute('SELECT id,email FROM dr_users WHERE email=?',[email]);if(!account)throw Error('The office account must sign in once before issuing its key.');
 const path=resolve(args.output||'.private/photo-agent-key.json');if(!path.startsWith(resolve('.private')+'/'))throw Error('Store the secret inside .private.');
 await mkdir(dirname(path),{recursive:true,mode:0o700});handle=await open(path,'wx',0o600);
 const result=await createKeyService({pool,config}).issue({...account,office:true},{name:args.name||'Photo CLI agent',days:Number(args.days??90),scopes:['backend:read','backend:write']});
 await handle.writeFile(JSON.stringify({baseUrl:config.origin,...result},null,2)+'\n');console.log(JSON.stringify({id:result.key.id,secretFile:path,expiresAt:result.key.expiresAt}));
} catch(e){console.error(e.message);process.exitCode=1;}finally{await handle?.close();await pool.end();}
