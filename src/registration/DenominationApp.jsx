'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from './client';
import { denominationSite, denominationPeople, ministerSections } from './denomination-sites.mjs';
import { placeOf, titleFor } from './model.mjs';
import PortraitImage from './PortraitImage';
import { portraitStyle } from '../runtime/portrait-framing';
import people from './reference-people.json';
import './denomination-sites.css';

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const Arrow = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const thumb = path => path.replace(/^(assets\/(?:portraits|bishops|pastors))\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp');
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
function MinisterDialog({ person, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog className="denom-dialog" ref={ref} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="denom-person-name">
    <button type="button" className="denom-close" onClick={onClose} aria-label="Close profile">×</button>
    <div className="denom-profile-photo"><MinisterPortrait person={person} full /></div>
    <p className="denom-kicker">{titleFor(person)}</p><h2 id="denom-person-name">{person.name}</h2><span className="denom-approved"><span aria-hidden="true">✓</span> Approved</span>
    {placeOf(person) && <p>{placeOf(person)}</p>}
    {person.branch && <p className="denom-profile-detail">Branch · {person.branch}</p>}
    {person.role === 'pastor' && person.bishop && <p className="denom-profile-detail">Bishop · {person.bishop}</p>}
  </dialog>;
}
function MinisterGrid({ list, onOpen }) {
  return <div className="denom-grid">{list.map(person => <button type="button" className="denom-person" key={person.id} onClick={() => onOpen(person.id)} aria-label={person.name}>
    <div className="denom-person-photo"><MinisterPortrait person={person}/></div>
    <div className="denom-person-copy"><small>{titleFor(person)}</small><h3>{person.name}</h3>{placeOf(person) && <p>{placeOf(person)}</p>}<span className="denom-approved"><span aria-hidden="true">✓</span> Approved</span></div>
  </button>)}</div>;
}
function DenominationDirectory({ site }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [filter, setFilter] = useState({q:'',city:'',gender:''}), [limit, setLimit] = useState(48), [selectedId,setSelectedId] = useState(null);
  const inFlight = useRef(false), mounted = useRef(false);
  async function load() {
    if (inFlight.current) return;
    inFlight.current = true;
    try { const snapshot = await api.publicDirectory(); if (mounted.current) { setData(snapshot); setError(''); } }
    catch(e) { if (mounted.current) setError(e.message); }
    finally { inFlight.current = false; }
  }
  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener('focus',load);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener('focus',load); };
  }, []);
  const list = useMemo(() => data ? denominationPeople(data,site,people) : [],[data,site]);
  const sections = useMemo(() => ministerSections(list,filter),[list,filter]);
  const cities = useMemo(() => [...new Set(list.map(p=>p.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),[list]);
  const selected = list.find(p=>p.id===selectedId) || null;
  const update = (key,value) => { setFilter(f=>({...f,[key]:value}));setLimit(48); };
  return <main className="denom-directory">
    <div className="denom-directory-heading"><div><p className="denom-kicker">THE PASTORAL DIRECTORY</p><h1>Licensed ministers</h1><p>{denominationSite(site).name}</p></div>{data && <span className="denom-total">{(sections.bishops.length+sections.pastors.length).toLocaleString()} ministers</span>}</div>
    <div className="denom-filters"><label><span>Search ministers</span><input type="search" placeholder="Search by name or location" value={filter.q} onChange={e=>update('q',e.target.value)}/></label><label><span>City</span><select value={filter.city} onChange={e=>update('city',e.target.value)}><option value="">All cities</option>{cities.map(city=><option key={city}>{city}</option>)}</select></label><label><span>Male / female</span><select value={filter.gender} onChange={e=>update('gender',e.target.value)}><option value="">Everyone</option><option value="male">Male</option><option value="female">Female</option></select></label></div>
    {error && <div className="denom-load-error" role="alert"><p>{data ? 'The latest update could not be loaded. ' : ''}{error}</p><button className="reg-secondary" type="button" onClick={load}>Try again</button></div>}
    {!data && !error && <div className="denom-loading" role="status">Loading ministers…</div>}
    {data && <>
      {sections.bishops.length>0 && <section className="denom-minister-section" aria-label="Bishops"><h2>Bishops <span>{sections.bishops.length}</span></h2><MinisterGrid list={sections.bishops} onOpen={setSelectedId}/></section>}
      {sections.pastors.length>0 && <section className="denom-minister-section" aria-label="Pastors"><h2>Pastors <span>{sections.pastors.length}</span></h2><MinisterGrid list={sections.pastors.slice(0,limit)} onOpen={setSelectedId}/>{sections.pastors.length>limit && <button type="button" className="reg-secondary denom-more" onClick={()=>setLimit(n=>n+48)}>Show more pastors <Arrow/></button>}</section>}
      {!sections.bishops.length&&!sections.pastors.length && <div className="denom-loading"><h2>No ministers match</h2><p>Try another name or clear the filters.</p><button type="button" className="reg-secondary" onClick={()=>setFilter({q:'',city:'',gender:''})}>Clear filters</button></div>}
    </>}
    {selected && selected.standing!==false && <MinisterDialog person={selected} onClose={()=>setSelectedId(null)}/>}
  </main>;
}
export default function DenominationApp({ site, browse = false }) {
  const config = denominationSite(site);
  const [paused,setPaused] = useState(false);
  useEffect(()=>{setPaused(matchMedia('(prefers-reduced-motion: reduce)').matches);},[]);
  if (!config) return null;
  return <div className={`denom-site denom-${site} ${paused?'denom-motion-paused':''}`} style={{'--denom-accent':config.accent}}>
    <div className="denom-watermark" aria-hidden="true"><img className="denom-watermark-main" src={`${base}/${config.logo}`} alt=""/><img className="denom-watermark-secondary" src={`${base}/${config.logo}`} alt=""/></div>
    <header className="denom-header"><a href={`${base}/${site}/`} className="denom-brand" aria-label={`${config.name} home`}><img src={`${base}/${config.logo}`} alt=""/><span>{config.shortName}{config.subtitle && <small>{config.subtitle}</small>}</span></a></header>
    {browse ? <DenominationDirectory site={site}/> : <main className="denom-home"><div className="denom-home-content"><img className="denom-hero-logo" src={`${base}/${config.logo}`} alt={`${config.name} logo`} fetchPriority="high"/><p className="denom-kicker">THE PASTORAL DIRECTORY</p><h1>{config.shortName}</h1>{config.subtitle && <p className="denom-subtitle">{config.subtitle}</p>}<p className="denom-home-description">Pastors and bishops licensed to minister<br/> within {config.name}.</p><a className="reg-primary denom-enter" href={`${base}/${site}/directory/`}>View all licensed ministers <Arrow/></a></div></main>}
    <footer className="denom-footer"><span>{config.name}</span><div><a href={`${base}/privacy/`}>Privacy</a><a href={`${base}/terms/`}>Terms</a><button type="button" onClick={()=>setPaused(p=>!p)} aria-pressed={paused} aria-label={paused?'Play background animation':'Pause background animation'}>{paused?'▷':'Ⅱ'}<span>{paused?'Play motion':'Pause motion'}</span></button></div></footer>
  </div>;
}
