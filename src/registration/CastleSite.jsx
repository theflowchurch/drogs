"use client";
// Kuriake Castle's own site (office, 19 Nov): the licensing authority's main page
// and the ceremonies and gatherings the castle hosts. No sign-in or sign-up here;
// (office, 19 Nov) no enquiry form.
import { useEffect, useRef, useState } from "react";
import { CASTLE_EVENTS, castleEvent } from "./castle-events.mjs";
import { CASTLE_NEWS, castleNews } from "./castle-news.mjs";
import { renderMarkdown } from "./Docs";
import { LEGAL_PAGES } from "./legal.mjs";
import "./castle-site.css";

// The Declaration without its page title (the section has its own).
const DECLARATION_TEXT = LEGAL_PAGES.find((p) => p.slug === "declaration").markdown.replace(/^# .*\n+/, "");

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const MAP_URL = "https://maps.app.goo.gl/Z5px9mW4b3D9xxfh9";
const href = (path = "") => `${base}/${path ? `${path}/` : ""}`;


function Mark({ size = 30 }) {
  return <img src={`${base}/assets/brand/castle-white.png`} alt="" width={size} height={size} className="kc-mark" />;
}
function Nav({ solid = false }) {
  const [open, setOpen] = useState(false), [scrolled, setScrolled] = useState(solid);
  useEffect(() => { if (solid) return; const on = () => setScrolled(window.scrollY > 40); on(); addEventListener("scroll", on, { passive: true }); return () => removeEventListener("scroll", on); }, [solid]);
  return <header className={`kc-nav ${scrolled ? "is-solid" : ""} ${open ? "is-open" : ""}`}>
    <a className="kc-brand" href={href()}><Mark /><span><b>Kuriake Castle</b></span></a>
    <button type="button" className="kc-menu" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}><span /><span /></button>
    <nav aria-label="Main">
      {/* Office, 20 Nov: each opens its own page. */}
      {[["about-us", "About Us"], ["the-castle", "The Castle"], ["tours", "Tours"], ["events", "Events"], ["news", "News"], ["declaration", "Declaration"]].map(([path, label]) =>
        <a key={path} href={href(path)}>{label}</a>)}
    </nav>
  </header>;
}
// Office, 19 Nov: no enquiry form and no policy links on the castle's pages;
// the footer holds the ceremonies and the Kuriake Castle Declaration.
function Footer() {
  return <footer className="kc-footer">
    <div className="kc-footer-top">
      <div className="kc-footer-brand"><Mark size={38} /><div><b>Kuriake Castle</b></div></div>
      <div className="kc-footer-cols kc-footer-one">
        <div><h4>Explore</h4><div className="kc-footer-links">{[["about-us", "About Us"], ["the-castle", "The Castle"], ["tours", "Tours"], ["news", "News"]].map(([p, l]) => <a key={p} href={href(p)}>{l}</a>)}</div></div>
        <div><h4>Events</h4><div className="kc-footer-events">{CASTLE_EVENTS.map((e) => <a key={e.slug} href={href(e.slug)}>{e.title}</a>)}</div></div>
        <div className="kc-footer-declaration"><h4>Declaration</h4><a href={href("declaration")}>Kuriake Castle Declaration <span aria-hidden="true">→</span></a></div>
        {/* Office, 20 Nov: where the castle is; the map opens Google Maps. */}
        <div className="kc-footer-visit"><h4>Visit</h4>
          <a className="kc-footer-map" href={MAP_URL} target="_blank" rel="noopener noreferrer" aria-label="Open Kuriake Castle in Google Maps">
            <img src={`${base}/assets/brand/castle-map.webp`} alt="Map showing Kuriake Castle" width="280" height="160" loading="lazy" /><span>Open in Google Maps ↗</span>
          </a>
          <p>Asesano, Akuapem North<br />Eastern Region, Ghana</p>
          <small className="kc-map-credit">Map © OpenStreetMap contributors</small>
        </div>
      </div>
    </div>
    <div className="kc-footer-legal"><span>© {new Date().getFullYear()} Kuriake Castle</span></div>
  </footer>;
}
function Hero({ eyebrow, title, lead, children, next = null, video = false, small = false, image = "assets/brand/castle-night.webp" }) {
  const ref = useRef(null);
  useEffect(() => { if (matchMedia("(prefers-reduced-motion: reduce)").matches) ref.current?.pause(); }, []);
  return <section className={`kc-hero ${small ? "is-small" : ""}`}>
    {video ? <video ref={ref} className="kc-hero-media" autoPlay muted loop playsInline poster={`${base}/assets/brand/castle-night.webp`}>
      <source src={`${base}/assets/brand/castle-hero-night-b-1920.mp4`} media="(min-width: 1100px)" type="video/mp4" />
      <source src={`${base}/assets/brand/castle-hero-night-b-1280.mp4`} type="video/mp4" />
    </video> : <img className="kc-hero-media" src={`${base}/${image}`} alt="" />}
    <div className="kc-hero-shade" />
    <div className="kc-hero-copy">
      <p className="kc-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {lead && <p className="kc-lead">{lead}</p>}
      {children}
    </div>
    {next}
  </section>;
}
function EventCards({ except = "" }) {
  return <div className="kc-cards">{CASTLE_EVENTS.filter((e) => e.slug !== except).map((e, i) => <a key={e.slug} className="kc-card" href={href(e.slug)}>
    <h3>{e.title}</h3><span className="kc-card-more">View <span aria-hidden="true">→</span></span>
  </a>)}</div>;
}

