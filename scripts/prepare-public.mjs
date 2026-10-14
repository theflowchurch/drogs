import {mkdir,cp,writeFile,rm,readFile} from 'node:fs/promises';
import { dirname } from 'node:path';
import { publishedPortraits } from './lib/published-portraits.mjs';
// Explicit public-asset allowlist: the reconciled portrait library, denomination
// marks and branding back the directory. Never export .private, source
// workbooks, API keys, local audit reports, or the repository itself.
const published=['brand','denominations','payment-apps'];
await mkdir('public/assets',{recursive:true});
await rm('public/assets',{recursive:true,force:true});
await mkdir('public/assets',{recursive:true});
await cp('assets/mitre-transparent.png','public/assets/mitre-transparent.png');
for(const folder of published)await cp(`assets/${folder}`,`public/assets/${folder}`,{recursive:true});
const people = JSON.parse(await readFile('src/registration/reference-people.json','utf8'));
for (const file of publishedPortraits(people)) {
  await mkdir(dirname(`public/${file}`), { recursive: true });
  await cp(file, `public/${file}`);
}
await writeFile('public/.nojekyll','');
// The API reference is published at /docs from the same Markdown.
await writeFile('src/registration/api-docs.json',JSON.stringify({markdown:await readFile('API.md','utf8')}));
