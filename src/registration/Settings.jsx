"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
// Office-managed integration settings. Saved values are never shown back; the
// office sees only whether each one is set.
export default function Settings({ run }) {
  const [settings, setSettings] = useState([]), [values, setValues] = useState({}), [saved, setSaved] = useState(false), [admins, setAdmins] = useState([]), [newAdmin, setNewAdmin] = useState('');
  const reload = async () => { const r = await api.listSettings(); setSettings(r.settings); setAdmins(r.admins || []); };
  const saveAdmins = (list) => run(async () => { const r = await api.saveSettings({ ADMIN_EMAILS: list.join(',') }); setSettings(r.settings); setAdmins(r.admins || []); setNewAdmin(''); }, 'Office members updated.');
  useEffect(() => { run(reload); }, []);
  const changed = Object.entries(values).filter(([, v]) => v !== undefined);
  return <>
  <section className="reg-card reg-settings">
    <h2>Office members</h2>
    <p>These emails can sign in to /admin/ (with the access code and an emailed code). Add or remove people here.</p>
    <ul className="reg-admin-list">{admins.map(email => <li key={email}><span>{email}</span><button type="button" className="reg-text danger" disabled={admins.length < 2} onClick={() => saveAdmins(admins.filter(e => e !== email))}>Remove</button></li>)}</ul>
    <form className="reg-admin-add" onSubmit={e => { e.preventDefault(); const v = newAdmin.trim().toLowerCase(); if (v && !admins.includes(v)) saveAdmins([...admins, v]); }}>
      <input type="email" required aria-label="New office email" placeholder="name@example.com" value={newAdmin} onChange={e => setNewAdmin(e.target.value)} />
      <button className="reg-primary">Add office member</button>
    </form>
  </section>
  <form className="reg-card reg-settings" onSubmit={event => {
    event.preventDefault();
    run(async () => {
      setSettings((await api.saveSettings(Object.fromEntries(changed))).settings);
      setValues({}); setSaved(true);
    }, 'Settings saved and in effect.');
  }}>
    <h2>Connected services</h2>
    <p>Email delivery, payments, storage and access codes. Leave a field blank to keep its current value; type a single space to clear it.</p>
    {settings.filter(s => s.key !== 'ADMIN_EMAILS').map(s => <label className="reg-field" key={s.key}>
      <span>{s.label} <small className={`reg-badge ${s.set ? 'verified' : 'unclaimed'}`}>{s.set ? 'Set' : 'Not set'}</small></span>
      <input aria-label={s.label} type={/KEY|SECRET|TOKEN|CODE/.test(s.key) ? 'password' : 'text'} autoComplete="off"
        value={values[s.key] ?? ''} placeholder={s.set ? '••••••••' : ''} onChange={e => setValues({ ...values, [s.key]: e.target.value })} />
      {s.hint && <small>{s.hint}</small>}
    </label>)}
    <button className="reg-primary" disabled={!changed.length}>Save settings</button>
    {saved && !changed.length && <p className="reg-small">Saved.</p>}
  </form>
  </>;
}