// Office, 20 Nov: a short home page with a page for each topic, as on the
// sites of other castles, cathedrals and licensing bodies.
const ABOUT = [
  "Kuriake Castle is a fellowship of churches and Christian ministries from many nations. Its members are united by a common faith, shared beliefs and one mission: to bring the gospel of Jesus Christ to the world.",
  "The fellowship is built on mutual respect and cooperation. Taking part is voluntary, and every denomination and group in the fellowship is independent. Each one keeps its own name and identity, has its own leadership, and is responsible for the running of its own churches and ministries.",
  "Kuriake Castle does not govern its member churches. Its role is to support them. It provides fellowship, spiritual encouragement and advice when they ask for it, and it brings ministers and churches together around their shared calling.",
  "Kuriake Castle also keeps the Roll of Good Standing, a register of the bishops and pastors who serve within the fellowship. It allows churches and members of the public to confirm a minister’s standing each year.",
];
const STORY = [
  ["I", "Ghana’s Forts and Castles", "Ghana is known around the world for its historic forts and castles. Built along the coast by European powers between 1482 and 1786, castles such as Elmina, Cape Coast and Christiansborg in Osu were centres of the gold trade and, later, the transatlantic slave trade. In 1979 they were listed together as a UNESCO World Heritage Site."],
  ["II", "The Akuapem Mountains", "In 1835 the Basel Mission missionary Andreas Riis moved inland from the coast to Akropong, on the Akuapem ridge. The church he founded there was the first Presbyterian church in Ghana, and the Akuapem Mountains became one of the early homes of Christianity in the country."],
  ["III", "A Castle for the Church", "Kuriake Castle stands in the Akuapem Mountains, where the missionaries came. Ghana’s coastal castles were built for trade. Kuriake Castle is, for the first time, a castle built for the church: a home for churches and missions, a place of worship and gathering, and the home of its Licensing Authority."],
];
const More = ({ to, children }) => <a className="kc-more" href={href(to)}>{children} <span aria-hidden="true">→</span></a>;
function NewsCards({ list = CASTLE_NEWS }) {
  return <div className="kc-news-grid">{list.map((n) => <a key={n.slug} className="kc-news-card" href={href(`news/${n.slug}`)}>
    <img src={`${base}/${n.image}`} alt="" loading="lazy" />
    <h3>{n.title}</h3><p>{n.summary}</p>
  </a>)}</div>;
}
// One topic's own page: the small castle banner, then its content.
function TopicPage({ eyebrow = "Kuriake Castle", title, lead = "", image, children }) {
  return <div className="kc-site">
    <Nav solid />
    <Hero small eyebrow={eyebrow} title={title} lead={lead} image={image} />
    {children}
    <Footer />
  </div>;
}

