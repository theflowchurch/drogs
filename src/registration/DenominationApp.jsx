'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { denominationSite, denominationPeople, ministerSections, ministerDisplayTitle } from './denomination-sites.mjs';
import { placeOf } from './model.mjs';
import PortraitImage from './PortraitImage';
import DenominationTexture from './DenominationTexture';
import LicensedMinisterNotice from './LicensedMinisterNotice';
import DenominationHome from './DenominationHome';
import { landingStyle } from './denomination-landing-styles.mjs';
import { portraitStyle } from '../runtime/portrait-framing';
import './denomination-sites.css';
import './landing-concepts.css';
import './denomination-catalog.css';
import './denomination-large-text.css';

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
    try {
      // Landing pages need only their branding. Load the roster client when
      // the directory opens; the connected server remains authoritative.
      const api = await import('./client');
      const snapshot = await api.publicDirectory();
      if (!Array.isArray(snapshot.referencePeople)) {
        if (process.env.NEXT_PUBLIC_REGISTRATION_BACKEND === 'mysql') throw Error('The current directory could not be loaded. Please try again shortly.');
        snapshot.referencePeople = (await import('./reference-people.json')).default;
      }
      if (mounted.current) { setData(snapshot); setError(''); }
    }
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
  const list = useMemo(() => data ? denominationPeople(data, site) : [], [data, site]);
  return { data, error, list, retry: load };
}

