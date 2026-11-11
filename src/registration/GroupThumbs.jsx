import PortraitImage from './PortraitImage';
import { portraitStyle } from '../runtime/portrait-framing';
import './group-thumbs.css';

// Small photos of a council's (or country's) bishops on its box in the second
// contents page (office, 11 Nov). Four styles to choose from:
//   stack  overlapping circles
//   strip  a row of small square portraits
//   lead   the chairperson larger, the others small beside
//   fan    photos fanned like cards
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const LIMITS = { stack: 7, strip: 8, lead: 5, fan: 5, all: Infinity, under: Infinity };
// all    every bishop as a strip beside the name (office, 11 Nov)
// under  every bishop as a strip under the name

function Face({ person, className = '', title }) {
  if (!person?.image) return <span className={`gt-face gt-face-empty ${className}`} aria-hidden="true"/>;
  const edited = person.image.startsWith('assets/organisations/people/');
  const style = edited ? { '--portrait-x': '50%', '--portrait-y': '0%' } : Object.fromEntries(portraitStyle(person.image).split(';').filter(Boolean).map(pair => pair.split(':')));
  // Small copies (200px, about 5 KB) keep a strip of sixty photos light;
  // the full photo is the fallback if a small one is missing.
  const thumb = person.image.replace(/^(assets\/portraits|assets\/organisations\/people)\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp');
  return <span className={`gt-face ${className}`} title={title}><PortraitImage media={person.image} src={`${base}/${thumb}`} fallbackSrc={`${base}/${person.image}`} alt="" style={style}/></span>;
}

export default function GroupThumbs({ people, variant = 'stack' }) {
  const ordered = [...people.filter(p => p.leader), ...people.filter(p => !p.leader)];
  const limit = LIMITS[variant] || 7;
  const shown = ordered.slice(0, limit);
  const more = ordered.length - shown.length;
  if (variant === 'lead') {
    const [head, ...rest] = shown;
    return <span className="gt gt-lead" aria-hidden="true">
      <Face person={head} className="gt-head"/>
      <span className="gt-lead-text"><b>{head?.title || 'Bishop'} {head?.name}</b><small>{head?.role || 'Chairperson'}</small></span>
      <span className="gt-lead-rest">{rest.map(p => <Face key={p.rosterId || p.name} person={p}/>)}{more > 0 && <span className="gt-more">+{more}</span>}</span>
    </span>;
  }
  if (variant === 'all' || variant === 'under') return <span className={`gt gt-strip gt-${variant}`} aria-hidden="true">
    {ordered.map(p => <Face key={p.rosterId || p.name} person={p} title={`${p.title || 'Bishop'} ${p.name}`}/>)}
  </span>;
  return <span className={`gt gt-${variant}`} aria-hidden="true">
    {shown.map((p, i) => <Face key={p.rosterId || p.name} person={p} className={variant === 'fan' ? `gt-fan-${i}` : ''}/>)}
    {more > 0 && <span className="gt-more">+{more}</span>}
  </span>;
}
