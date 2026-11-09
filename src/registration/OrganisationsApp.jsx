'use client';
import { ORGANISATIONS as data, ORGANISATIONS_PATH, ALL_ORGANISATIONS, organisationBySlug, sectionsOf, peopleOf } from './ministry-organisations.mjs';
import PortraitImage from './PortraitImage';
import { portraitStyle } from '../runtime/portrait-framing';
import './denomination-sites.css';
import './organisations.css';

// The organisations of the ministry, from the THREE.ORG documentary. Made to be
// easy for older readers: the main page is a set of large picture tiles, one
// per organisation, and each organisation has its own page with the people in
// charge shown large, and big Back / Next buttons. No search, menus or small print.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const home = `${base}/${ORGANISATIONS_PATH}/`;
const pageOf = slug => `${home}${slug}/`;
const shortName = name => name.replace(/^The /, '');

function Photo({ person, large = false }) {
  if (!person?.image) return <span className="org-photo-empty" aria-hidden="true"><svg viewBox="0 0 80 96" fill="currentColor"><circle cx="40" cy="27" r="18"/><path d="M7 91V76c0-20 14-30 33-30s33 10 33 30v15Z"/></svg></span>;
  const style = Object.fromEntries(portraitStyle(person.image).split(';').filter(Boolean).map(pair => pair.split(':')));
  const thumb = person.image.replace(/^(assets\/portraits)\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp');
  return <PortraitImage media={person.image} src={`${base}/${large ? person.image : thumb}`} fallbackSrc={`${base}/${person.image}`} alt={person.name} className="denom-portrait" style={style}/>;
}

function Header() {
  return <header className="org-header"><a href={home} className="org-brand"><span className="org-brand-mark" aria-hidden="true">✦</span><span>{data.shortName}</span></a></header>;
}

function Tile({ organisation }) {
  const leaders = peopleOf(organisation).filter(p => p.leader);
  return <a className="org-tile" href={pageOf(organisation.slug)}>
    <span className={`org-tile-photos org-tile-photos-${Math.min(leaders.length, 2) || 0}`}>
      {leaders.length ? leaders.slice(0, 2).map(p => <span className="org-tile-photo" key={p.name}><Photo person={p}/></span>) : <span className="org-tile-mark" aria-hidden="true">✦</span>}
    </span>
    <span className="org-tile-text">
      <strong>{shortName(organisation.name)}</strong>
      {leaders.length > 0 && <span>{leaders.map(p => p.name).join(' & ')}</span>}
      {!leaders.length && organisation.summary && <span>{organisation.summary.replace(/\.$/, '')}</span>}
    </span>
  </a>;
}

function OrganisationsHome() {
  return <main className="org-main">
    <section className="org-hero">
      <h1>The Organisations</h1>
      <p>Tap an organisation to see who is in charge.</p>
    </section>
    {data.groups.map(group => <section className="org-group" key={group.slug} aria-labelledby={`${group.slug}-heading`}>
      <h2 id={`${group.slug}-heading`}>{group.name}</h2>
      <div className="org-tiles">{group.organisations.map(organisation => <Tile key={organisation.slug} organisation={organisation}/>)}</div>
    </section>)}
  </main>;
}

function Leader({ person }) {
  return <article className="org-leader">
    <div className="org-leader-photo"><Photo person={person} large/></div>
    <div className="org-leader-text">
      <h3>{person.name}</h3>
      {person.role && <p>{person.role}</p>}
      {person.detail && <p className="org-leader-detail">{person.detail}</p>}
    </div>
  </article>;
}

function OrganisationPage({ slug }) {
  const organisation = organisationBySlug(slug);
  const index = ALL_ORGANISATIONS.findIndex(o => o.slug === slug);
  const next = ALL_ORGANISATIONS[(index + 1) % ALL_ORGANISATIONS.length];
  const back = <a className="org-button org-button-back" href={home}>← All organisations</a>;
  return <main className="org-main org-page">
    {back}
    <p className="org-page-group">{organisation.group.name}</p>
    <h1>{organisation.name}</h1>
    {organisation.summary && <p className="org-page-summary">{organisation.summary}</p>}
    {organisation.places && <p className="org-page-summary">{organisation.places.join(' · ')}</p>}
    {sectionsOf(organisation).map(section => section.people.length > 0 && <section key={section.name || 'people'} className="org-leaders">
      {section.name && <h2>{section.name}</h2>}
      {section.people.map(p => <Leader key={p.name} person={p}/>)}
    </section>)}
    {organisation.link && <a className="org-button" href={`${base}${organisation.link.href}`}>{organisation.link.label}</a>}
    <nav className="org-page-buttons" aria-label="More organisations">
      {back}
      <a className="org-button org-button-next" href={pageOf(next.slug)}><small>Next</small>{shortName(next.name)} →</a>
    </nav>
  </main>;
}

export default function OrganisationsApp({ slug = '' }) {
  return <div className="denom-site org-site">
    <Header/>
    {slug ? <OrganisationPage slug={slug}/> : <OrganisationsHome/>}
    <footer className="org-footer"><span>{data.name}</span><span>Updated {data.updated}</span></footer>
  </div>;
}
