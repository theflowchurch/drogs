'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from './client';
import { denominationSite, denominationPeople, ministerSections, ministerDisplayTitle } from './denomination-sites.mjs';
import { placeOf } from './model.mjs';
import PortraitImage from './PortraitImage';
import DenominationTexture from './DenominationTexture';
import LicensedMinisterNotice from './LicensedMinisterNotice';
import { portraitStyle } from '../runtime/portrait-framing';
import people from './reference-people.json';
import './denomination-sites.css';

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const Arrow = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const SearchIcon = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>;
const thumb = path => path.replace(/^(assets\/portraits)\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp');

function useChurchRoster(site) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const inFlight = useRef(false), mounted = useRef(false);
  async function load() {
    if (inFlight.current) return;
    inFlight.current = true;
    try { const snapshot = await api.publicDirectory(); if (mounted.current) { setData(snapshot); setError(''); } }
    catch (e) { if (mounted.current) setError(e.message); }
    finally { inFlight.current = false; }
  }
  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 30000);
    window.addEventListener('focus', load);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener('focus', load); };
  }, []);
  const list = useMemo(() => data ? denominationPeople(data, site, people) : [], [data, site]);
  return { data, error, list, retry: load };
}

function MinisterPortrait({ person, full = false }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true;
    setUrl('');
    if (!person.photo || person.standing === false) return;
    const load = () => api.mediaUrl(person.photo).then(value => { if (live) setUrl(value); }).catch(() => {});
    load();
    const refresh = setInterval(load, 50 * 60 * 1000);
    return () => { live = false; clearInterval(refresh); };
  }, [person.photo, person.standing]);
  const source = person.standing === false ? '' : person.photo ? url : person.image ? `${base}/${full ? person.image : thumb(person.image)}` : '';
  if (!source) return <span className="denom-portrait-placeholder" aria-label={person.standing === false ? 'Not yet confirmed' : 'Photograph not available'}><svg width="80" height="96" viewBox="0 0 80 96" fill="currentColor" aria-hidden="true"><circle cx="40" cy="27" r="18"/><path d="M7 91V76c0-20 14-30 33-30s33 10 33 30v15Z"/></svg></span>;
  const media = person.photo || person.image;
  const style = Object.fromEntries(portraitStyle(media).split(';').filter(Boolean).map(pair => pair.split(':')));
  return <PortraitImage media={media} src={source} alt={person.name} className="denom-portrait" style={style} fallbackSrc={!full && !person.photo && person.image ? `${base}/${person.image}` : undefined} />;
}
function MinisterDialog({ person, onClose, onPrevious, onNext, position, total }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog className="denom-dialog" ref={ref} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={e => {
    if (e.key === 'ArrowLeft' && onPrevious) { e.preventDefault(); onPrevious(); }
    if (e.key === 'ArrowRight' && onNext) { e.preventDefault(); onNext(); }
  }} aria-labelledby="denom-person-name">
    <div className="denom-profile-toolbar"><span>MINISTER PROFILE · {position} / {total}</span><button type="button" className="denom-close" onClick={onClose} aria-label="Close profile">×</button></div>
    <div className="denom-profile-layout"><div className="denom-profile-photo"><MinisterPortrait person={person} full /></div>
      <div className="denom-profile-copy"><p className="denom-kicker">{ministerDisplayTitle(person)}</p><h2 id="denom-person-name">{person.name}</h2>
        {placeOf(person) && <p>{placeOf(person)}</p>}
        {person.role === 'pastor' && person.bishop && <p className="denom-profile-detail">Bishop · {person.bishop}</p>}
      </div>
    </div>
    <nav className="denom-profile-navigation" aria-label="Minister profiles"><button type="button" className="denom-nav-button" onClick={onPrevious} disabled={!onPrevious} aria-label="Previous minister">← Previous</button><span>{position} of {total}</span><button type="button" className="denom-nav-button" onClick={onNext} disabled={!onNext} aria-label="Next minister">Next →</button></nav>
  </dialog>;
}
function ProfileViewer({ list, selectedId, onSelect }) {
  const index = list.findIndex(p => p.id === selectedId), selected = list[index];
  return selected && selected.standing !== false ? <MinisterDialog person={selected} onClose={() => onSelect(null)} position={index + 1} total={list.length} onPrevious={index > 0 ? () => onSelect(list[index - 1].id) : null} onNext={index < list.length - 1 ? () => onSelect(list[index + 1].id) : null}/> : null;
}
function GalleryPortrait({ person, onOpen, index }) {
  return <button type="button" className={`denom-gallery-portrait gallery-${index}`} onClick={() => onOpen(person.id)} aria-label={`View ${person.name}`}>
    <div className="denom-gallery-image"><MinisterPortrait person={person} full/></div>
    <span className="denom-gallery-caption"><small>{ministerDisplayTitle(person)}</small><strong>{person.name}</strong></span>
  </button>;
}
function ChurchName({ config }) {
  return <><h1 className="denom-church-name">{config.shortName}</h1>{config.subtitle && <p className="denom-church-subtitle">{config.subtitle}</p>}</>;
}
function HomeGallery({ list, onOpen, className = '' }) {
  return <div className={`denom-home-gallery ${className}`} aria-label="Photo gallery of ministers">{list.map((person, i) => <GalleryPortrait key={person.id} person={person} index={i} onOpen={onOpen}/>)}</div>;
}
function DenominationHome({ site, roster }) {
  const config = denominationSite(site), [selectedId, onSelect] = useState(null);
  const sections = useMemo(() => ministerSections(roster.list), [roster.list]);
  const ordered = [...sections.bishops, ...sections.pastors];
  // Use current roster portraits, with both women and men represented where available.
  const portraits = ordered.filter(p => p.photo || p.image);
  const woman = portraits.find(p => p.gender === 'female');
  const gallery = [...new Map([portraits[0], woman, ...portraits].filter(Boolean).map(p => [p.id, p])).values()].slice(0, 4);
  const link = <a className="denom-action" href={`${base}/${site}/directory/`}>{config.directoryAction}<Arrow/></a>;
  const mark = <img className="denom-hero-logo" src={`${base}/${config.logo}`} alt={`${config.name} logo`} fetchPriority="high"/>;
  return <main className="denom-home">
    {site === 'lighthousechapelinternational' && <section className="lighthouse-hero">
      <div className="denom-home-copy">{mark}<p className="denom-kicker">THE MINISTERIAL DIRECTORY</p><ChurchName config={config}/><p className="denom-home-description">Meet the bishops and pastors licensed to minister within Lighthouse Chapel International.</p>{link}<p className="denom-home-footnote">One church. A worldwide ministry.</p></div>
      <div className="lighthouse-gallery-wrap"><p className="denom-gallery-heading">FACES OF OUR MINISTRY <span>{gallery.length ? `01 — ${String(Math.min(3, gallery.length)).padStart(2, '0')}` : 'PHOTO GALLERY'}</span></p><HomeGallery list={gallery} onOpen={onSelect}/></div>
    </section>}
    {site === 'pleasantsurprise' && <section className="pleasant-hero">
      <div className="denom-home-copy">{mark}<p className="denom-kicker">PEOPLE AT THE HEART OF MINISTRY</p><ChurchName config={config}/><p className="denom-home-description">Get to know the bishops and pastors of Pleasant Surprise Church International.</p>{link}</div>
      <HomeGallery list={gallery} onOpen={onSelect}/>
    </section>}
    {site === 'gochurch' && <><section className="go-hero">
      <div className="denom-home-copy">{mark}<p className="denom-kicker">THE CHURCH. THE PEOPLE. THE MINISTRY.</p><ChurchName config={config}/><p className="denom-home-description">The bishops and pastors of Go Church.<br/>Find a minister. Put a face to a name.</p>{link}</div>
      <HomeGallery list={gallery.slice(0, 3)} onOpen={onSelect}/>
    </section><div className="go-ministry-strip"><span>THE MINISTRY DIRECTORY <Arrow/></span><span>Bishops & pastors</span><span>{roster.data ? `${ordered.length} ministers` : 'Explore our ministry'}</span></div></>}
    {!roster.data && <p className="denom-gallery-status" role="status">{roster.error ? 'The photo gallery could not be loaded.' : 'Loading the photo gallery…'}{roster.error && <button type="button" onClick={roster.retry}>Try again</button>}</p>}
    <LicensedMinisterNotice/>
    <ProfileViewer list={ordered} selectedId={selectedId} onSelect={onSelect}/>
  </main>;
}
function MinisterGrid({ list, onOpen }) {
  return <div className="denom-grid">{list.map(person => <button type="button" className="denom-person" key={person.id} onClick={() => onOpen(person.id)} aria-label={person.name}>
    <div className="denom-person-photo"><MinisterPortrait person={person}/><span className="denom-card-arrow" aria-hidden="true"><Arrow/></span></div>
    <div className="denom-person-copy"><small>{ministerDisplayTitle(person)}</small><h3>{person.name}</h3>{placeOf(person) && <p>{placeOf(person)}</p>}</div>
  </button>)}</div>;
}
// Native disclosure + ordinary buttons retains keyboard and screen-reader access.
function FilterMenu({ label, value, options, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) ref.current.open = false; };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  return <details className="denom-filter-menu" ref={ref} onKeyDown={e => { if (e.key === 'Escape') { ref.current.open = false; ref.current.querySelector('summary').focus(); } }}>
    <summary><span><small>{label}</small>{options.find(o => o.value === value)?.label}</span><span aria-hidden="true">⌄</span></summary>
    <div className="denom-filter-options" role="group" aria-label={label}>{options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => { onChange(option.value); ref.current.open = false; ref.current.querySelector('summary').focus(); }}>{option.label}<span aria-hidden="true">{value === option.value ? '✓' : ''}</span></button>)}</div>
  </details>;
}
function DirectoryFilters({ site, filter, cities, update, reset }) {
  const cityOptions = [{ value: '', label: 'All cities' }, ...cities.map(city => ({ value: city, label: city }))];
  const genders = [{ value: '', label: 'Everyone' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }];
  const active = Boolean(filter.q || filter.city || filter.gender);
  const search = <label className="denom-search"><span className="denom-field-label">Search ministers</span><div><SearchIcon/><input type="search" placeholder={site === 'gochurch' ? 'WHO ARE YOU LOOKING FOR?' : site === 'pleasantsurprise' ? 'A name, a city, a familiar face…' : 'Search by name or location'} value={filter.q} onChange={e => update('q', e.target.value)}/></div></label>;
  const city = <label className="denom-select"><span className="denom-field-label">City</span><select value={filter.city} onChange={e => update('city', e.target.value)}>{cityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  const gender = <label className="denom-select"><span className="denom-field-label">Male / female</span><select value={filter.gender} onChange={e => update('gender', e.target.value)}>{genders.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  return <div className={`denom-filters ${active ? 'has-filters' : ''}`}>
    {search}
    {site === 'pleasantsurprise' ? <><FilterMenu label="City" value={filter.city} options={cityOptions} onChange={v => update('city', v)}/><FilterMenu label="Male / female" value={filter.gender} options={genders} onChange={v => update('gender', v)}/></> : site === 'gochurch' ? <details className="go-filter-drawer" open><summary>Refine your search <span aria-hidden="true">+</span></summary><div>{city}<div className="denom-gender"><span className="denom-field-label">Male / female</span><div role="group" aria-label="Male / female">{genders.map(o => <button type="button" key={o.value} aria-pressed={filter.gender === o.value} onClick={() => update('gender', o.value)}>{o.label}</button>)}</div></div></div></details> : <>{city}{gender}</>}
    {active && <button className="denom-clear" type="button" onClick={reset}>Clear filters ×</button>}
  </div>;
}
function DenominationDirectory({ site, roster }) {
  const { data, error, list, retry } = roster;
  const [filter, setFilter] = useState({ q: '', city: '', gender: '' }), [limit, setLimit] = useState(48), [selectedId, setSelectedId] = useState(null);
  const sections = useMemo(() => ministerSections(list, filter), [list, filter]);
  const cities = useMemo(() => [...new Set(list.map(p => p.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [list]);
  const ordered = [...sections.bishops, ...sections.pastors];
  const config = denominationSite(site);
  const update = (key, value) => { setFilter(f => ({ ...f, [key]: value })); setLimit(48); };
  const reset = () => { setFilter({ q: '', city: '', gender: '' }); setLimit(48); };
  return <main className="denom-directory">
    <div className="denom-directory-heading"><div><a className="denom-back" href={`${base}/${site}/`}>← {config.shortName}</a><p className="denom-kicker">LICENSED BISHOPS & PASTORS</p><h1>{config.directoryHeading}</h1></div>{data && <span className="denom-total"><strong>{ordered.length}</strong> ministers{(filter.q || filter.city || filter.gender) ? ' found' : ''}</span>}</div>
    <DirectoryFilters site={site} filter={filter} cities={cities} update={update} reset={reset}/>
    {error && <div className="denom-load-error" role="alert"><p>{data ? 'The latest update could not be loaded. ' : ''}{error}</p><button className="denom-nav-button" type="button" onClick={retry}>Try again</button></div>}
    {!data && !error && <div className="denom-loading" role="status">Loading ministers…</div>}
    {data && <>
      {sections.bishops.length > 0 && <section className={`denom-minister-section ${sections.bishops.length === 1 ? 'denom-single-bishop' : ''}`} aria-label="Bishops"><h2>Bishops <span>{sections.bishops.length}</span></h2><MinisterGrid list={sections.bishops} onOpen={setSelectedId}/></section>}
      {sections.pastors.length > 0 && <section className="denom-minister-section" aria-label="Pastors"><h2>Pastors <span>{sections.pastors.length}</span></h2><MinisterGrid list={sections.pastors.slice(0, limit)} onOpen={setSelectedId}/>{sections.pastors.length > limit && <button type="button" className="denom-nav-button denom-more" onClick={() => setLimit(n => n + 48)}>Show more pastors <Arrow/></button>}</section>}
      {!ordered.length && <div className="denom-loading"><h2>No ministers match</h2><p>Try another name or clear the filters.</p><button type="button" className="denom-nav-button" onClick={reset}>Clear filters</button></div>}
    </>}
    <LicensedMinisterNotice/>
    <ProfileViewer list={ordered} selectedId={selectedId} onSelect={setSelectedId}/>
  </main>;
}
export default function DenominationApp({ site, browse = false }) {
  const config = denominationSite(site), roster = useChurchRoster(site);
  const [paused, setPaused] = useState(false);
  useEffect(() => { setPaused(matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  if (!config) return null;
  return <div className={`denom-site denom-${site} ${browse ? 'denom-is-directory' : 'denom-is-home'} ${paused ? 'denom-motion-paused' : ''}`} style={{ '--denom-accent': config.accent }}>
    <DenominationTexture site={site} paused={paused}/>
    <div className="denom-watermark" aria-hidden="true"><img className="denom-watermark-main" src={`${base}/${config.logo}`} alt=""/><img className="denom-watermark-secondary" src={`${base}/${config.logo}`} alt=""/></div>
    <header className="denom-header"><a href={`${base}/${site}/`} className="denom-brand" aria-label={`${config.name} home`}><img src={`${base}/${config.logo}`} alt=""/><span>{config.shortName}{config.subtitle && <small>{config.subtitle}</small>}</span></a><span className="denom-header-label">{site === 'gochurch' ? 'PEOPLE / MINISTRY' : site === 'pleasantsurprise' ? 'Our church. Our people.' : 'THE MINISTERIAL DIRECTORY'}</span></header>
    {browse ? <DenominationDirectory site={site} roster={roster}/> : <DenominationHome site={site} roster={roster}/>}
    <footer className="denom-footer"><span>{config.name}</span><div><a href={`${base}/privacy/`}>Privacy</a><a href={`${base}/terms/`}>Terms</a><button type="button" onClick={() => setPaused(p => !p)} aria-pressed={paused} aria-label={paused ? 'Play background animation' : 'Pause background animation'}>{paused ? '▷' : 'Ⅱ'}<span>{paused ? 'Play motion' : 'Pause motion'}</span></button></div></footer>
  </div>;
}
