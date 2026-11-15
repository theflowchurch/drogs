'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Masthead, Photo } from './OrganisationsApp';
import { bishopSurname } from './ministry-organisations.mjs';
import './denomination-sites.css';
import './organisations.css';

// The public list of bishops (office, 15 Nov): every bishop on the
// Organisations page once, A to Z by surname, in that page's style. A bishop's
// card opens their church and the year they were consecrated.
const letterOf = b => (bishopSurname(b.name)[0] || '#').toUpperCase();

function Card({ person, onOpen }) {
  return <button type="button" className="org-member bl-card" onClick={() => onOpen(person)} aria-haspopup="dialog">
    <span className="org-member-photo"><Photo person={person}/></span>
    <span className="org-member-text">
      <small>{person.title || 'Bishop'}</small>
      <strong>{person.name}</strong>
    </span>
  </button>;
}

function Detail({ person, onClose }) {
  const close = useRef(null);
  useEffect(() => {
    close.current?.focus();
    const key = e => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [onClose]);
  return <div className="bl-backdrop" onClick={onClose}>
    <div className="bl-detail" role="dialog" aria-modal="true" aria-labelledby="bl-detail-name" onClick={e => e.stopPropagation()}>
      <button ref={close} type="button" className="bl-close" onClick={onClose} aria-label="Close">×</button>
      <div className="bl-detail-photo"><Photo person={person} large/></div>
      <div className="bl-detail-text">
        <small>{person.title || 'Bishop'}</small>
        <h2 id="bl-detail-name">{person.name}</h2>
        <dl>
          <div><dt>Church</dt><dd>{person.church || 'Not recorded'}</dd></div>
          <div><dt>{person.consecrated || !person.appointed ? 'Consecrated' : 'Appointed'}</dt><dd>{person.consecrated || person.appointed || 'Not recorded'}</dd></div>
        </dl>
      </div>
    </div>
  </div>;
}

export default function BishopsApp({ bishops }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? bishops.filter(b => `${b.name} ${b.church || ''}`.toLowerCase().includes(q)) : bishops;
  }, [bishops, query]);
  const letters = useMemo(() => {
    const m = new Map();
    for (const b of shown) { const l = letterOf(b); if (!m.has(l)) m.set(l, []); m.get(l).push(b); }
    return [...m];
  }, [shown]);
  return <div className="denom-site org-site bl-site" id="top">
    <Masthead/>
    <main className="org-main bl-main">
      <div className="bl-tools">
        <h1 className="bl-heading">The Bishops <span>A to Z</span></h1>
        <label className="bl-search"><span className="sr-only">Search bishops</span>
          <input id="bl-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or church" autoComplete="off"/>
        </label>
      </div>
      {!query && <nav className="bl-letters" aria-label="Jump to a letter">{letters.map(([l]) => <a key={l} href={`#letter-${l}`}>{l}</a>)}</nav>}
      {letters.length ? letters.map(([l, people]) => <section key={l} className="bl-letter" id={`letter-${l}`} aria-labelledby={`h-${l}`}>
        <h2 className="bl-letter-heading" id={`h-${l}`}>{l}</h2>
        <div className="org-members">{people.map(p => <Card key={p.rosterId || p.name} person={p} onOpen={setOpen}/>)}</div>
      </section>) : <p className="bl-empty">No bishop matches “{query}”.</p>}
    </main>
    {open && <Detail person={open} onClose={() => setOpen(null)}/>}
  </div>;
}
