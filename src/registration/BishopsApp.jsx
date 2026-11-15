'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Masthead, Photo } from './OrganisationsApp';
import { bishopSurname } from './ministry-organisations.mjs';
import './denomination-sites.css';
import './organisations.css';

// The public list of bishops (office, 15 Nov): every bishop on the
// Organisations page once, A to Z by surname, in that page's style. A bishop's
// card opens their church and the year they were consecrated.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
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
          <div><dt>Church</dt><dd className="bl-church">{person.logo && <img src={`${base}/${person.logo}`} alt=""/>}<span>{person.church || 'Not recorded'}</span></dd></div>
          <div><dt>{person.consecrated || !person.appointed ? 'Consecrated' : 'Appointed'}</dt><dd>{person.consecrated || person.appointed || 'Not recorded'}</dd></div>
        </dl>
      </div>
    </div>
  </div>;
}

export default function BishopsApp({ bishops }) {
  const [open, setOpen] = useState(null);
  const letters = useMemo(() => {
    const m = new Map();
    for (const b of bishops) { const l = letterOf(b); if (!m.has(l)) m.set(l, []); m.get(l).push(b); }
    return [...m];
  }, [bishops]);
  return <div className="denom-site org-site bl-site" id="top">
    <Masthead/>
    <main className="org-main bl-main">
      {letters.map(([l, people]) => <section key={l} className="bl-letter" id={`letter-${l}`} aria-labelledby={`h-${l}`}>
        <h2 className="bl-letter-heading" id={`h-${l}`}>{l}</h2>
        <div className="org-members">{people.map(p => <Card key={p.rosterId || p.name} person={p} onOpen={setOpen}/>)}</div>
      </section>)}
    </main>
    {open && <Detail person={open} onClose={() => setOpen(null)}/>}
  </div>;
}
