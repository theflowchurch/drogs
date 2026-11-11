import { applyAction } from './model.mjs';
// Explicit office ZIP replacements use a compare-and-set against the saved
// portrait we inspected. A later upload always wins, and old media is retained.
export function replaceOfficePortraits(state, references, replacements) {
  let next=state;
  for(const item of replacements){
    // A person the office added by hand (Bishop Joshua Heward-Mills) has no roll
    // record, so the edited portrait goes on that added record itself.
    const added=!references.some(p=>p.id===item.id)&&(next.extraReferences||[]).find(p=>p.id===item.id);
    if(added){
      // A renamed file for a portrait already in place (a browser kept the old
      // name's "not found" answer): move the added record to the new name.
      if(item.previousImage&&!added.photo&&added.image===item.previousImage){next=structuredClone(next);next.extraReferences.find(p=>p.id===item.id).image=item.image;continue;}
      if(!item.source||!item.previousPhoto||added.photo!==item.previousPhoto||next.overrides?.[item.id]?.deleted||(next.overrides?.[item.id]?.photo&&next.overrides[item.id].photo!==item.previousPhoto))continue;
      const linked=new Set(next.profiles.filter(p=>p.referenceId===item.id).map(p=>p.id));
      const registrations=next.registrations.filter(r=>r.data.referenceId===item.id||linked.has(r.userId));
      if(registrations.some(r=>r.data.photo&&r.data.photo!==item.previousPhoto))continue;
      next=applyAction(next,{id:'system',office:true},'editReference',{referenceId:item.id,fields:{photo:''}},undefined,references);
      next.extraReferences.find(p=>p.id===item.id).image=item.image;
      for(const r of next.registrations.filter(r=>r.data.referenceId===item.id||linked.has(r.userId)))r.displayPhoto='reference';
      Object.assign(next.audit.at(-1).detail,{officePortraitSource:{image:item.image,previousPhoto:item.previousPhoto,source:item.source}});
      continue;
    }
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
