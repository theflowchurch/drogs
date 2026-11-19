"use client";
// Kuriake Castle's own site (office, 19 Nov): the licensing authority's main page
// and the ceremonies and gatherings the castle hosts. No sign-in or sign-up here;
// people get in touch through the enquiry form, which emails the office.
import { useEffect, useRef, useState } from "react";
import * as api from "./client";
import { CASTLE_EVENTS, ENQUIRY_KINDS, castleEvent } from "./castle-events.mjs";
import { LEGAL_PAGES } from "./legal.mjs";
import "./castle-site.css";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const href = (path = "") => `${base}/${path ? `${path}/` : ""}`;

const ROLE = [
  ["Licensing of ministers", "Bishops, reverends and pastors are licensed to exercise the rights, titles and functions of their ministerial office."],
  ["The Roll of Good Standing", "An annual register of every licensed bishop and pastor. Ministers renew each year to remain on the roll."],
  ["Standards of ministry", "Clear expectations of conduct, accountability and official attire for every licensed minister."],
  ["Recognition of churches", "Denominations, churches and missions, with their bishops and structures, are recognised and served by the Authority."],
  ["Verification", "Churches and the public can confirm whether a minister holds a current licence and is in good standing."],
  ["Ecclesiastical counsel", "Guidance for the governance of churches, councils and their leadership."],
];
const PRINCIPLES = [
  ["Integrity", "Every licence rests on a minister’s character, calling and conduct."],
  ["Accountability", "Ministers renew their licence each year, and their bishop confirms them."],
  ["Order", "Each minister serves within a recognised denomination and structure."],
  ["Service", "The Authority exists to serve denominations, churches and their bishops."],
];

