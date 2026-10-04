import {mkdir,cp,writeFile,rm} from 'node:fs/promises';
// Explicit public-asset allowlist: the reconciled portrait library, denomination
// marks and branding back the directory. Never export .private, source
// workbooks, API keys, local audit reports, or the repository itself.
const published=['brand','bishops','pastors','denominations','outreach','payment-apps', 'portraits'];
await mkdir('public/assets',{recursive:true});
await rm('public/assets',{recursive:true,force:true});
await mkdir('public/assets',{recursive:true});
await cp('assets/mitre-transparent.png','public/assets/mitre-transparent.png');
for(const folder of published)await cp(`assets/${folder}`,`public/assets/${folder}`,{recursive:true});
await writeFile('public/.nojekyll','');
// The API reference is published at /docs from the same Markdown.
const {readFile}=await import('node:fs/promises');
await writeFile('src/registration/api-docs.json',JSON.stringify({markdown:await readFile('API.md','utf8')}));
