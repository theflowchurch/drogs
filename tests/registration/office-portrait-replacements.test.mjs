import test from 'node:test';import assert from 'node:assert/strict';
import { emptyState, directoryPeople } from '../../src/registration/model.mjs';
import { replaceOfficePortraits } from '../../src/registration/office-portrait-replacements.mjs';
const refs=[{id:'B1',role:'bishop',name:'First Bishop'}, {id:'B2',role:'bishop',name:'Second Bishop'}, {id:'P1',role:'pastor',name:'Daniel Marcus Annan',bishop:'First Bishop'}];
test('explicit ZIP photo replacement clears only the inspected saved portrait and never overwrites a newer photo',()=>{
 const references=[...refs.slice(0,2),{...refs[2],image:'assets/portraits/new.webp'}],rule={id:'P1',previousPhoto:'old-office.webp',image:'assets/portraits/new.webp',source:'Explicit office ZIP'};
 const state={...emptyState(),overrides:{P1:{photo:'old-office.webp',city:'Office city',_officeFields:['city']}},profiles:[{id:'member',referenceId:'P1'}],registrations:[{userId:'member',year:2027,status:'confirmed',data:{referenceId:'P1',role:'pastor',photo:'old-office.webp'}}]};
 const next=replaceOfficePortraits(state,references,[rule]);assert.equal(next.overrides.P1.photo,'');assert.equal(next.overrides.P1.city,'Office city');assert.equal(next.registrations[0].displayPhoto,'reference');assert.equal(directoryPeople(next,references).find(p=>p.id==='P1').image,rule.image);assert.equal(replaceOfficePortraits(next,references,[rule]),null);
 const newer=structuredClone(state);newer.overrides.P1.photo='newer-office.webp';assert.equal(replaceOfficePortraits(newer,references,[rule]),null);assert.equal(state.overrides.P1.photo,'old-office.webp');
});

test('a person the office added by hand gets the edited portrait on that record, never over a newer upload',()=>{
 const rule={id:'X1',previousPhoto:'old-office.webp',image:'assets/portraits/X1-new.webp',source:'Edited portrait'};
 const state={...emptyState(),extraReferences:[{id:'X1',role:'bishop',name:'Added Bishop',image:'',photo:'old-office.webp'}],overrides:{X1:{branch:'Centre',deleted:false}}};
 const next=replaceOfficePortraits(state,refs,[rule]);
 const added=next.extraReferences.find(p=>p.id==='X1');assert.equal(added.photo,'');assert.equal(added.image,rule.image);
 assert.equal(directoryPeople(next,refs).find(p=>p.id==='X1').image,rule.image);assert.equal(replaceOfficePortraits(next,refs,[rule]),null);
 const newer=structuredClone(state);newer.extraReferences[0].photo='newer-office.webp';assert.equal(replaceOfficePortraits(newer,refs,[rule]),null);
});

test('a renamed portrait file moves a hand-added record already switched to the old name',()=>{
 const rule={id:'X1',previousPhoto:'old-office.webp',previousImage:'assets/portraits/X1-a.webp',image:'assets/portraits/X1-b.webp',source:'Edited portrait'};
 const state={...emptyState(),extraReferences:[{id:'X1',role:'bishop',name:'Added Bishop',image:'assets/portraits/X1-a.webp',photo:''}]};
 const next=replaceOfficePortraits(state,refs,[rule]);assert.equal(next.extraReferences[0].image,rule.image);assert.equal(state.extraReferences[0].image,'assets/portraits/X1-a.webp');assert.equal(replaceOfficePortraits(next,refs,[rule]),null);
 const upload=structuredClone(state);upload.extraReferences[0].photo='newer-office.webp';assert.equal(replaceOfficePortraits(upload,refs,[rule]),null);
});
