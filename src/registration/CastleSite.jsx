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
const href = (path = "") => `${base}/${path ? `${path}/` : ""}`;

// Office, 19 Nov: the main information only.
const ROLE = [
  ["Licensing", "We issue annual licences to bishops and pastors across the denominations we serve."],
  ["Roll of Good Standing", "Our annual register lists bishops and pastors who hold valid licences and are in good standing."],
  ["Verification", "Verify whether a bishop or pastor holds a valid licence and is currently in good standing."],
];

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
      {/* Office, 19 Nov: in the order they appear on the page. */}
      {[["news", "News"], ["authority", "About Us"], ["declaration", "Declaration"], ["ceremonies", "Events"]].map(([id, label]) =>
        <a key={id} href={`${href()}#${id}`} onClick={() => setOpen(false)}>{label}</a>)}
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
        <div><h4>Events</h4><div className="kc-footer-events">{CASTLE_EVENTS.map((e) => <a key={e.slug} href={href(e.slug)}>{e.title}</a>)}</div></div>
        <div className="kc-footer-declaration"><h4>Declaration</h4><a href={href("declaration")}>Kuriake Castle Declaration <span aria-hidden="true">→</span></a></div>
      </div>
    </div>
    <div className="kc-footer-legal"><span>© {new Date().getFullYear()} Kuriake Castle</span></div>
  </footer>;
}
function Hero({ eyebrow, title, lead, children, next = null, video = false, small = false }) {
  const ref = useRef(null);
  useEffect(() => { if (matchMedia("(prefers-reduced-motion: reduce)").matches) ref.current?.pause(); }, []);
  return <section className={`kc-hero ${small ? "is-small" : ""}`}>
    {video ? <video ref={ref} className="kc-hero-media" autoPlay muted loop playsInline poster={`${base}/assets/brand/castle-night.webp`}>
      <source src={`${base}/assets/brand/castle-hero-night-b-1920.mp4`} media="(min-width: 1100px)" type="video/mp4" />
      <source src={`${base}/assets/brand/castle-hero-night-b-1280.mp4`} type="video/mp4" />
    </video> : <img className="kc-hero-media" src={`${base}/assets/brand/castle-night.webp`} alt="" />}
    <div className="kc-hero-shade" />
    <div className="kc-hero-copy">
      <p className="kc-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="kc-lead">{lead}</p>
      {children}
    </div>
    {next}
  </section>;
}
// Office, 19 Nov: a small arrow at the foot of each section naming the next
// one, so visitors can tell there is more below.
function Next({ to, label, light = false }) {
  return <a className={`kc-next ${light ? "is-light" : ""}`} href={`#${to}`}><span>{label}</span><i aria-hidden="true">↓</i></a>;
}
function EventCards({ except = "" }) {
  return <div className="kc-cards">{CASTLE_EVENTS.filter((e) => e.slug !== except).map((e, i) => <a key={e.slug} className="kc-card" href={href(e.slug)}>
    <h3>{e.title}</h3><span className="kc-card-more">View <span aria-hidden="true">→</span></span>
  </a>)}</div>;
}

export function CastleHome() {
  return <div className="kc-site">
    <Nav />
    <Hero video eyebrow="Ecclesiastical Licensing Authority" title="Kuriake Castle"
      lead="We are the licensing authority for the bishops and pastors in more than sixty denominations worldwide." next={<Next to="news" label="News" light />} />
    {/* Office, 19 Nov: news before About Us. */}
    <section className="kc-news kc-screen" id="news" aria-labelledby="kc-news-title">
      <div className="kc-section-head"><h2 id="kc-news-title">News</h2></div>
      <div className="kc-news-grid">{CASTLE_NEWS.map((n) => <a key={n.slug} className="kc-news-card" href={href(`news/${n.slug}`)}>
        <img src={`${base}/${n.image}`} alt="" loading="lazy" />
        <h3>{n.title}</h3><p>{n.summary}</p>
      </a>)}</div>
      <Next to="authority" label="About Us" />
    </section>
    <section className="kc-about kc-screen" id="authority" aria-labelledby="kc-authority-title">
      <div className="kc-about-photo"><img src={`${base}/assets/brand/castle-night.webp`} alt="Kuriake Castle at night" loading="lazy" /></div>
      <div className="kc-about-copy">
        <h2 id="kc-authority-title">About Us</h2>
        {/* Office, 20 Nov: About Us drawn from the Declaration, in general terms. */}
        <p>Kuriake Castle is a fellowship of churches and Christian ministries from many nations. Its members are united by a common faith, shared beliefs and one mission: to bring the gospel of Jesus Christ to the world.</p>
        <p>The fellowship is built on mutual respect and cooperation. Taking part is voluntary, and every denomination and group in the fellowship is independent. Each one keeps its own name and identity, has its own leadership, and is responsible for the running of its own churches and ministries.</p>
        <p>Kuriake Castle does not govern its member churches. Its role is to support them. It provides fellowship, spiritual encouragement and advice when they ask for it, and it brings ministers and churches together around their shared calling.</p>
        <p>Kuriake Castle also keeps the Roll of Good Standing, a register of the bishops and pastors who serve within the fellowship. It allows churches and members of the public to confirm a minister’s standing each year.</p>
        <ul className="kc-role-list">{ROLE.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul>
      </div>
      <Next to="declaration" label="Our Declaration" />
    </section>
    {/* Office, 19 Nov: the start of the Declaration, with the full text on its own page. */}
    <section className="kc-declaration kc-screen" id="declaration" aria-labelledby="kc-declaration-title">
      <div className="kc-declaration-inner">
        <h2 id="kc-declaration-title">Our Declaration</h2>
        {/* Office, 19 Nov: the whole Declaration here, read by scrolling within it. */}
        <div className="kc-declaration-text" tabIndex={0} aria-label="The Kuriake Castle Declaration" dangerouslySetInnerHTML={{ __html: renderMarkdown(DECLARATION_TEXT) }} />
      </div>
      <Next to="ceremonies" label="Events" light />
    </section>
    <section className="kc-ceremonies kc-screen" id="ceremonies" aria-labelledby="kc-ceremonies-title">
      <div className="kc-section-head"><p className="kc-eyebrow">At the castle</p><h2 id="kc-ceremonies-title">Events</h2></div>
      <EventCards />
    </section>
    <Footer />
  </div>;
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
        <a className="kc-back" href={`${href()}#ceremonies`}>← All events</a>
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
