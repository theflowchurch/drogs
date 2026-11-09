'use client';
import { useEffect, useState } from 'react';
import { ORGANISATIONS as data, sectionsOf, PAGE_ALIASES } from './ministry-organisations.mjs';
import PortraitImage from './PortraitImage';
import { portraitStyle } from '../runtime/portrait-framing';
import './denomination-sites.css';
import './organisations.css';

// The organisations, from the THREE.ORG documentary, on one page to scroll
// through like the church directories: each category (Church, Outreach,
// Para-Church), then each of its councils with the people in charge shown
// large and the bishops under that council listed beneath. Deep navy, ivory
// and muted gold, with large type for older readers.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
// The host tells browsers to keep these files for a year; bump MEDIA_VERSION
// whenever a picture or clip is replaced so visitors fetch the new one.
const MEDIA_VERSION = 3;
const media = name => `${base}/assets/organisations/${name}?v=${MEDIA_VERSION}`;
const shortName = name => name.replace(/^The /, '');

function Photo({ person, large = false }) {
  if (!person?.image) return <span className="org-photo-empty" aria-hidden="true"><svg viewBox="0 0 80 96" fill="currentColor"><circle cx="40" cy="27" r="18"/><path d="M7 91V76c0-20 14-30 33-30s33 10 33 30v15Z"/></svg></span>;
  // The office's edited portraits are framed alike with headroom above the
  // head, so they sit against the top of every card and never lose the head.
  const edited = person.image.startsWith('assets/organisations/people/');
  const style = edited ? { '--portrait-x': '50%', '--portrait-y': '0%' } : Object.fromEntries(portraitStyle(person.image).split(';').filter(Boolean).map(pair => pair.split(':')));
  const thumb = person.image.replace(/^(assets\/portraits)\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp');
  return <PortraitImage media={person.image} src={`${base}/${large ? person.image : thumb}`} fallbackSrc={`${base}/${person.image}`} alt={person.name} className="denom-portrait" style={style}/>;
}

// A short, silent part of the documentary, faded behind a heading. People who
// ask their device for reduced motion see a still picture instead.
function Backdrop({ name }) {
  const [still, setStill] = useState(true);
  useEffect(() => { setStill(matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  return <div className="org-backdrop" aria-hidden="true">
    {still ? <img src={media(`${name}.jpg`)} alt=""/> : <video src={media(`${name}.mp4`)} poster={media(`${name}.jpg`)} autoPlay muted loop playsInline preload="auto"/>}
  </div>;
}

function Bishop({ person }) {
  return <article className="org-member">
    <div className="org-member-photo"><Photo person={person}/></div>
    <div className="org-member-text">
      <small>{person.title || 'Bishop'}</small>
      <strong>{person.name}</strong>
      {person.role ? <span>{person.role}</span> : person.church && <span className="org-member-church">{person.church}</span>}
      {person.consecrated && <span className="org-consecrated">Consecrated {person.consecrated}</span>}
    </div>
  </article>;
}

function Council({ organisation }) {
  // An untitled group (office, 9 Nov) lists bishops with no council given.
  return <section className={`org-council ${organisation.untitled ? 'org-council-untitled' : ''}`} id={organisation.slug} aria-labelledby={organisation.untitled ? undefined : `${organisation.slug}-heading`} aria-label={organisation.untitled ? 'More bishops' : undefined}>
    {!organisation.untitled && <h3 id={`${organisation.slug}-heading`}>{organisation.name}</h3>}
    {organisation.summary && <p className="org-council-summary">{organisation.summary}</p>}
    {organisation.places && <ul className="org-places">{organisation.places.map(place => <li key={place}>{place}</li>)}</ul>}
    {sectionsOf(organisation).map(section => section.people.length > 0 && <div className="org-council-part" key={section.name || 'people'}>
      <div className="org-members">{section.people.map(p => <Bishop key={p.rosterId || p.name} person={p}/>)}</div>
    </div>)}
    {/* The Kuriake Council also lists the bishops of each directory group (office, 9 Nov). */}
    {(organisation.directoryGroups || []).map(group => group.people.length > 0 && <div className="org-council-part org-directory-group" key={group.slug || group.name} id={group.slug}>
      {group.name ? <h5 className="org-under org-group-name">{group.name}</h5> : <hr className="org-group-rule"/>}
      <div className="org-members">{group.people.map(p => <Bishop key={p.rosterId || p.name} person={p}/>)}</div>
    </div>)}
  </section>;
}

const councils = data.groups.flatMap(group => group.organisations);
const tabs = councils.filter(o => !o.untitled);

// Office, 9 Nov: tabs in place of the Church / Para-Church banners, so a
// reader can jump to any council. The bar stays at the top while scrolling and
// marks the council being read.
function CouncilTabs() {
  const [active, setActive] = useState(tabs[0]?.slug);
  useEffect(() => {
    const seen = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id);
    }, { rootMargin: '-140px 0px -60% 0px' });
    tabs.forEach(o => { const el = document.getElementById(o.slug); if (el) seen.observe(el); });
    return () => seen.disconnect();
  }, []);
  // Every button is visible: they wrap onto rows on wide screens; on a phone a
  // single "Go to a council" button opens the full list.
  const [open, setOpen] = useState(false);
  const current = tabs.find(o => o.slug === active);
  const link = o => <a key={o.slug} data-slug={o.slug} href={`#${o.slug}`} onClick={() => setOpen(false)} className={`org-tab ${active === o.slug ? 'is-active' : ''}`} aria-current={active === o.slug ? 'true' : undefined}>{o.tabName || shortName(o.name)}</a>;
  return <nav className={`org-tabs ${open ? 'is-open' : ''}`} aria-label="Councils">
    <button type="button" className="org-tabs-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>
      <span><small>Go to a council</small>{current ? (current.tabName || shortName(current.name)) : 'Councils'}</span><span aria-hidden="true">{open ? '✕' : '▾'}</span>
    </button>
    <div className="org-tabs-row">{tabs.map(link)}</div>
  </nav>;
}

export default function OrganisationsApp({ slug = '' }) {
  // An older address for one category or council opens this page at that part.
  useEffect(() => { if (slug) document.getElementById(PAGE_ALIASES[slug] || slug)?.scrollIntoView(); }, [slug]);
  // The page opens straight on the Church Organisations (office, 9 Nov).
  return <div className="denom-site org-site" id="top">
    <main>
      {/* The page heading (office, 9 Nov); the corner logo and name are gone. */}
      <header className="org-masthead">
        <h1>{data.heading}</h1>
        <span className="org-masthead-rule" aria-hidden="true"/>
        <p>{data.subheading}</p>
      </header>
      <CouncilTabs/>
      <div className="org-main">
        {councils.map(organisation => <Council key={organisation.slug} organisation={organisation}/>)}
        <a className="org-top" href="#top">↑ Back to the top</a>
      </div>
    </main>
    <footer className="org-footer"><span>{data.name}</span><span>Updated {data.updated}</span></footer>
  </div>;
}
