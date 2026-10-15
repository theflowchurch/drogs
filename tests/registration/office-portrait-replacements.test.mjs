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