function Mark({ size = 30 }) {
  return <img src={`${base}/assets/brand/castle-white.png`} alt="" width={size} height={size} className="kc-mark" />;
}
function Nav({ solid = false }) {
  const [open, setOpen] = useState(false), [scrolled, setScrolled] = useState(solid);
  useEffect(() => { if (solid) return; const on = () => setScrolled(window.scrollY > 40); on(); addEventListener("scroll", on, { passive: true }); return () => removeEventListener("scroll", on); }, [solid]);
  return <header className={`kc-nav ${scrolled ? "is-solid" : ""} ${open ? "is-open" : ""}`}>
    <a className="kc-brand" href={href()}><Mark /><span><b>Kuriake Castle</b><small>Licensing Authority</small></span></a>
    <button type="button" className="kc-menu" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}><span /><span /></button>
    <nav aria-label="Main">
      <a href={`${href()}#authority`} onClick={() => setOpen(false)}>The Authority</a>
      <a href={`${href()}#castle`} onClick={() => setOpen(false)}>The Castle</a>
      <a href={`${href()}#ceremonies`} onClick={() => setOpen(false)}>Ceremonies &amp; Gatherings</a>
      <a className="kc-nav-cta" href="#enquire" onClick={() => setOpen(false)}>Make an enquiry</a>
    </nav>
  </header>;
}
function Footer() {
  return <footer className="kc-footer">
    <div className="kc-footer-top">
      <div className="kc-footer-brand"><Mark size={38} /><div><b>Kuriake Castle</b><p>Ecclesiastical Licensing Authority · Ghana</p></div></div>
      <div className="kc-footer-cols">
        <div><h4>The Authority</h4><a href={`${href()}#authority`}>Our role</a><a href={`${href()}#principles`}>Principles</a><a href={`${href()}#castle`}>The castle</a></div>
        <div><h4>Ceremonies</h4>{CASTLE_EVENTS.slice(0, 4).map((e) => <a key={e.slug} href={href(e.slug)}>{e.title}</a>)}</div>
        <div><h4>Gatherings</h4>{CASTLE_EVENTS.slice(4).map((e) => <a key={e.slug} href={href(e.slug)}>{e.title}</a>)}</div>
      </div>
    </div>
    <div className="kc-footer-legal"><span>© {new Date().getFullYear()} Kuriake Castle</span><span className="kc-legal-links">{LEGAL_PAGES.map((p) => <a key={p.slug} href={href(p.slug)}>{p.label}</a>)}</span></div>
  </footer>;
}
function Enquiry({ kind: preset = "" }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", organisation: "", kind: preset, date: "", guests: "", message: "" });
  const [state, setState] = useState(""), [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const event = CASTLE_EVENTS.find((e) => e.title === form.kind);
  const submit = async (e) => {
    e.preventDefault(); setError(""); setState("sending");
    try { await api.enquire(form); setState("sent"); }
    catch (err) { setError(err.message || "Your enquiry could not be sent. Please try again."); setState(""); }
  };
  return <section className="kc-enquire" id="enquire" aria-labelledby="kc-enquire-title">
    <div className="kc-enquire-copy">
      <p className="kc-eyebrow">Get in touch</p>
      <h2 id="kc-enquire-title">Make an enquiry</h2>
      <p>Tell us what you are planning or what you would like to know. The office will reply to you by email.</p>
      <ul className="kc-enquire-points"><li>Ceremonies, services and gatherings</li><li>Councils, meetings and conferences</li><li>Questions for the Licensing Authority</li></ul>
    </div>
    {state === "sent" ? <div className="kc-enquire-done" role="status"><h3>Thank you, {form.name.split(" ")[0]}.</h3><p>Your enquiry has been sent. The office will reply to {form.email}.</p></div> :
    <form className="kc-form" onSubmit={submit}>
      <label className="kc-field"><span>Full name</span><input required value={form.name} onChange={set("name")} autoComplete="name" /></label>
      <label className="kc-field"><span>Email address</span><input required type="email" value={form.email} onChange={set("email")} autoComplete="email" /></label>
      <label className="kc-field"><span>Phone or WhatsApp <em>optional</em></span><input value={form.phone} onChange={set("phone")} autoComplete="tel" /></label>
      <label className="kc-field"><span>Church or organisation <em>optional</em></span><input value={form.organisation} onChange={set("organisation")} /></label>
      <label className="kc-field kc-wide"><span>Your enquiry is about</span><select required value={form.kind} onChange={set("kind")}><option value="" disabled>Choose one</option>{ENQUIRY_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
      {(event || !form.kind) && form.kind !== "The Licensing Authority" && <>
        <label className="kc-field"><span>Preferred date <em>optional</em></span><input type="date" value={form.date} onChange={set("date")} /></label>
        <label className="kc-field"><span>Expected guests <em>optional</em></span><input inputMode="numeric" value={form.guests} onChange={set("guests")} /></label>
      </>}
      <label className="kc-field kc-wide"><span>Message</span><textarea required rows={5} value={form.message} onChange={set("message")} /></label>
      {error && <p className="kc-error" role="alert">{error}</p>}
      <button className="kc-button kc-wide" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send enquiry"}<span aria-hidden="true">→</span></button>
    </form>}
  </section>;
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
    <span className="kc-card-num">{String(i + 1).padStart(2, "0")}</span>
    <h3>{e.title}</h3><p>{e.short}</p><span className="kc-card-more">Learn more <span aria-hidden="true">→</span></span>
  </a>)}</div>;
}

