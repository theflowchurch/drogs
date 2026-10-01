"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
// Office-managed integration settings. Saved values are never shown back; the
// office sees only whether each one is set.
import { catalogOf, feesOf, orgLabel } from './model.mjs';
// Organizations, their denominations and the fees: editable lists saved as one action each.
function Structure({ state, perform }) {
  const base = state ? catalogOf(state) : null;
  const [cat, setCat] = useState(null), [fees, setFees] = useState(null), [newOrg, setNewOrg] = useState(''), [newDen, setNewDen] = useState({});
  useEffect(() => { if (base && !cat) setCat(JSON.parse(JSON.stringify(base))); if (state && !fees) setFees({ ...feesOf(state) }); }, [state]);
  if (!cat || !fees) return null;
  const dirty = JSON.stringify(cat) !== JSON.stringify(base);
  const addOrg = () => { const o = newOrg.trim(); if (!o || cat.organizations.includes(o)) return; setCat({ organizations: [...cat.organizations, o], denominations: { ...cat.denominations, [o]: [] } }); setNewOrg(''); };
  const removeOrg = (o) => { const d = { ...cat.denominations }; delete d[o]; setCat({ organizations: cat.organizations.filter(x => x !== o), denominations: d }); };
  const addDen = (o) => { const v = (newDen[o] || '').trim(); if (!v || (cat.denominations[o] || []).includes(v)) return; setCat({ ...cat, denominations: { ...cat.denominations, [o]: [...(cat.denominations[o] || []), v].sort((a, b) => a.localeCompare(b)) } }); setNewDen({ ...newDen, [o]: '' }); };
  const removeDen = (o, v) => setCat({ ...cat, denominations: { ...cat.denominations, [o]: cat.denominations[o].filter(x => x !== v) } });
  return <>
  <section className="reg-card reg-settings">
    <h2>Organizations and denominations</h2>
    <p>What the sign-up form offers. Add a new fellowship or grouping here and it appears on the form at once. An organization with no denominations hides the denomination field.</p>
    {cat.organizations.map(o => <div key={o} className="reg-catalog-org">
      <div className="reg-catalog-head"><b>{orgLabel(o)}</b>{o !== orgLabel(o) && <small> ({o})</small>}<button type="button" className="reg-text danger" onClick={() => removeOrg(o)}>Remove organization</button></div>
      <ul className="reg-catalog-list">{(cat.denominations[o] || []).map(v => <li key={v}><span>{v}</span><button type="button" className="reg-text danger" aria-label={`Remove ${v}`} onClick={() => removeDen(o, v)}>×</button></li>)}</ul>
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
