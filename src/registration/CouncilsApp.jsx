'use client';
import { ORGANISATIONS as data, DIRECTORY_GROUPS } from './ministry-organisations.mjs';
import PortraitImage from './PortraitImage';
import useGroupFocus from './useGroupFocus';
import { portraitStyle } from '../runtime/portrait-framing';
import './councils.css';

// A second design (office, 9 Nov), at /councils/: the same groups and people
// as /organisations/, after the office's mockup. A night-sky header with the
// earth holds the contents, one coloured box per group; a chosen group is
// shown on its own on the white panel.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

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

const Pill = ({ n }) => <span className="cz-pill">{n} {n === 1 ? 'Bishop' : 'Bishops'}</span>;

function Group({ group }) {
  return <section className="cz-section" id={group.slug} aria-labelledby={`${group.slug}-title`}>
    <h2 id={`${group.slug}-title`} className="cz-box" style={{ '--box': group.colour }}>{group.name}</h2>
    {group.parts ? group.parts.map(part => <div className="cz-group" key={part.slug} id={part.slug}>
      <div className="cz-group-head"><h3>{part.name}</h3><Pill n={part.people.length}/></div>
      <div className="cz-cards">{part.people.map(p => <Card key={p.rosterId || p.name} person={p}/>)}</div>
    </div>) : <>
      <div className="cz-group-head"><Pill n={group.people.length}/></div>
      <div className="cz-cards">{group.people.map(p => <Card key={p.rosterId || p.name} person={p}/>)}</div>
    </>}
  </section>;
}

export default function CouncilsApp() {
  const group = useGroupFocus();
  // No title for now (office, 9 Nov): the night sky and the earth, then the
  // contents, one coloured box per group.
  return <div className="cz-site" id="top">
    <header className={`cz-hero ${group ? 'cz-hero-small' : ''}`}>
      <img className="cz-earth" src={`${base}/assets/organisations/earth.webp`} alt="" aria-hidden="true"/>
      {!group && <nav className="cz-contents" id="contents" aria-label="Contents">
        {DIRECTORY_GROUPS.map(g => <a key={g.slug} href={`#${g.slug}`} className="cz-box" style={{ '--box': g.colour }}>{g.name}</a>)}
      </nav>}
    </header>
    {group && <main className="cz-panel">
      <Group group={group}/>
      <div className="cz-end-links"><a className="cz-top" href="#contents">↑ Back to contents</a></div>
    </main>}
    <footer className="cz-footer"><span>Updated {data.updated}</span></footer>
  </div>;
}
