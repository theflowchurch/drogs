import { createHash, randomUUID } from 'node:crypto';
import { transaction, readState, persistState } from './database.mjs';
import { HttpError } from './auth.mjs';
import { readBody, jsonBody } from './api-body.mjs';
import { prepareImage } from './storage.mjs';
import { applyAction, directoryPeople, REFERENCE_FIELDS } from '../registration/model.mjs';
import { photoProgress, photoKey, photoTask } from '../registration/photo-progress.mjs';
import { managementPeople, personRevision, changePerson, importPastors, workbookPastors, annotateApiAudit } from './managed-people.mjs';
import { readSettings, writeSettings, describeSettings, applySettings } from './settings.mjs';

export const MANAGEMENT_ACTIONS = ['addPerson','addRoster','approveBishop','assignBishop','carryRoster','choosePhoto','claim','deleteRegistration','editRoster','hideReference','linkReference','markPaid','moveRoster','officeEdit','openYear','removeRoster','restoreRoster','reviewBishop','reviewPayment','reviewPhoto','setCatalog','setFees','setSignup','setStatus','setVisibility'];
const writes = ['backend:write','people:write','photos:write','rosters:write'];
const reply = (data, status=200, headers={}) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const findPerson = (state, refs, id) => { const p = managementPeople(state, refs).find(p=>p.id===id);if(!p)throw new HttpError(404,'Current person not found.');return p; };
const checkRevision = (request, p) => { const expected=request.headers.get('if-match');if(expected && expected.replace(/^"|"$/g,'')!==personRevision(p))throw new HttpError(409,'This person changed. Read the current record before retrying.'); };
const responsePerson = (person,state,actor) => {
  const privateDetails = actor?.apiScopes?.some(s=>['backend:read','backend:write','people:write'].includes(s));
  const fields = ['id','image','lay',...REFERENCE_FIELDS.filter(k=>privateDetails || !['dob','phone','email'].includes(k))];
  return {...Object.fromEntries(fields.filter(k=>person[k]!==undefined).map(k=>[k,person[k]])),revision:personRevision(person),...(person.role==='pastor'?{photoTask:photoTask(person,state)}:{})};
};
const bool = (url,key) => { const value=url.searchParams.get(key);if(value!==null&&!['true','false'].includes(value))throw new HttpError(400,`${key} must be true or false.`);return value==='true'; };
const websiteSettings = new Set(['PUBLIC_DIRECTORY_SOURCE','PUBLIC_PHOTOS']);
export function createManagementApi({pool,config,storage,keys,people,invalidate}) {
  const snapshot = () => transaction(pool,conn=>readState(conn));
  async function mutate(actor,fn) {
    const result=await transaction(pool,async conn=>{
      const before=await readState(conn,true), start=before.audit.length;
      const result=await fn(before,conn);
      annotateApiAudit(result.state,actor,start);
      if(!result.dryRun)await persistState(conn,before,result.state);
      return {...result,progress:photoProgress(result.state,people)};
    });
    if(!result.dryRun)invalidate();return result;
  }
  return async request=>{
    const url=new URL(request.url), path=url.pathname.replace(/\/$/,''), method=request.method;
    if(!/^\/api\/v1\/(people(?:\/.*)?|photo-progress|actions|schema|settings|uploads)$/.test(path))return null;
    // Cookie sessions do not authorize these routes; every call requires an app-issued key.
    if(path==='/api/v1/schema'&&method==='GET') {
      await keys.authenticate(request,['backend:read',...writes]);
      return reply({peopleFields:REFERENCE_FIELDS,actions:MANAGEMENT_ACTIONS,scopes:['backend:read',...writes],routes:{people:'/api/v1/people',person:'/api/v1/people/{id}',photo:'/api/v1/people/{id}/photo',import:'/api/v1/people/import',photoProgress:'/api/v1/photo-progress',actions:'/api/v1/actions',settings:'/api/v1/settings'},uploads:{types:['image/jpeg','image/png','image/webp'],maxBytes:5*1024*1024},imports:{maxRows:500,default:'preview',allowNew:false,moveExisting:false}});
    }
    if(path==='/api/v1/photo-progress'&&method==='GET') {
      await keys.authenticate(request,['backend:read','photos:write']);const state=await snapshot();
      const progress=photoProgress(state,people), by=new Map(directoryPeople({...state,hidden:[]},people).map(p=>[p.id,p]));
      return reply({...progress,outstanding:progress.missing+progress.replace,tasks:[...progress.missingIds,...progress.replaceIds].map(id=>({id,name:by.get(id)?.name,bishop:by.get(id)?.bishop,...photoTask(by.get(id),state)}))});
    }
    if(path==='/api/v1/uploads') {
      if(method!=='POST')throw new HttpError(405,'Use POST.');
      const actor=await keys.authenticate(request,'photos:write');
      const kind=url.searchParams.get('kind')||'portrait';
      if(!['portrait','logo'].includes(kind))throw new HttpError(400,'Only portraits and logos can be uploaded here.');
      const path=await storage.upload(actor,await readBody(request,5*1024*1024),request.headers.get('content-type')?.split(';')[0],kind);
      return reply({path},201);
    }
    if(path==='/api/v1/settings') {
      const actor=await keys.authenticate(request,method==='GET'?'backend:read':'backend:write');
      if(method==='GET')return reply({settings:describeSettings(await readSettings(pool)).filter(s=>websiteSettings.has(s.key))});
      if(method!=='PATCH')throw new HttpError(405,'Use GET or PATCH.');
      const {values}=await jsonBody(request);
      if(!values||Object.keys(values).some(k=>!websiteSettings.has(k)))throw new HttpError(400,'Only PUBLIC_DIRECTORY_SOURCE and PUBLIC_PHOTOS are editable here. Use actions for catalog, signup and fees.');
      await writeSettings(pool,values,actor,config);await applySettings(config,pool);invalidate();return reply({ok:true});
    }
    if(path==='/api/v1/actions') {
      if(method!=='POST')throw new HttpError(405,'Use POST.');
      const actor=await keys.authenticate(request,'backend:write'),{name,payload={}}=await jsonBody(request);
      if(!MANAGEMENT_ACTIONS.includes(name))throw new HttpError(400,'Use a documented office action; use /people for person edits and /photo for uploads.');
      if(!payload||Array.isArray(payload)||typeof payload!=='object')throw new HttpError(400,'Supply an action payload object.');
      const result=await mutate(actor,async(before,conn)=>{
        // Never attach a payment receipt as a portrait or reference missing media.
        const portrait=payload.fields?.photo||payload.data?.photo||payload.photo;
        if(portrait)await assertPortrait(conn,portrait);
        let state;try{state=applyAction(before,actor,name,payload,undefined,people);}catch(e){throw new HttpError(400,e.message);}
        return{state};
      });return reply({ok:true,photoProgress:result.progress});
    }
    if(path==='/api/v1/people/import') {
      if(method!=='POST')throw new HttpError(405,'Use POST.');
      const actor=await keys.authenticate(request,['rosters:write','people:write']);
      let input,skipped=[],sourceHash;
      if(request.headers.get('content-type')?.startsWith('application/json')) { input=await jsonBody(request); sourceHash=createHash('sha256').update(JSON.stringify(input.rows||[])).digest('hex'); }
      else {
        const type=request.headers.get('content-type')?.split(';')[0];
        if(!['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','application/csv','application/vnd.ms-excel'].includes(type))throw new HttpError(415,'Send JSON, XLSX or CSV.');
        const bytes=await readBody(request,5*1024*1024),parsed=workbookPastors(bytes);sourceHash=createHash('sha256').update(bytes).digest('hex');skipped=parsed.skipped;
        input={rows:parsed.rows,bishopId:url.searchParams.get('bishopId'),dryRun:!url.searchParams.has('dryRun')||bool(url,'dryRun'),allowNew:bool(url,'allowNew'),moveExisting:bool(url,'moveExisting')};
      }
      for(const k of ['dryRun','allowNew','moveExisting'])if(input[k]!==undefined&&typeof input[k]!=='boolean')throw new HttpError(400,`${k} must be boolean.`);
      if(input.rows?.some(r=>r?.photo))throw new HttpError(400,'Import person details first, then upload portraits through /people/{id}/photo.');
      const result=await mutate(actor,before=>{
        const imported=importPastors(before,actor,people,input);
        imported.state.audit.push({id:randomUUID(),actor:actor.id,action:'importPastors',year:before.year,target:input.bishopId,at:new Date().toISOString(),detail:{source:String(request.headers.get('x-source-filename')||input.source||'API pastor import').slice(0,200),sha256:sourceHash,rows:input.rows.length,created:imported.outcomes.filter(r=>r.status==='created').length,updated:imported.outcomes.filter(r=>r.status==='updated').length,skipped:skipped.length+imported.outcomes.filter(r=>r.status==='skipped').length}});
        return {...imported,dryRun:input.dryRun!==false};
      });
      return reply({dryRun:result.dryRun,results:result.outcomes,skipped,created:result.outcomes.filter(r=>r.status==='created').length,updated:result.outcomes.filter(r=>r.status==='updated').length,photoProgress:result.progress});
    }
    if(path==='/api/v1/people') {
      if(method==='GET') {
        const actor=await keys.authenticate(request,['backend:read',...writes]);const state=await snapshot();let data=managementPeople(state,people);
        const search=(url.searchParams.get('search')||'').trim().toLowerCase(), role=url.searchParams.get('role'), bishopId=url.searchParams.get('bishopId'), status=url.searchParams.get('photoTask');
        if(search)data=data.filter(p=>[p.name,p.bishop,p.city,p.country,p.branch].some(v=>String(v||'').toLowerCase().includes(search)));
        if(role){if(!['bishop','pastor'].includes(role))throw new HttpError(400,'Use role bishop or pastor.');data=data.filter(p=>p.role===role);}
        if(bishopId){const b=findPerson(state,people,bishopId);if(b.role!=='bishop')throw new HttpError(400,'Choose a bishopId.');data=data.filter(p=>p.bishop===b.name);}
        if(status){if(!['missing','replace','ready'].includes(status))throw new HttpError(400,'Use photoTask missing, replace or ready.');data=data.filter(p=>p.role==='pastor'&&photoTask(p,state).status===status);}
        for(const k of ['organization','group','country'])if(url.searchParams.has(k))data=data.filter(p=>p[k]===url.searchParams.get(k));
        const total=data.length,limit=Number(url.searchParams.get('limit')||100),after=url.searchParams.get('after')||'';
        if(!Number.isInteger(limit)||limit<1||limit>500||after.length>100)throw new HttpError(400,'Use limit 1–500 and the returned cursor.');
        data.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);data=data.filter(p=>p.id>after);
        return reply({data:data.slice(0,limit).map(p=>responsePerson(p,state,actor)),total,nextCursor:data.length>limit?data[limit-1].id:null});
      }
      if(method!=='POST')throw new HttpError(405,'Use GET or POST.');
      const actor=await keys.authenticate(request,'people:write'),input=await jsonBody(request);
      if(input.id!==undefined)throw new HttpError(400,'Use PATCH /people/ID to edit an existing person.');
      const result=await mutate(actor,async(before,conn)=>{if(input.fields?.photo)await assertPortrait(conn,input.fields.photo);return changePerson(before,actor,people,input);});
      return reply({person:responsePerson(result.person,result.state,actor),photoProgress:result.progress},201);
    }
    const matched=path.match(/^\/api\/v1\/people\/([^/]+)(?:\/(photo|restore))?$/);
    if(!matched)throw new HttpError(404,'API endpoint not found.');
    let id;try{id=decodeURIComponent(matched[1]);}catch{throw new HttpError(400,'Invalid person ID.');}const operation=matched[2];if(id.length>100)throw new HttpError(400,'Invalid person ID.');
    if(operation==='photo') {
      const actor=await keys.authenticate(request,method==='GET'?['backend:read','photos:read','photos:write']:'photos:write');
      if(method==='GET'){const p=findPerson(await snapshot(),people,id);return reply({id,url:p.photo?await storage.url(p.photo):p.image?new URL('/'+p.image,url.origin).href:null});}
      if(!['POST','PUT'].includes(method))throw new HttpError(405,'Use GET, POST or PUT.');
      const previous=findPerson(await snapshot(),people,id);checkRevision(request,previous);
      const bytes=await readBody(request,5*1024*1024),type=request.headers.get('content-type')?.split(';')[0];
      const prepared=await prepareImage(bytes,type);
      if(previous.photo&&storage.bytes){
        const stored=await storage.bytes(previous.photo);
        if(stored&&createHash('sha256').update(stored).digest('hex')===createHash('sha256').update(prepared).digest('hex')) {
          const state=await snapshot(),current=findPerson(state,people,id);checkRevision(request,current);
          if(photoKey(current)!==photoKey(previous))throw new HttpError(409,'A newer photo was added during this upload. Read the person again.');
          return reply({unchanged:true,person:responsePerson(current,state,actor),photoProgress:photoProgress(state,people)});
        }
      }
      const photo=await storage.upload(actor,bytes,type,'portrait');
      const result=await mutate(actor,before=>{const current=findPerson(before,people,id);checkRevision(request,current);if(photoKey(current)!==photoKey(previous))throw new HttpError(409,'A newer photo was added during this upload. Read the person again before retrying.');return changePerson(before,actor,people,{id,fields:{photo}});});
      return reply({person:responsePerson(result.person,result.state,actor),photoProgress:result.progress},201);
    }
    if(operation==='restore') {
      if(method!=='POST')throw new HttpError(405,'Use POST.');
      const actor=await keys.authenticate(request,'people:write');const result=await mutate(actor,before=>{
        if(![...people,...(before.extraReferences||[])].some(p=>p.id===id))throw new HttpError(404,'Person not found.');
        return{state:applyAction(before,actor,'deleteReference',{referenceId:id,deleted:false},undefined,people)};
      });return reply({person:responsePerson(findPerson(result.state,people,id),result.state,actor),photoProgress:result.progress});
    }
    if(method==='GET'){const actor=await keys.authenticate(request,['backend:read',...writes]);const state=await snapshot(),p=findPerson(state,people,id);return reply({person:responsePerson(p,state,actor)},200,{ETag:`"${personRevision(p)}"`});}
    if(!['PATCH','DELETE'].includes(method))throw new HttpError(405,'Use GET, PATCH or DELETE.');
    const actor=await keys.authenticate(request,'people:write'),input=method==='PATCH'?await jsonBody(request):{};
    const result=await mutate(actor,async(before,conn)=>{
      const p=findPerson(before,people,id);checkRevision(request,p);
      if(method==='DELETE'){
        if(p.role==='bishop'&&managementPeople(before,people).some(q=>q.bishop===p.name))throw new HttpError(409,'Move this bishop’s pastors before deleting the bishop.');
        return{state:applyAction(before,actor,'deleteReference',{referenceId:id},undefined,people)};
      }
      if(input.fields?.photo)await assertPortrait(conn,input.fields.photo);
      return changePerson(before,actor,people,{...input,id});
    });return reply({...(result.person?{person:responsePerson(result.person,result.state,actor)}:{deleted:true,id}),photoProgress:result.progress});
  };
}
async function assertPortrait(conn,path) {
  if(typeof path!=='string'||path.length>512)throw new HttpError(400,'Invalid portrait path.');
  const [[media]]=await conn.execute('SELECT kind FROM dr_media WHERE object_key=?',[path]);
  if(media?.kind!=='portrait')throw new HttpError(400,'Upload a portrait before assigning it.');
}
