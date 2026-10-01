"use client";
import { useEffect, useRef, useState } from 'react';
import * as api from './client';
import { shortDateTime } from './format.mjs';
const date = value => value ? shortDateTime(value) : 'Not recorded';
const status = value => value === 'not_started' ? 'Not started' : value.replaceAll('_', ' ');
export default function Accounts({ run }) {
  const [result, setResult] = useState(null), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [history, setHistory] = useState(null), [person, setPerson] = useState(null);
  const [admins, setAdmins] = useState([]), [newAdmin, setNewAdmin] = useState(''), [revoking, setRevoking] = useState(''), [deleting, setDeleting] = useState('');
  const seq = useRef(0);
  // Only the latest request may set the table; a slow first load must not overwrite a search.
  const load = (page = 1, term = query) => { const n = ++seq.current; return run(async () => { const r = await api.accounts(term, page); if (n === seq.current) setResult(r); }); };
  const saveAdmins = (list, message = 'Office access updated.') => run(async () => { setAdmins((await api.saveSettings({ ADMIN_EMAILS: list.join(',') })).admins || []); setNewAdmin(''); }, message);
  const remove = (body, message) => run(async () => { await api.removeAccounts(body); const n = ++seq.current; const r = await api.accounts(query, 1); if (n === seq.current) setResult(r); }, message);
  useEffect(() => { load(); run(async () => setAdmins((await api.listSettings()).admins || [])); }, []);
  // Results appear as you type (name or email), after a short pause between keystrokes.
  useEffect(() => { const t = setTimeout(() => { if (search !== query) { setQuery(search); load(1, search); } }, 250); return () => clearTimeout(t); }, [search]);
  return <div className="reg-accounts">
    <section className="reg-card">
      <h2>Office access</h2>
      <p>These email addresses have access to the Kuriake Castle office. You can add or remove access below.</p>
      <ul className="reg-admin-list">{admins.map(email => <li key={email}><span>{email}</span><button type="button" className="reg-text danger" disabled={admins.length < 2} onClick={() => setRevoking(email)}>Remove access</button></li>)}</ul>
      <form className="reg-admin-add" onSubmit={e => { e.preventDefault(); const v = newAdmin.trim().toLowerCase(); if (v && !admins.includes(v)) saveAdmins([...admins, v]); }}>
        <input type="email" required aria-label="New office email" placeholder="name@example.com" value={newAdmin} onChange={e => setNewAdmin(e.target.value)} />
        <button className="reg-primary">Add office access</button>
      </form>
    </section>
    <section className="reg-card">
      <div className="reg-account-toolbar"><div><h2>Member accounts</h2><p>{result ? `${result.total} ${query ? 'matching ' : ''}account${result.total === 1 ? '' : 's'}` : 'Loading accounts…'} · Most recent login first</p></div><button className="reg-text" onClick={() => load(result?.page || 1)}>Refresh</button></div>
      <form className="reg-account-search" onSubmit={e => { e.preventDefault(); setQuery(search); load(1, search); }}>
        <label className="reg-field">Find an account<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Start typing a name or email address" maxLength={254} autoComplete="off" /></label><button className="reg-primary">Search</button>
      </form>
      <p className="reg-account-note">An account is created when someone first signs in. Deleting an account permanently removes their profile, registration, uploads and login history.</p>
      <p className="reg-account-note">Office accounts cannot be deleted from this page.</p>
      {result && !result.data.length ? <p>No accounts found.</p> : result && <div className="reg-account-table"><table><thead><tr><th>Person</th><th>Account created</th><th>Last login</th><th>Registration</th><th>Activity</th></tr></thead><tbody>{result.data.map(account => <tr key={account.id}>
        <td><strong>{account.name || 'Name not provided yet'}</strong><span>{account.email}</span><small>{account.office ? 'Office member' : account.role || 'Role not yet selected'}</small></td>
        <td>{date(account.signedUpAt)}</td><td>{date(account.lastLoginAt)}</td><td className="reg-account-status">{status(account.registrationStatus)}</td>
        <td><button className="reg-text" onClick={() => run(async () => { const events = await api.logins(account.id); setPerson(account); setHistory(events); })}>View logins ({account.loginCount})</button>
          {!account.office && (deleting === account.id
            ? <span className="reg-inline-confirm">Delete this account? <button className="reg-text danger" onClick={() => { setDeleting(''); remove({ user: account.id }, 'Account deleted.'); }}>Yes, delete</button> <button className="reg-text" onClick={() => setDeleting('')}>Cancel</button></span>
            : <button className="reg-text danger" onClick={() => setDeleting(account.id)}>Delete account</button>)}</td>
      </tr>)}</tbody></table></div>}
      {result && result.total > 50 && <div className="reg-account-toolbar"><button className="reg-text" disabled={result.page === 1} onClick={() => load(result.page - 1)}>Previous</button><span>Page {result.page} of {Math.ceil(result.total / 50)}</span><button className="reg-text" disabled={result.page * 50 >= result.total} onClick={() => load(result.page + 1)}>Next</button></div>}
    </section>
    {revoking && <div className="reg-overlay"><section className="reg-dialog" role="dialog" aria-modal="true" aria-label="Remove office access">
      <div className="reg-section-head"><h2>Remove office access?</h2><button className="reg-icon" onClick={() => setRevoking('')} aria-label="Close">×</button></div>
      <p><strong>{revoking}</strong> will no longer be able to sign in to the Kuriake Castle office. You can add access again later.</p>
      <div className="reg-review-buttons">
        <button className="reg-secondary danger" autoFocus onClick={() => { const email = revoking; setRevoking(''); saveAdmins(admins.filter(e => e !== email), `Access removed for ${email}.`); }}>Yes, remove access</button>
        <button className="reg-secondary" onClick={() => setRevoking('')}>Keep access</button>
      </div>
    </section></div>}
    {history && <section className="reg-card" aria-label="Account login history"><div className="reg-account-toolbar"><div><h2>Successful logins</h2><p>{person.email}</p></div><button className="reg-text" onClick={() => setHistory(null)}>Close history</button></div>
      {history.data.length ? <ul>{history.data.map(event => <li key={event.id}>{date(event.loggedInAt)} — Signed in</li>)}</ul> : <p>No logins recorded since tracking began.</p>}
      {history.nextCursor && <button className="reg-text" onClick={() => run(async () => { const next = await api.logins(person.id, history.nextCursor); setHistory({ ...next, data: [...history.data, ...next.data] }); })}>Load earlier logins</button>}
    </section>}
  </div>;
}
