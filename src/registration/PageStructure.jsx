"use client";
import { useEffect, useMemo, useState } from 'react';
import publishedStructure from './ministry-organisations.json';
import { DEFAULT_LAYOUT, buildDirectory, ORGANISATION_PAGES } from './ministry-organisations.mjs';
import { overlayReferences } from './model.mjs';
import { rosterFrom } from './live-roster.mjs';
import { pastorEntries, pastorGroups } from './public-entries.mjs';
import referencePeople from './reference-people.json';

// Admin › Bishops and pastors pages (office, 17 Nov): everything the Order of
// Bishops, Councils and pastors' pages show that is not on a person's own record:
// the groups, councils and boards, who sits in each, in what order, their roles
// (e.g. Chairman), the groups' names and initials and the boxes' order; and the
// pastors' boxes. Saving changes every page at once. A person's own details
// (name, title, church, photo, bishop) are still edited on their record.

const slugOf = text => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clone = v => JSON.parse(JSON.stringify(v));
const sections = st => st.groups.flatMap(g => g.organisations);
const allGroups = st => sections(st).flatMap(o => (o.directoryGroups || []).map(g => ({ o, g })));
const layoutOf = st => ({ ...DEFAULT_LAYOUT, ...(st.layout || {}) });

function Move({ onUp, onDown, label }) {
  return <span className="reg-ps-move">
    <button type="button" className="reg-text" onClick={onUp} aria-label={`Move ${label} up`} title="Move up">↑</button>
    <button type="button" className="reg-text" onClick={onDown} aria-label={`Move ${label} down`} title="Move down">↓</button>
  </span>;
}
const swap = (list, i, j) => { if (j < 0 || j >= list.length) return list; const out = [...list]; [out[i], out[j]] = [out[j], out[i]]; return out; };