export function CastleHome() {
  return <div className="kc-site">
    <Nav />
    <Hero video eyebrow="Ecclesiastical Licensing Authority · Ghana" title="Kuriake Castle"
      lead="An ecclesiastical castle and monument in Ghana, home to the licensing authority for the bishops and pastors of more than sixty denominations worldwide.">
      <div className="kc-hero-actions"><a className="kc-button" href="#authority">The Licensing Authority <span aria-hidden="true">→</span></a><a className="kc-button is-ghost" href="#enquire">Make an enquiry</a></div>
    </Hero>
    <section className="kc-figures" aria-label="Kuriake Castle in figures">
      <div><strong>60+</strong><span>Denominations served worldwide</span></div>
      <div><strong>Annual</strong><span>Licensing and the Roll of Good Standing</span></div>
      <div><strong>One</strong><span>Home for the headquarters of churches and missions</span></div>
      <div><strong>Ghana</strong><span>An ecclesiastical castle and monument</span></div>
    </section>
    <section className="kc-about" id="castle">
      <div className="kc-about-photo"><img src={`${base}/assets/brand/castle-night.webp`} alt="Kuriake Castle at night" loading="lazy" /></div>
      <div className="kc-about-copy">
        <p className="kc-eyebrow">The Castle</p>
        <h2>An ecclesiastical castle in Ghana</h2>
        <p>Kuriake Castle is an ecclesiastical monument and a centre of Christian life and authority. It houses the headquarters of various churches and missions, and serves more than sixty denominations around the world.</p>
        <p>The castle belongs to no single church. It exists to serve denominations, churches and bishops, together with the structures through which they govern and care for their people.</p>
        <p>Within its walls sits the Licensing Authority, which licenses bishops and pastors and keeps the Roll of Good Standing.</p>
      </div>
    </section>
    <section className="kc-authority" id="authority" aria-labelledby="kc-authority-title">
      <div className="kc-section-head"><p className="kc-eyebrow">The Licensing Authority</p><h2 id="kc-authority-title">Our role</h2><p>The Licensing Authority upholds the order and integrity of Christian ministry across the denominations it serves.</p></div>
      <div className="kc-roles">{ROLE.map(([t, d], i) => <article key={t} className="kc-role"><span className="kc-role-num">{String(i + 1).padStart(2, "0")}</span><h3>{t}</h3><p>{d}</p></article>)}</div>
    </section>
    <section className="kc-mandate" aria-label="Our mandate"><blockquote><p>“It exists to serve denominations and churches, their bishops and their structures.”</p><cite>The mandate of Kuriake Castle</cite></blockquote></section>
    <section className="kc-principles" id="principles" aria-labelledby="kc-principles-title">
      <div className="kc-section-head"><p className="kc-eyebrow">What we hold to</p><h2 id="kc-principles-title">Principles</h2></div>
      <div className="kc-principle-grid">{PRINCIPLES.map(([t, d]) => <div key={t} className="kc-principle"><h3>{t}</h3><p>{d}</p></div>)}</div>
    </section>
    <section className="kc-ceremonies" id="ceremonies" aria-labelledby="kc-ceremonies-title">
      <div className="kc-section-head"><p className="kc-eyebrow">At the castle</p><h2 id="kc-ceremonies-title">Ceremonies &amp; gatherings</h2><p>Beyond its work as a licensing authority, Kuriake Castle welcomes churches, families and ministries for the moments that matter most.</p></div>
      <EventCards />
    </section>
    <Enquiry />
    <Footer />
  </div>;
}

export function CastleEventPage({ slug }) {
  const e = castleEvent(slug);
  if (!e) return null;
  return <div className="kc-site">
    <Nav solid />
    <Hero small eyebrow="Kuriake Castle · Ceremonies & gatherings" title={e.title} lead={e.lead}>
      <div className="kc-hero-actions"><a className="kc-button" href="#enquire">Enquire about {e.title.toLowerCase().split(" & ")[0]} <span aria-hidden="true">→</span></a></div>
    </Hero>
    <section className="kc-event">
      <div className="kc-event-main">
        <p className="kc-eyebrow">What we offer</p>
        <h2>{e.short}</h2>
        <ul className="kc-offer">{e.offer.map((o) => <li key={o}>{o}</li>)}</ul>
        <p className="kc-note">{e.note}</p>
      </div>
      <aside className="kc-steps" aria-label="How it works">
        <h3>How it works</h3>
        <ol>
          <li><b>Enquire</b><span>Send the form below with your preferred date and the number of guests.</span></li>
          <li><b>Confirm</b><span>The office replies to check availability and arrange a visit if you wish.</span></li>
          <li><b>Plan</b><span>We plan the details with you and your minister.</span></li>
          <li><b>The day</b><span>We welcome you and your guests to Kuriake Castle.</span></li>
        </ol>
      </aside>
    </section>
    <Enquiry kind={e.title} />
    <section className="kc-ceremonies is-more" aria-labelledby="kc-more-title"><div className="kc-section-head"><h2 id="kc-more-title">Other ceremonies &amp; gatherings</h2></div><EventCards except={e.slug} /></section>
    <Footer />
  </div>;
}
