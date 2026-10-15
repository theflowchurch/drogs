import test from 'node:test';import assert from 'node:assert/strict';import * as XLSX from 'xlsx';
import { emptyState, directoryPeople, publicOverlay, overlayReferences } from '../../src/registration/model.mjs';
import { changePerson, importPastors, workbookPastors } from '../../src/server/managed-people.mjs';
import { peopleForSite } from '../../src/registration/organization-sites.mjs';
import { replaceOfficePortraits } from '../../src/registration/office-portrait-replacements.mjs';
import { photoProgress } from '../../src/registration/photo-progress.mjs';
const actor={id:'office',office:true,apiKeyId:'key-one',apiKeyName:'Photo agent'};
const refs=[{id:'B1',role:'bishop',name:'First Bishop',organization:'First Love',group:'First Love',denomination:'First Love Church'}, {id:'B2',role:'bishop',name:'Second Bishop',organization:'United Denominations',group:'UD Ghana',denomination:'The Mega Church'}, {id:'P1',role:'pastor',title:'Pastor',name:'Daniel Marcus Annan',dob:'1990-01-01',bishop:'First Bishop',organization:'First Love',group:'First Love',denomination:'First Love Church',image:'assets/portraits/old.webp'}];
test('person corrections and moves persist on linked accounts and split public directories',()=>{
 const state={...emptyState(),profiles:[{id:'member',referenceId:'P1',role:'pastor'}],registrations:[{userId:'member',year:2027,status:'confirmed',data:{referenceId:'P1',role:'pastor',name:refs[2].name,bishopId:'B1',organization:'First Love'}}]};
 const result=changePerson(state,actor,refs,{id:'P1',bishopId:'B2',fields:{name:'Daniel Marcus Annan Junior',city:'New City',phone:'123456789'}});
 assert.equal(result.person.bishop,'Second Bishop');assert.equal(result.person.city,'New City');assert.equal(result.state.registrations[0].data.bishopId,'B2');assert.equal(result.state.registrations[0].data.name,'Daniel Marcus Annan Junior');
 assert.ok(result.state.overrides.P1._officeFields.includes('city'));assert.equal(result.state.audit.at(-1).apiKeyId,'key-one');
 const publicState={...emptyState(),...publicOverlay(result.state)};const publicPeople=directoryPeople(publicState,refs);
 assert.equal(peopleForSite(publicPeople,'firstlove').some(p=>p.id==='P1'),false);assert.equal(peopleForSite(publicPeople,'ud').find(p=>p.id==='P1').name,'Daniel Marcus Annan Junior');
 assert.equal(publicOverlay(result.state).overrides.P1.phone,undefined);assert.equal(state.registrations[0].data.bishopId,'B1');
});
test('a shortened name with the same birthday is a duplicate; confirmed namesakes with different birthdays remain distinct',()=>{
 assert.throws(()=>changePerson(emptyState(),actor,refs,{bishopId:'B1',fields:{name:'Daniel Marcus',role:'pastor',dob:'01/01/1990'}}),/Possible duplicate/);
 const {person}=changePerson(emptyState(),actor,refs,{bishopId:'B1',fields:{name:'Daniel Marcus',role:'pastor',dob:'01/01/1991'}});assert.equal(person.dob,'1991-01-01');
 assert.throws(()=>changePerson(emptyState(),actor,refs,{bishopId:'B1',fields:{name:'Third Bishop',role:'bishop'}}),/Bishops cannot/);
 assert.throws(()=>changePerson(emptyState(),actor,refs,{id:'B1',bishopId:'B2',fields:{role:'pastor'}}),/current bishop/);
 assert.throws(()=>changePerson(emptyState(),actor,refs,{id:'P1',fields:{_officeFields:['name']}}),/Unknown fields/);
});
test('imports skip bishops, require explicit new-person and move instructions, and roll back the entire invalid batch',()=>{
 const state=emptyState();assert.throws(()=>importPastors(state,actor,refs,{bishopId:'B2',rows:[{name:'Daniel Marcus Annan'}]}),/moveExisting/);
 assert.throws(()=>importPastors(state,actor,refs,{bishopId:'B1',rows:[{name:'New Pastor'}]}),/allowNew/);
 assert.throws(()=>importPastors(state,actor,refs,{bishopId:'B1',allowNew:true,rows:[{name:'New Pastor'},{name:'Invalid'}]}),/full name/);assert.equal(state.extraReferences.length,0);assert.equal(state.audit.length,0);
 const result=importPastors(state,actor,refs,{bishopId:'B1',allowNew:true,rows:[{name:'First Bishop'},{name:'New Pastor',gender:'female',dob:'2000-09-05'}]});assert.equal(result.outcomes[0].status,'skipped');assert.equal(result.state.extraReferences.length,1);assert.equal(result.state.extraReferences[0].role,'pastor');
});
test('spreadsheet import reads template sections and Excel dates while excluding non-pastoral ranks',()=>{
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Name','Gender','Rank','Date of Birth'],['First Bishop','Male','Bishop'],['PASTORS UNDER THE BISHOP'],['Example Pastor','Female','Pastor',new Date('1995-10-15T00:00:00Z')],['Example Shepherd','Male','Minister Shepherd','1/1/1990']]),'Submitted');
 const result=workbookPastors(XLSX.write(book,{type:'buffer',bookType:'xlsx'}));assert.equal(result.rows.length,1);assert.equal(result.rows[0].gender,'female');assert.equal(result.rows[0].dob,'1995-10-15');assert.equal(result.skipped.length,2);
 const timezone=process.env.TZ;try{process.env.TZ='Pacific/Auckland';assert.equal(workbookPastors(XLSX.write(book,{type:'buffer',bookType:'xlsx'})).rows[0].dob,'1995-10-15');}finally{if(timezone===undefined)delete process.env.TZ;else process.env.TZ=timezone;}
});
test('soft deletion of API-added people is reflected in public lists and photo tasks',()=>{
 const {state,person}=changePerson(emptyState(),actor,refs,{bishopId:'B1',fields:{name:'Added Pastor',role:'pastor'}});assert.equal(photoProgress(state,refs).missing,1);state.overrides[person.id].deleted=true;
 assert.ok(!overlayReferences(refs,{...emptyState(),...publicOverlay(state)}).some(p=>p.id===person.id));assert.equal(photoProgress(state,refs).missing,0);
});

