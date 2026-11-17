'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Masthead, Photo } from './OrganisationsApp';
import { bishopSurname, DIRECTORY_GROUPS, allBishopsOf } from './ministry-organisations.mjs';
import useLiveRoll from './useLiveRoll';
import { patchGroups } from './live-patch.mjs';
import { bishopEntries, pastorEntries, setOfficeLogos } from './public-entries.mjs';
import './denomination-sites.css';
import './organisations.css';

// The public list of bishops (office, 15 Nov): every bishop on the
// Organisations page once, A to Z by surname, in that page's style. A bishop's
// card opens their church and the year they were consecrated.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const letterOf = b => (bishopSurname(b.name)[0] || '#').toUpperCase();

export function Card({ person, onOpen, fallback }) {
  return <button type="button" className="org-member bl-card" onClick={() => onOpen(person)} aria-haspopup="dialog">
    <span className="org-member-photo"><Photo person={person}/></span>
    <span className="org-member-text">
      <small>{person.title || fallback}</small>
      <strong>{person.name}</strong>
    </span>
  </button>;
}

export function Detail({ person, onClose, fallback }) {
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
        <small>{person.title || fallback}</small>
        <h2 id="bl-detail-name">{person.name}</h2>
        <dl>
          {person.details ? person.details.map(d => <div key={d.label}><dt>{d.label}</dt><dd className={d.logo !== undefined ? 'bl-church' : undefined}>{d.logo && <img src={`${base}/${d.logo}`} alt=""/>}<span>{d.value || 'Not recorded'}</span></dd></div>) : <>
          <div><dt>Church</dt><dd className="bl-church">{person.logo && <img src={`${base}/${person.logo}`} alt=""/>}<span>{person.church || 'Not recorded'}</span></dd></div>
          <div><dt>{person.consecrated || !person.appointed ? 'Consecrated' : 'Appointed'}</dt><dd>{person.consecrated || person.appointed || 'Not recorded'}</dd></div>
          </>}
        </dl>
      </div>
    </div>
  </div>;
}

// Pastors' register (office, 17 Nov): thousands of cards, so they are drawn a
// screenful at a time as the visitor scrolls.
const STEP = 120;
export default function BishopsApp({ bishops: published, kind = 'bishop', masthead = {} }) {
  // The office's live changes over the list this page was built with.
  const live = useLiveRoll();
  const bishops = useMemo(() => { if (live) setOfficeLogos(live.logos); return !live ? published : kind === 'pastor'
    ? pastorEntries(live.people).map(({ denomination, ...p }) => p)
    : bishopEntries(allBishopsOf(patchGroups(DIRECTORY_GROUPS, live).groups), live.byId); }, [live, published, kind]);
  const noun = kind === 'pastor' ? 'pastor' : 'bishop', fallback = kind === 'pastor' ? 'Pastor' : 'Bishop';
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(STEP);
  const more = useRef(null);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? bishops.filter(b => b.name.toLowerCase().includes(q)) : bishops;
  }, [bishops, query]);
  useEffect(() => { setLimit(STEP); }, [query]);
  useEffect(() => {
    if (!more.current || limit >= shown.length) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setLimit(n => n + STEP); }, { rootMargin: '1200px 0px' });
    io.observe(more.current);
    return () => io.disconnect();
  }, [limit, shown.length]);
  const letters = useMemo(() => {
    const m = new Map();
    for (const b of shown.slice(0, limit)) { const l = letterOf(b); if (!m.has(l)) m.set(l, []); m.get(l).push(b); }
    return [...m];
  }, [shown, limit]);
  return <div className="denom-site org-site bl-site" id="top">
    <Masthead count={false} {...masthead}/>
    <main className="org-main bl-main">
      <div className="bl-tools">
        <label className="bl-search"><span className="sr-only">Search {noun}s</span>
          <input id="bl-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name" autoComplete="off"/>
        </label>
      </div>
      {!letters.length && <p className="bl-empty">No {noun} matches “{query}”.</p>}
      {letters.map(([l, people]) => <section key={l} className="bl-letter" id={`letter-${l}`} aria-labelledby={`h-${l}`}>
        <h2 className="bl-letter-heading" id={`h-${l}`}>{l}</h2>
        <div className="org-members">{people.map(p => <Card key={p.rosterId || p.name} person={p} onOpen={setOpen} fallback={fallback}/>)}</div>
      </section>)}
      {limit < shown.length && <div ref={more} className="bl-more"><button type="button" className="bl-more-button" onClick={() => setLimit(n => n + STEP)}>Show more</button></div>}
    </main>
    {open && <Detail person={open} onClose={() => setOpen(null)} fallback={fallback}/>}
  </div>;
}
