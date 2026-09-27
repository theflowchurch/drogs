"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
const date = value => value ? new Date(value).toLocaleString() : 'Not recorded';
const status = value => value === 'not_started' ? 'Not started' : value.replaceAll('_', ' ');
export default function Accounts({ run }) {
  const [result, setResult] = useState(null), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [history, setHistory] = useState(null), [person, setPerson] = useState(null);
  const load = (page = 1, term = query) => run(async () => setResult(await api.accounts(term, page)));
  useEffect(() => { load(); }, []);
  return <div className="reg-accounts">
    <section className="reg-card">
      <div className="reg-account-toolbar"><div><h2>Account signups</h2><p>{result ? `${result.total} ${query ? 'matching' : 'total'} accounts` : 'Loading accounts…'} · Latest login first</p></div><button className="reg-text" onClick={() => load(result?.page || 1)}>Refresh</button></div>
      <form className="reg-account-search" onSubmit={e => { e.preventDefault(); setQuery(search); load(1, search); }}>
        <label className="reg-field">Find an account<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email address" maxLength={254} /></label><button className="reg-primary">Search accounts</button>
      </form>
      <p className="reg-account-note">An account is created when someone first verifies their email. Registration status refers to the current annual cycle. Login tracking starts with this update; older dates may be unavailable.</p>
      {result && !result.data.length ? <p>No accounts found.</p> : result && <div className="reg-account-table"><table><thead><tr><th>Person</th><th>Account created</th><th>Last successful login</th><th>Registration</th><th>Activity</th></tr></thead><tbody>{result.data.map(account => <tr key={account.id}>
        <td><strong>{account.name || 'Name not yet provided'}</strong><span>{account.email}</span><small>{account.office ? 'Office admin' : account.role || 'Role not yet selected'}</small></td>
        <td>{date(account.signedUpAt)}</td><td>{date(account.lastLoginAt)}</td><td className="reg-account-status">{status(account.registrationStatus)}</td>
        <td><button className="reg-text" onClick={() => run(async () => { const events = await api.logins(account.id); setPerson(account); setHistory(events); })}>View logins ({account.loginCount})</button></td>
      </tr>)}</tbody></table></div>}
      {result && result.total > 50 && <div className="reg-account-toolbar"><button className="reg-text" disabled={result.page === 1} onClick={() => load(result.page - 1)}>Previous</button><span>Page {result.page} of {Math.ceil(result.total / 50)}</span><button className="reg-text" disabled={result.page * 50 >= result.total} onClick={() => load(result.page + 1)}>Next</button></div>}
    </section>
    {history && <section className="reg-card" aria-label="Account login history"><div className="reg-account-toolbar"><div><h2>Successful logins</h2><p>{person.email}</p></div><button className="reg-text" onClick={() => setHistory(null)}>Close history</button></div>
      {history.data.length ? <ul>{history.data.map(event => <li key={event.id}>{date(event.loggedInAt)} — Email verified</li>)}</ul> : <p>No logins recorded since tracking began.</p>}
      {history.nextCursor && <button className="reg-text" onClick={() => run(async () => { const next = await api.logins(person.id, history.nextCursor); setHistory({ ...next, data: [...history.data, ...next.data] }); })}>Load earlier logins</button>}
    </section>}
  </div>;
}
