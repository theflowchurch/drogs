"use client";
// Kuriake Castle's own site (office, 19 Nov): the licensing authority's main page
// and the ceremonies and gatherings the castle hosts. No sign-in or sign-up here;
// (office, 19 Nov) no enquiry form.
import { useEffect, useRef, useState } from "react";
import { CASTLE_EVENTS, castleEvent } from "./castle-events.mjs";
import "./castle-site.css";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const href = (path = "") => `${base}/${path ? `${path}/` : ""}`;

// Office, 19 Nov: the main information only.
const ROLE = [
  ["Licensing", "Bishops and pastors are licensed for their ministry."],
  ["Roll of Good Standing", "A yearly register of every licensed bishop and pastor."],
  ["Verification", "Anyone can confirm that a minister is in good standing."],
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
      <a href={`${href()}#authority`} onClick={() => setOpen(false)}>About Us</a>
      <a href={`${href()}#ceremonies`} onClick={() => setOpen(false)}>Ceremonies &amp; Gatherings</a>
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
        <div><h4>Ceremonies &amp; gatherings</h4><div className="kc-footer-events">{CASTLE_EVENTS.map((e) => <a key={e.slug} href={href(e.slug)}>{e.title}</a>)}</div></div>
        <div className="kc-footer-declaration"><h4>Declaration</h4><a href={href("declaration")}>Kuriake Castle Declaration <span aria-hidden="true">→</span></a></div>
      </div>
    </div>
    <div className="kc-footer-legal"><span>© {new Date().getFullYear()} Kuriake Castle</span></div>
  </footer>;
}
function Hero({ eyebrow, title, lead, children, video = false, small = false }) {
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
  </section>;
}
function EventCards({ except = "" }) {
  return <div className="kc-cards">{CASTLE_EVENTS.filter((e) => e.slug !== except).map((e, i) => <a key={e.slug} className="kc-card" href={href(e.slug)}>
    <h3>{e.title}</h3><span className="kc-card-more">View <span aria-hidden="true">→</span></span>
  </a>)}</div>;
}

export function CastleHome() {
  return <div className="kc-site">
    <Nav />
    <Hero video eyebrow="Ecclesiastical Licensing Authority · Ghana" title="Kuriake Castle"
      lead="We are the licensing authority for the bishops and pastors in more than sixty denominations worldwide.">
      <div className="kc-hero-actions"><a className="kc-button" href="#authority">About Us <span aria-hidden="true">→</span></a></div>
    </Hero>
    <section className="kc-about" id="authority" aria-labelledby="kc-authority-title">
      <div className="kc-about-photo"><img src={`${base}/assets/brand/castle-night.webp`} alt="Kuriake Castle at night" loading="lazy" /></div>
      <div className="kc-about-copy">
        <p className="kc-eyebrow">The Licensing Authority</p>
        <h2 id="kc-authority-title">A centre of Christian authority</h2>
        <p>Kuriake Castle is an ecclesiastical monument in Ghana and the headquarters of churches and missions. It serves denominations, churches and bishops worldwide.</p>
        <ul className="kc-role-list">{ROLE.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul>
      </div>
    </section>
    <section className="kc-ceremonies" id="ceremonies" aria-labelledby="kc-ceremonies-title">
      <div className="kc-section-head"><p className="kc-eyebrow">At the castle</p><h2 id="kc-ceremonies-title">Ceremonies &amp; gatherings</h2></div>
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
    <Hero small eyebrow="Kuriake Castle · Ceremonies & gatherings" title={e.title} lead={e.lead} />
    <section className="kc-event">
      <div className="kc-event-main">
        <p className="kc-eyebrow">What we offer</p>
        <ul className="kc-offer">{e.offer.map((o) => <li key={o}>{o}</li>)}</ul>
        <a className="kc-back" href={`${href()}#ceremonies`}>← All ceremonies &amp; gatherings</a>
      </div>
    </section>
    <Footer />
  </div>;
}
