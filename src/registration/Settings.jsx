"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
// Office-managed integration settings. Saved values are never shown back; the
// office sees only whether each one is set.
export default function Settings({ run }) {
  const [settings, setSettings] = useState([]), [values, setValues] = useState({}), [saved, setSaved] = useState(false), [copied, setCopied] = useState('');
  const reload = async () => setSettings((await api.listSettings()).settings);
  useEffect(() => { run(reload); }, []);
  const changed = Object.entries(values).filter(([, v]) => v !== undefined);
  const origin = typeof window === 'undefined' ? 'https://kuriakecastle.org' : window.location.origin;
  const links = [['Public roll', '/directory/'], ['Sign in', '/signup/#signin'], ['Sign up as a bishop', '/signup/bishop/'], ['Sign up as a pastor', '/signup/pastor/'], ['Office sign in', '/admin/'], ['API documentation', '/docs/']];
  return <>
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
    {saved && !changed.length && <p className="reg-small">Saved.</p>}
  </form>
  </>;
}
