'use client';
import { useEffect, useState } from 'react';
import { ORGANISATIONS as data, ORGANISATIONS_PATH, ALL_ORGANISATIONS, organisationBySlug, groupBySlug, sectionsOf, peopleOf } from './ministry-organisations.mjs';
import PortraitImage from './PortraitImage';
import { portraitStyle } from '../runtime/portrait-framing';
import './denomination-sites.css';
import './organisations.css';

// The organisations of the ministry, from the THREE.ORG documentary. Made to be
// easy for older readers, in deep navy, ivory and muted gold:
//   main page      -> three large category cards (Church, Outreach, Para-Church)
//   category page  -> large picture tiles of its organisations
//   organisation   -> its own part of the documentary playing faded behind the
//                     title, the people in charge shown large, big Back / Next.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const home = `${base}/${ORGANISATIONS_PATH}/`;
const pageOf = slug => `${home}${slug}/`;
const media = name => `${base}/assets/organisations/${name}`;
const shortName = name => name.replace(/^The /, '');

function Photo({ person, large = false }) {
  if (!person?.image) return <span className="org-photo-empty" aria-hidden="true"><svg viewBox="0 0 80 96" fill="currentColor"><circle cx="40" cy="27" r="18"/><path d="M7 91V76c0-20 14-30 33-30s33 10 33 30v15Z"/></svg></span>;
  const style = Object.fromEntries(portraitStyle(person.image).split(';').filter(Boolean).map(pair => pair.split(':')));
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

function Header() {
  return <header className="org-header"><a href={home} className="org-brand"><span className="org-brand-mark" aria-hidden="true">✦</span><span>{data.shortName}</span></a></header>;
}

function Hero({ backdrop, kicker, title, text, children }) {
  return <section className="org-hero">
    <Backdrop name={backdrop}/>
    <div className="org-hero-inner">
      {kicker && <p className="org-kicker">{kicker}</p>}
      <h1>{title}</h1>
      {text && <p className="org-hero-text">{text}</p>}
      {children}
    </div>
  </section>;
}

function OrganisationsHome() {
  const total = data.groups.reduce((n, g) => n + g.organisations.length, 0);
  return <main>
    <Hero backdrop="home" kicker={`Updated ${data.updated}`} title="The Organisations of Dag Heward-Mills" text="The councils, boards and committees that serve the churches, the outreaches and the institutions.">
      <div className="org-stats"><span><strong>{total}</strong>Organisations</span><span><strong>{data.groups.length}</strong>Categories</span></div>
    </Hero>
    <section className="org-main org-choose" aria-labelledby="choose-heading">
      <h2 id="choose-heading">Choose a category</h2>
      <div className="org-categories">{data.groups.map(group => <a className="org-category" key={group.slug} href={pageOf(group.slug)}>
        <img src={media(`${group.slug}.jpg`)} alt="" loading="lazy"/>
        <span className="org-category-text"><strong>{shortName(group.name)}</strong><span>{group.organisations.length} organisations</span><span className="org-category-go">Open →</span></span>
      </a>)}</div>
    </section>
  </main>;
}

function Tile({ organisation }) {
  const leaders = peopleOf(organisation).filter(p => p.leader);
  return <a className="org-tile" href={pageOf(organisation.slug)}>
    <span className={`org-tile-photos org-tile-photos-${Math.min(leaders.length, 2) || 0}`}>
      {leaders.length ? leaders.slice(0, 2).map(p => <span className="org-tile-photo" key={p.name}><Photo person={p}/></span>) : <span className="org-tile-photo"><img className="denom-portrait" src={media(`${organisation.slug}.jpg`)} alt="" loading="lazy"/></span>}
    </span>
    <span className="org-tile-text">
      <strong>{shortName(organisation.name)}</strong>
      {leaders.length > 0 ? <span>{leaders.map(p => p.name).join(' & ')}</span> : organisation.summary && <span>{organisation.summary.replace(/\.$/, '')}</span>}
    </span>
  </a>;
}

function CategoryPage({ group }) {
  const index = data.groups.findIndex(g => g.slug === group.slug), next = data.groups[(index + 1) % data.groups.length];
  return <main>
    <Hero backdrop={group.slug} kicker="Category" title={group.name} text={`${group.organisations.length} organisations. Tap one to see who is in charge.`}>
      <a className="org-button org-button-light" href={home}>← All categories</a>
    </Hero>
    <section className="org-main org-tiles-wrap"><div className="org-tiles">{group.organisations.map(o => <Tile key={o.slug} organisation={o}/>)}</div>
      <nav className="org-page-buttons" aria-label="More categories"><a className="org-button" href={home}>← All categories</a><a className="org-button org-button-next" href={pageOf(next.slug)}><small>Next category</small>{shortName(next.name)} →</a></nav>
    </section>
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

function OrganisationPage({ organisation }) {
  const siblings = organisation.group.organisations;
  const index = siblings.findIndex(o => o.slug === organisation.slug);
  const next = siblings[index + 1];
  const back = pageOf(organisation.group.slug);
  return <main>
    <Hero backdrop={organisation.slug} kicker={organisation.group.name} title={organisation.name} text={organisation.summary}>
      <a className="org-button org-button-light" href={back}>← {shortName(organisation.group.name)}</a>
    </Hero>
    <div className="org-main org-page">
      {organisation.places && <ul className="org-places">{organisation.places.map(place => <li key={place}>{place}</li>)}</ul>}
      {sectionsOf(organisation).map(section => {
        const leaders = section.people.filter(p => p.leader), members = section.people.filter(p => !p.leader);
        return section.people.length > 0 && <section key={section.name || 'people'} className="org-leaders">
          {section.name && <h2>{section.name}</h2>}
          {leaders.map(p => <Leader key={p.name} person={p}/>)}
          {members.length > 0 && <>
            <h3 className="org-under">Under {leaders.length === 1 ? leaders[0].name : 'them'}</h3>
            <div className="org-members">{members.map(p => <article className="org-member" key={p.name}>
              <div className="org-member-photo"><Photo person={p}/></div>
              <div className="org-member-text"><strong>{p.name}</strong>{p.role && <span>{p.role}</span>}</div>
            </article>)}</div>
          </>}
        </section>;
      })}
      {organisation.link && <a className="org-button org-link" href={`${base}${organisation.link.href}`}>{organisation.link.label} →</a>}
      <nav className="org-page-buttons" aria-label="More organisations">
        <a className="org-button" href={back}>← {shortName(organisation.group.name)}</a>
        {next ? <a className="org-button org-button-next" href={pageOf(next.slug)}><small>Next</small>{shortName(next.name)} →</a>
          : <a className="org-button org-button-next" href={home}><small>Finished</small>All categories →</a>}
      </nav>
    </div>
  </main>;
}

export default function OrganisationsApp({ slug = '' }) {
  const group = slug && groupBySlug(slug), organisation = slug && !group && organisationBySlug(slug);
  return <div className="denom-site org-site">
    <Header/>
    {group ? <CategoryPage group={group}/> : organisation ? <OrganisationPage organisation={organisation}/> : <OrganisationsHome/>}
    <footer className="org-footer"><span>{data.name}</span><span>Updated {data.updated}</span></footer>
  </div>;
}
