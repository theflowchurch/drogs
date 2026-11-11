'use client';
import { useEffect, useRef, useState } from 'react';
import { ORGANISATIONS as data, DIRECTORY_GROUPS, DIRECTORY_TOTAL } from './ministry-organisations.mjs';
import PortraitImage from './PortraitImage';
import useGroupFocus from './useGroupFocus';
import GoodStandingNotice from './GoodStandingNotice';
import NightGlobe from './NightGlobe';
import GroupThumbs from './GroupThumbs';
import { portraitStyle } from '../runtime/portrait-framing';
import './councils.css';

// The modern design (office, 9 Nov), at /councils/: the same title, contents
// and groups as /organisations/, in a dark glass theme. Numbered rows, a
// search box ("/" to jump to it), arrow keys between rows, a count that runs
// up to the total, and a filter on each group's page.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const pad = n => String(n).padStart(2, '0');
const plural = n => `${n} ${n === 1 ? 'Bishop' : 'Bishops'}`;
const matches = (text, query) => text.toLowerCase().includes(query.trim().toLowerCase());
const stillMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// A group's name, then the initials it is known by (office, 10 Nov).
const Name = ({ group }) => <>{group.name}{group.initials && <span className="tx-initials"> – {group.initials}</span>}</>;

function Photo({ person }) {
  if (!person?.image) return <span className="tx-photo-empty" aria-hidden="true"/>;
  const edited = person.image.startsWith('assets/organisations/people/');
  const style = edited ? { '--portrait-x': '50%', '--portrait-y': '0%' } : Object.fromEntries(portraitStyle(person.image).split(';').filter(Boolean).map(pair => pair.split(':')));
  const thumb = person.image.replace(/^(assets\/portraits)\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp');
  return <PortraitImage media={person.image} src={`${base}/${thumb}`} fallbackSrc={`${base}/${person.image}`} alt={person.name} className="tx-portrait" style={style}/>;
}

function Card({ person }) {
  return <article className="tx-card">
    <div className="tx-card-photo"><Photo person={person}/></div>
    <div className="tx-card-text">
      <small className="tx-card-title">{person.title || 'Bishop'}</small>
      <strong>{person.name}</strong>
      <span>{person.role || person.church}</span>
      {person.consecrated ? <em>Consecrated {person.consecrated}</em> : person.appointed && <em>Appointed {person.appointed}</em>}
    </div>
  </article>;
}

// The total runs up from zero when the page opens (still for reduced motion).
function CountUp({ to }) {
  const [n, setN] = useState(to);
  useEffect(() => {
    if (stillMotion()) return;
    let frame; const start = performance.now();
    const step = now => { const t = Math.min(1, (now - start) / 1100); setN(Math.round(to * (1 - (1 - t) ** 3))); if (t < 1) frame = requestAnimationFrame(step); };
    setN(0); frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  return <>{n}</>;
}

function Title({ compact, children }) {
  return <div className={`tx-head ${compact ? 'is-compact' : ''}`}>
    <a href="#contents" className="tx-logo"><img src={`${base}/assets/organisations/dhmm-logo-white.webp`} alt="DHMM – Dag Heward-Mills Ministries" width="1200" height="396"/></a>
    <div className="tx-title">
      <p className="tx-sub">Worldwide Fellowship of Bishops</p>
      <p className="tx-total"><span className="tx-dot" aria-hidden="true"/>Roll of Good Standing <span className="tx-sep">·</span> <strong><CountUp to={DIRECTORY_TOTAL}/></strong> Bishops</p>
    </div>
    {children && <div className="tx-head-tools">{children}</div>}
  </div>;
}

const THEME_KEY = 'dhmm-councils-theme';
// The day/night switch in the title bar.
function ThemeSwitch({ day, onToggle }) {
  return <button type="button" className="tx-theme" onClick={onToggle} title={day ? 'Night look' : 'Day look'} aria-pressed={day} aria-label={day ? 'Switch to the night look' : 'Switch to the day look'}>
    <span className={`tx-theme-opt ${!day ? 'is-on' : ''}`}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 12.2A6.5 6.5 0 0 1 7.8 4.5a6.5 6.5 0 1 0 7.7 7.7Z" fill="currentColor"/></svg></span>
    <span className={`tx-theme-opt ${day ? 'is-on' : ''}`}><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="currentColor"/><g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M10 1.8v2.1M10 16.1v2.1M1.8 10h2.1M16.1 10h2.1M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5"/></g></svg></span>
  </button>;
}

function Search({ value, onChange, label, inputRef }) {
  return <label className="tx-search">
    <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    <input ref={inputRef} type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={label} aria-label={label}/>
    {inputRef && <kbd aria-hidden="true">/</kbd>}
  </label>;
}

// A soft light follows the pointer across the rows.
const spotlight = e => { const row = e.target.closest?.('.tx-row'); if (!row) return; const r = row.getBoundingClientRect(); row.style.setProperty('--mx', `${e.clientX - r.left}px`); };

function Contents({ query, search }) {
  const list = useRef(null);
  const shown = DIRECTORY_GROUPS.filter(g => !query || matches(`${g.name} ${g.initials} ${(g.parts || []).map(p => `${p.name} ${p.initials}`).join(' ')}`, query));
  // "/" jumps to the search box; ↑ and ↓ move between the rows.
  useEffect(() => {
    const keys = e => {
      if (e.key === '/' && document.activeElement !== search.current) { e.preventDefault(); search.current?.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const rows = [...(list.current?.querySelectorAll('a') || [])]; if (!rows.length) return;
      const at = rows.indexOf(document.activeElement);
      if (at < 0 && document.activeElement !== search.current) return;
      e.preventDefault();
      rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
    };
    addEventListener('keydown', keys); return () => removeEventListener('keydown', keys);
  }, []);
  return <>
    <nav className="tx-contents" id="contents" aria-label="Contents" ref={list} onPointerMove={spotlight}>
      {shown.map(g => <a key={g.slug} href={`#${g.slug}`} className="tx-row" style={{ '--box': g.colour, '--i': DIRECTORY_GROUPS.indexOf(g) }}>
        <span className="tx-index">{pad(DIRECTORY_GROUPS.indexOf(g) + 1)}</span>
        <span className="tx-row-name"><Name group={g}/></span>
        <span className="tx-row-count"><i aria-hidden="true"/>{plural(g.count)}</span>
        <span className="tx-arrow" aria-hidden="true">→</span>
      </a>)}
      {!shown.length && <p className="tx-empty">No group matches “{query}”.</p>}
    </nav>
  </>;
}

// Office, 11 Nov: Para-Church and First Love Church open a second contents
// page, one row per council or country with small photos of its bishops.
function SubContents({ group, variant }) {
  return <section className="tx-group" id={group.slug} aria-labelledby={`${group.slug}-title`} style={{ '--box': group.colour }}>
    <div className="tx-crumbs"><a href="#contents" className="tx-back">← All Groups</a></div>
    <div className="tx-group-head">
      <h2 id={`${group.slug}-title`}><Name group={group}/></h2>
      <span className="tx-chip">{plural(group.count)}</span>
    </div>
    <nav className="tx-contents tx-subcontents" aria-label={`${group.name}: contents`} onPointerMove={spotlight}>
      {/* Office, 11 Nov: every bishop's photo beside the name, in the bar. */}
      {group.parts.map((part, i) => <a key={part.slug} href={`#${part.slug}`} className="tx-row tx-subrow" style={{ '--box': part.colour, '--i': i }}>
        <span className="tx-index">{pad(i + 1)}</span>
        <span className="tx-row-name"><Name group={part}/></span>
        <GroupThumbs people={part.people} variant={variant}/>
        <span className="tx-row-count"><i aria-hidden="true"/>{plural(part.people.length)}</span>
        <span className="tx-arrow" aria-hidden="true">→</span>
      </a>)}
    </nav>
  </section>;
}

function Group({ group, part }) {
  const [query, setQuery] = useState('');
  const keep = people => people.filter(p => !query || matches(`${p.title || ''} ${p.name} ${p.role || ''} ${p.church || ''}`, query));
  const shown = part || group;
  const people = keep(shown.people);
  return <section className="tx-group" id={shown.slug} aria-labelledby={`${shown.slug}-title`} style={{ '--box': shown.colour || group.colour }}>
    <div className="tx-crumbs">
      <a href="#contents" className="tx-back">← All Groups</a>
      {part && <a href={`#${group.slug}`} className="tx-back">← {group.name}</a>}
    </div>
    <div className="tx-group-head">
      <h2 id={`${shown.slug}-title`}><Name group={shown}/></h2>
      <span className="tx-chip">{plural(shown.people.length)}</span>
    </div>
    <Search value={query} onChange={setQuery} label="Find a bishop in this group"/>
    <div className="tx-part"><div className="tx-cards">{people.map(p => <Card key={p.rosterId || p.name} person={p}/>)}</div></div>
    {!people.length && <p className="tx-empty">No bishop in this group matches “{query}”.</p>}
  </section>;
}

export default function CouncilsApp() {
  const { group, part } = useGroupFocus();
  // Office, 11 Nov: every bishop's photo in a strip beside each council's or
  // country's name.
  const variant = 'all';
  const [query, setQuery] = useState('');
  const search = useRef(null);
  // Day or night (office, 10 Nov): day by default, night one tap away; the
  // choice is kept on this device.
  const [day, setDay] = useState(true);
  useEffect(() => { try { setDay(localStorage.getItem(THEME_KEY) !== 'night'); } catch {} }, []);
  const toggle = () => setDay(d => { try { localStorage.setItem(THEME_KEY, d ? 'night' : 'day'); } catch {} return !d; });
  return <div className={`tx-site ${day ? 'tx-day' : ''}`} id="top">
    {/* The living backdrop (office, 10 Nov): stars that twinkle, an aurora
        that drifts, and the earth turning slowly with its city lights
        glowing (NightGlobe). All still for reduced motion. */}
    <div className="tx-sky" aria-hidden="true"><i className="tx-stars tx-stars-1"/><i className="tx-stars tx-stars-2"/><i className="tx-aurora"/></div>
    <div className="tx-backdrop" aria-hidden="true">
      <NightGlobe day={day} src={`${base}/assets/organisations/${day ? 'earth-day-4k' : 'earth-night-4k'}.webp`} fallback={`${base}/assets/organisations/earth.webp`}/>
    </div>
    <header className="tx-header"><Title compact={Boolean(group)}>
      {!group && <Search value={query} onChange={setQuery} label="Search groups" inputRef={search}/>}
      <ThemeSwitch day={day} onToggle={toggle}/>
    </Title></header>
    <main className="tx-main">
      {group ? <>
        {group.parts && !part ? <SubContents group={group} variant={variant}/> : <Group key={(part || group).slug} group={group} part={part}/>}
        <div className="tx-end"><a className="tx-back" href="#contents">← All Groups</a>{part && <a className="tx-back" href={`#${group.slug}`}>← {group.name}</a>}</div>
      </> : <Contents query={query} search={search}/>}
      {!group && <GoodStandingNotice className="tx-good-standing"/>}
    </main>
    <footer className="tx-footer"><span>Updated {data.updated}</span><span className="tx-mono">{DIRECTORY_TOTAL} bishops · {DIRECTORY_GROUPS.length} groups</span></footer>
  </div>;
}
