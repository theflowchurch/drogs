import test from 'node:test';
import assert from 'node:assert/strict';
import {denominationPeople,ministerSections,DENOMINATION_SITES} from '../../src/registration/denomination-sites.mjs';
const b={id:'b',role:'bishop',name:'Bishop James',denomination:'Go Church',city:'Brussels',gender:'male'};
const p={id:'p',role:'pastor',name:'Anne Pastor',denomination:'Go Church',city:'London',gender:'female'};
test('denomination pages use current office corrections, removals and extra people without including other churches',()=>{
 const state={source:'original',photos:'all',referencePeople:[b,p,{...b,id:'other',denomination:'Go Ye Church'},{...b,id:'city',denomination:'Lighthouse City Churches'}],overrides:{p:{name:'Anne Corrected',photo:'saved-new.webp',city:'Brussels'}},extraReferences:[{...p,id:'new',name:'New minister'}],hidden:['b']};
 const list=denominationPeople(state,'gochurch');
 assert.deepEqual(list.map(p=>p.id),['p','new']);assert.equal(list[0].photo,'saved-new.webp');assert.equal(list[0].name,'Anne Corrected');assert.equal(list[0].city,'Brussels');
 assert.deepEqual(denominationPeople(state,'lighthousechapelinternational'),[]);
 assert.deepEqual(denominationPeople(state,'unknown'),[]);
});
test('the three sites publish their current roster as approved without changing accounts or payments',()=>{
 const state={source:'original',photos:'confirmed',referencePeople:[{...b,image:'current.webp'}],roll:[],registrations:[{payment:'unpaid'}]};const before=structuredClone(state);
 const list=denominationPeople(state,'gochurch');assert.equal(list[0].standing,true);assert.equal(list[0].image,'current.webp');assert.deepEqual(state,before);
 const current=denominationPeople({...state,source:'roll',roll:[p]},'gochurch');assert.deepEqual(current.map(p=>p.id),['b','p'],'the current submitted roster, plus someone new who registered and was confirmed under this church (18 Nov)');
});
test('bishops and pastors remain separate sections with city and gender filters and no rank toggle',()=>{
 const lay={...b,id:'lay',title:'Lay President',name:'Lay Leader'};
 let list=ministerSections([p,lay,b]);assert.deepEqual(list.bishops.map(p=>p.id),['b']);assert.deepEqual(new Set(list.pastors.map(p=>p.id)),new Set(['p','lay']));
 list=ministerSections([p,b],{city:'London',gender:'female'});assert.equal(list.bishops.length,0);assert.deepEqual(list.pastors,[p]);
 assert.equal(ministerSections([b,p],{q:'Anne London'}).pastors.length,1);

});
test('reverends precede other pastors while bishops stay in the first section',()=>{
 const people=[{...p,id:'ordinary',name:'Anna Aardvark',title:'Pastor'},{...p,id:'rev',name:'Zoe Zulu',title:'Rev.'},{...p,id:'lady',name:'Lady Brown',title:'Lady Rev.'},b];
 const sections=ministerSections(people);
 assert.deepEqual(sections.bishops.map(p=>p.id),['b']);
 assert.deepEqual(sections.pastors.map(p=>p.id),['lady','rev','ordinary']);
});

test('public titles spell out Reverend while retaining office titles and ordering',async()=>{
 const {ministerDisplayTitle}=await import('../../src/registration/denomination-sites.mjs');
 const reverend={...p,title:'Rev.'},lady={...p,title:'Lady Rev.',gender:'female'};
 assert.equal(ministerDisplayTitle(reverend),'Reverend');
 assert.equal(ministerDisplayTitle(lady),'Lady Reverend');
 assert.equal(ministerDisplayTitle(b),'Bishop');
 assert.equal(reverend.title,'Rev.');assert.equal(lady.title,'Lady Rev.');
 assert.deepEqual(ministerSections([p,reverend]).pastors,[reverend,p]);
});