test('bishop organization changes carry all current pastors to the same split site',()=>{
 const result=changePerson(emptyState(),actor,refs,{id:'B1',fields:{organization:'FLOW',group:'FLOW',denomination:'FLOW'}});
 const pastor=result.state.overrides.P1;assert.equal(pastor.organization,'FLOW');assert.equal(pastor.group,'FLOW');assert.equal(pastor.bishop,'First Bishop');
 assert.equal(peopleForSite(directoryPeople(result.state,refs),'flow').some(p=>p.id==='P1'),true);
});
test('invalid data is a client error and current bishops cannot be duplicated as pastors',()=>{
 assert.throws(()=>changePerson(emptyState(),actor,refs,{id:'P1',fields:{yearOrdained:'yesterday'}}),e=>e.status===400);
 assert.throws(()=>changePerson(emptyState(),actor,refs,{bishopId:'B2',fields:{name:'First Bishop',role:'pastor'}}),/current bishop/);
 assert.throws(()=>changePerson(emptyState(),actor,refs,{bishopId:'B2',fields:{name:'New Pastor',role:'pastor',title:'Bishop'}}),/bishop title/);
 const promoted=changePerson(emptyState(),actor,refs,{id:'P1',fields:{role:'bishop'}});assert.equal(promoted.person.role,'bishop');assert.equal(promoted.person.bishop,'');
});
