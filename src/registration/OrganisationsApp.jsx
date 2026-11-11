'use client';
import { ORGANISATIONS as data, DIRECTORY_GROUPS, DIRECTORY_TOTAL, PAGE_ALIASES, flatPeople } from './ministry-organisations.mjs';
import PortraitImage from './PortraitImage';
import { useEffect } from 'react';
import useGroupFocus from './useGroupFocus';
import GroupThumbs from './GroupThumbs';
import GoodStandingNotice from './GoodStandingNotice';
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
      {person.consecrated ? <span className="org-consecrated">Consecrated {person.consecrated}</span> : person.appointed && <span className="org-consecrated">Appointed {person.appointed}</span>}
    </div>
  </article>;
}

// A group's name, then the initials it is known by (office, 10 Nov).
const Name = ({ group }) => <>{group.name}{group.initials && <span className="org-initials"> – {group.initials}</span>}</>;

// One group's heading, in the shape of the section banners, in its own colour.
function GroupBox({ group, as: Tag = 'a', thumbs }) {
  const link = Tag === 'a';
  const props = link ? { href: `#${group.slug}` } : { id: `${group.slug}-heading` };
  const n = group.count ?? group.people.length;
  return <Tag className={`org-group-box ${thumbs ? 'org-sub-box' : ''}`} style={{ '--box': group.colour }} {...props}>
    <span className="org-box-name"><Name group={group}/></span>
    {thumbs && <GroupThumbs people={group.people} variant={thumbs}/>}
    {link && <span className="org-box-count">{n} {n === 1 ? 'Bishop' : 'Bishops'}</span>}
  </Tag>;
}

// The title (office, 9 Nov): the DHMM logo in white on navy, "Worldwide Fellowship of
// Bishops" in gold, and every bishop on the page counted once.
function Masthead() {
  return <header className="org-dhmm-head">
    <a href="#contents" className="org-dhmm-logo"><img src={`${base}/assets/organisations/dhmm-logo-white.webp`} alt="DHMM – Dag Heward-Mills Ministries" width="1200" height="396"/></a>
    <div className="org-dhmm-text">
      <p className="org-dhmm-sub">Worldwide Fellowship of Bishops</p>
      <p className="org-dhmm-total">Roll of Good Standing <span className="org-dhmm-dot" aria-hidden="true">·</span> <strong>{DIRECTORY_TOTAL}</strong> Bishops</p>
    </div>
  </header>;
}

function Contents() {
  return <nav id="contents" className="org-contents" aria-label="Contents">
    {DIRECTORY_GROUPS.map(g => <GroupBox key={g.slug} group={g}/>)}
  </nav>;
}

const Count = ({ n }) => <span className="org-count">{n} {n === 1 ? 'bishop' : 'bishops'}</span>;

// Office, 11 Nov: Para-Church and First Love Church open a second contents
// page, one box per council or country with small photos of its bishops.
function SubContents({ group, variant }) {
  return <section className="org-council" id={group.slug} aria-labelledby={`${group.slug}-heading`}>
    <a className="org-all-groups" href="#contents">← All Groups</a>
    <GroupBox group={group} as="h2"/>
    <p className="org-group-total"><Count n={group.count}/></p>
    <nav className={`org-contents org-subcontents ${group.large || group.parts.every(p => p.people.length <= 4) ? 'is-few' : ''} ${group.twoColumns ? 'is-two' : ''}`} aria-label={`${group.name}: contents`}>
      {/* Office, 11 Nov: every bishop's photo beside the name, in the bar. */}
      {group.parts.map(part => <GroupBox key={part.slug} group={part} thumbs={variant}/>)}
    </nav>
  </section>;
}

// Office, 11 Nov: choosing a line opens the whole group, every section and
// every bishop, at the section chosen; the only way back is to All Groups.
function Group({ group, part }) {
  useEffect(() => { if (part && !group.flat) setTimeout(() => document.getElementById(part.slug)?.scrollIntoView(), 60); }, [part]);
  return <section className="org-council" id={group.slug} aria-labelledby={`${group.slug}-heading`}>
    {/* The way back, at the top and kept in view while scrolling (office, 10 Nov). */}
    <div className="org-back-row"><a className="org-all-groups" href="#contents">← All Groups</a></div>
    <GroupBox group={group} as="h2"/>
    <p className="org-group-total"><Count n={group.count}/></p>
    {group.flat ? <div className="org-members">{flatPeople(group, part).map(p => <Bishop key={p.rosterId || p.name} person={p}/>)}</div> : group.parts ? group.parts.map(s => <div className="org-group-part" key={s.slug} id={s.slug}>
      <h3 className="org-part-heading"><Name group={s}/> <Count n={s.people.length}/></h3>
      <div className="org-members">{s.people.map(p => <Bishop key={p.rosterId || p.name} person={p}/>)}</div>
    </div>) : <div className="org-members">{group.people.map(p => <Bishop key={p.rosterId || p.name} person={p}/>)}</div>}
  </section>;
}

export default function OrganisationsApp({ slug = '' }) {
  // An older address for a section opens the contents; one for a group opens it.
  const { group, part } = useGroupFocus(PAGE_ALIASES[slug] ? '' : slug);
  // Office, 11 Nov: every bishop's photo in a strip beside each council's or
  // country's name.
  const variant = 'all';
  return <div className="denom-site org-site" id="top">
    <Masthead/>
    <main className="org-main">
      {group ? <>
        {group.parts && !part ? <SubContents group={group} variant={variant}/> : <Group group={group} part={part}/>}
        <div className="org-end-links"><a className="org-all-groups org-all-groups-end" href="#contents">← All Groups</a></div>
      </> : <Contents/>}
      {!group && <GoodStandingNotice className="org-good-standing"/>}
    </main>
    <footer className="org-footer"><span>Updated {data.updated}</span></footer>
  </div>;
}
