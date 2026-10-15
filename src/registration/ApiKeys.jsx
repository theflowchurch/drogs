"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
import { shortDate, shortDateTime } from './format.mjs';
const scopes = [
  ['backend:write', 'Manage all website data', 'Add and edit people, photos, pastor assignments, spreadsheet imports, registrations, catalog, fees and signup settings.'],
  ['people:write', 'Manage people', 'Add people, correct names and details, move pastors, and remove or restore directory records.'],
  ['photos:write', 'Manage photos', 'Upload and replace portraits, find people, and view current Photo tasks totals.'],
  ['rosters:write', 'Import pastor sheets', 'Preview and apply pastor spreadsheets under a chosen bishop.'],
  ['backend:read', 'Read all data', 'Access all available Kuriake Castle data, including registrations, accounts, pastor lists, payments and photos.'],
  ['registrations:read', 'Read registrations', 'View submitted names, contact details, organisations and registration status.'],
  ['rosters:read', 'Read annual pastor lists', 'View names and contact details on bishops’ annual pastor lists.'],
  ['photos:read', 'View portraits', 'View submitted profile photos. Payment receipts will remain private.'],
];
export default function ApiKeys({ run }) {
  const [keys, setKeys] = useState([]), [name, setName] = useState(''), [days, setDays] = useState('90');
  const [access, setAccess] = useState('read'), [issued, setIssued] = useState(null), [revoke, setRevoke] = useState(null);
  const reload = async () => setKeys(await api.listKeys());
  useEffect(() => { run(reload); }, []);
  return <div className="reg-api-keys">
    <form className="reg-card" onSubmit={event => {
      event.preventDefault();
      run(async () => {
        const result = await api.issueKey({ name, days: Number(days), scopes: access === 'full' ? ['backend:read', 'backend:write'] : ['backend:read'] });
        setIssued(result); setName(''); await reload();
      });
    }}>
      <h2>Create an API key</h2>
      <label className="reg-field">Application name
        <input aria-label="Application name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Church directory" />
      </label>
      <label className="reg-field">Expires after
        <select aria-label="Key expiry" value={days} onChange={e => setDays(e.target.value)}>
          {[7,30,90,365].map(value => <option key={value} value={value}>{value} days</option>)}
          <option value="0">Never expires</option>
        </select>
      </label>
      <label className="reg-field">Access
        <select aria-label="Key access" value={access} onChange={e => setAccess(e.target.value)}>
          <option value="read">Read only</option>
          <option value="full">Full access — read, write and edit</option>
        </select>
      </label>
      <button className="reg-primary">Create API key</button>
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
            <small>{key.scopes.includes('backend:write') ? 'Full access' : key.scopes.includes('backend:read') ? 'Read only' : key.scopes.map(scope => scopes.find(([k]) => k === scope)?.[1] || scope).join(' · ')}</small>
            <small>{key.revokedAt ? 'Revoked' : key.expiresAt <= Date.now() ? 'Expired' : `Expires: ${shortDate(key.expiresAt)}`}{key.lastUsedAt ? ` · Last used: ${shortDateTime(key.lastUsedAt)}` : ' · Not used yet'}</small>
          </div>
          {!inactive && (revoke === key.id ? <div><p>Disconnect {key.name} immediately?</p>
            <button className="reg-primary" onClick={() => run(async () => { await api.revokeKey(key.id); if (issued?.key.id === key.id) setIssued(null); setRevoke(null); await reload(); }, 'API key revoked.')}>Confirm revoke</button>{' '}
            <button className="reg-text" onClick={() => setRevoke(null)}>Cancel</button></div> : <button className="reg-text" aria-label={`Revoke access for ${key.name}`} onClick={() => setRevoke(key.id)}>Revoke access</button>)}
        </article>;
      })}
    </section>
  </div>;
}
