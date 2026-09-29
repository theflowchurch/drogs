"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
// Office-managed integration settings. Saved values are never shown back; the
// office sees only whether each one is set.
export default function Settings({ run }) {
  const [settings, setSettings] = useState([]), [values, setValues] = useState({}), [saved, setSaved] = useState(false);
  const reload = async () => setSettings((await api.listSettings()).settings);
  useEffect(() => { run(reload); }, []);
  const changed = Object.entries(values).filter(([, v]) => v !== undefined);
  return <form className="reg-card reg-settings" onSubmit={event => {
    event.preventDefault();
    run(async () => {
      setSettings((await api.saveSettings(Object.fromEntries(changed))).settings);
      setValues({}); setSaved(true);
    }, 'Settings saved and in effect.');
  }}>
    <h2>Connected services</h2>
    <p>Email delivery, payments, storage and access codes. Leave a field blank to keep its current value; type a single space to clear it.</p>
    {settings.map(s => <label className="reg-field" key={s.key}>
      <span>{s.label} <small className={`reg-badge ${s.set ? 'verified' : 'unclaimed'}`}>{s.set ? 'Set' : 'Not set'}</small></span>
      <input aria-label={s.label} type={/KEY|SECRET|TOKEN|CODE/.test(s.key) ? 'password' : 'text'} autoComplete="off"
        value={values[s.key] ?? ''} placeholder={s.set ? '••••••••' : ''} onChange={e => setValues({ ...values, [s.key]: e.target.value })} />
      {s.hint && <small>{s.hint}</small>}
    </label>)}
    <button className="reg-primary" disabled={!changed.length}>Save settings</button>
    {saved && !changed.length && <p className="reg-small">Saved.</p>}
  </form>;
}