function BishopsStructure({ state, perform }) {
  const saved = state.pageStructure || publishedStructure;
  const [st, setSt] = useState(() => clone(saved));
  const [open, setOpen] = useState('');
  const [find, setFind] = useState('');
  const [moveChurch, setMoveChurch] = useState({ church: '', to: '' });
  const [newGroup, setNewGroup] = useState({ name: '', section: '' });
  useEffect(() => { setSt(clone(state.pageStructure || publishedStructure)); }, [state.pageStructure]);
  const dirty = JSON.stringify(st) !== JSON.stringify(saved);
  const roster = useMemo(() => overlayReferences(rosterFrom(state, referencePeople), state), [state.referencePeople, state.overrides, state.extraReferences, state.hidden]);
  const bishops = useMemo(() => roster.filter(p => p.role === 'bishop'), [roster]);
  const L = layoutOf(st);
  const listed = useMemo(() => allGroups(st), [st]);
  // The groups in the order the page shows them (as boxes), then any not yet placed.
  const order = [...L.order.filter(s => listed.some(x => x.g.slug === s) || sections(st).some(o => o.slug === s)), ...listed.map(x => x.g.slug).filter(s => !L.order.includes(s))];
  const update = fn => setSt(prev => { const next = clone(prev); fn(next); return next; });
  const groupOf = (next, slug) => allGroups(next).find(x => x.g.slug === slug);
  const setLayout = (next, patch) => { next.layout = { ...layoutOf(next), ...(next.layout || {}), ...patch }; };
  const built = useMemo(() => { try { return buildDirectory(st); } catch { return null; } }, [st]);
  const boxOrder = built ? built.groups.map(g => g.slug) : [];
  const moveBox = (slug, dir) => update(next => { const o = [...layoutOf(next).order]; const i = o.indexOf(slug); if (i >= 0) setLayout(next, { order: swap(o, i, i + dir) }); });
  const current = open && groupOf(st, open);
  const members = current ? current.g.people : [];
  const churches = [...new Set(members.map(p => p.church).filter(Boolean))];
  const matches = find.trim().length >= 2 ? bishops.filter(b => b.name.toLowerCase().includes(find.trim().toLowerCase())).slice(0, 8) : [];
  const save = () => perform('setPageStructure', { structure: st }, 'Saved. The Order of Bishops, Councils and Register pages now show it.');
  return <>
    <p className="reg-small">The Order of Bishops and Councils pages, and the Register of Bishops. Change a group's name, initials, members, their roles and order, or move a church's bishops to another group. Save to update every page.</p>
    <div className="reg-form-actions"><small>{dirty ? 'Unsaved changes.' : state.pageStructure ? 'Saved (edited by the office).' : 'Showing the published page.'}</small>
      {state.pageStructure && <button type="button" className="reg-secondary" onClick={() => perform('setPageStructure', { structure: null }, 'Back to the published page.')}>Go back to the published page</button>}
      <button type="button" className="reg-secondary" disabled={!dirty} onClick={() => setSt(clone(saved))}>Discard changes</button>
      <button type="button" className="reg-primary" disabled={!dirty} onClick={save}>Save</button></div>
    <h3 className="reg-ps-h">Boxes on the Order of Bishops page, in order</h3>
    <ol className="reg-ps-boxes">
      {(built?.groups || []).map((g, i) => <li key={g.slug}>
        <span className="reg-ps-box-name">{g.name}{g.initials ? ` – ${g.initials}` : ''} <small>{g.count} bishops</small></span>
        {L.order.includes(g.slug) && <Move label={g.name} onUp={() => moveBox(g.slug, -1)} onDown={() => moveBox(g.slug, 1)}/>}
      </li>)}
    </ol>
    <h3 className="reg-ps-h">Groups, councils and boards</h3>
    {sections(st).map(o => <div key={o.slug} className="reg-ps-section">
      <b>{o.name}</b>
      <ul className="reg-ps-groups">{(o.directoryGroups || []).map(g => <li key={g.slug}>
        <button type="button" className={`reg-ps-group ${open === g.slug ? 'open' : ''}`} onClick={() => setOpen(open === g.slug ? '' : g.slug)} aria-expanded={open === g.slug}>{g.name} <small>{g.people.length}</small></button>
      </li>)}</ul>
    </div>)}
    <div className="reg-admin-add">
      <input placeholder="New group, council or board" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}/>
      <select aria-label="Section for the new group" value={newGroup.section || sections(st)[0]?.slug} onChange={e => setNewGroup({ ...newGroup, section: e.target.value })}>{sections(st).map(o => <option key={o.slug} value={o.slug}>{o.name}</option>)}</select>
      <button type="button" className="reg-secondary" disabled={!newGroup.name.trim()} onClick={() => update(next => {
        const o = sections(next).find(x => x.slug === (newGroup.section || sections(next)[0].slug));
        let slug = slugOf(newGroup.name) || 'group'; while (slug === 'signup' || ORGANISATION_PAGES.includes(slug) || allGroups(next).some(x => x.g.slug === slug)) slug += '-2';
        o.directoryGroups = [...(o.directoryGroups || []), { slug, name: newGroup.name.trim(), people: [] }];
        if (!['first-love-church', 'para-church'].includes(o.slug)) setLayout(next, { order: [...layoutOf(next).order, slug] });
        setOpen(slug); setNewGroup({ name: '', section: newGroup.section });
      })}>Add group</button>
    </div>
    {current && <div className="reg-ps-editor">
      <h3>{current.g.name} <small>in {current.o.name}</small></h3>
      <p className="reg-small">Its own link (works once saved): <a href={`/orderofbishopsingoodstanding/${open}/`} target="_blank" rel="noreferrer">kuriakecastle.org/orderofbishopsingoodstanding/{open}/</a></p>
      <div className="reg-fields">
        <label className="reg-field"><span>Name</span><input value={current.g.name} onChange={e => update(next => { groupOf(next, open).g.name = e.target.value; })}/></label>
        <label className="reg-field"><span>Initials (shown after a dash)</span><input value={L.initials[open] || ''} onChange={e => update(next => setLayout(next, { initials: { ...layoutOf(next).initials, [open]: e.target.value } }))}/></label>
        <label className="reg-field"><span>Box title (leave empty for “The Bishops of …”)</span><input value={L.names[open] || ''} onChange={e => update(next => { const names = { ...layoutOf(next).names }; if (e.target.value) names[open] = e.target.value; else delete names[open]; setLayout(next, { names }); })}/></label>
        <label className="reg-field"><span>Move this group to</span><select value={current.o.slug} onChange={e => update(next => { const from = groupOf(next, open); from.o.directoryGroups = from.o.directoryGroups.filter(g => g.slug !== open); const to = sections(next).find(o => o.slug === e.target.value); to.directoryGroups = [...(to.directoryGroups || []), from.g]; })}>{sections(st).map(o => <option key={o.slug} value={o.slug}>{o.name}</option>)}</select></label>
      </div>
      <table className="reg-ps-members"><thead><tr><th>Bishop</th><th>Role (e.g. Chairman)</th><th>Leader</th><th>Order</th><th>Move to</th><th></th></tr></thead><tbody>
        {members.map((p, i) => <tr key={(p.rosterId || p.name) + i}>
          <td><b>{p.title || 'Bishop'} {p.name}</b><br/><small>{p.church || ''}</small></td>
          <td><input aria-label={`Role of ${p.name}`} value={p.role || ''} onChange={e => update(next => { const q = groupOf(next, open).g.people[i]; if (e.target.value) q.role = e.target.value; else delete q.role; })}/></td>
          <td><input type="checkbox" aria-label={`${p.name} leads this group`} checked={Boolean(p.leader)} onChange={e => update(next => { const q = groupOf(next, open).g.people[i]; if (e.target.checked) q.leader = true; else delete q.leader; })}/></td>
          <td><Move label={p.name} onUp={() => update(next => { const g = groupOf(next, open).g; g.people = swap(g.people, i, i - 1); })} onDown={() => update(next => { const g = groupOf(next, open).g; g.people = swap(g.people, i, i + 1); })}/></td>
          <td><select aria-label={`Move ${p.name} to`} value="" onChange={e => e.target.value && update(next => { const g = groupOf(next, open).g; const [q] = g.people.splice(i, 1); groupOf(next, e.target.value).g.people.push(q); })}><option value="">Move…</option>{listed.filter(x => x.g.slug !== open).map(x => <option key={x.g.slug} value={x.g.slug}>{x.g.name}</option>)}</select></td>
          <td><button type="button" className="reg-text" onClick={() => update(next => { groupOf(next, open).g.people.splice(i, 1); })}>Remove</button></td>
        </tr>)}
      </tbody></table>
      {!members.length && <p className="reg-small">No bishops in this group yet.</p>}
      <div className="reg-admin-add">
        <input placeholder="Add a bishop: type a name" value={find} onChange={e => setFind(e.target.value)}/>
        {matches.length > 0 && <ul className="reg-ps-find">{matches.map(b => <li key={b.id}><button type="button" className="reg-text" onClick={() => { update(next => { const g = groupOf(next, open).g; if (!g.people.some(q => q.rosterId === b.id)) g.people.push({ name: b.name, rosterId: b.id, bishop: true, church: b.denomination || '', title: b.title || 'Bishop', image: b.image || '', ...(b.yearConsecrated ? { consecrated: b.yearConsecrated } : {}), ...(b.country ? { country: b.country } : {}) }); }); setFind(''); }}>{b.title} {b.name} <small>{b.denomination}</small></button></li>)}</ul>}
      </div>
      {churches.length > 0 && <div className="reg-admin-add">
        <span>Move every bishop of</span>
        <select aria-label="Church to move" value={moveChurch.church} onChange={e => setMoveChurch({ ...moveChurch, church: e.target.value })}><option value="">a church…</option>{churches.map(c => <option key={c}>{c}</option>)}</select>
        <span>to</span>
        <select aria-label="Group to move them to" value={moveChurch.to} onChange={e => setMoveChurch({ ...moveChurch, to: e.target.value })}><option value="">a group…</option>{listed.filter(x => x.g.slug !== open).map(x => <option key={x.g.slug} value={x.g.slug}>{x.g.name}</option>)}</select>
        <button type="button" className="reg-secondary" disabled={!moveChurch.church || !moveChurch.to} onClick={() => { update(next => { const g = groupOf(next, open).g; const moving = g.people.filter(p => p.church === moveChurch.church); g.people = g.people.filter(p => p.church !== moveChurch.church); groupOf(next, moveChurch.to).g.people.push(...moving); }); setMoveChurch({ church: '', to: '' }); }}>Move</button>
      </div>}
      <div className="reg-form-actions">
        <button type="button" className="reg-secondary danger" disabled={members.length > 0} title={members.length ? 'Move or remove its bishops first' : ''} onClick={() => update(next => { const x = groupOf(next, open); x.o.directoryGroups = x.o.directoryGroups.filter(g => g.slug !== open); setLayout(next, { order: layoutOf(next).order.filter(s => s !== open) }); setOpen(''); })}>Delete this group</button>
        <button type="button" className="reg-primary" disabled={!dirty} onClick={save}>Save</button>
      </div>
    </div>}
  </>;
}

