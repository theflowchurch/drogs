"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
// Office-managed integration settings. Saved values are never shown back; the
// office sees only whether each one is set.
import { catalogOf, feesOf, orgLabel, signupOf, SIGNUP_PAUSED, overlayReferences } from './model.mjs';
import { rosterFrom } from './live-roster.mjs';
import { DENOMINATION_SITES, churchHref } from './denomination-sites.mjs';
// Organizations, their denominations and the fees: editable lists saved as one action each.
// Pause or reopen sign-up. Paused: new people cannot request a code or submit;
// everyone already registered keeps signing in, paying and editing.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
// An uploaded logo lives in photo storage; fetch its URL like any media.
function LogoMedia({ path }) {
  const [url, setUrl] = useState('');
  useEffect(() => { let live = true; api.mediaUrl(path).then(u => live && setUrl(u)).catch(() => {}); return () => { live = false; }; }, [path]);
  return url ? <img src={url} alt="" /> : <span aria-hidden="true">◌</span>;
}
// Settings fold into categories so the page reads as a short list; open the one you need.
function Category({ title, summary, children, open = false }) {
  return <details className="reg-settings-cat" open={open}>
    <summary><b>{title}</b>{summary ? <small>{summary}</small> : null}<span className="reg-settings-chevron" aria-hidden="true">›</span></summary>
    <div className="reg-settings-cat-body">{children}</div>
  </details>;
}
function SignupControl({ state, perform }) {
  const all = signupOf(state);
  const doors = [
    { scope: 'general', title: 'General sign-up', path: '/signup/', current: { closed: all.closed, notice: all.notice }, what: 'bishops and pastors registering for the year' },
    { scope: 'appointments', title: 'Pastoral appointments', path: '/appointments/', current: all.appointments, what: 'newly appointed bishops and pastors registering through the appointments link' },
  ];
  const [notes, setNotes] = useState({ general: all.notice, appointments: all.appointments.notice });
  useEffect(() => setNotes({ general: all.notice, appointments: all.appointments.notice }), [all.notice, all.appointments.notice]);
  return <Category title="Registration" summary={`General registration: ${all.closed ? 'Paused' : 'Open'} · Appointments: ${all.appointments.closed ? 'Paused' : 'Open'}`}>
    {doors.map(d => <div key={d.scope} className="reg-door-control">
      <h3>{d.title} <small>{d.path} · {d.what}</small></h3>
      <p>Currently <b>{d.current.closed ? 'paused' : 'open'}</b>.</p>
      <label className="reg-field wide"><span>Message shown while paused</span><textarea rows={2} value={notes[d.scope]} onChange={e => setNotes({ ...notes, [d.scope]: e.target.value })} placeholder={SIGNUP_PAUSED} /></label>
      <div className="reg-form-actions">
        {d.current.closed
          ? <><button type="button" className="reg-secondary" onClick={() => perform('setSignup', { scope: d.scope, closed: true, notice: notes[d.scope] }, 'Message saved.')}>Save message</button><button type="button" className="reg-primary" onClick={() => perform('setSignup', { scope: d.scope, closed: false, notice: notes[d.scope] }, `${d.title} is open again.`)}>Reopen</button></>
          : <button type="button" className="reg-secondary" onClick={() => perform('setSignup', { scope: d.scope, closed: true, notice: notes[d.scope] }, `${d.title} is paused.`)}>Pause {d.title.toLowerCase()}</button>}
      </div>
    </div>)}
  </Category>;
}
// Office, 19 Nov: the registration deadline. Applying it closes registration and
// shows only those in good standing on every public page; nobody's record is
// deleted, so everyone can be put back. Reopening registration starts again.
// TEST (office, 21 Nov): the email addresses used to test sign-up. Only these accounts
// skip payment and have 30 minutes (not one week) for their bishop to confirm them.
// Blocked people (office, 24 Nov): one per line, "Name, email, WhatsApp number, note"
// (only the name is needed). Kept by the office alone; never shown to anyone else.
const blockLine = (b) => [b.name, b.email, b.phone, b.note].map((v) => String(v || '').replace(/,/g, ' ')).join(', ').replace(/(, )+$/, '');
function BlockedPeople({ state, perform }) {
  const list = state?.blocked || [];
  const saved = list.map(blockLine).join('\n');
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved]);
  const parse = () => text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const parts = l.split(',').map((x) => x.trim());
    const email = parts.find((x) => /@/.test(x)) || '', phone = parts.find((x) => /^\+?[\d\s()-]{7,}$/.test(x)) || '';
    const rest = parts.filter((x) => x !== email && x !== phone);
    const old = list.find((b) => blockLine(b) === l);
    return { id: old?.id, addedAt: old?.addedAt, name: rest[0] || '', email, phone, note: rest.slice(1).join(', ') };
  });
  return <Category title="Blocked people" summary={list.length ? `${list.length} ${list.length === 1 ? 'person' : 'people'}` : 'None'}>
    <p>People who are not part of the fellowship, or who left, and may try to sign up. Someone who signs up with <b>the same name</b> (in any order), <b>email</b> or <b>WhatsApp number</b> is refused, and the site stops working on their device without explanation. A name that is only <b>close</b> is held for you to check under <b>To do</b>.</p>
    <label className="reg-field"><span>One person per line: name, then email, WhatsApp number and a note if you have them</span><textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Kwame Example, kwame@example.com, +233 24 000 0000, left in 2025" /></label>
    <div className="reg-form-actions">
      <button type="button" className="reg-primary" disabled={text.trim() === saved.trim()} onClick={() => perform('setBlocked', { blocked: parse() }, 'Blocked people saved.')}>Save</button>
    </div>
    <p className="reg-small">This list is seen only by the office. Anyone already registered who matches is dealt with as soon as you save.</p>
  </Category>;
}
function TestAccounts({ state, perform }) {
  const saved = (state?.testEmails || []).join('\n');
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved]);
  const n = (state?.testEmails || []).length;
  return <Category title="Test accounts" summary={n ? `${n} test email${n === 1 ? '' : 's'}: no payment, 30 minutes for the bishop` : 'Off'}>
    <p>Accounts that sign in with these email addresses are <b>test accounts</b>. They skip the payment step, and their bishop has <b>30 minutes</b> to confirm them instead of one week (a reminder email after 15 minutes; removed and emailed after 30). Everyone else signs up as normal.</p>
    <label className="reg-field"><span>Test email addresses (one per line)</span><textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="test.pastor@example.com" /></label>
    <div className="reg-form-actions">
      <button type="button" className="reg-primary" disabled={text.trim() === saved.trim()} onClick={() => perform('setTestEmails', { emails: text }, 'Test email addresses saved.')}>Save</button>
      {n > 0 && <button type="button" className="reg-secondary" onClick={() => perform('setTestEmails', { emails: '' }, 'Test accounts are off.')}>Turn test accounts off</button>}
    </div>
    <p className="reg-small">Add the email address before signing up with it. An account that already registered keeps the settings it had when it registered.</p>
  </Category>;
}
function DeadlineControl({ state, perform }) {
  const applied = Boolean(state?.deadline?.applied);
  const [confirming, setConfirming] = useState(false);
  const saved = state?.deadline?.date || '';
  const [date, setDate] = useState(saved);
  useEffect(() => setDate(saved), [saved]);
  const shown = saved ? new Date(`${saved}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const roll = (state.roll || []).filter((r) => r.referenceId || r.id);
  const listed = overlayReferences(rosterFrom(state, []), state);
  const ok = new Set(roll.flatMap((r) => [r.referenceId, r.id]).filter(Boolean));
  const kept = listed.filter((p) => ok.has(p.id)).length + roll.filter((r) => !r.referenceId).length;
  const removed = listed.filter((p) => !ok.has(p.id)).length;
  const when = applied && state.deadline.at ? new Date(state.deadline.at).toLocaleString() : '';
  return <Category title="Registration deadline" summary={applied ? `Applied${when ? ` on ${when}` : ''}: only those in good standing are shown` : `${shown ? `Closes ${shown}` : 'No date set'} · not applied yet`}>
    <div className="reg-deadline-date">
      <label className="reg-field"><span>Deadline date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <button type="button" className="reg-secondary" disabled={date === saved} onClick={() => perform('setDeadlineDate', { date }, date ? 'Deadline date saved. The sign-up pages now show it.' : 'Deadline date removed.')}>{date ? 'Save date' : 'Remove date'}</button>
    </div>
    <p className="reg-small">{shown ? <>The sign-up pages say <b>Registration closes on {shown}</b>.</> : 'Set the date registration closes. It is shown on the sign-up pages.'} Nobody is taken off the pages until you press Apply the deadline.</p>
    {applied ? <>
      <p>The deadline is <b>applied</b>{when ? <> (since {when})</> : null}. Registration is closed and the public pages show only the bishops and pastors in good standing for {state.year}. Everyone else is still here in the office records.</p>
      <div className="reg-form-actions">
        <button type="button" className="reg-secondary" onClick={() => perform('liftDeadline', { reopen: false }, 'Everyone is back on the public pages. Registration stays closed.')}>Put everyone back</button>
        <button type="button" className="reg-primary" onClick={() => perform('liftDeadline', { reopen: true }, 'Registration is open again and everyone is back on the public pages.')}>Reopen registration</button>
      </div>
      <p className="reg-small">Put everyone back shows everyone on the public pages again with registration still closed. Reopen registration does the same and opens registration, so people can register until the next deadline.</p>
    </> : <>
      <p>While the deadline is not applied, everyone is on the public pages and those in good standing for {state.year} have a green tick.</p>
      <p>Applying the deadline <b>closes registration</b> and takes everyone <b>not</b> in good standing off every public page: the church pages, the Order pages, Councils and the registers. Their records stay here, and you can put them back at any time.</p>
      <p className="reg-deadline-counts"><span><b>{kept.toLocaleString()}</b> in good standing stay on the pages</span>{listed.length > 0 && <span><b>{removed.toLocaleString()}</b> would be taken off</span>}</p>
      {!confirming
        ? <div className="reg-form-actions"><button type="button" className="reg-primary" onClick={() => setConfirming(true)}>Apply the deadline…</button></div>
        : <div className="reg-deadline-confirm" role="alert">
            <p><b>Are you sure?</b> Registration will close and {removed > 0 ? <><b>{removed.toLocaleString()}</b> people</> : 'everyone not in good standing'} will be taken off every public page now.</p>
            <div className="reg-form-actions">
              <button type="button" className="reg-secondary" onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" className="reg-danger" onClick={() => { setConfirming(false); perform('applyDeadline', { kept, removed }, 'The deadline is applied. Only those in good standing are on the public pages.'); }}>Yes, apply the deadline</button>
            </div>
          </div>}
    </>}
  </Category>;
}
function Structure({ state, perform, actor, show = ['groups', 'orgs', 'fees'] }) {
  const base = state ? catalogOf(state) : null;
  const [cat, setCat] = useState(null), [fees, setFees] = useState(null), [newOrg, setNewOrg] = useState(''), [newDen, setNewDen] = useState({}), [over, setOver] = useState(null);
  const [newGroup, setNewGroup] = useState({ name: '', organization: '' }), [overGroup, setOverGroup] = useState(null), [openGroups, setOpenGroups] = useState([]);
  const [renaming, setRenaming] = useState(null); // { kind: 'den'|'group', org, name, value }
  const [logoBusy, setLogoBusy] = useState('');
  const [newDenLogo, setNewDenLogo] = useState({}); // org → File chosen for the denomination being added
  useEffect(() => { if (base && !cat) setCat(JSON.parse(JSON.stringify(base))); if (state && !fees) setFees({ ...feesOf(state) }); }, [state]);
  if (!cat || !fees) return null;
  const dirty = JSON.stringify(cat) !== JSON.stringify(base);
  const addOrg = () => { const o = newOrg.trim(); if (!o || cat.organizations.includes(o)) return; setCat({ ...cat, organizations: [...cat.organizations, o], denominations: { ...cat.denominations, [o]: [] } }); setNewOrg(''); };
  const removeOrg = (o) => { const d = { ...cat.denominations }; delete d[o]; setCat({ ...cat, organizations: cat.organizations.filter(x => x !== o), denominations: d, groups: Object.fromEntries(Object.entries(cat.groups || {}).filter(([, g]) => g.organization !== o)) }); };
  const addDen = (o) => {
    const v = (newDen[o] || '').trim(); if (!v || (cat.denominations[o] || []).includes(v)) return;
    const next = { ...cat, denominations: { ...cat.denominations, [o]: [...(cat.denominations[o] || []), v].sort((a, b) => a.localeCompare(b)) } };
    const file = newDenLogo[o];
    setCat(next); setNewDen({ ...newDen, [o]: '' }); setNewDenLogo({ ...newDenLogo, [o]: null });
    // A logo picked alongside the name is uploaded and attached to the new denomination.
    if (file && actor) { setLogoBusy(v); api.upload(actor, file, 'logo').then(key => setCat(c => ({ ...(c || next), logos: { ...((c || next).logos || {}), [v]: key } }))).catch(() => {}).finally(() => setLogoBusy('')); }
  };
  const removeDen = (o, v) => setCat({ ...cat, denominations: { ...cat.denominations, [o]: cat.denominations[o].filter(x => x !== v) } });
  // Spelling fixes: a denomination is renamed everywhere it appears (its organization's list and every group card); a group keeps its contents under the new name.
  const renameDen = (o, from, to) => { const v = to.trim(); if (!v || v === from) return setRenaming(null); const fix = list => [...new Set(list.map(x => (x === from ? v : x)))]; setCat({ ...cat, logos: Object.fromEntries(Object.entries(cat.logos || {}).map(([k, x]) => [k === from ? v : k, x])), denominations: { ...cat.denominations, [o]: fix(cat.denominations[o] || []).sort((a, b) => a.localeCompare(b)) }, groups: Object.fromEntries(Object.entries(cat.groups || {}).map(([g, x]) => [g, x.organization === o ? { ...x, denominations: fix(x.denominations) } : x])) }); setRenaming(null); };
  const renameGroup = (from, to) => { const v = to.trim(); if (!v || v === from || (cat.groups || {})[v]) return setRenaming(null); const next = {}; for (const [g, x] of Object.entries(cat.groups || {})) next[g === from ? v : g] = x; setCat({ ...cat, groups: next }); setOpenGroups(openGroups.map(x => (x === from ? v : x))); setRenaming(null); };
  const renameBox = (onDone) => <input className="reg-rename" autoFocus aria-label="New spelling" value={renaming.value} onChange={e => setRenaming({ ...renaming, value: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onDone(renaming.value); } if (e.key === 'Escape') setRenaming(null); }} onBlur={() => onDone(renaming.value)} />;
  // Denomination logos: a small picture per denomination, uploaded by the office and saved with the lists.
  const logos = cat.logos || {};
  const logoSrc = v => { const k = logos[v]; return k ? (k.startsWith('assets/') ? `${basePath}/${k}` : null) : ''; };
  const setLogo = (v, file) => { if (!file || !actor) return; setLogoBusy(v); api.upload(actor, file, 'logo').then(key => setCat({ ...cat, logos: { ...logos, [v]: key } })).catch(() => {}).finally(() => setLogoBusy('')); };
  const logoControl = (v) => <label className={`reg-logo-chip ${logos[v] ? 'has' : ''}`} title={logos[v] ? 'Change logo' : 'Add logo'}>
    {logos[v] ? (logoSrc(v) ? <img src={logoSrc(v)} alt="" /> : <LogoMedia path={logos[v]} />) : <span aria-hidden="true">◌</span>}
    <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!actor || logoBusy === v} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; setLogo(v, f); }} />
  </label>;
  const denChip = (o, v, extra = null) => <li key={v}>{logoControl(v)}{renaming?.kind === 'den' && renaming.org === o && renaming.name === v ? renameBox(val => renameDen(o, v, val)) : <span>{v}</span>}<button type="button" className="reg-text" aria-label={`Edit the spelling of ${v}`} title="Edit spelling" onClick={() => setRenaming({ kind: 'den', org: o, name: v, value: v })}>✎</button>{extra}</li>;
  // Groups: cards per group; denomination chips drag between groups of the same
  // organization, or back to “Not in a group”. Adding a denomination to a group
  // also lists it on the sign-up form for that organization.
  const groups = cat.groups || {};
  const normal = v => String(v || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const grouped = o => new Set(Object.values(groups).filter(g => g.organization === o).flatMap(g => g.denominations.map(normal)));
  const ungrouped = o => (cat.denominations[o] || []).filter(d => !grouped(o).has(normal(d)));
  const setGroupDens = (name, dens) => setCat({ ...cat, groups: { ...groups, [name]: { ...groups[name], denominations: dens } } });
  // Drop onto a group card, a "Not in a group" card, or an organization with no
  // groups. Crossing into another organization moves the denomination out of
  // the old organization's list and every group it sat in.
  const moveTo = ({ den, fromGroup = '', fromOrg = '' }, { toGroup = '', toOrg }) => {
    if (!den) return;
    if (fromGroup === toGroup && (!fromOrg || fromOrg === toOrg)) return;
    let next = Object.fromEntries(Object.entries(groups).map(([g, x]) => [g, x.organization !== toOrg || g === fromGroup ? { ...x, denominations: x.denominations.filter(v => normal(v) !== normal(den)) } : x]));
    let dens = { ...cat.denominations };
    if (fromOrg && fromOrg !== toOrg) dens = { ...dens, [fromOrg]: (dens[fromOrg] || []).filter(v => normal(v) !== normal(den)) };
    if (!(dens[toOrg] || []).some(v => normal(v) === normal(den))) dens = { ...dens, [toOrg]: [...(dens[toOrg] || []), den].sort((a, b) => a.localeCompare(b)) };
    if (toGroup && next[toGroup] && !next[toGroup].denominations.some(v => normal(v) === normal(den))) next = { ...next, [toGroup]: { ...next[toGroup], denominations: [...next[toGroup].denominations, den] } };
    setCat({ ...cat, groups: next, denominations: dens });
  };
  const moveToGroup = (from, to, den) => moveTo({ den, fromGroup: from, fromOrg: to ? groups[to]?.organization : (from ? groups[from]?.organization : '') }, { toGroup: to, toOrg: to ? groups[to]?.organization : (from ? groups[from]?.organization : '') });
  const addGroup = () => { const n = newGroup.name.trim(), o = newGroup.organization || cat.organizations[0]; if (!n || groups[n]) return; setCat({ ...cat, groups: { ...groups, [n]: { organization: o, denominations: [] } } }); setNewGroup({ name: '', organization: '' }); };
  const removeGroup = (n) => { const next = { ...groups }; delete next[n]; setCat({ ...cat, groups: next }); setOpenGroups(openGroups.filter(x => x !== n)); };
  const isOpen = n => openGroups.includes(n), toggle = n => setOpenGroups(isOpen(n) ? openGroups.filter(x => x !== n) : [...openGroups, n]);
  const groupDrop = (target) => ({
    onDragOver: e => { e.preventDefault(); if (overGroup !== target) setOverGroup(target); },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverGroup(null); },
    onDrop: e => { e.preventDefault(); setOverGroup(null); const { fromGroup, fromOrg, den } = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); if (den === undefined) return; const toGroup = target.startsWith('ungrouped:') ? '' : target; const toOrg = toGroup ? groups[toGroup]?.organization : target.slice('ungrouped:'.length); moveTo({ den, fromGroup: fromGroup || '', fromOrg: fromOrg || '' }, { toGroup, toOrg }); },
  });
  // An organization without groups: its whole block takes the drop.
  const orgDrop = (o) => ({
    onDragOver: e => { e.preventDefault(); if (overGroup !== `org:${o}`) setOverGroup(`org:${o}`); },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverGroup(null); },
    onDrop: e => { e.preventDefault(); setOverGroup(null); const { fromGroup, fromOrg, den } = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); if (den !== undefined) moveTo({ den, fromGroup: fromGroup || '', fromOrg: fromOrg || '' }, { toGroup: '', toOrg: o }); },
  });
  const chip = (den, fromGroup, org) => <li key={den} draggable onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', JSON.stringify({ fromGroup, fromOrg: org, den })); }}>{org ? logoControl(den) : null}{renaming?.kind === 'den' && renaming.org === org && renaming.name === den ? renameBox(val => renameDen(org, den, val)) : <span>{den}</span>}{org && <button type="button" className="reg-text" aria-label={`Edit the spelling of ${den}`} title="Edit spelling" onClick={() => setRenaming({ kind: 'den', org, name: den, value: den })}>✎</button>}{fromGroup && <button type="button" className="reg-text danger" aria-label={`Take ${den} out of ${fromGroup}`} onClick={() => moveToGroup(fromGroup, '', den)}>×</button>}</li>;
  const OFFICE_ORG = { 'United Denominations': 'UD – OLGC' };
  const officeOrg = o => OFFICE_ORG[o] || orgLabel(o);
  // Drag a denomination chip onto another organization's card to move it.
  const moveDen = (from, to, v) => { if (!from || from === to || !v) return; const d = { ...cat.denominations, [from]: cat.denominations[from].filter(x => x !== v) }; d[to] = [...new Set([...(d[to] || []), v])].sort((a, b) => a.localeCompare(b)); setCat({ ...cat, denominations: d }); };
  const dropProps = (o) => ({
    onDragOver: e => { e.preventDefault(); if (over !== o) setOver(o); },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); },
    onDrop: e => { e.preventDefault(); setOver(null); const { from, den } = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); moveDen(from, o, den); },
  });
  const groupCount = Object.keys(groups).length, denCount = Object.values(cat.denominations).reduce((n, d) => n + d.length, 0);
  const saveLists = (label = 'Save lists') => <div className="reg-form-actions reg-save-row"><small>{dirty ? 'Unsaved changes.' : 'Saved.'}</small><button type="button" className="reg-primary" disabled={!dirty} onClick={() => perform('setCatalog', { catalog: cat }, 'Organizations and denominations saved.')}>{label}</button></div>;
  return <>
  {show.includes('groups') && <Category title="Groups" summary={`${groupCount} groups${dirty ? ' · unsaved changes' : ''}`}>
    {cat.organizations.map(o => <div key={o} className={`reg-group-org ${overGroup === `org:${o}` ? 'over' : ''}`} {...(!Object.values(groups).some(g => g.organization === o) ? orgDrop(o) : {})}>
      <h3>{officeOrg(o)}</h3>
      {!Object.values(groups).some(g => g.organization === o) ? (
        <>
          <ul className="reg-catalog-list">{(cat.denominations[o] || []).map(v => chip(v, '', o))}</ul>
          {!(cat.denominations[o] || []).length && <p className="reg-small reg-catalog-empty">No denominations listed.</p>}
          <div className="reg-admin-add"><input placeholder="New denomination" value={newDen[o] || ''} onChange={e => setNewDen({ ...newDen, [o]: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDen(o); } }} /><label className={`reg-secondary reg-file-button ${newDenLogo[o] ? 'has' : ''}`} title="Logo for the new denomination">{newDenLogo[o] ? `Logo: ${newDenLogo[o].name}` : 'Add logo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; setNewDenLogo({ ...newDenLogo, [o]: f || null }); }} /></label><button type="button" className="reg-secondary" onClick={() => addDen(o)}>Add denomination</button>{dirty && <button type="button" className="reg-primary" onClick={() => perform('setCatalog', { catalog: cat }, 'Groups saved.')}>Save</button>}</div>
        </>
      ) : (
      <div className="reg-group-grid">
        {Object.entries(groups).filter(([, g]) => g.organization === o).map(([name, g]) => <div key={name} className={`reg-group-card ${overGroup === name ? 'over' : ''} ${isOpen(name) ? 'open' : ''}`} {...groupDrop(name)}>
          {renaming?.kind === 'group' && renaming.name === name
            ? <div className="reg-group-head">{renameBox(val => renameGroup(name, val))}</div>
            : <button type="button" className="reg-group-head" onClick={() => toggle(name)} aria-expanded={isOpen(name)}><b>{name}</b><small>{g.denominations.length} denomination/country</small></button>}
          {isOpen(name) && <>
            <ul className="reg-catalog-list">{g.denominations.map(d => chip(d, name, o))}</ul>
            {!g.denominations.length && <p className="reg-small reg-catalog-empty">Nothing here yet. Drop a denomination/country onto this card.</p>}
            <div className="reg-row-actions"><button type="button" className="reg-text" onClick={() => setRenaming({ kind: 'group', name, value: name })}>Edit spelling</button><button type="button" className="reg-text danger" onClick={() => removeGroup(name)}>Remove group</button></div>
          </>}
        </div>)}
        <div className={`reg-group-card muted ${overGroup === `ungrouped:${o}` ? 'over' : ''} ${isOpen(`ungrouped:${o}`) ? 'open' : ''}`} {...groupDrop(`ungrouped:${o}`)}>
          <button type="button" className="reg-group-head" onClick={() => toggle(`ungrouped:${o}`)} aria-expanded={isOpen(`ungrouped:${o}`)}><b>Not in a group</b><small>{ungrouped(o).length} denomination/country</small></button>
          {isOpen(`ungrouped:${o}`) && <ul className="reg-catalog-list">{ungrouped(o).map(d => chip(d, '', o))}</ul>}
        </div>
      </div>
      )}
    </div>)}
    <div className="reg-admin-add">
      <input placeholder="New group (e.g. UD Asia)" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }} />
      <select aria-label="Organization for the new group" value={newGroup.organization || cat.organizations[0]} onChange={e => setNewGroup({ ...newGroup, organization: e.target.value })}>{cat.organizations.map(o => <option key={o} value={o}>{officeOrg(o)}</option>)}</select>
      <button type="button" className="reg-secondary" onClick={addGroup}>Add group</button>
    </div>
    <div className="reg-form-actions"><small>{dirty ? 'Unsaved changes.' : 'Saved.'}</small><button type="button" className="reg-primary" disabled={!dirty} onClick={() => perform('setCatalog', { catalog: cat }, 'Groups saved.')}>Save groups</button></div>
  </Category>}
  {show.includes('orgs') && <Category title="Organizations and denominations" summary={`${cat.organizations.length} organizations · ${denCount} denominations${dirty ? ' · unsaved changes' : ''}`}>
    {saveLists()}
    {cat.organizations.map(o => <div key={o} className={`reg-catalog-org ${over === o ? 'over' : ''}`} {...dropProps(o)}>
      <div className="reg-catalog-head"><b>{officeOrg(o)}</b>{dirty && <button type="button" className="reg-secondary reg-inline-save" onClick={() => perform('setCatalog', { catalog: cat }, 'Organizations and denominations saved.')}>Save</button>}<button type="button" className="reg-text danger" onClick={() => removeOrg(o)}>Remove organization</button></div>
      <ul className="reg-catalog-list">{(cat.denominations[o] || []).map(v => <li key={v} draggable onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', JSON.stringify({ from: o, den: v })); }}>{logoControl(v)}{renaming?.kind === 'den' && renaming.org === o && renaming.name === v ? renameBox(val => renameDen(o, v, val)) : <span>{v}</span>}<button type="button" className="reg-text" aria-label={`Edit the spelling of ${v}`} title="Edit spelling" onClick={() => setRenaming({ kind: 'den', org: o, name: v, value: v })}>✎</button><button type="button" className="reg-text danger" aria-label={`Remove ${v}`} onClick={() => removeDen(o, v)}>×</button></li>)}</ul>
      {!(cat.denominations[o] || []).length && <p className="reg-small reg-catalog-empty">No denominations. Drop one here or add it below.</p>}
      <div className="reg-admin-add"><input placeholder="New denomination" value={newDen[o] || ''} onChange={e => setNewDen({ ...newDen, [o]: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDen(o); } }} /><label className={`reg-secondary reg-file-button ${newDenLogo[o] ? 'has' : ''}`} title="Logo for the new denomination">{newDenLogo[o] ? `Logo: ${newDenLogo[o].name}` : 'Add logo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; setNewDenLogo({ ...newDenLogo, [o]: f || null }); }} /></label><button type="button" className="reg-secondary" onClick={() => addDen(o)}>Add denomination</button></div>
    </div>)}
    <div className="reg-admin-add"><input placeholder="New organization or grouping" value={newOrg} onChange={e => setNewOrg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOrg(); } }} /><button type="button" className="reg-secondary" onClick={addOrg}>Add organization</button></div>
    {saveLists()}
  </Category>}
  {show.includes('fees') && <Category title="Fees" summary={`Bishop $${feesOf(state).bishop} · Pastor $${feesOf(state).pastor}`}>
    <div className="reg-fields">
      <label className="reg-field"><span>Bishop</span><input type="number" min="1" step="1" value={fees.bishop} onChange={e => setFees({ ...fees, bishop: Number(e.target.value) })} /></label>
      <label className="reg-field"><span>Pastor</span><input type="number" min="1" step="1" value={fees.pastor} onChange={e => setFees({ ...fees, pastor: Number(e.target.value) })} /></label>
    </div>
    <div className="reg-form-actions"><small>Current: ${feesOf(state).bishop} / ${feesOf(state).pastor}</small><button type="button" className="reg-primary" disabled={fees.bishop === feesOf(state).bishop && fees.pastor === feesOf(state).pastor} onClick={() => perform('setFees', fees, 'Fees saved.')}>Save fees</button></div>
  </Category>}
  </>;
}
export default function Settings({ run, state, perform, actor }) {
  const [settings, setSettings] = useState([]), [values, setValues] = useState({}), [saved, setSaved] = useState(false), [copied, setCopied] = useState(''), [telegramResult, setTelegramResult] = useState(''), [query, setQuery] = useState('');
  // Search: a section stays visible when its title, description or any of its field labels contains the words typed.
  const matches = (...texts) => { const q = query.trim().toLowerCase(); return !q || texts.join(' ').toLowerCase().includes(q); };
  const reload = async () => setSettings((await api.listSettings()).settings);
  useEffect(() => { run(reload); }, []);
  const changed = Object.entries(values).filter(([, v]) => v !== undefined);
  const origin = typeof window === 'undefined' ? 'https://kuriakecastle.org' : window.location.origin;
  const links = [['Public roll', '/directory/'], ['Sign in', '/signup/#signin'], ['Sign up as a bishop', '/signup/bishop/'], ['Sign up as a pastor', '/signup/pastor/'], ['Pastoral appointments', '/appointments/'], ['Office sign in', '/admin/'], ['API documentation', '/docs/']];
  const CATEGORIES = [
    ['Email', 'Sign-in emails, bulk emails and issue reports', ['RESEND_API_KEY', 'SMTP_FROM', 'SUPPORT_EMAIL']],
    ['Payments', 'Paystack card and mobile money payments', ['PAYSTACK_PUBLIC_KEY', 'PAYSTACK_SECRET_KEY']],
    ['Telegram', 'Receive system issue alerts on Telegram', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']],
    ['Photos', 'Automatic editing of new photos to the official look (Gemini)', ['GEMINI_API_KEY']],
    ['Photo storage', 'Storage for uploaded photos and payment receipts', ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']],
    ['Access and public page', 'Manage office access and what appears on the public directory', ['ADMIN_ACCESS_CODE', 'ORDER_ACCESS_CODE', 'PUBLIC_DIRECTORY_SOURCE', 'PUBLIC_PHOTOS']],
  ];
  const field = s => <label className="reg-field" key={s.key}>
    <span>{s.label} {s.invalid ? <small className="reg-badge rejected">Wrong value – paste the key again</small> : <small className={`reg-badge ${s.set ? 'verified' : 'unclaimed'}`}>{s.set ? s.test ? 'Set up (test key)' : 'Set up' : 'Not set up'}</small>}</span>
    <input aria-label={s.label} name={`setting-${s.key}`} type={/KEY|SECRET|TOKEN|CODE/.test(s.key) ? 'password' : 'text'} autoComplete={/KEY|SECRET|TOKEN|CODE/.test(s.key) ? 'new-password' : 'off'} data-lpignore="true" data-1p-ignore=""
      value={values[s.key] ?? ''} placeholder={s.set ? '••••••••' : ''} onChange={e => setValues({ ...values, [s.key]: e.target.value })} />
    {s.value && <small>Saved now: <b>{s.value}</b></small>}
    {s.hint && <small>{s.hint}</small>}
  </label>;
  const setCount = keys => { const mine = settings.filter(s => keys.includes(s.key)); if (!mine.length) return ''; if (mine.some(s => s.invalid)) return 'Needs fixing'; const n = mine.filter(s => s.set).length; return n === 0 ? 'Not set up' : n === mine.length ? 'Set up' : 'Partly set up'; };
  // Each church site runs the same sign-up, locked to that church; the office shares these links.
  const churches = Object.entries(DENOMINATION_SITES).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  const sections = [['signup', 'registration sign-up signup pause open close notice'], ['fees', 'fees fee amount price payment bishop pastor'], ['links', 'registration links share copy ' + links.map(([l]) => l).join(' ')], ['church-links', 'church denomination sign-up signup links share copy ' + churches.map(([, c]) => c.name).join(' ')], ...CATEGORIES.map(([title, blurb, keys]) => [title, `${title} ${blurb} ${settings.filter(s => keys.includes(s.key)).map(s => `${s.label} ${s.hint || ''}`).join(' ')}`])];
  const visible = (id) => matches(sections.find(([k]) => k === id)[1]);
  const copy = path => <button type="button" className="reg-text" onClick={() => navigator.clipboard?.writeText(origin + path).then(() => setCopied(path))}>{copied === path ? 'Copied' : 'Copy'}</button>;
  return <div className="reg-settings-list">
  <input type="search" className="reg-settings-search" aria-label="Search Settings" placeholder="Search Settings" value={query} onChange={e => setQuery(e.target.value)} />
  {state && perform && visible('signup') && <SignupControl state={state} perform={perform} />}
  {state && perform && visible('signup') && <DeadlineControl state={state} perform={perform} />}
  {state && perform && visible('signup') && <BlockedPeople state={state} perform={perform} />}
  {state && perform && visible('signup') && <TestAccounts state={state} perform={perform} />}
  {state && perform && visible('fees') && <Structure state={state} perform={perform} actor={actor} show={['fees']} />}
  {visible('links') && <Category title="Registration links" summary={`${links.length} links`} open={Boolean(query.trim())}>
    <ul className="reg-admin-list">{links.map(([label, path]) => <li key={path}><span><b>{label}</b><br /><a href={origin + path}>{origin + path}</a></span><button type="button" className="reg-text" onClick={() => navigator.clipboard?.writeText(origin + path).then(() => setCopied(path))}>{copied === path ? 'Copied' : 'Copy'}</button></li>)}</ul>
  </Category>}
  {visible('church-links') && <Category title="Church sign-up links" summary={`${churches.length} churches`} open={Boolean(query.trim())}>
    <ul className="reg-admin-list">{churches.filter(([, c]) => !query.trim() || matches(c.name)).map(([path, c]) => <li key={path}><span><b>{c.name}</b><br /><a href={churchHref(path, 'signup', origin)}>{churchHref(path, 'signup', origin)}</a></span>{copy(churchHref(path, 'signup'))}</li>)}</ul>
  </Category>}
  <form className="reg-settings-form" onSubmit={event => {
    event.preventDefault();
    run(async () => {
      setSettings((await api.saveSettings(Object.fromEntries(changed))).settings);
      setValues({}); setSaved(true);
    }, 'Settings saved and in effect.');
  }}>
    {CATEGORIES.filter(([title]) => visible(title)).map(([title, blurb, keys]) => <Category key={title} title={title} summary={`${blurb}${setCount(keys) ? ` · ${setCount(keys)}` : ''}`} open={Boolean(query.trim())}>
      {settings.filter(s => keys.includes(s.key)).map(field)}
      {title === 'Email' && <>
        <button type="button" className="reg-secondary" onClick={() => run(async () => { const r = await api.emailTest(); setTelegramResult(`Test email sent to ${r.to}.`); }, 'Email is working.')}>Send me a test email</button>
        {telegramResult && <p className="reg-small">{telegramResult}</p>}
      </>}
      {title === 'Photos' && <>
        <button type="button" className="reg-secondary" disabled={!settings.find(s => s.key === 'GEMINI_API_KEY')?.set} onClick={() => run(async () => { const r = await api.geminiTest(); setTelegramResult(`The Gemini key works: a test photo was edited. Photos so far: ${r.edited} edited, ${r.failed} failed${r.lastError ? ` (last problem: ${r.lastError})` : ''}. Any photos waiting are being edited now.`); }, 'The Gemini key works.')}>Test the Gemini key</button>
        {telegramResult && <p className="reg-small">{telegramResult}</p>}
      </>}
      {title === 'Telegram' && <>
        <button type="button" className="reg-secondary" disabled={!settings.find(s => s.key === 'TELEGRAM_CHAT_ID')?.set} onClick={() => run(async () => { const r = await api.telegramTest(); setTelegramResult(`Test message posted to “${r.chat}”.`); }, 'Telegram is connected.')}>Send a Telegram test message</button>
        {telegramResult && <p className="reg-small">{telegramResult}</p>}
      </>}
      <div className="reg-form-actions"><small>{changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'} to save` : saved ? 'Saved.' : ''}</small><button className="reg-primary" disabled={!changed.length}>Save settings</button></div>
    </Category>)}
  </form>
  {query.trim() && !sections.some(([id]) => visible(id)) && <p className="reg-small">No settings match “{query}”.</p>}
  </div>;
}
export { Structure, SignupControl };
