'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Masthead } from './OrganisationsApp';
import { Card, Detail } from './BishopsApp';
import GoodStandingNotice from './GoodStandingNotice';
import useLiveRoll from './useLiveRoll';
import { pastorEntries, pastorGroups, setOfficeLogos } from './public-entries.mjs';
import { COLOURS } from './ministry-organisations.mjs';
import './denomination-sites.css';
import './organisations.css';

// The Order of Pastors in Good Standing (office, 17 Nov): the Order of Bishops'
// style with one coloured box per denomination, A to Z. Choosing a box (its
// address, e.g. #the-mega-church, can be shared) shows that denomination's
// pastors A to Z; a card opens their church, year and overseeing bishop. Large
// denominations are drawn a screenful at a time as the visitor scrolls.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const STEP = 120;
const plural = n => `${n.toLocaleString()} ${n === 1 ? 'Pastor' : 'Pastors'}`;

function Box({ group, as: Tag = 'a' }) {
  const link = Tag === 'a';
  return <Tag className="org-group-box" style={{ '--box': group.colour }} {...(link ? { href: `#${group.slug}` } : { id: `${group.slug}-heading` })}>
    <span className="org-box-name">{group.name}</span>
    {link && <span className="org-box-count">{plural(group.people.length)}</span>}
  </Tag>;
}

function Group({ group, onOpen }) {
  const [limit, setLimit] = useState(STEP);
  const more = useRef(null);
  useEffect(() => {
    if (!more.current || limit >= group.people.length) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setLimit(n => n + STEP); }, { rootMargin: '1200px 0px' });
    io.observe(more.current);
    return () => io.disconnect();
  }, [limit, group.people.length]);
  return <section className="org-council" id={group.slug} aria-labelledby={`${group.slug}-heading`}>
    <div className="org-back-row"><a className="org-all-groups" href="#contents">← All Groups</a></div>
    <Box group={group} as="h2"/>
    <p className="org-group-total"><span className="org-count">{plural(group.people.length).toLowerCase()}</span></p>
    <div className="org-members">{group.people.slice(0, limit).map(p => <Card key={p.rosterId} person={p} onOpen={onOpen} fallback="Pastor"/>)}</div>
    {limit < group.people.length && <div ref={more} className="bl-more"><button type="button" className="bl-more-button" onClick={() => setLimit(n => n + STEP)}>Show more</button></div>}
  </section>;
}

export default function PastorsOrderApp({ groups: published, total: publishedTotal }) {
  // The office's live changes over the groups this page was built with.
  const live = useLiveRoll();
  const { groups, total } = useMemo(() => {
    if (!live) return { groups: published, total: publishedTotal };
    setOfficeLogos(live.logos);
    const entries = pastorEntries(live.people);
    return { groups: pastorGroups(entries, COLOURS).map(g => ({ ...g, people: g.people.map(({ denomination, ...p }) => p) })), total: entries.length };
  }, [live, published, publishedTotal]);
  const [slug, setSlug] = useState('');
  const [open, setOpen] = useState(null);
  useEffect(() => {
    const read = () => { setSlug(decodeURIComponent(location.hash.slice(1))); window.scrollTo(0, 0); };
    read(); addEventListener('hashchange', read);
    return () => removeEventListener('hashchange', read);
  }, []);
  const group = useMemo(() => groups.find(g => g.slug === slug) || null, [groups, slug]);
  return <div className="denom-site org-site" id="top">
    <Masthead sub="Worldwide Fellowship of Pastors" total={total} noun="Pastors"/>
    <main className="org-main">
      {group ? <>
        <Group key={group.slug} group={group} onOpen={setOpen}/>
        <div className="org-end-links"><a className="org-all-groups org-all-groups-end" href="#contents">← All Groups</a></div>
      </> : <nav id="contents" className="org-contents" aria-label="Contents">{groups.map(g => <Box key={g.slug} group={g}/>)}</nav>}
      {!group && <GoodStandingNotice className="org-good-standing"/>}
    </main>
    {open && <Detail person={open} onClose={() => setOpen(null)} fallback="Pastor"/>}
  </div>;
}
