'use client';
import { useMemo, useState } from 'react';
import { ORGANISATIONS as data, ORGANISATIONS_PATH, organisationBySlug, sectionsOf, peopleOf, plainName as plain, personKey, serviceIndex } from './ministry-organisations.mjs';
import PortraitImage from './PortraitImage';
import { portraitStyle } from '../runtime/portrait-framing';
import './denomination-sites.css';
import './denomination-large-text.css';
import './organisations.css';

// The organisations of the ministry, taken from the THREE.ORG documentary:
// three groups (church, outreach, para-church), each organisation with the
// people in charge first and its members after. The data is static and
// lives in ministry-organisations.json; photographs come from the roster.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const home = `${base}/${ORGANISATIONS_PATH}/`;
const pageOf = slug => `${home}${slug}/`;
const Arrow = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const SearchIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>;
const thumb = path => path.replace(/^(assets\/portraits)\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp');
const SERVICE = serviceIndex();

function Portrait({ person, large = false }) {
  if (!person.image) return <span className="denom-portrait-placeholder" aria-label="Photograph not available"><svg width="80" height="96" viewBox="0 0 80 96" fill="currentColor" aria-hidden="true"><circle cx="40" cy="27" r="18"/><path d="M7 91V76c0-20 14-30 33-30s33 10 33 30v15Z"/></svg></span>;
  const style = Object.fromEntries(portraitStyle(person.image).split(';').filter(Boolean).map(pair => pair.split(':')));
  return <PortraitImage media={person.image} src={`${base}/${large ? person.image : thumb(person.image)}`} fallbackSrc={`${base}/${person.image}`} alt={person.name} className="denom-portrait" style={style}/>;
}

function Header() {
  return <header className="org-header">
    <a href={home} className="org-brand"><span className="org-brand-mark" aria-hidden="true">✦</span><span>{data.shortName}<small>Dag Heward-Mills</small></span></a>
    <a className="org-header-link" href={`${base}/directory/`}>Ministers<span className="org-wide-only">' directory</span></a>
  </header>;
}

function Footer() {
  return <footer className="denom-footer"><span>{data.name} · Updated {data.updated}</span><div><a href={`${base}/privacy/`}>Privacy</a><a href={`${base}/terms/`}>Terms</a></div></footer>;
}

function OrganisationCard({ organisation }) {
  const people = peopleOf(organisation);
  const leaders = people.filter(p => p.leader);
  const count = people.length - leaders.length;
  return <a className="org-card" href={pageOf(organisation.slug)}>
    <h3>{organisation.name}</h3>
    {organisation.summary && <p className="org-card-summary">{organisation.summary}</p>}
    {leaders.length > 0 && <div className="org-card-leaders">{leaders.map(leader => <div className="org-card-leader" key={leader.name}>
      <span className="org-card-face"><Portrait person={leader}/></span>
      <span><small>In charge</small><strong>{leader.name}</strong></span>
    </div>)}</div>}
    <span className="org-card-foot"><span>{count > 0 ? `${count} ${count === 1 ? 'member' : 'members'}` : 'Open'}</span><Arrow/></span>
  </a>;
}

function PersonFinder() {
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const words = plain(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    return [...SERVICE.values()].filter(service => words.every(w => service.some(s => plain(s.person.name).includes(w)))).slice(0, 12);
  }, [q]);
  return <section className="org-finder" aria-label="Find a person">
    <label><span className="org-finder-label">Find a person</span><div><SearchIcon/><input type="search" placeholder="Type a name" value={q} onChange={e => setQ(e.target.value)}/></div></label>
    {q.trim() && <div className="org-finder-results" role="status">{matches.length ? matches.map(service => <div className="org-finder-row" key={personKey(service[0].person)}>
      <span className="org-finder-face"><Portrait person={service.find(s => s.person.image)?.person || service[0].person}/></span>
      <div><strong>{service[0].person.name}</strong><span>{service.map(s => <a key={s.organisation.slug} href={pageOf(s.organisation.slug)}>{s.organisation.name}{s.person.role ? ` · ${s.person.role}` : ''}</a>)}</span></div>
    </div>) : <p>No one by that name is listed.</p>}</div>}
  </section>;
}

function OrganisationsHome() {
  return <main className="org-main">
    <section className="org-hero">
      <p className="denom-kicker">Dag Heward-Mills · Updated {data.updated}</p>
      <h1>The Organisations</h1>
      <p className="org-hero-text">The councils, boards and committees that carry the ministry forward, and the people in charge of them.</p>
      <nav className="org-jump" aria-label="Groups">{data.groups.map(group => <a key={group.slug} href={`#${group.slug}`}>{group.name.replace(/^The /, '')}<span>{group.organisations.length}</span></a>)}</nav>
    </section>
    <PersonFinder/>
    {data.groups.map(group => <section className="org-group" id={group.slug} key={group.slug} aria-labelledby={`${group.slug}-heading`}>
      <div className="org-group-heading"><h2 id={`${group.slug}-heading`}>{group.name}</h2>{group.summary && <p>{group.summary}</p>}</div>
      <div className="org-card-grid">{group.organisations.map(organisation => <OrganisationCard key={organisation.slug} organisation={{ ...organisation, group }}/>)}</div>
    </section>)}
    <section className="org-mission" aria-labelledby="mission-heading">
      <h2 id="mission-heading">{data.mission.heading}</h2>
      <p className="org-mission-by">In the words of {data.founder.title} {data.founder.name}</p>
      <div className="org-quotes">{data.mission.quotes.map(quote => <blockquote key={quote}>“{quote}”</blockquote>)}</div>
    </section>
  </main>;
}

