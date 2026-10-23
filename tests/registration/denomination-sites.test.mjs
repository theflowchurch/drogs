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
 const current=denominationPeople({...state,source:'roll',roll:[p]},'gochurch');assert.deepEqual(current.map(p=>p.id),['b'],'the office approved the current submitted roster, not only the annual paid roll');
});
test('bishops and pastors remain separate sections with city and gender filters and no rank toggle',()=>{
 const lay={...b,id:'lay',title:'Lay President',name:'Lay Leader'};
 let list=ministerSections([p,lay,b]);assert.deepEqual(list.bishops.map(p=>p.id),['b']);assert.deepEqual(new Set(list.pastors.map(p=>p.id)),new Set(['p','lay']));
 list=ministerSections([p,b],{city:'London',gender:'female'});assert.equal(list.bishops.length,0);assert.deepEqual(list.pastors,[p]);
 assert.equal(ministerSections([b,p],{q:'Anne London'}).pastors.length,1);
 assert.equal(Object.keys(DENOMINATION_SITES).length,3);
});