test('all submitted denomination names have a site and every directory is isolated', async()=>{
 const {DENOMINATIONS,WITHOUT_CHURCH_SITE}=await import('../../src/registration/denominations.mjs');
 const {normalName}=await import('../../src/registration/model.mjs');
 const {organizationSitePaths}=await import('../../src/registration/organization-sites.mjs');
 const names=new Set(Object.values(DENOMINATION_SITES).flatMap(s=>s.denominations.map(normalName)));
 // The Affiliated Denominations' churches (office, 17 Nov) have no church site of their own.
 for(const name of Object.entries(DENOMINATIONS).filter(([o])=>o!=='Affiliated Denominations').flatMap(([,d])=>d).filter(n=>!WITHOUT_CHURCH_SITE.includes(n)))assert.ok(names.has(normalName(name)),`Missing submitted denomination: ${name}`);
 const records=Object.entries(DENOMINATION_SITES).map(([path,site],i)=>({...p,id:path,role:i%2?'bishop':'pastor',denomination:site.denominations[0]}));
 const snapshot={referencePeople:records,overrides:{},hidden:[]};
 for(const [path,site] of Object.entries(DENOMINATION_SITES)){
  assert.match(path,/^[a-z0-9]+$/);assert.ok(!organizationSitePaths.includes(path),'Denomination route must not replace an organization umbrella');
  assert.deepEqual(denominationPeople(snapshot,path).map(p=>p.id),[path],`Cross-denomination records in ${site.name}`);
 }
});

test('all denomination artwork exists and missing artwork stays unset',async()=>{
 const {existsSync}=await import('node:fs');
 for(const site of Object.values(DENOMINATION_SITES)){
  if(site.logo)assert.ok(existsSync(site.logo),`Missing logo for ${site.name}`);
  else assert.equal(site.logo,'');
  if(site.homeLayout){const {landingStyle}=await import('../../src/registration/denomination-landing-styles.mjs');assert.ok(landingStyle(site.homeLayout));}
 }
});


test('every denomination site has its own landing composition',async()=>{
 const {LANDING_STYLES}=await import('../../src/registration/denomination-landing-styles.mjs');
 assert.ok(LANDING_STYLES.length>=85);assert.equal(new Set(LANDING_STYLES.map(s=>s.id)).size,LANDING_STYLES.length);
 const counts=new Map(LANDING_STYLES.map(s=>[s.id,0]));
 for(const config of Object.values(DENOMINATION_SITES))if(config.homeLayout)counts.set(config.homeLayout,counts.get(config.homeLayout)+1);
 for(const [id,count] of counts){assert.ok(count>=1,`Unused style ${id}`);assert.ok(count<=1,`More than one site uses ${id}`);}
});

test('a church site locks sign-up to its own organization and denomination and only shows its people',async()=>{
 const {churchPlacement,inChurch,churchOfDenomination}=await import('../../src/registration/denomination-sites.mjs');
 const {catalogOf}=await import('../../src/registration/model.mjs');
 const {FLOW_GROUPS}=await import('../../src/registration/organization-sites.mjs');
 const allos=churchPlacement(catalogOf(null),'allosmegachurch',FLOW_GROUPS);
 assert.equal(allos.organization,'United Denominations');assert.equal(allos.denomination,'Allos Mega Church');
 assert.ok(inChurch(allos,{denomination:'ALLOS MEGA CHURCH'}));assert.ok(!inChurch(allos,{denomination:'Go Church'}));
 assert.ok(inChurch(null,{denomination:'Go Church'}),'outside a church site nothing is filtered');
 const hjc=churchPlacement(catalogOf(null),'healingjesuscampaign',FLOW_GROUPS);
 assert.equal(hjc.organization,'HJC');assert.ok(inChurch(hjc,{organization:'HJC',denomination:''}));assert.ok(!inChurch(hjc,{organization:'FLOW'}));
 assert.equal(churchPlacement({organizations:[],denominations:{}},'allosmegachurch').organization,'','a church missing from the catalog stays closed');
 assert.equal(churchOfDenomination('Allos Mega Church'),'allosmegachurch');
});

test('every church page with a logo has a square browser-tab icon (wide logos are not squashed)', async () => {
  const { existsSync } = await import('node:fs');
  const { DENOMINATION_SITES } = await import('../../src/registration/denomination-sites.mjs');
  const missing = Object.entries(DENOMINATION_SITES).filter(([path, s]) => s.logo && !existsSync(`assets/denominations/icons/${path}.png`)).map(([path]) => path);
  assert.deepEqual(missing, []);
});

test('church pages live at /<church>/rollofgoodstanding/licensingauthority/ (19 Nov)', async () => {
  const { churchHref } = await import('../../src/registration/denomination-sites.mjs');
  assert.equal(churchHref('gochurch'), '/gochurch/rollofgoodstanding/licensingauthority/');
  assert.equal(churchHref('gochurch', 'signup', 'https://kuriakecastle.org'), 'https://kuriakecastle.org/gochurch/rollofgoodstanding/licensingauthority/signup/');
  assert.equal(churchHref('gochurch', '/directory/'), '/gochurch/rollofgoodstanding/licensingauthority/directory/');
});
