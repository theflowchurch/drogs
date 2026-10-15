import { applyAction } from './model.mjs';
// Explicit office ZIP replacements use a compare-and-set against the saved
// portrait we inspected. A later upload always wins, and old media is retained.
export function replaceOfficePortraits(state, references, replacements) {
  let next=state;
  for(const item of replacements){
    const person=references.find(p=>p.id===item.id);
    if(!person||person.image!==item.image||!item.source||!item.previousPhoto||next.overrides?.[item.id]?.deleted)continue;
    if(next.overrides?.[item.id]?.photo!==item.previousPhoto)continue;
    const linked=new Set(next.profiles.filter(p=>p.referenceId===item.id).map(p=>p.id));
    const registrations=next.registrations.filter(r=>r.data.referenceId===item.id||linked.has(r.userId));
    if(registrations.some(r=>r.data.photo&&r.data.photo!==item.previousPhoto))continue;
    next=applyAction(next,{id:'system',office:true},'editReference',{referenceId:item.id,fields:{photo:''}},undefined,references);
    for(const r of next.registrations.filter(r=>r.data.referenceId===item.id||linked.has(r.userId)))r.displayPhoto='reference';
    Object.assign(next.audit.at(-1).detail,{officePortraitSource:{image:item.image,previousPhoto:item.previousPhoto,source:item.source}});
  }
  return next===state?null:next;
}
