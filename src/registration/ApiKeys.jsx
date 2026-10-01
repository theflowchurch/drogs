"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
import { shortDate, shortDateTime } from './format.mjs';
const scopes = [
  ['backend:read', 'Read all data', 'Access all available Kuriake Castle data, including registrations, accounts, pastor lists, payments and photos.'],
  ['registrations:read', 'Read registrations', 'View submitted names, contact details, organisations and registration status.'],
  ['rosters:read', 'Read annual pastor lists', 'View names and contact details on bishops’ annual pastor lists.'],
  ['photos:read', 'View portraits', 'View submitted profile photos. Payment receipts will remain private.'],
];
export default function ApiKeys({ run }) {
  const [keys, setKeys] = useState([]), [name, setName] = useState(''), [days, setDays] = useState('90');
  const [selected, setSelected] = useState(['backend:read']), [issued, setIssued] = useState(null), [revoke, setRevoke] = useState(null);
  const reload = async () => setKeys(await api.listKeys());
  useEffect(() => { run(reload); }, []);
  return <div className="reg-api-keys">
    <form className="reg-card" onSubmit={event => {
      event.preventDefault();
      run(async () => {
        const result = await api.issueKey({ name, days: Number(days), scopes: selected });
        setIssued(result); setName(''); await reload();
      });
    }}>
      <h2>Create an API key</h2>
      <p>Create a separate key for each connected application. API keys can only read the information you allow — they cannot change or delete anything.</p>
      <label className="reg-field">Application name
        <input aria-label="Application name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Church directory" />
      </label>
      <label className="reg-field">Expires after
        <select aria-label="Key expiry" value={days} onChange={e => setDays(e.target.value)}>
          {[7,30,90,365].map(value => <option key={value} value={value}>{value} days</option>)}
          <option value="0">Never expires</option>
        </select>
      </label>
      <fieldset className="reg-api-permissions"><legend>Allowed access</legend>
        {scopes.map(([scope, label, description]) => <label key={scope}>
          <input type="checkbox" checked={selected.includes(scope)} onChange={e => setSelected(e.target.checked ? [...selected, scope] : selected.filter(s => s !== scope))} />
          <span><strong>{label}</strong><small>{description}</small></span>
        </label>)}
      </fieldset>
      <button className="reg-primary" disabled={!selected.length}>Create API key</button>
    </form>
    {issued && <section className="reg-card" aria-label="Created key details">
      <h2>Copy your key now</h2><p>This is the only time the full key is shown. Store it in the connected app’s server settings.</p>
      <label className="reg-field">API key<input aria-label="New API key" readOnly value={issued.token} autoComplete="off" spellCheck={false} /></label>
      <p>Expires: {shortDate(issued.key.expiresAt)}.</p>
      <button className="reg-primary" onClick={() => run(() => navigator.clipboard.writeText(issued.token), 'API key copied.')}>Copy key</button>{' '}
      <button className="reg-text" onClick={() => setIssued(null)}>I’ve saved this key</button>
    </section>}
    <section className="reg-card"><h2>Connected applications</h2>
      {!keys.length ? <p>No API keys have been created.</p> : keys.map(key => {
        const inactive = key.revokedAt || key.expiresAt <= Date.now();
        return <article className="reg-api-key" key={key.id}>
          <div><h3>{key.name}</h3><code>{key.prefix}…</code>
            <details className="reg-api-scopes"><summary>View permissions</summary><p>{key.scopes.map(scope => scopes.find(([k]) => k === scope)?.[1] || scope).join(' · ')}<br /><code>{key.scopes.join(' · ')}</code></p></details>
            <small>{key.revokedAt ? 'Revoked' : key.expiresAt <= Date.now() ? 'Expired' : `Expires: ${shortDate(key.expiresAt)}`}{key.lastUsedAt ? ` · Last used: ${shortDateTime(key.lastUsedAt)}` : ' · Not used yet'}</small>
          </div>
          {!inactive && (revoke === key.id ? <div><p>Disconnect {key.name} immediately?</p>
            <button className="reg-primary" onClick={() => run(async () => { await api.revokeKey(key.id); if (issued?.key.id === key.id) setIssued(null); setRevoke(null); await reload(); }, 'API key revoked.')}>Confirm revoke</button>{' '}
            <button className="reg-text" onClick={() => setRevoke(null)}>Cancel</button></div> : <button className="reg-text" aria-label={`Revoke access for ${key.name}`} onClick={() => setRevoke(key.id)}>Revoke access</button>)}
        </article>;
      })}
    </section>
    <section className="reg-card"><h2>Connect an application</h2>
      <p>Send the key in an <code>Authorization: Bearer YOUR_API_KEY</code> header from your app’s server. Don’t put it in a website’s public JavaScript.</p>
      <p>Full access uses <code>/api/v1/backend/</code>: registrations, rosters, profiles, users, history, media, media-url, settings, reference and keys. Registrations include payments and receipt references. All years are included unless filtered.</p>
      <ul><li><code>GET /api/v1/registrations?year=2027&amp;limit=50</code></li><li><code>GET /api/v1/rosters?year=2027&amp;limit=50</code></li><li><code>GET /api/v1/photos?path=ENCODED_PHOTO_PATH</code></li></ul>
      <p>List responses include <code>nextCursor</code>. Pass it as <code>after</code> to get the next page. The limit is 120 requests per minute per key.</p>
    </section>
  </div>;
}