export function CastleHome() {
  return <div className="kc-site">
    <Nav />
    <Hero video eyebrow="A Castle for the Church" title="Kuriake Castle"
      lead="A fellowship of churches and Christian ministries from many nations, in the Akuapem Mountains of Ghana." />
    <section className="kc-home-news" aria-labelledby="kc-news-title">
      <div className="kc-home-head"><h2 id="kc-news-title">News</h2><More to="news">All news</More></div>
      <NewsCards />
    </section>
    <section className="kc-home-about" aria-labelledby="kc-about-title">
      <div className="kc-home-about-photo"><img src={`${base}/assets/brand/castle-night.webp`} alt="Kuriake Castle at night" loading="lazy" /></div>
      <div><p className="kc-eyebrow">About Us</p><h2 id="kc-about-title">A fellowship of churches and ministries</h2>
        <p>{ABOUT[0]}</p><More to="about-us">About Us</More></div>
    </section>
    <section className="kc-home-tiles" aria-label="Explore Kuriake Castle">
      <a className="kc-tile is-dark" href={href("the-castle")}><p className="kc-eyebrow">The Castle</p><h3>A Castle for the Church</h3><p>Ghana is known for its forts and castles. Kuriake Castle, in the Akuapem Mountains, is the first castle built for the church.</p><span className="kc-more">Read the story <span aria-hidden="true">→</span></span></a>
      <a className="kc-tile" href={href("tours")}><p className="kc-eyebrow">Tours</p><h3>Tour the Castle</h3><p>Visitors are welcome to tour the castle and its grounds and discover its place in the story of the church in Ghana.</p><span className="kc-more">Plan a visit <span aria-hidden="true">→</span></span></a>
      <a className="kc-tile" href={href("events")}><p className="kc-eyebrow">Events</p><h3>Events at the Castle</h3><p>Weddings, funerals, conferences, councils, consecrations and ordinations.</p><span className="kc-more">See the events <span aria-hidden="true">→</span></span></a>
      <a className="kc-tile is-dark" href={href("declaration")}><p className="kc-eyebrow">Declaration</p><h3>Our Declaration</h3><p>The shared principles of our fellowship of denominations and groups.</p><span className="kc-more">Read the Declaration <span aria-hidden="true">→</span></span></a>
    </section>
    <Footer />
  </div>;
}
export function CastleAboutPage() {
  return <TopicPage eyebrow="Kuriake Castle" title="About Us">
    <section className="kc-about kc-page-body">
      <div className="kc-about-photo"><img src={`${base}/assets/brand/castle-night.webp`} alt="Kuriake Castle at night" loading="lazy" /></div>
      <div className="kc-about-copy">{ABOUT.map((t) => <p key={t}>{t}</p>)}</div>
    </section>
  </TopicPage>;
}
export function CastleStoryPage() {
  return <TopicPage eyebrow="The Castle" title="A Castle for the Church" image="assets/brand/castle-hero-poster-bw.webp"
    lead="Kuriake comes from the Greek kuriakē, meaning “belonging to the Lord”. It is the word from which the English word “church” comes.">
    <section className="kc-castle kc-page-body">
      <div className="kc-castle-story">{STORY.map(([n, t, d]) => <article key={t}><span className="kc-castle-num">{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div>
    </section>
  </TopicPage>;
}
export function CastleToursPage() {
  return <TopicPage eyebrow="Tours" title="Tour the Castle" image="assets/brand/castle-hero-poster-bw.webp">
    <section className="kc-tours kc-page-body">
      <div className="kc-tours-photo"><img src={`${base}/assets/brand/castle-night.webp`} alt="Kuriake Castle" loading="lazy" /></div>
      <div className="kc-tours-copy">
        <p>Visitors are welcome to tour Kuriake Castle and discover its place in the story of the church in Ghana.</p>
        <p>A visit takes you through the castle and its grounds in the Akuapem Mountains, with time to learn about its history, its purpose and the fellowship it serves.</p>
        <ul className="kc-offer"><li>Guided tours of the castle and its grounds</li><li>Visits for churches, schools and groups</li><li>Time for prayer and reflection</li></ul>
      </div>
    </section>
  </TopicPage>;
}
export function CastleEventsPage() {
  return <TopicPage eyebrow="At the castle" title="Events">
    <section className="kc-ceremonies kc-page-body"><EventCards /></section>
  </TopicPage>;
}
export function CastleNewsIndex() {
  return <TopicPage eyebrow="Kuriake Castle" title="News">
    <section className="kc-home-news kc-page-body"><NewsCards /></section>
  </TopicPage>;
}
export function CastleDeclarationPage() {
  return <TopicPage eyebrow="Kuriake Castle" title="Our Declaration">
    <section className="kc-declaration-page kc-page-body">
      <div className="kc-declaration-full" dangerouslySetInnerHTML={{ __html: renderMarkdown(DECLARATION_TEXT) }} />
    </section>
  </TopicPage>;
}

export function CastleEventPage({ slug }) {
  const e = castleEvent(slug);
  if (!e) return null;
  return <div className="kc-site">
    <Nav solid />
    <Hero small eyebrow="Kuriake Castle · Events" title={e.title} lead={e.lead} />
    <section className="kc-event">
      <div className="kc-event-main">
        <ul className="kc-offer">{e.offer.map((o) => <li key={o}>{o}</li>)}</ul>
        <a className="kc-back" href={href("events")}>← All events</a>
      </div>
    </section>
    <Footer />
  </div>;
}

// Office, 19 Nov: one news article on its own page.
export function CastleNewsPage({ slug }) {
  const n = castleNews(slug);
  if (!n) return null;
  return <div className="kc-site">
    <Nav solid />
    <article className="kc-article">
      <p className="kc-eyebrow">Kuriake Castle · News</p>
      <h1>{n.title}</h1>
      <img src={`${base}/${n.image}`} alt="" />
      {n.body.map((t) => <p key={t}>{t}</p>)}
      {n.links.length > 0 && <div className="kc-article-links">{n.links.map(([label, path]) => <a key={path} className="kc-button" href={href(path)}>{label} <span aria-hidden="true">→</span></a>)}</div>}
    </article>
    <Footer />
  </div>;
}