function PastorBoxes({ state, perform }) {
  const saved = state.pastorBoxes || { names: {}, merge: {}, order: [] };
  const [boxes, setBoxes] = useState(() => clone(saved));
  useEffect(() => setBoxes(clone(state.pastorBoxes || { names: {}, merge: {}, order: [] })), [state.pastorBoxes]);
  const dirty = JSON.stringify(boxes) !== JSON.stringify(saved);
  const roster = useMemo(() => overlayReferences(rosterFrom(state, referencePeople), state), [state.referencePeople, state.overrides, state.extraReferences, state.hidden]);
  const entries = useMemo(() => pastorEntries(roster), [roster]);
  const shown = pastorGroups(entries, ['#000'], boxes);
  const churches = [...new Set(entries.map(p => p.denomination || 'Other'))].sort((a, b) => a.localeCompare(b));
  const moveBox = (d, dir) => { const order = shown.map(g => g.denomination); const i = order.indexOf(d); setBoxes({ ...boxes, order: swap(order, i, i + dir) }); };
  return <>
    <p className="reg-small">The Order of Pastors page: one box per church, holding its pastors. Rename a box, put one church's pastors into another church's box, or change the order. A pastor's own church is changed on their record.</p>
    <div className="reg-form-actions"><small>{dirty ? 'Unsaved changes.' : state.pastorBoxes ? 'Saved (edited by the office).' : 'Showing the published boxes (A to Z).'}</small>
      {state.pastorBoxes && <button type="button" className="reg-secondary" onClick={() => perform('setPageStructure', { pastorBoxes: null }, 'Back to the published boxes.')}>Go back to A to Z</button>}
      <button type="button" className="reg-secondary" disabled={!dirty} onClick={() => setBoxes(clone(saved))}>Discard changes</button>
      <button type="button" className="reg-primary" disabled={!dirty} onClick={() => perform('setPageStructure', { pastorBoxes: boxes }, 'Saved. The Order of Pastors page now shows it.')}>Save</button></div>
    <table className="reg-ps-members"><thead><tr><th>Box</th><th>Pastors</th><th>Box title</th><th>Order</th></tr></thead><tbody>
      {shown.map(g => <tr key={g.denomination}>
        <td><b>{g.denomination}</b></td><td>{g.people.length}</td>
        <td><input aria-label={`Title of the ${g.denomination} box`} placeholder={`The Pastors of ${g.denomination}`} value={boxes.names[g.denomination] || ''} onChange={e => setBoxes({ ...boxes, names: { ...boxes.names, [g.denomination]: e.target.value } })}/></td>
        <td><Move label={g.denomination} onUp={() => moveBox(g.denomination, -1)} onDown={() => moveBox(g.denomination, 1)}/></td>
      </tr>)}
    </tbody></table>
    <h3 className="reg-ps-h">Put one church's pastors into another church's box</h3>
    <table className="reg-ps-members"><thead><tr><th>Church</th><th>Shown in the box of</th></tr></thead><tbody>
      {churches.map(c => <tr key={c}><td>{c}</td><td><select aria-label={`Box for ${c}`} value={boxes.merge[c] || ''} onChange={e => { const merge = { ...boxes.merge }; if (e.target.value) merge[c] = e.target.value; else delete merge[c]; setBoxes({ ...boxes, merge }); }}><option value="">Its own box</option>{churches.filter(x => x !== c).map(x => <option key={x}>{x}</option>)}</select></td></tr>)}
    </tbody></table>
  </>;
}

export default function PageStructure({ state, perform }) {
  const [part, setPart] = useState('bishops');
  if (!state) return null;
  return <div className="reg-page-structure">
    <div className="reg-ps-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={part === 'bishops'} className={part === 'bishops' ? 'reg-primary' : 'reg-secondary'} onClick={() => setPart('bishops')}>Order of Bishops</button>
      <button type="button" role="tab" aria-selected={part === 'pastors'} className={part === 'pastors' ? 'reg-primary' : 'reg-secondary'} onClick={() => setPart('pastors')}>Order of Pastors</button>
    </div>
    {part === 'bishops' ? <BishopsStructure state={state} perform={perform}/> : <PastorBoxes state={state} perform={perform}/>}
  </div>;
}
