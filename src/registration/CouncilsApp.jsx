'use client';
import { useEffect, useMemo, useState } from 'react';
import { ORGANISATIONS as data } from './ministry-organisations.mjs';
import PortraitImage from './PortraitImage';
import useSectionFocus from './useSectionFocus';
import { portraitStyle } from '../runtime/portrait-framing';
import './councils.css';

// A second design of the Bishop's Directory (office, 9 Nov), at /councils/:
// the same people and sections as /organisations/, presented after the
// office's mockup: a night-sky header with the earth, coloured section tiles,
// and inside each section a row of tabs that shows one group at a time.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const shortName = name => name.replace(/^The /, '');
const sections = data.groups.flatMap(g => g.organisations);
const groupsOf = o => (o.directoryGroups?.length ? o.directoryGroups : [{ slug: o.slug, name: o.name, people: o.people }]).filter(g => g.people?.length);
const COLOURS = { 'united-denominations': 'purple', 'first-love-church': 'blue', councils: 'teal', 'para-church': 'magenta', 'change-of-status': 'gold' };

function Photo({ person }) {
  if (!person?.image) return <span className="cz-photo-empty" aria-hidden="true"/>;
  const edited = person.image.startsWith('assets/organisations/people/');
  const style = edited ? { '--portrait-x': '50%', '--portrait-y': '0%' } : Object.fromEntries(portraitStyle(person.image).split(';').filter(Boolean).map(pair => pair.split(':')));
  const thumb = person.image.replace(/^(assets\/portraits)\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp');
  return <PortraitImage media={person.image} src={`${base}/${thumb}`} fallbackSrc={`${base}/${person.image}`} alt={person.name} className="cz-portrait" style={style}/>;
}

function Card({ person }) {
  return <article className="cz-card">
    <div className="cz-card-photo"><Photo person={person}/></div>
    <div className="cz-card-text">
      <strong>{person.title || 'Bishop'} {person.name}</strong>
      <span>{person.role || person.church}</span>
      {person.consecrated && <small>Consecrated {person.consecrated}</small>}
    </div>
  </article>;
}

function Section({ section }) {
  const groups = groupsOf(section);
  const [active, setActive] = useState(groups[0]?.slug);
  // A link to a group (#ud-ghana-east) opens that group's tab.
  useEffect(() => {
    const open = () => { const id = location.hash.slice(1); if (groups.some(g => g.slug === id)) { setActive(id); document.getElementById(section.slug)?.scrollIntoView(); } };
    open(); addEventListener('hashchange', open); return () => removeEventListener('hashchange', open);
  }, []);
  const shown = groups.filter(g => g.slug === active);
  const single = groups.length === 1;
  return <section className={`cz-section cz-${COLOURS[section.slug] || 'blue'}`} id={section.slug} aria-labelledby={`${section.slug}-title`}>
    <h2 id={`${section.slug}-title`}>{section.name}</h2>
    {!single && <div className="cz-tabs" role="tablist" aria-label={`${shortName(section.name)} groups`}>
      {groups.map(g => <button key={g.slug} type="button" role="tab" aria-selected={active === g.slug} className={active === g.slug ? 'is-on' : ''} onClick={() => setActive(g.slug)}>{shortName(g.name)}</button>)}
    </div>}
    {shown.map(g => <div className="cz-group" key={g.slug}>
      <div className="cz-group-head">
        <h3>{single ? 'Bishops' : `${shortName(g.name)} Bishops`}</h3>
        <span className="cz-pill">{g.people.length} {g.people.length === 1 ? 'Bishop' : 'Bishops'}</span>
      </div>
      <div className="cz-cards">{g.people.map(p => <Card key={p.rosterId || p.name} person={p}/>)}</div>
    </div>)}
  </section>;
}

// The "↑ Sections" button shows once the section tiles are off screen.
function ToSections({ onClick }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById('sections'); if (!el) return;
    const seen = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    seen.observe(el); return () => seen.disconnect();
  }, []);
  return show ? <a className="cz-to-sections" href="#sections" onClick={onClick}>↑ Sections</a> : null;
}

export default function CouncilsApp() {
  const { focus, open, close } = useSectionFocus();
  const [menu, setMenu] = useState(false);
  const stats = useMemo(() => {
    const people = new Map();
    sections.forEach(s => groupsOf(s).forEach(g => g.people.forEach(p => people.set(p.rosterId || p.name, p))));
    return { bishops: people.size };
  }, []);
  return <div className="cz-site" id="top">
    <header className="cz-hero">
      <img className="cz-earth" src={`${base}/assets/organisations/earth.webp`} alt="" aria-hidden="true"/>
      <div className="cz-bar">
        <div className="cz-menu">
          <button type="button" aria-expanded={menu} onClick={() => setMenu(v => !v)}>Menu <span aria-hidden="true">⌄</span></button>
          {menu && <nav aria-label="Sections">{sections.map(s => <a key={s.slug} href={`#${s.slug}`} onClick={event => { setMenu(false); open(s.slug)(event); }}>{s.tabName || shortName(s.name)}</a>)}</nav>}
        </div>
      </div>
      <div className="cz-hero-text">
        <p className="cz-kicker">The Central Directory of</p>
        <h1>Bishops</h1>
        <p className="cz-sub">Across All Denominations</p>
      </div>
      <div className="cz-stats">
        <span><strong>{stats.bishops}</strong>Bishops</span>
      </div>
      <nav className="cz-tiles" id="sections" aria-label="Sections">{sections.map(s => <a key={s.slug} href={`#${s.slug}`} onClick={open(s.slug)} className={`cz-tile cz-${COLOURS[s.slug] || 'blue'}`}>{s.tabName || shortName(s.name)}</a>)}</nav>
    </header>
    <main className="cz-panel">
      {sections.filter(s => !focus || s.slug === focus).map(s => <Section key={s.slug} section={s}/>)}
      <div className="cz-end-links">
        {focus && <a className="cz-top" href="#sections" onClick={close('sections')}>↑ Back to sections</a>}
        <a className="cz-top" href="#top" onClick={close('top')}>↑ Back to the top</a>
      </div>
    </main>
    <ToSections onClick={close('sections')}/>
    <footer className="cz-footer"><span>{data.name}</span><span>Updated {data.updated}</span></footer>
  </div>;
}
