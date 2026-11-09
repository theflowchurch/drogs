'use client';
import { ORGANISATIONS as data, DIRECTORY_GROUPS, DIRECTORY_TOTAL, PAGE_ALIASES } from './ministry-organisations.mjs';
import PortraitImage from './PortraitImage';
import useGroupFocus from './useGroupFocus';
import { portraitStyle } from '../runtime/portrait-framing';
import './denomination-sites.css';
import './organisations.css';

// The organisations, from the THREE.ORG documentary: a contents page of
// coloured boxes, one per group, and each group's bishops on their own once
// chosen. Ivory and navy, with large type for older readers.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

function Photo({ person, large = false }) {
  if (!person?.image) return <span className="org-photo-empty" aria-hidden="true"><svg viewBox="0 0 80 96" fill="currentColor"><circle cx="40" cy="27" r="18"/><path d="M7 91V76c0-20 14-30 33-30s33 10 33 30v15Z"/></svg></span>;
  // The office's edited portraits are framed alike with headroom above the
  // head, so they sit against the top of every card and never lose the head.
  const edited = person.image.startsWith('assets/organisations/people/');
  const style = edited ? { '--portrait-x': '50%', '--portrait-y': '0%' } : Object.fromEntries(portraitStyle(person.image).split(';').filter(Boolean).map(pair => pair.split(':')));
  const thumb = person.image.replace(/^(assets\/portraits)\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp');
  return <PortraitImage media={person.image} src={`${base}/${large ? person.image : thumb}`} fallbackSrc={`${base}/${person.image}`} alt={person.name} className="denom-portrait" style={style}/>;
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

// One group's heading, in the shape of the section banners, in its own colour.
function GroupBox({ group, as: Tag = 'a' }) {
  const link = Tag === 'a';
  const props = link ? { href: `#${group.slug}` } : { id: `${group.slug}-heading` };
  return <Tag className="org-group-box" style={{ '--box': group.colour }} {...props}>
    <span className="org-box-name">{group.name}</span>
    {link && <span className="org-box-count">{group.count} {group.count === 1 ? 'Bishop' : 'Bishops'}</span>}
  </Tag>;
}

// The title (office, 9 Nov): the DHMM logo in white on navy, "Worldwide
// Bishops" in gold, and every bishop on the page counted once.
function Masthead() {
  return <header className="org-dhmm-head">
    <a href="#contents" className="org-dhmm-logo"><img src={`${base}/assets/organisations/dhmm-logo-white.webp`} alt="DHMM – Dag Heward-Mills Ministries" width="1200" height="396"/></a>
    <div className="org-dhmm-text">
      <p className="org-dhmm-sub">Worldwide Bishops</p>
      <p className="org-dhmm-total"><strong>{DIRECTORY_TOTAL}</strong> Bishops</p>
    </div>
  </header>;
}

function Contents() {
  return <nav id="contents" className="org-contents" aria-label="Contents">
    {DIRECTORY_GROUPS.map(g => <GroupBox key={g.slug} group={g}/>)}
  </nav>;
}

const Count = ({ n }) => <span className="org-count">{n} {n === 1 ? 'bishop' : 'bishops'}</span>;

function Group({ group }) {
  return <section className="org-council" id={group.slug} aria-labelledby={`${group.slug}-heading`}>
    <GroupBox group={group} as="h2"/>
    {group.parts ? group.parts.map(part => <div className="org-group-part" key={part.slug} id={part.slug}>
      <h3 className="org-part-heading">{part.name} <Count n={part.people.length}/></h3>
      <div className="org-members">{part.people.map(p => <Bishop key={p.rosterId || p.name} person={p}/>)}</div>
    </div>) : <>
      <p className="org-group-total"><Count n={group.people.length}/></p>
      <div className="org-members">{group.people.map(p => <Bishop key={p.rosterId || p.name} person={p}/>)}</div>
    </>}
  </section>;
}

export default function OrganisationsApp({ slug = '' }) {
  // An older address for a section opens the contents; one for a group opens it.
  const group = useGroupFocus(PAGE_ALIASES[slug] ? '' : slug);
  return <div className="denom-site org-site" id="top">
    <Masthead/>
    <main className="org-main">
      {group ? <>
        <Group group={group}/>
        <div className="org-end-links"><a className="org-top" href="#contents">↑ Back to contents</a></div>
      </> : <Contents/>}
    </main>
    <footer className="org-footer"><span>Updated {data.updated}</span></footer>
  </div>;
}