function MinisterPortrait({ person, full = false }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true;
    setUrl('');
    if (!person.photo || person.standing === false) return;
    const load = () => import('./client').then(api => api.mediaUrl(person.photo)).then(value => { if (live) setUrl(value); }).catch(() => {});
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
function MinisterDialog({ person, onClose, onPrevious, onNext, position, total, counted = true }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog className="denom-dialog" ref={ref} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={e => {
    if (e.key === 'ArrowLeft' && onPrevious) { e.preventDefault(); onPrevious(); }
    if (e.key === 'ArrowRight' && onNext) { e.preventDefault(); onNext(); }
  }} aria-labelledby="denom-person-name">
    <div className="denom-profile-toolbar"><span>MINISTER PROFILE{counted && ` · ${position} / ${total}`}</span><button type="button" className="denom-close" onClick={onClose} aria-label="Close profile">×</button></div>
    <div className="denom-profile-layout"><div className="denom-profile-photo"><MinisterPortrait person={person} full /></div>
      <div className="denom-profile-copy"><p className="denom-kicker">{ministerDisplayTitle(person)}</p><h2 id="denom-person-name">{person.name}</h2>
        {placeOf(person) && <p>{placeOf(person)}</p>}
        {person.role === 'pastor' && person.bishop && <p className="denom-profile-detail">Bishop · {person.bishop}</p>}
      </div>
    </div>
    <nav className="denom-profile-navigation" aria-label="Minister profiles"><button type="button" className="denom-nav-button" onClick={onPrevious} disabled={!onPrevious} aria-label="Previous minister">← Previous</button><span>{counted && `${position} of ${total}`}</span><button type="button" className="denom-nav-button" onClick={onNext} disabled={!onNext} aria-label="Next minister">Next →</button></nav>
  </dialog>;
}
function ProfileViewer({ list, selectedId, onSelect, counted }) {
  const index = list.findIndex(p => p.id === selectedId), selected = list[index];
  return selected && selected.standing !== false ? <MinisterDialog person={selected} onClose={() => onSelect(null)} position={index + 1} total={list.length} counted={counted} onPrevious={index > 0 ? () => onSelect(list[index - 1].id) : null} onNext={index < list.length - 1 ? () => onSelect(list[index + 1].id) : null}/> : null;
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
function DenominationDirectory({ site }) {
  const { data, error, list, retry } = useChurchRoster(site);
  const [filter, setFilter] = useState({ q: '', city: '', gender: '' }), [limit, setLimit] = useState(48), [selectedId, setSelectedId] = useState(null);
  const sections = useMemo(() => ministerSections(list, filter), [list, filter]);
  const cities = useMemo(() => [...new Set(list.map(p => p.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [list]);
  const ordered = [...sections.bishops, ...sections.pastors];
  const config = denominationSite(site);
  // A simple directory (asked for by the church) lists everyone with no search, filters or counts.
  const simple = Boolean(config.simpleDirectory);
  const count = n => simple ? null : <span>{n}</span>;
  const update = (key, value) => { setFilter(f => ({ ...f, [key]: value })); setLimit(48); };
  const reset = () => { setFilter({ q: '', city: '', gender: '' }); setLimit(48); };
  return <main className="denom-directory">
    <div className="denom-directory-heading"><div>{config.namedHeading
      ? <div className="denom-named-title">{config.logoHeading && config.logo && <a href={`${base}/${site}/`} className="denom-named-logo" aria-label={`${config.name} home`}><img src={`${base}/${config.logo}`} alt=""/></a>}<h1 className="denom-named-heading"><span>{config.name}</span><span>{config.directoryHeading}</span></h1></div>
      : <><a className="denom-back" href={`${base}/${site}/`}>← {config.shortName}</a><p className="denom-kicker">LICENSED BISHOPS & PASTORS</p><h1>{config.directoryHeading}</h1></>}</div>{data && !simple && <span className="denom-total"><strong>{ordered.length}</strong> ministers{(filter.q || filter.city || filter.gender) ? ' found' : ''}</span>}</div>
    {!simple && <DirectoryFilters site={config.visualStyle || site} filter={filter} cities={cities} update={update} reset={reset}/>}
    {error && <div className="denom-load-error" role="alert"><p>{data ? 'The latest update could not be loaded. ' : ''}{error}</p><button className="denom-nav-button" type="button" onClick={retry}>Try again</button></div>}
    {!data && !error && <div className="denom-loading" role="status">Loading ministers…</div>}
    {data && <>
      {sections.bishops.length > 0 && <section className={`denom-minister-section ${sections.bishops.length === 1 ? 'denom-single-bishop' : ''}`} aria-label="Bishops"><h2>Bishops {count(sections.bishops.length)}</h2><MinisterGrid list={sections.bishops} onOpen={setSelectedId}/></section>}
      {sections.pastors.length > 0 && <section className="denom-minister-section" aria-label="Pastors"><h2>Pastors {count(sections.pastors.length)}</h2><MinisterGrid list={sections.pastors.slice(0, limit)} onOpen={setSelectedId}/>{sections.pastors.length > limit && <button type="button" className="denom-nav-button denom-more" onClick={() => setLimit(n => n + 48)}>Show more pastors <Arrow/></button>}</section>}
      {!ordered.length && <div className="denom-loading"><h2>{filter.q || filter.city || filter.gender ? 'No ministers match' : 'No ministers listed'}</h2><p>{filter.q || filter.city || filter.gender ? 'Try another name or clear the filters.' : 'There are currently no ministers listed for this denomination.'}</p>{(filter.q || filter.city || filter.gender) && <button type="button" className="denom-nav-button" onClick={reset}>Clear filters</button>}</div>}
    </>}
    <LicensedMinisterNotice open={config.openLicenseNotice}/>
    <ProfileViewer list={ordered} selectedId={selectedId} onSelect={setSelectedId} counted={!simple}/>
  </main>;
}
export default function DenominationApp({ site, browse = false }) {
  const config = denominationSite(site);
  const landing = landingStyle(config?.homeLayout);
  const [paused, setPaused] = useState(false), [concept, setConcept] = useState(config?.homeConcept || 1);
  useEffect(() => { setPaused(matchMedia('(prefers-reduced-motion: reduce)').matches); const choice = Number(new URLSearchParams(window.location.search).get('concept')); if ([1, 2, 3].includes(choice)) setConcept(choice); }, []);
  if (!config) return null;
  return <div data-landing-style={!browse ? landing?.id : undefined} data-landing-tone={!browse && landing?.dark ? 'dark' : undefined} className={`denom-site denom-${config.visualStyle || site} ${config.homeLayout ? 'denom-catalog-site' : ''} ${browse ? 'denom-is-directory' : `denom-is-home denom-concept-${concept}`} ${paused ? 'denom-motion-paused' : ''} ${config.largeText ? 'denom-large-text' : ''}`} style={{ '--brand': config.accent, '--denom-accent': !browse && (landing?.dark || (site === 'gochurch' && concept !== 2) || (site === 'lighthousechapelinternational' && concept === 3)) ? '#d5b56c' : config.accent }}>
    {browse && <><DenominationTexture site={config.visualStyle || site} paused={paused}/>
    {config.logo && <div className="denom-watermark" aria-hidden="true"><img className="denom-watermark-main" src={`${base}/${config.logo}`} alt=""/><img className="denom-watermark-secondary" src={`${base}/${config.logo}`} alt=""/></div>}</>}
    {/* logoHeading: the logo moves into the page heading, leaving the header with only Sign in. */}
    <header className={`denom-header ${config.logoHeading ? 'denom-header-minimal' : ''}`}>{!config.logoHeading && <a href={`${base}/${site}/`} className="denom-brand" aria-label={`${config.name} home`}>{config.logo && <img src={`${base}/${config.logo}`} alt=""/>}<span>{config.shortName}{config.subtitle && <small>{config.subtitle}</small>}</span></a>}<div className="denom-header-actions">{!config.logoHeading && <span className="denom-header-label">MINISTERIAL DIRECTORY</span>}<a className="denom-signin" href={`${base}/${site}/signup/#signin`}>Sign in</a></div></header>
    {browse ? <DenominationDirectory site={site}/> : <DenominationHome site={site} concept={concept}/>}
    <footer className="denom-footer"><span>{config.name}</span><div><a href={`${base}/privacy/`}>Privacy</a><a href={`${base}/terms/`}>Terms</a><button type="button" onClick={() => setPaused(p => !p)} aria-pressed={paused} aria-label={paused ? 'Play background animation' : 'Pause background animation'}>{paused ? '▷' : 'Ⅱ'}<span>{paused ? 'Play motion' : 'Pause motion'}</span></button></div></footer>
  </div>;
}