function PersonCard({ person, organisation, featured = false }) {
  const elsewhere = (SERVICE.get(personKey(person)) || []).filter(s => s.organisation.slug !== organisation.slug);
  return <article className={`denom-person org-person ${featured ? 'org-person-featured' : ''}`}>
    <div className="denom-person-photo"><Portrait person={person} large={featured}/></div>
    <div className="denom-person-copy">
      {person.role && <small>{person.role}</small>}
      <h3>{person.name}</h3>
      {person.detail && <div className="org-detail">{person.detail}</div>}
      {elsewhere.length > 0 && <div className="org-also">Also serves on {elsewhere.map((s, i) => <span key={s.organisation.slug}>{i > 0 && (i === elsewhere.length - 1 ? ' and ' : ', ')}<a href={pageOf(s.organisation.slug)}>{s.organisation.name.replace(/^The /, '')}</a></span>)}</div>}
    </div>
  </article>;
}

function PeopleSection({ section, organisation }) {
  const leaders = section.people.filter(p => p.leader), members = section.people.filter(p => !p.leader);
  return <>
    {section.name && <h2 className="org-section-title">{section.name}</h2>}
    {leaders.length > 0 && <section className="org-people" aria-label={`In charge${section.name ? ` of ${section.name}` : ''}`}>
      <h3 className="org-people-heading">In charge</h3>
      <div className="org-leaders">{leaders.map(p => <PersonCard key={p.name} person={p} organisation={organisation} featured/>)}</div>
    </section>}
    {members.length > 0 && <section className="org-people" aria-label={`Members${section.name ? ` of ${section.name}` : ''}`}>
      <h3 className="org-people-heading">Members <span>{members.length}</span></h3>
      <div className="denom-grid">{members.map(p => <PersonCard key={p.name} person={p} organisation={organisation}/>)}</div>
    </section>}
  </>;
}

function OrganisationPage({ slug }) {
  const organisation = organisationBySlug(slug);
  const siblings = organisation.group.organisations;
  const index = siblings.findIndex(o => o.slug === slug);
  const previous = siblings[index - 1], next = siblings[index + 1];
  return <main className="org-main">
    <nav className="org-crumbs" aria-label="Breadcrumb"><a href={home}>The Organisations</a><span aria-hidden="true">›</span><a href={`${home}#${organisation.group.slug}`}>{organisation.group.name.replace(/^The /, '')}</a><span aria-hidden="true">›</span><span aria-current="page">{organisation.name.replace(/^The /, '')}</span></nav>
    <label className="org-switch"><span>Go to another organisation</span><select value={slug} onChange={e => { window.location.href = pageOf(e.target.value); }}>
      {data.groups.map(group => <optgroup key={group.slug} label={group.name}>{group.organisations.map(o => <option key={o.slug} value={o.slug}>{o.name}</option>)}</optgroup>)}
    </select></label>
    <div className="org-title">
      <p className="denom-kicker">{organisation.group.name}</p>
      <h1>{organisation.name}</h1>
      {organisation.summary && <p className="org-title-summary">{organisation.summary}</p>}
      {organisation.places && <ul className="org-places">{organisation.places.map(place => <li key={place}>{place}</li>)}</ul>}
      {organisation.link && <a className="org-link" href={`${base}${organisation.link.href}`}>{organisation.link.label}<Arrow/></a>}
    </div>
    {sectionsOf(organisation).map(section => <PeopleSection key={section.name || 'people'} section={section} organisation={organisation}/>)}
    <nav className="org-pager" aria-label="More organisations">
      {previous ? <a href={pageOf(previous.slug)}><small>← Previous</small>{previous.name}</a> : <span/>}
      <a className="org-pager-home" href={`${home}#${organisation.group.slug}`}>All organisations</a>
      {next ? <a className="org-pager-next" href={pageOf(next.slug)}><small>Next →</small>{next.name}</a> : <span/>}
    </nav>
  </main>;
}

export default function OrganisationsApp({ slug = '' }) {
  return <div className={`denom-site denom-large-text org-site ${slug ? 'org-is-page' : 'org-is-home'}`}>
    <Header/>
    {slug ? <OrganisationPage slug={slug}/> : <OrganisationsHome/>}
    <Footer/>
  </div>;
}
