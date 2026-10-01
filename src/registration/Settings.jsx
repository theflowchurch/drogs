"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
// Office-managed integration settings. Saved values are never shown back; the
// office sees only whether each one is set.
import { catalogOf, feesOf, orgLabel, signupOf, SIGNUP_PAUSED } from './model.mjs';
// Organizations, their denominations and the fees: editable lists saved as one action each.
// Pause or reopen sign-up. Paused: new people cannot request a code or submit;
// everyone already registered keeps signing in, paying and editing.
function SignupControl({ state, perform }) {
  const current = signupOf(state);
  const [notice, setNotice] = useState(current.notice);
  useEffect(() => setNotice(current.notice), [current.notice]);
  return <section className="reg-card reg-settings">
    <h2>Registration</h2>
    <p>Currently <b>{current.closed ? 'paused' : 'open'}</b>. {current.closed ? 'New people see the message below and cannot sign up; members who already registered are unaffected.' : 'Anyone can sign up. Pause it to stop new registrations, for example once the cycle has closed.'}</p>
    <label className="reg-field wide"><span>Message shown while paused</span><textarea rows={3} value={notice} onChange={e => setNotice(e.target.value)} placeholder={SIGNUP_PAUSED} /></label>
    <div className="reg-form-actions">
      {current.closed
        ? <><button type="button" className="reg-secondary" onClick={() => perform('setSignup', { closed: true, notice }, 'Message saved.')}>Save message</button><button type="button" className="reg-primary" onClick={() => perform('setSignup', { closed: false, notice }, 'Sign-up is open again.')}>Reopen sign-up</button></>
        : <button type="button" className="reg-primary danger" onClick={() => perform('setSignup', { closed: true, notice }, 'Sign-up is paused.')}>Pause sign-up</button>}
    </div>
  </section>;
}
function Structure({ state, perform }) {
  const base = state ? catalogOf(state) : null;
  const [cat, setCat] = useState(null), [fees, setFees] = useState(null), [newOrg, setNewOrg] = useState(''), [newDen, setNewDen] = useState({}), [over, setOver] = useState(null);
  const [newGroup, setNewGroup] = useState({ name: '', organization: '' }), [overGroup, setOverGroup] = useState(null), [openGroup, setOpenGroup] = useState(null);
  useEffect(() => { if (base && !cat) setCat(JSON.parse(JSON.stringify(base))); if (state && !fees) setFees({ ...feesOf(state) }); }, [state]);
  if (!cat || !fees) return null;
  const dirty = JSON.stringify(cat) !== JSON.stringify(base);
  const addOrg = () => { const o = newOrg.trim(); if (!o || cat.organizations.includes(o)) return; setCat({ ...cat, organizations: [...cat.organizations, o], denominations: { ...cat.denominations, [o]: [] } }); setNewOrg(''); };
  const removeOrg = (o) => { const d = { ...cat.denominations }; delete d[o]; setCat({ ...cat, organizations: cat.organizations.filter(x => x !== o), denominations: d, groups: Object.fromEntries(Object.entries(cat.groups || {}).filter(([, g]) => g.organization !== o)) }); };
  const addDen = (o) => { const v = (newDen[o] || '').trim(); if (!v || (cat.denominations[o] || []).includes(v)) return; setCat({ ...cat, denominations: { ...cat.denominations, [o]: [...(cat.denominations[o] || []), v].sort((a, b) => a.localeCompare(b)) } }); setNewDen({ ...newDen, [o]: '' }); };
  const removeDen = (o, v) => setCat({ ...cat, denominations: { ...cat.denominations, [o]: cat.denominations[o].filter(x => x !== v) } });
  // Groups: cards per group; denomination chips drag between groups of the same
  // organization, or back to “Not in a group”. Adding a denomination to a group
  // also lists it on the sign-up form for that organization.
  const groups = cat.groups || {};
  const normal = v => String(v || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const grouped = o => new Set(Object.values(groups).filter(g => g.organization === o).flatMap(g => g.denominations.map(normal)));
  const ungrouped = o => (cat.denominations[o] || []).filter(d => !grouped(o).has(normal(d)));
  const setGroupDens = (name, dens) => setCat({ ...cat, groups: { ...groups, [name]: { ...groups[name], denominations: dens } } });
  const moveToGroup = (from, to, den) => {
    if (!den || from === to) return;
    let next = { ...groups };
    if (from && next[from]) next = { ...next, [from]: { ...next[from], denominations: next[from].denominations.filter(x => normal(x) !== normal(den)) } };
    let dens = { ...cat.denominations };
    if (to && next[to]) {
      const o = next[to].organization;
      if (!next[to].denominations.some(x => normal(x) === normal(den))) next = { ...next, [to]: { ...next[to], denominations: [...next[to].denominations, den] } };
      if (!(dens[o] || []).some(x => normal(x) === normal(den))) dens = { ...dens, [o]: [...(dens[o] || []), den].sort((a, b) => a.localeCompare(b)) };
    }
    setCat({ ...cat, groups: next, denominations: dens });
  };
  const addGroup = () => { const n = newGroup.name.trim(), o = newGroup.organization || cat.organizations[0]; if (!n || groups[n]) return; setCat({ ...cat, groups: { ...groups, [n]: { organization: o, denominations: [] } } }); setNewGroup({ name: '', organization: '' }); };
  const removeGroup = (n) => { const next = { ...groups }; delete next[n]; setCat({ ...cat, groups: next }); if (openGroup === n) setOpenGroup(null); };
  const groupDrop = (target) => ({
    onDragOver: e => { e.preventDefault(); if (overGroup !== target) setOverGroup(target); },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverGroup(null); },
    onDrop: e => { e.preventDefault(); setOverGroup(null); const { fromGroup, den } = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); if (den !== undefined) moveToGroup(fromGroup || '', target.startsWith('ungrouped:') ? '' : target, den); },
  });
  const chip = (den, fromGroup) => <li key={den} draggable onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', JSON.stringify({ fromGroup, den })); }}><span>{den}</span>{fromGroup && <button type="button" className="reg-text danger" aria-label={`Take ${den} out of ${fromGroup}`} onClick={() => moveToGroup(fromGroup, '', den)}>×</button>}</li>;
  const OFFICE_ORG = { 'United Denominations': 'UD – OLGC' };
  const officeOrg = o => OFFICE_ORG[o] || orgLabel(o);
  // Drag a denomination chip onto another organization's card to move it.
  const moveDen = (from, to, v) => { if (!from || from === to || !v) return; const d = { ...cat.denominations, [from]: cat.denominations[from].filter(x => x !== v) }; d[to] = [...new Set([...(d[to] || []), v])].sort((a, b) => a.localeCompare(b)); setCat({ ...cat, denominations: d }); };
  const dropProps = (o) => ({
    onDragOver: e => { e.preventDefault(); if (over !== o) setOver(o); },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); },
    onDrop: e => { e.preventDefault(); setOver(null); const { from, den } = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); moveDen(from, o, den); },
  });
  return <>
  <section className="reg-card reg-settings">
    <h2>Groups</h2>
    <p>Each organization’s denominations fall into groups (UD Ghana, UD Africa, United Islands…). Tap a card to see its denominations; drag a denomination onto another card to move it. The office directory and the members’ directory can filter by group; the public page does not show groups.</p>
    {cat.organizations.map(o => <div key={o} className="reg-group-org">
      <h3>{officeOrg(o)}</h3>
      <div className="reg-group-grid">
        {Object.entries(groups).filter(([, g]) => g.organization === o).map(([name, g]) => <div key={name} className={`reg-group-card ${overGroup === name ? 'over' : ''} ${openGroup === name ? 'open' : ''}`} {...groupDrop(name)}>
          <button type="button" className="reg-group-head" onClick={() => setOpenGroup(openGroup === name ? null : name)} aria-expanded={openGroup === name}><b>{name}</b><small>{g.denominations.length} denomination{g.denominations.length === 1 ? '' : 's'}</small></button>
          {openGroup === name && <>
            <ul className="reg-catalog-list">{g.denominations.map(d => chip(d, name))}</ul>
            {!g.denominations.length && <p className="reg-small reg-catalog-empty">Nothing here yet. Drop a denomination onto this card.</p>}
            <button type="button" className="reg-text danger" onClick={() => removeGroup(name)}>Remove group</button>
          </>}
        </div>)}
        <div className={`reg-group-card muted ${overGroup === `ungrouped:${o}` ? 'over' : ''} ${openGroup === `ungrouped:${o}` ? 'open' : ''}`} {...groupDrop(`ungrouped:${o}`)}>
          <button type="button" className="reg-group-head" onClick={() => setOpenGroup(openGroup === `ungrouped:${o}` ? null : `ungrouped:${o}`)} aria-expanded={openGroup === `ungrouped:${o}`}><b>Not in a group</b><small>{ungrouped(o).length} denomination{ungrouped(o).length === 1 ? '' : 's'}</small></button>
          {openGroup === `ungrouped:${o}` && <ul className="reg-catalog-list">{ungrouped(o).map(d => chip(d, ''))}</ul>}
        </div>
      </div>
    </div>)}
    <div className="reg-admin-add">
      <input placeholder="New group (e.g. UD Asia)" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }} />
      <select aria-label="Organization for the new group" value={newGroup.organization || cat.organizations[0]} onChange={e => setNewGroup({ ...newGroup, organization: e.target.value })}>{cat.organizations.map(o => <option key={o} value={o}>{officeOrg(o)}</option>)}</select>
      <button type="button" className="reg-secondary" onClick={addGroup}>Add group</button>
    </div>
    <div className="reg-form-actions"><small>{dirty ? 'Unsaved changes.' : 'Saved.'}</small><button type="button" className="reg-primary" disabled={!dirty} onClick={() => perform('setCatalog', { catalog: cat }, 'Groups saved.')}>Save groups</button></div>
  </section>
  <section className="reg-card reg-settings">
    <h2>Organizations and denominations</h2>
    <p>What the sign-up form offers. Add a new fellowship or grouping here and it appears on the form at once. An organization with no denominations hides the denomination field. Drag a denomination onto another organization to move it there.</p>
    {cat.organizations.map(o => <div key={o} className={`reg-catalog-org ${over === o ? 'over' : ''}`} {...dropProps(o)}>
      <div className="reg-catalog-head"><b>{officeOrg(o)}</b><button type="button" className="reg-text danger" onClick={() => removeOrg(o)}>Remove organization</button></div>
      <ul className="reg-catalog-list">{(cat.denominations[o] || []).map(v => <li key={v} draggable onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', JSON.stringify({ from: o, den: v })); }}><span>{v}</span><button type="button" className="reg-text danger" aria-label={`Remove ${v}`} onClick={() => removeDen(o, v)}>×</button></li>)}</ul>
      {!(cat.denominations[o] || []).length && <p className="reg-small reg-catalog-empty">No denominations. Drop one here or add it below.</p>}
      <div className="reg-admin-add"><input placeholder="New denomination" value={newDen[o] || ''} onChange={e => setNewDen({ ...newDen, [o]: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDen(o); } }} /><button type="button" className="reg-secondary" onClick={() => addDen(o)}>Add denomination</button></div>
    </div>)}
    <div className="reg-admin-add"><input placeholder="New organization or grouping" value={newOrg} onChange={e => setNewOrg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOrg(); } }} /><button type="button" className="reg-secondary" onClick={addOrg}>Add organization</button></div>
    <div className="reg-form-actions"><small>{dirty ? 'Unsaved changes.' : 'Saved.'}</small><button type="button" className="reg-primary" disabled={!dirty} onClick={() => perform('setCatalog', { catalog: cat }, 'Organizations and denominations saved.')}>Save lists</button></div>
  </section>
  <section className="reg-card reg-settings">
    <h2>Fees</h2>
    <p>Whole US dollars. Applies to registrations submitted from now on.</p>
    <div className="reg-fields">
      <label className="reg-field"><span>Bishop</span><input type="number" min="1" step="1" value={fees.bishop} onChange={e => setFees({ ...fees, bishop: Number(e.target.value) })} /></label>
      <label className="reg-field"><span>Pastor</span><input type="number" min="1" step="1" value={fees.pastor} onChange={e => setFees({ ...fees, pastor: Number(e.target.value) })} /></label>
    </div>
    <div className="reg-form-actions"><small>Current: ${feesOf(state).bishop} / ${feesOf(state).pastor}</small><button type="button" className="reg-primary" disabled={fees.bishop === feesOf(state).bishop && fees.pastor === feesOf(state).pastor} onClick={() => perform('setFees', fees, 'Fees saved.')}>Save fees</button></div>
  </section>
  </>;
}
export default function Settings({ run, state, perform }) {
  const [settings, setSettings] = useState([]), [values, setValues] = useState({}), [saved, setSaved] = useState(false), [copied, setCopied] = useState(''), [telegramResult, setTelegramResult] = useState('');
  const reload = async () => setSettings((await api.listSettings()).settings);
  useEffect(() => { run(reload); }, []);
  const changed = Object.entries(values).filter(([, v]) => v !== undefined);
  const origin = typeof window === 'undefined' ? 'https://kuriakecastle.org' : window.location.origin;
  const links = [['Public roll', '/directory/'], ['Sign in', '/signup/#signin'], ['Sign up as a bishop', '/signup/bishop/'], ['Sign up as a pastor', '/signup/pastor/'], ['Office sign in', '/admin/'], ['API documentation', '/docs/']];
  return <>
  {state && perform && <SignupControl state={state} perform={perform} />}
  {state && perform && <Structure state={state} perform={perform} />}
  <section className="reg-card reg-settings">
    <h2>Links to share</h2>
    <p>Send people the right door. Office access itself is granted under Accounts; anyone you add there signs in at the office link.</p>
    <ul className="reg-admin-list">{links.map(([label, path]) => <li key={path}><span><b>{label}</b><br /><a href={origin + path}>{origin + path}</a></span><button type="button" className="reg-text" onClick={() => navigator.clipboard?.writeText(origin + path).then(() => setCopied(path))}>{copied === path ? 'Copied' : 'Copy'}</button></li>)}</ul>
  </section>
  <form className="reg-card reg-settings" onSubmit={event => {
    event.preventDefault();
    run(async () => {
      setSettings((await api.saveSettings(Object.fromEntries(changed))).settings);
      setValues({}); setSaved(true);
    }, 'Settings saved and in effect.');
  }}>
    <h2>Connected services</h2>
    <p>Email delivery, payments, storage and access codes. Office members are managed under Accounts. Leave a field blank to keep its current value; type a single space to clear it.</p>
    {settings.filter(s => s.key !== 'ADMIN_EMAILS').map(s => <label className="reg-field" key={s.key}>
      <span>{s.label} <small className={`reg-badge ${s.set ? 'verified' : 'unclaimed'}`}>{s.set ? 'Set' : 'Not set'}</small></span>
      <input aria-label={s.label} type={/KEY|SECRET|TOKEN|CODE/.test(s.key) ? 'password' : 'text'} autoComplete="off"
        value={values[s.key] ?? ''} placeholder={s.set ? '••••••••' : ''} onChange={e => setValues({ ...values, [s.key]: e.target.value })} />
      {s.hint && <small>{s.hint}</small>}
    </label>)}
    <button className="reg-primary" disabled={!changed.length}>Save settings</button>
    <button type="button" className="reg-secondary" disabled={!settings.find(s => s.key === 'TELEGRAM_CHAT_ID')?.set} onClick={() => run(async () => { const r = await api.telegramTest(); setTelegramResult(`Test message posted to “${r.chat}”.`); }, 'Telegram is connected.')}>Send a Telegram test message</button>
    {telegramResult && <p className="reg-small">{telegramResult}</p>}
    {saved && !changed.length && <p className="reg-small">Saved.</p>}
  </form>
  </>;
}
export { Structure, SignupControl };
