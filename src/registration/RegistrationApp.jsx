"use client";
import Accounts from './Accounts';
import ApiKeys from './ApiKeys';
import Settings, { Structure } from './Settings';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useId,
  useRef,
  Children,
  isValidElement,
  cloneElement,
} from "react";
// Which door the person came through: the general sign-up or pastoral appointments.
const EntranceContext = createContext("general");
import * as api from "./client";
import { LegalFooter } from "./Docs";
import { DENOMINATIONS } from "./denominations.mjs";
import {
  ORGANIZATIONS,
  registrationEmail,
  AMOUNTS,
  parseRoster,
  validateProfile,
  normalName,
  namesAlike,
  nearMatches,
  dobClose,
  titleFor,
  BISHOP_TITLES_FEMALE,
  PASTOR_TITLES,
  withStanding,
  pastorsOf,
  pastorsByBishop,
  caps,
  splitName,
  bySurname,
  placeOf,
  orgLabel,
  REFERENCE_FIELDS,
  catalogOf,
  overlayReferences,
  broadcastRecipients,
  SIGNUP_PAUSED,
  denominationListed,
  NO_DENOMINATION,
  logoFor,
  attireExample,
  paymentReference,
  referenceIndex,
  referenceMatches,
  directoryPeople,
} from "./model.mjs";
import {
  currencyFor,
  loadRates,
  localAmount,
  rateFor,
} from "./exchange.mjs";
import { checkReceiptImage } from "./receipt-check.mjs";
import { portraitStyle } from "../runtime/portrait-framing";
import { shortDateTime, longDate } from "./format.mjs";
import { checkAttire, expectedAttire } from "./attire-check.mjs";
import people from "./reference-people.json";
// Everyone Kuriake Castle already knows. Bishops are the linkable approval references;
// the whole roster backs the Directory and the member search.
const references = people.filter((p) => p.role === "bishop");
const index = referenceIndex(people);
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
// A self-contained preview for /directory-demo/. It deliberately never reads
// or writes the registration store: ten bishops appear as paid/confirmed and
// every other minister remains behind the dark public-directory silhouette.
// A temporary preview build: the front page opens the preview roll and plays the drone shot in black and white.
const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW === "1";
// The front-page drone shot. React does not write the muted attribute into the page, and Safari
// refuses to autoplay a video it does not see as muted, so the element is muted from script and
// played explicitly; if the browser still refuses (Low Power Mode), the first touch starts it.
// The drone shot starts the moment the page loads: both files are named in the HTML
// itself with a media query, so the browser picks the 720p file on phones and the
// 1080p file on larger screens and begins downloading before any script runs. No
// poster: the first frame appears as soon as it is decoded.
function HeroVideo({ src }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
    const start = () => v.play().catch(() => {});
    start();
    const onVisible = () => { if (!document.hidden) start(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("touchstart", start, { once: true, passive: true });
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("pointerdown", start); window.removeEventListener("touchstart", start); };
  }, []);
  return (
    <video ref={ref} className="reg-hero-video" autoPlay muted loop playsInline disablePictureInPicture disableRemotePlayback preload="auto" aria-hidden="true">
      <source src={src.replace("{size}", "1920")} media="(min-width: 900px)" type="video/mp4" />
      <source src={src.replace("{size}", "1280")} type="video/mp4" />
    </video>
  );
}
const directoryDemo = () => {
  const pastorsOf = (b) => people.filter((q) => q.role === "pastor" && q.bishop && namesAlike(q.bishop, b.name));
  const chosen = references.filter((b) => b.image && pastorsOf(b).length).sort(bySurname);
  const confirmed = [...chosen, ...chosen.flatMap((b) => pastorsOf(b).filter((q) => q.image).slice(0, 12))];
  return {
    source: "original",
    photos: "confirmed",
    year: 2027,
    roll: confirmed.map((person) => ({ ...person, id: `preview-${person.id}`, referenceId: person.id, paymentStatus: "verified" })),
    hidden: [],
    overrides: {},
    extraReferences: [],
  };
};
const statusLabel = {
  draft: "Draft",
  unclaimed: "Unclaimed",
  pending: "Awaiting office confirmation",
  denied: "Not approved",
  confirmed: "Confirmed",
  removed: "Removed from this year’s list",
  unpaid: "Not paid",
  rejected: "New payment proof needed",
  verified: "Payment verified",
};
const fieldLabel = {
  name: "name",
  gender: "gender",
  denomination: "denomination",
  church: "church",
  organization: "organization",
  country: "country",
  city: "city",
  email: "email",
  phone: "phone",
  dob: "date of birth",
  bishopName: "bishop (as typed)",
  bishopFirstName: "bishop first name",
  bishopLastName: "bishop last name",
};
const titleCase = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
function Badge({ status, children }) {
  return (
    <span className={`reg-badge ${status}`}>
      {children || statusLabel[status] || status}
    </span>
  );
}
function Field({ label, children, wide = false, hint }) {
  const id = useId();
  return (
    <div className={`reg-field ${wide ? "wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        ["input", "select", "textarea", Choice].includes(child.type)
          ? cloneElement(child, {
              id,
              "aria-describedby": hint ? `${id}-hint` : undefined,
            })
          : child,
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
function Empty({ title, children }) {
  return (
    <div className="reg-empty">
      <span className="empty-mark">◇</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Media({ path, alt, className = "" }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false,
      object = "";
    setUrl("");
    const load = () => {
      if (!path) return;
      api
        .mediaUrl(path)
        .then((u) => {
          object = u;
          if (!cancelled) setUrl(u);
          else if (u.startsWith("blob:")) URL.revokeObjectURL(u);
        })
        .catch(() => {});
    };
    load();
    const timer = api.live ? setInterval(load, 50 * 60 * 1000) : null;
    return () => {
      if (timer) clearInterval(timer);
      cancelled = true;
      if (object.startsWith("blob:")) URL.revokeObjectURL(object);
    };
  }, [path]);
  return url ? (
    <img className={className} src={url} alt={alt} loading="lazy" decoding="async" />
  ) : (
    <div className={`reg-placeholder ${className}`} aria-label={alt}>
      ◯
    </div>
  );
}
// Step through the people of a list from inside the dialog: arrow buttons,
// the keyboard's left/right keys, or a horizontal swipe on a phone.
const stepper = (list, selected, setSelected) => {
  const i = list.findIndex((p) => p.id === selected.id);
  return {
    onPrev: i > 0 ? () => setSelected(list[i - 1]) : undefined,
    onNext: i >= 0 && i < list.length - 1 ? () => setSelected(list[i + 1]) : undefined,
  };
};
// A member keeps their own record current: everything except the date of
// birth, with the same lists the sign-up form uses. Pastors can move to
// another registered bishop; the match is re-run.
function ProfileEditor({ current, state, actor, perform, onDone }) {
  const d = current.data;
  const catalog = state.catalog || catalogOf(state);
  const [f, setF] = useState({ gender: d.gender || "", title: d.title || "", organization: d.organization || "", denomination: d.denomination || "", country: d.country || "", city: d.city || "", phone: d.phone || "", bishopId: d.bishopId || "" });
  const [busyPhoto, setBusyPhoto] = useState(false), [problem, setProblem] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === "organization" ? { denomination: "" } : {}) }));
  const countries = [...new Set([...overlayReferences(people, state).map((x) => x.country), f.country].filter(Boolean))].sort();
  const bishops = [...(state.bishops || [])].filter((b) => b.approved && b.organization === f.organization).sort((a, b) => a.name.localeCompare(b.name));
  const denominations = catalog.denominations[f.organization] || [];
  const save = () => perform("update", { ...f, photoConfirmed: true }, "Your details were updated.").then((ok) => ok && onDone());
  return (
    <div className="reg-fields reg-office-form">
      <p className="reg-field wide reg-small">Name: <b>{d.name}</b> · Date of birth: <b>{longDate(d.dob)}</b> · Gender: <b>{d.gender === "female" ? "Female" : "Male"}</b>. These were set when you registered. If any of them is incorrect, please let the office know.</p>
      {d.role === "pastor" && <Field label="Title"><select value={titleFor({ ...d, ...f })} onChange={(e) => set("title", e.target.value)}>{PASTOR_TITLES.filter((t) => t !== "Lady Rev." || f.gender === "female").map((t) => <option key={t}>{t}</option>)}</select></Field>}
      <Field label="WhatsApp number"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      <Field label="Organization"><select value={f.organization} onChange={(e) => set("organization", e.target.value)}>{catalog.organizations.map((o) => <option key={o} value={o}>{orgLabel(o)}</option>)}</select></Field>
      {denominations.length > 0 && (
        <Field label="Denomination"><select value={f.denomination} onChange={(e) => set("denomination", e.target.value)}><option value="">Select</option>{denominations.map((x) => <option key={x} value={x}>{caps(x)}</option>)}</select></Field>
      )}
      <Field label="Country where you currently serve"><Choice value={f.country} options={countries} onChange={(v) => set("country", v)} blank="Choose…" /></Field>
      <Field label="City"><input value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
      {d.role === "pastor" && (
        <Field label="Your bishop" wide hint="Only bishops who have registered appear here. Choosing a different bishop re-runs the match against their list.">
          <select value={f.bishopId} onChange={(e) => set("bishopId", e.target.value)}>
            <option value="">Choose your bishop…</option>
            {bishops.map((b) => <option key={b.id} value={b.id}>{[b.name, caps(b.denomination)].filter(Boolean).join(" · ")}</option>)}
          </select>
        </Field>
      )}
      <div className="reg-field wide">
        <label>Photo</label>
        <label className={`reg-secondary reg-file-button ${busyPhoto ? "busy" : ""}`}>
          {busyPhoto ? "Uploading…" : "Replace my photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busyPhoto} onChange={(e) => {
            const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setBusyPhoto(true); setProblem("");
            api.upload(actor, file, "portrait").then((key) => perform("update", { photo: key, photoConfirmed: true }, "Photo updated.")).catch((err) => setProblem(err.message || "The photo could not be uploaded.")).finally(() => setBusyPhoto(false));
          }} />
        </label>
      </div>
      {problem && <p className="reg-field wide reg-error-text" role="alert">{problem}</p>}
      <div className="reg-form-actions wide">
        <button type="button" className="reg-secondary" onClick={onDone}>Cancel</button>
        <button type="button" className="reg-primary" onClick={save}>Save changes</button>
      </div>
    </div>
  );
}
// Office broadcasts: pick who receives it, write it, confirm, send. Each
// person gets their own email addressed to them.
function Communication({ state, run }) {
  const [audience, setAudience] = useState("all"), [q, setQ] = useState(""), [picked, setPicked] = useState([]),
    [subject, setSubject] = useState(""), [message, setMessage] = useState(""), [confirming, setConfirming] = useState(false), [result, setResult] = useState(null);
  // Registered members and the original data's emails can both be picked.
  const members = [
    ...(state.profiles || []).filter((p) => p.email && !/@manual\.invalid$/.test(p.email)),
    ...overlayReferences(people, state).map((p) => ({ ...p, ...(state.contacts?.[p.id] || {}) })).filter((p) => p.email).map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.role, original: true })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const targets = broadcastRecipients(state, audience, picked, people);
  const term = q.trim().toLowerCase();
  const matches = term ? members.filter((p) => !picked.includes(p.id) && (normalName(p.name).includes(normalName(q)) || p.email.toLowerCase().includes(term))).slice(0, 12) : [];
  const ready = subject.trim() && message.trim() && targets.length > 0;
  const send = () => run(async () => {
    const r = await api.sendBroadcast({ subject: subject.trim(), message: message.trim(), audience, ids: picked });
    setResult(r); setConfirming(false); setSubject(""); setMessage("");
  }, "Message on its way.");
  return (
    <div className="reg-communication">
      <section className="reg-card">
        <h2>Choose who will receive this email</h2>
        <div className="reg-audience" role="radiogroup" aria-label="Audience">
          {[["all", "Everyone registered"], ["bishops", "Registered bishops"], ["pastors", "Registered pastors"], ["original-all", "Everyone in existing records"], ["original-bishops", "Bishops in existing records"], ["original-pastors", "Pastors in existing records"], ["selected", "Selected people"]].map(([value, label]) => (
            <label key={value} className={audience === value ? "active" : ""}>
              <input type="radio" name="audience" value={value} checked={audience === value} onChange={() => setAudience(value)} />
              {label}
            </label>
          ))}
        </div>
        {audience === "selected" && (
          <div className="reg-recipients">
            <input type="search" aria-label="Find people" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
            {matches.length > 0 && (
              <ul className="reg-recipient-matches">
                {matches.map((p) => (
                  <li key={p.id}><button type="button" className="reg-text" onClick={() => { setPicked([...picked, p.id]); setQ(""); }}>+ {p.name} <small>{p.role} · {p.email}{p.original ? " · existing records" : ""}</small></button></li>
                ))}
              </ul>
            )}
            {picked.length > 0 ? (
              <ul className="reg-recipient-chips">
                {picked.map((id) => { const p = members.find((m) => m.id === id); return p ? <li key={id}>{p.name}<button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPicked(picked.filter((x) => x !== id))}>×</button></li> : null; })}
              </ul>
            ) : (
              <p className="reg-small">Nobody picked yet. Search above and tap a name to add them.</p>
            )}
          </div>
        )}
        <p className="reg-small">{targets.length.toLocaleString()} {targets.length === 1 ? "person" : "people"} will receive this email.{audience.startsWith("original") ? " Only people with an email address in the existing records are counted; some addresses may be out of date." : ""}</p>
      </section>
      <section className="reg-card">
        <h2>Message</h2>
        <div className="reg-fields">
          <Field label="Subject" wide><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} /></Field>
          <Field label="Message" wide hint="Each email will be personalised with the recipient’s name."><textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        </div>
        {!api.communicationAvailable && <p className="reg-small">Sending works on the live site, where email is connected.</p>}
        {result && <p className="reg-small" role="status">{result.queued ? `Sending to ${result.queued.toLocaleString()} people in the background. It will take a few minutes; the result is recorded under History when it finishes.` : `Sent to ${result.sent.toLocaleString()} ${result.sent === 1 ? "person" : "people"}${result.failed?.length ? `; ${result.failed.length} could not be delivered (${result.failed.slice(0, 3).join(", ")}${result.failed.length > 3 ? "…" : ""})` : ""}.`}</p>}
        <div className="reg-form-actions">
          {confirming ? (
            <>
              <span className="reg-small">Send this email to {targets.length.toLocaleString()} {targets.length === 1 ? "person" : "people"}?</span>
              <button type="button" className="reg-secondary" onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" className="reg-primary" onClick={send}>Send email</button>
            </>
          ) : (
            <button type="button" className="reg-primary" disabled={!ready || !api.communicationAvailable} onClick={() => setConfirming(true)}>Send email →</button>
          )}
        </div>
      </section>
    </div>
  );
}
// The live dashboard at dashboard.kuriakecastle.org, shown inside the office
// like an app: fills the work area, expands over the whole screen, minimises to a bar.
const DASHBOARD_URL = "https://dashboard.kuriakecastle.org/";
function DashboardFrame() {
  const [view, setView] = useState("fit"); // fit | full | min
  useEffect(() => {
    if (view !== "full") return;
    const key = (e) => { if (e.key === "Escape") setView("fit"); };
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = old; };
  }, [view]);
  return (
    <section className={`reg-dash ${view}`} aria-label="Dashboard">
      <div className="reg-dash-tools">
        {view === "min" ? (
          <button type="button" className="reg-dash-tool" onClick={() => setView("fit")} title="Restore the dashboard">▢ Restore</button>
        ) : (
          <>
            <button type="button" className="reg-dash-tool" onClick={() => setView("min")} aria-label="Minimise" title="Minimise">—</button>
            <button type="button" className="reg-dash-tool" onClick={() => setView(view === "full" ? "fit" : "full")} aria-label={view === "full" ? "Exit full screen" : "Full screen"} title={view === "full" ? "Exit full screen (Esc)" : "Full screen"}>{view === "full" ? "⤡" : "⤢"}</button>
            <a className="reg-dash-tool" href={DASHBOARD_URL} target="_blank" rel="noreferrer" title="Open in a new tab">↗</a>
          </>
        )}
      </div>
      {view === "min" && <div className="reg-dash-minbar"><b>Dashboard</b><small>Minimised · it keeps running</small></div>}
      <iframe className="reg-dash-frame" src={DASHBOARD_URL} title="Kuriake Castle dashboard" allow="clipboard-read; clipboard-write; fullscreen" />
    </section>
  );
}
// The on-device attire check's verdict, shown to the member under their upload.
// A photo without the official attire, without a plain white background, or without a face cannot go forward; more than one face is only flagged.
const attireBlocked = (check) => ["colour", "background", "no-face", "checking"].includes(check?.verdict);
function AttireNotice({ check, onChoose }) {
  if (!check || check.verdict === "ok" || check.verdict === "skipped") return null;
  if (check.verdict === "checking") return <p className="reg-small reg-attire-checking">Checking the photo…</p>;
  const hard = check.verdict === "colour" || check.verdict === "no-face";
  return (
    <div className="reg-attire-warning" role="alert">
      <b>{hard ? "This photo cannot be used." : "Please take another look at this photo."}</b> {check.note} {hard ? "Please upload a photo of yourself in your official attire, facing the camera, in front of a plain white background." : "You can choose a different photo, or continue if you are sure this one is right. The office will review it."}
      <div><button type="button" className="reg-secondary" onClick={onChoose}>Choose another photo</button></div>
    </div>
  );
}
const attireWords = (check) => !check ? "" : check.verdict === "ok" ? "Attire check: passed" : check.verdict === "no-face" ? "Attire check: no face detected" : check.verdict === "many-faces" ? "Attire check: more than one person" : check.verdict === "colour" ? (check.note?.includes("Background:") ? "Attire check: expected attire colour not seen; background not plain white" : "Attire check: expected attire colour not seen") : check.verdict === "background" ? "Attire check: background not plain white" : "";
// A denomination's logo: the record's own artwork, else the catalog's (asset path or uploaded key).
function DenominationLogo({ person, catalog }) {
  const src = person.denominationLogo || logoFor(catalog, person.denomination);
  if (!src) return null;
  return src.startsWith("assets/") ? <img src={`${base}/${src}`} alt="" /> : <Media path={src} alt="" className="reg-denomination-logo" />;
}
// Opening a pastor from a bishop's record leaves a trail, so the dialog can go back.
function useTrail(selected, setSelected) {
  const [trail, setTrail] = useState([]);
  const prev = trail.at(-1);
  return {
    open: (p) => { if (selected) setTrail((t) => [...t, selected]); setSelected(p); },
    step: (p) => { setTrail([]); setSelected(p); },
    close: () => { setTrail([]); setSelected(null); },
    back: prev ? () => { setTrail((t) => t.slice(0, -1)); setSelected(prev); } : undefined,
    backLabel: prev?.name,
  };
}
function Dialog({ title, onClose, onPrev, onNext, onBack, backLabel, children }) {
  const host = useRef(null),
    close = useRef(onClose),
    nav = useRef({}),
    touch = useRef(null);
  close.current = onClose;
  nav.current = { onPrev, onNext };
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () =>
      Array.from(
        host.current?.querySelectorAll(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ) || [],
      );
    focusable()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape") close.current();
      if (!/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || "")) {
        if (e.key === "ArrowLeft") nav.current.onPrev?.();
        if (e.key === "ArrowRight") nav.current.onNext?.();
      }
      if (e.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      previous?.focus?.();
    };
  }, []);
  return (
    <div className="reg-overlay">
      <section
        ref={host}
        className="reg-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - (touch.current ?? e.changedTouches[0].clientX);
          if (dx > 70) nav.current.onPrev?.();
          if (dx < -70) nav.current.onNext?.();
        }}
      >
        {onBack && (
          <button type="button" className="reg-text reg-dialog-back" onClick={onBack}>
            ← Back to {backLabel || "the previous record"}
          </button>
        )}
        <div className="reg-section-head">
          <h2>{title}</h2>
          {(onPrev || onNext) && (
            <div className="reg-dialog-nav">
              <button className="reg-icon" onClick={onPrev} disabled={!onPrev} aria-label="Previous person">←</button>
              <button className="reg-icon" onClick={onNext} disabled={!onNext} aria-label="Next person">→</button>
            </div>
          )}
          <button className="reg-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export default function RegistrationApp({
  office = false,
  browse = false,
  directoryDemo: showDirectoryDemo = false,
  signup = false,
  entrance = "general",
}) {
  // Members sign in with their email; only the office and the browse-only
  // directory sit behind an access code.
  const gated = office;
  const hero = !office && !browse && !signup;
  api.setDoor(office); // the server reads the member or office session cookie accordingly
  const [theme, setTheme] = useState("light"),
    [pub, setPub] = useState(() => showDirectoryDemo ? directoryDemo() : null),
    [sidebarHidden, setSidebarHidden] = useState(false),
    [signinOpen, setSigninOpen] = useState(false),
    [directoryRole, setDirectoryRole] = useState("bishop"),
    [facePref, setFacePref] = useState(() => (typeof localStorage !== "undefined" && localStorage.getItem("kc-faces")) || ""), // "" follows the site setting; "all" shows every photograph; "confirmed" darkens the unconfirmed
    [gate, setGate] = useState(!gated),
    [actor, setActor] = useState(null),
    [checking, setChecking] = useState(true),
    [state, setState] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState(() => { const wanted = typeof sessionStorage !== "undefined" && sessionStorage.getItem("kc-open-tab"); if (wanted) sessionStorage.removeItem("kc-open-tab"); return wanted || (office ? "Directory" : "Registration"); }),
    [year, setYear] = useState(null);
  const refresh = useCallback(
    async (a = actor) => {
      if (a) {
        const data = await api.snapshot(a);
        setState(data);
        setYear((y) => y || data.year);
      }
    },
    [actor],
  );
  async function run(fn, message) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (message) setNotice(message);
      return true;
    } catch (e) {
      // A session the server no longer knows: back to sign-in instead of a dead end of failed saves.
      if (e.message === "Please sign in again.") { setActor(null); setState(null); setError("Your session has ended. Please sign in again. Nothing was saved."); return false; }
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const perform = async (name, payload, message) =>
    run(async () => {
      await api.action(actor, name, payload);
      await refresh();
    }, message);
  useEffect(() => {
    setChecking(true);
    api
      .currentActor(office)
      .then((current) => {
        setActor(current);
        // A signed-in member does not pass the office gate, and neither does a
        // remembered office session: the access code is typed once per browser
        // session (the stamp below), whoever is signed in.
        if (current && !gated) setGate(true);
      })
      // A failed session check (e.g. the server restarting after a deploy)
      // just means "not signed in"; visitors should not see a fetch error.
      .catch(() => setActor(null))
      .finally(() => setChecking(false));
    const until = Number(
      sessionStorage.getItem("drogs-registration-gate") || 0,
    );
    setGate(!gated || until > Date.now());
  }, []);
  useEffect(() => {
    if (actor) {
      if (!gated) setGate(true); // the office gate only opens with the access code
      refresh().catch((e) => setError(e.message));
    }
  }, [actor, refresh, gated, office]);
  useEffect(() => {
    const saved = localStorage.getItem("kc-theme") === "dark" ? "dark" : "light";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("kc-theme", next);
    document.documentElement.dataset.theme = next;
  };
  useEffect(() => {
    setSidebarHidden(localStorage.getItem("kc-sidebar-hidden") === "yes");
    if (signup && location.hash === "#signin") setSigninOpen("signin");
    else if (signup && location.hash === "#signup") setSigninOpen("signup");
    // The bishop / pastor links open straight onto the email box: email first,
    // then the code, then the form with that email locked in.
    else if (typeof signup === "string") setSigninOpen("signup");
  }, [signup]);
  const toggleSidebar = () => {
    const next = !sidebarHidden;
    setSidebarHidden(next);
    localStorage.setItem("kc-sidebar-hidden", next ? "yes" : "no");
  };
  const [pubError, setPubError] = useState("");
  const loadPublic = () => { setPubError(""); api.publicDirectory().then(setPub).catch((e) => setPubError(e.message)); };
  useEffect(() => {
    // The public directory needs no account at all.
    if (browse && !showDirectoryDemo) loadPublic();
  }, [browse, showDirectoryDemo]);
  useEffect(() => {
    if (!actor) return;
    // Background refreshes stay quiet when the network hiccups; the next tick tries again.
    // Background refreshes stay quiet, except when the session has ended: then show sign-in.
    const update = () => refresh().catch((e) => { if (e.message === "Please sign in again.") { setActor(null); setState(null); setError("Your session has ended. Please sign in again."); } });
    window.addEventListener("storage", update);
    window.addEventListener("registration-change", update);
    const timer = setInterval(update, 30000);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("registration-change", update);
      clearInterval(timer);
    };
  }, [actor, refresh]);
  useEffect(() => {
    if (!gate) return;
    // Nothing to time out until a member is signed in; the office gate has its own stamp.
    if (!actor && !gated) return;
    // Someone who chose to stay signed in is not signed out for being idle. Read
    // after sign-in, so the box ticked on this sign-in is what counts.
    if (localStorage.getItem("kc-remember") === "yes") return;
    let timeout;
    const reset = () => {
      clearTimeout(timeout);
      // Only an access code earns the gate stamp; a member's email sign-in
      // must never unlock the office or the browse-only directory.
      if (gated)
        sessionStorage.setItem(
          "drogs-registration-gate",
          String(Date.now() + 1800000),
        );
      timeout = setTimeout(() => {
        api.signOut(office, false).finally(() => {
          setActor(null);
          setGate(!gated);
          sessionStorage.removeItem("drogs-registration-gate");
        });
      }, 1800000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [gate, actor]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const isOffice = api.live ? Boolean(state?.office) : Boolean(actor?.office);
  const profile = state?.profiles.find((p) => p.id === actor?.id);
  const current = state?.registrations.find(
    (r) => r.userId === actor?.id && r.year === state.year,
  );
  const scoped = (state?.registrations || []).filter(
    (r) => r.year === Number(year),
  );
  const nav = office
    ? [
        "Directory",
        "Existing records",
        "Unclaimed",
        "Approvals",
        "Payments",
        "Pastor lists",
        "History",
        "Communication",
        "Denominations",
        ...(api.apiKeysAvailable ? ["Accounts", "API keys"] : []),
        "Dashboard",
        ...(api.settingsAvailable ? ["Settings"] : []),
      ]
    : [
        "Registration",
        ...(current && current.status !== "draft" ? ROLL_TABS : []),
        ...(profile?.role === "bishop" && current && !["draft", "denied"].includes(current.status)
          ? ["My pastors"]
          : []),
      ];
  async function logout() {
    await run(async () => {
      await api.signOut(office);
      // Members land back on the public front page; the office returns to its gate.
      if (!office) { location.assign(`${base}/`); return; }
      setSigninOpen(false);
      setActor(null);
      setState(null);
      setGate(!gated);
      sessionStorage.removeItem("drogs-registration-gate");
    });
  }
  if (api.configError)
    return (
      <div className="reg-app">
        <div className="reg-empty">
          <h1>Backend configuration is incomplete.</h1>
          <p>
            Configure both the Supabase project URL and public key, then
            rebuild.
          </p>
        </div>
      </div>
    );
  return (
    <EntranceContext.Provider value={entrance}>
    <div className="reg-app">
      {!hero && (
        <div
          className="reg-app-bg"
          style={{ backgroundImage: `url(${base}/assets/brand/castle-night.webp)` }}
          aria-hidden="true"
        />
      )}
      {!hero && <header className="reg-header">
        {gate && actor && !browse && (
          <button
            className="reg-sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarHidden ? "Show side panel" : "Hide side panel"}
            aria-pressed={sidebarHidden}
            title={sidebarHidden ? "Show side panel" : "Hide side panel"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
        )}
        <a className="reg-brand" href={actor ? `${base}/${office ? "admin" : "signup"}/` : `${base}/`}>
          <span className="reg-brand-mark">
            <img src={`${base}/assets/brand/castle-blue.png`} alt="" />
          </span>
          <strong>Kuriake Castle</strong>
        </a>
        <div className="reg-header-right">
          {gate && actor ? (
            <button className="reg-text" onClick={logout}>
              Sign out
            </button>
          ) : signup ? (
            <>
              <button className="reg-text" onClick={() => setSigninOpen("signin")}>
                Sign in
              </button>
              <button className="reg-primary reg-signin-button" onClick={() => setSigninOpen("signup")}>
                Sign up
              </button>
            </>
          ) : browse ? (
            <>
              {/* The public roll only offers sign-in; sign-up is reached from the bishop and pastor links the office shares. */}
              <a className="reg-primary reg-signin-button" href={`${base}/signup/#signin`}>Sign in</a>
            </>
          ) : null}
          {!office && (browse || profile?.role === "bishop") && (
            <button
              type="button"
              role="switch"
              className="reg-face-switch"
              aria-checked={(facePref || pub?.photos || state?.publicPhotos || "confirmed") === "confirmed"}
              aria-label="Dark faces until confirmed"
              title="Photographs or dark faces"
              onClick={() => { const next = (facePref || pub?.photos || state?.publicPhotos || "confirmed") === "confirmed" ? "all" : "confirmed"; localStorage.setItem("kc-faces", next); setFacePref(next); }}
            />
          )}
          <button className="reg-theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>}
      {showDirectoryDemo ? (
        <div className="reg-demo reg-directory-demo">
          <strong>Preview</strong> · every bishop with pastors, and their photographed pastors, are marked confirmed; everyone else stays dark.
        </div>
      ) : !api.live && (
        <div className="reg-demo">
          Saved in this browser only · email delivery and shared accounts are
          not connected ·{" "}
          <a href="https://kuriakecastle.org/">
            live site: kuriakecastle.org
          </a>
        </div>
      )}
      {error && (
        <div className="reg-alert error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="reg-alert success" role="status">
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
      {hero ? (
        <section className="reg-account signin reg-hero-page">
          <button className="reg-primary reg-signin-button reg-hero-signin" onClick={() => setSigninOpen("signin")}>
            Sign in
          </button>
          {signinOpen && (
            <Dialog title="Sign in" onClose={() => setSigninOpen(false)}>
              <AccountForm mode="signin" run={run} busy={busy} onActor={() => location.assign(`${base}/signup/`)} />
            </Dialog>
          )}
          <HeroVideo src={`${base}/assets/brand/castle-hero-night-b-{size}.mp4`} />
          <h1 className="reg-hero-title">
            <img src={`${base}/assets/brand/castle-white.png`} alt="" />
            Kuriake Castle
          </h1>
          <a className="reg-enter" href={`${base}/directory/`}>
            <span className="reg-shimmer">View All Bishops and Pastors in Good Standing</span>
            <span className="reg-enter-arrow" aria-hidden="true">→</span>
          </a>
        </section>
      ) : !gate ? (
        <Gate
          office={office}
          onEnter={(code) => run(async () => {
            // The office code opens the door; the email and its code come next.
            if (api.live) { if (!(await api.officeCode(code)).ok) throw Error("That access code is not correct."); }
            else if (code !== "1234") throw Error("That access code is not correct.");
            sessionStorage.setItem("drogs-registration-gate", String(Date.now() + 1800000));
            setGate(true);
          })}
        />
      ) : browse ? (
        pub ? (
          <PublicDirectory data={{ ...pub, photos: facePref || pub.photos }} />
        ) : pubError ? (
          <div className="reg-loading" role="alert">
            <p>The directory could not be opened. {pubError}</p>
            <button type="button" className="reg-primary" onClick={loadPublic}>Try again</button>
          </div>
        ) : (
          <div className="reg-loading" role="status">
            Opening the directory…
          </div>
        )
      ) : !actor && checking ? (
        <div className="reg-loading" role="status">
          Checking your sign-in…
        </div>
      ) : !actor ? (
        <Account
          office={office}
          signup={signup}
          run={run}
          busy={busy}
          onActor={(a) => {
            setSigninOpen(false);
            setActor(a);
          }}
          open={signinOpen}
          onClose={() => setSigninOpen(false)}
        />
      ) : !state ? (
        <div className="reg-loading" role="status">
          Opening your workspace…
        </div>
      ) : office && !isOffice ? (
        <Empty title="Office access is required">
          This account has not been assigned office access.
        </Empty>
      ) : (
        <div className={`reg-shell ${sidebarHidden ? "sidebar-collapsed" : ""}`}>
          <aside className="reg-sidebar">
            <span className="reg-eyebrow">
              {office ? "Administration" : "Your workspace"}
            </span>
            <div className="reg-nav">
              {nav.map((n) => (
                <button
                  key={n}
                  className={tab === n ? "active" : ""}
                  onClick={() => {
                    setTab(n);
                    setError("");
                    setNotice("");
                  }}
                >
                  <span>
                    {n === "Registration" && current && current.status !== "draft"
                      ? "My profile"
                      : n}
                  </span>
                  {n === "Unclaimed" && (
                    <b>
                      {scoped.filter((r) => r.status === "unclaimed").length}
                    </b>
                  )}
                </button>
              ))}
            </div>
            <div className="reg-side-note">
              <b>
                {office
                  ? "Every bishop and pastor. Every year."
                  : profile?.name || "Welcome to Kuriake Castle"}
              </b>
              <p>
                {office
                  ? "Once registration is confirmed, the bishop or pastor appears in the directory. Unclaimed pastors remain under review."
                  : actor.email}
              </p>
              <small>{api.live ? "Secure access" : "Local account"}</small>
            </div>
          </aside>
          <main className={`reg-main ${tab === "Dashboard" ? "reg-main-flush" : ""}`} aria-busy={busy}>
            <fieldset className="reg-workspace-fieldset" disabled={busy}>
              {tab === "Dashboard" && <DashboardFrame />}
              {tab === "Registration" && (
                <Participant
                  fixedRole={typeof signup === "string" ? signup : ""}
                  actor={actor}
                  state={state}
                  current={current}
                  profile={profile}
                  perform={perform}
                  run={run}
                  busy={busy}
                  refresh={refresh}
                />
              )}
              {tab !== "Registration" && tab !== "Dashboard" && (
                <>
                  <div className="reg-page-heading">
                    <div>
                      <span className="reg-eyebrow">
                        {office ? "KURIAKE CASTLE / OFFICE" : "KURIAKE CASTLE / YOUR MINISTRY"}
                      </span>
                      <h1>
                        {tab === "Directory"
                          ? directoryHeading(directoryRole)
                          : tab === "Existing records"
                            ? `Existing ${directoryRole === "bishop" ? "Bishops" : "Pastors"} Records`
                            : tab === "Unclaimed"
                              ? "Unclaimed Pastors"
                              : tab}
                      </h1>
                      <p>
                        {
                          {
                            Directory: "Everyone who has completed their registration for this year appears here",
                            "Existing records":
                              "These are the bishops and pastors already in our records before this year’s registration. Green means confirmed. Red means not yet registered or confirmed.",
                            Unclaimed:
                              "Pastors who have registered but are waiting for a bishop to confirm that they belong to their ministry.",
                            Approvals:
                              "Bishops who match our existing records are approved automatically. Those who do not match will appear here for the Archbishop’s approval.",
                            "My pastors":
                              "Submit and maintain the names of the pastors under your oversight.",
                            "Pastor lists":
                              "View the pastors submitted by each bishop and see who has been confirmed, unclaimed or removed. Bishops can only see their own pastors under “My pastors”.",
                            Payments:
                              "Review payment proof and confirm payments received.",
                            History: "View previous registration years and activity.",
                            Communication: "Send an email to everyone, all bishops, all pastors, or selected people.",
                            Denominations: "Organisations, their denominations and logos, and the UD – OLGC groups.",
                            Accounts: "See who has created an account and when they last signed in.",
                            "API keys": "Create secure, read-only access for applications connected to Kuriake Castle.",
                            Settings: "Manage registration, payments, email, access and other system settings.",
                          }[tab]
                        }
                      </p>
                    </div>
                  </div>
                  {tab === "Communication" && <Communication state={state} run={run} />}
                  {tab === "Denominations" && <div className="reg-settings-list"><Structure state={state} perform={perform} actor={actor} show={["orgs", "groups"]} /></div>}
                  {tab === "Accounts" && <Accounts run={run} />}
                  {tab === "API keys" && <ApiKeys run={run} />}
                  {tab === "Settings" && <Settings run={run} state={state} perform={perform} actor={actor} />}
                  {tab === "Directory" &&
                    (office ? (
                      <Directory
                        state={state}
                        year={Number(year)}
                        role={directoryRole}
                        setRole={setDirectoryRole}
                        perform={perform}
                        actor={actor}
                        mode="registered"
                      />
                    ) : null)}
                  {rollTabRole(tab) && (
                    <PublicDirectory
                      key={tab}
                      data={{ source: state.publicDirectory || "original", photos: facePref || state.publicPhotos, roll: state.roll || [], catalog: catalogOf(state), year: state.year }}
                      embedded
                      role={rollTabRole(tab)}
                    />
                  )}
                  {tab === "Existing records" && (
                    <Directory
                      state={state}
                      year={Number(year)}
                      role={directoryRole}
                      setRole={setDirectoryRole}
                      perform={perform}
                      actor={actor}
                      mode="original"
                    />
                  )}
                  {tab === "Unclaimed" && (
                    <ReviewQueue
                      records={scoped.filter((r) => r.status === "unclaimed")}
                      state={state}
                      perform={perform}
                      actor={actor}
                      office={office}
                      canEdit={Number(year) === state.year}
                    />
                  )}
                  {tab === "Approvals" && (
                    <BishopApprovals
                      records={scoped}
                      directory={state.directory || []}
                      state={state}
                      actor={actor}
                      perform={perform}
                      canEdit={Number(year) === state.year}
                    />
                  )}
                  {tab === "Payments" && (
                    <Payments
                      records={scoped}
                      perform={perform}
                      canEdit={Number(year) === state.year}
                    />
                  )}
                  {(tab === "My pastors" || tab === "Pastor lists") && (
                    <Roster
                      state={state}
                      year={Number(year)}
                      actor={actor}
                      office={office}
                      perform={perform}
                    />
                  )}
                  {tab === "History" && (
                    <History
                      state={state}
                      records={scoped}
                      office={office}
                      actor={actor}
                      year={Number(year)}
                      perform={perform}
                    />
                  )}
                </>
              )}
            </fieldset>
          </main>
          <HelpButton actor={actor} run={run} />
        </div>
      )}
      <LegalFooter hidden={hero || browse} />
    </div>
    </EntranceContext.Provider>
  );
}
// Anyone stuck can report it from any screen. The office receives an email,
// with an optional Telegram heads-up, when the connected backend is running.
function HelpButton({ actor, run }) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [contact, setContact] = useState(""),
    [sent, setSent] = useState(false);
  return (
    <>
      <button
        className="reg-help-button"
        onClick={() => {
          setOpen(true);
          setSent(false);
          setContact(actor?.email || "");
        }}
      >
        <span aria-hidden="true">?</span> Any issues?
      </button>
      {open && (
        <Dialog title="Report a problem" onClose={() => setOpen(false)}>
          {sent ? (
            <div className="reg-status-message confirmed">
              <h3>Thank you — the office has your report.</h3>
              <p>
                {api.supportAvailable
                  ? "Someone will look at it and reply to the address you gave."
                  : "This copy is not connected to the office mailbox, so nothing was sent. On kuriakecastle.org this reaches the office by email."}
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api.reportIssue(actor, { message, contact });
                  setMessage("");
                  setSent(true);
                });
              }}
            >
              <p className="reg-small">
                Tell us what happened and what you were trying to do. Do not
                include passwords or payment card numbers.
              </p>
              <Field label="What went wrong?">
                <textarea
                  rows={5}
                  required
                  minLength={5}
                  maxLength={4000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="I tried to upload my receipt and it would not accept the photo."
                />
              </Field>
              <Field label="Email for a reply">
                <input
                  type="email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  autoComplete="email"
                />
              </Field>
              <button className="reg-primary full">Send to the office →</button>
            </form>
          )}
        </Dialog>
      )}
    </>
  );
}
function Gate({ office, onEnter }) {
  const [password, setPassword] = useState(""),
    [error, setError] = useState("");
  return (
    <section className="reg-gate">
      <div className="reg-gate-glow" />
      <div className="reg-gate-inner">
        <img src={`${base}/assets/brand/castle-white.png`} alt="" />
        <h1>
          <em>Kuriake Castle</em>
        </h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (!(await onEnter(password))) setError("That access code is not correct.");
          }}
        >
          <label className="sr-only" htmlFor="entrance">
            Access code
          </label>
          <input
            id="entrance"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kuriake Castle"
            type="password"
            required
            autoComplete="current-password"
          />
          <button className="reg-primary">
            Enter <span>→</span>
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
function AccountForm({ office, signup = false, mode = office ? "office" : signup ? "signup" : "signin", run, busy, onActor }) {
  const [remember, setRemember] = useState(false);
  // New sign-ups check whether registration is paused; the notice replaces the form.
  const [paused, setPaused] = useState(null);
  const entrance = useContext(EntranceContext);
  useEffect(() => {
    if (mode !== "signup") return;
    let live = true;
    api.publicDirectory().then((d) => { const flag = entrance === "appointments" ? d?.signup?.appointments : d?.signup; if (live && flag?.closed) setPaused(flag.notice || SIGNUP_PAUSED); }).catch(() => {});
    return () => { live = false; };
  }, [mode, entrance]);
  const [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [token, setToken] = useState("");
  if (paused)
    return (
      <div className="reg-paused" role="status">
        <h3>{entrance === "appointments" ? "Appointment registration is paused" : "Sign-up is paused"}</h3>
        <p>{paused}</p>
        <p className="reg-small">Already registered? Use Sign in instead.</p>
      </div>
    );
  return (
<form
  className="reg-card"
  onSubmit={(e) => {
    e.preventDefault();
    run(async () => {
      if (!api.live) {
        onActor(api.demoSignIn(email, office, mode));
        return;
      }
      if (sent) {
        localStorage.setItem("kc-remember", remember ? "yes" : "no");
        onActor(await api.verifyCode(email, token, mode, remember));
      }
      else {
        await api.requestCode(email, mode, entrance);
        setSent(true);
      }
    });
  }}
>
  {entrance === "appointments" && mode === "signup" && (
    <p className="reg-eyebrow reg-entrance-note">PASTORAL APPOINTMENT · registering a newly appointed bishop or pastor</p>
  )}
  <Field label="Email address">
    <input
      type="email"
      required
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      readOnly={sent}
      autoComplete="email"
    />
  </Field>
  {sent && (
    <Field label="One-time email code">
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        autoComplete="one-time-code"
        inputMode="numeric"
        required
        pattern="[0-9]{6,10}"
      />
    </Field>
  )}
  {sent && (
    <label className="reg-check">
      <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
      <span>Keep me signed in on this device for 30 days.</span>
    </label>
  )}
  <button className="reg-primary full" disabled={busy}>
    {busy
      ? "Please wait…"
      : !api.live
        ? "Continue"
        : sent
          ? signup
            ? "Verify and create account"
            : "Verify and sign in"
          : signup || mode === "office"
            ? "Send code"
            : "Send sign-in code"}{" "}
    →
  </button>
  {sent && (
    <button
      type="button"
      className="reg-text"
      onClick={() => {
        setSent(false);
        setToken("");
      }}
    >
      Change email or resend code
    </button>
  )}
  {signup && (
    <p className="reg-small">
      {api.live
        ? "Your email is your account identity. Keep using the same address each year."
        : "Accounts and uploads remain on this device until the site is connected."}
    </p>
  )}
  {signup && (
    <p className="reg-small">
      Already registered? <a href={`${base}/`}>Sign in</a>
    </p>
  )}
</form>
  );
}
// The landing page is only the castle and its name over the photograph; the
// green Sign in button in the header opens the email form.
function Account({ office, signup = false, run, busy, onActor, open = false, onClose }) {
  const [sent] = useState(false);
  return (
    <section className={`reg-account ${office ? "signup" : "signin"}`}>
      <HeroVideo src={`${base}/assets/brand/castle-hero-night-b-{size}.mp4`} />
      {office ? (
        <>
          <div>
            <img
              className="reg-account-mark"
              src={`${base}/assets/brand/castle-white.png`}
              alt=""
            />
            <span className="reg-eyebrow">OFFICE ACCESS</span>
            <h1>{sent ? "Check your email." : "Sign in to the office."}</h1>
            <p>Use your approved office email. We’ll send you a sign-in code.</p>
          </div>
          <AccountForm office={office} run={run} busy={busy} onActor={onActor} />
        </>
      ) : (
        <>
          <h1 className="reg-hero-title">
            <img src={`${base}/assets/brand/castle-white.png`} alt="" />
            Kuriake Castle
          </h1>
          {open && (
            <Dialog title={open === "signin" ? "Sign in" : "Sign up"} onClose={onClose}>
              {open === "signup" && typeof signup !== "string" ? (
                // Sign-up always starts from a role: the links below are the only way in.
                <div className="reg-signup-choice">
                  <p>Are you registering as a bishop or as a pastor?</p>
                  <a className="reg-primary" href={`${base}/signup/bishop/`}>I am a Bishop →</a>
                  <a className="reg-primary" href={`${base}/signup/pastor/`}>I am a Pastor →</a>
                </div>
              ) : (
                <AccountForm office={office} signup={open === "signup"} mode={open} run={run} busy={busy} onActor={onActor} />
              )}
            </Dialog>
          )}
        </>
      )}
    </section>
  );
}
// Plain-English names for everything the audit trail records.
const ACTION_LABELS = {
                  save: "Draft saved",
                  submit: "Registration submitted",
                  approveBishop: "Bishop approved",
                  addRoster: "Pastors added to list",
                  claim: "Pastor confirmed",
                  removeRoster: "Pastor removed from list",
                  assignBishop: "Supervising bishop assigned",
                  payment: "Payment proof submitted",
                  reviewPayment: "Payment reviewed",
                  openYear: "Next year opened",
                  carryRoster: "Prior list reconfirmed",
                  update: "Details updated",
                  choosePhoto: "Photo choice set",
                  recordPaystack: "Card or mobile-money payment received",
                  reviewBishop: "Bishop registration reviewed",
                  linkReference: "Linked to original record",
                  editRoster: "List entry edited",
                  restoreRoster: "Pastor restored to list",
                  moveRoster: "Pastor moved to another bishop",
                  officeEdit: "Record edited by the office",
                  setStatus: "Status changed by the office",
                  markPaid: "Payment marked by the office",
                  setVisibility: "Public visibility changed",
                  deleteRegistration: "Registration deleted",
                  addPerson: "Person added by the office",
                  addReference: "Original record added",
                  editReference: "Original record corrected",
                  hideReference: "Original record hidden or shown",
                  deleteReference: "Original record deleted or restored",
                  setCatalog: "Organizations and denominations changed",
                  setFees: "Fees changed",
                  setSignup: "Sign-up paused or reopened",
                  broadcast: "Email sent to members",
                  apiKeyCreated: "API key created",
                  apiKeyRevoked: "API key revoked",
};
const FIELD_LABELS = { firstName: "First name", lastName: "Last name", name: "Name", gender: "Gender", title: "Title", organization: "Organization", denomination: "Denomination", country: "Country", city: "City", phone: "WhatsApp number", email: "Email", bishopId: "Bishop", photo: "Photo", amount: "Amount", currency: "Currency", status: "Status", subject: "Subject", recipients: "Recipients", audience: "Audience", autoApproved: "Matched original record", closed: "Paused", notice: "Message" };
// What an audit entry changed, in words: "City: Kumasi · WhatsApp number: +233…".
function detailWords(detail, state) {
  if (!detail || typeof detail !== "object") return "";
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => {
      const label = FIELD_LABELS[k] || k;
      if (k === "photo") return "Photo replaced";
      if (k === "bishopId") return `${label}: ${(state?.bishops || []).find((b) => b.id === v)?.name || v}`;
      if (k === "organization") return `${label}: ${orgLabel(v)}`;
      if (k === "amount" && detail.currency) return `${label}: ${detail.currency} ${(Number(v) / 100).toLocaleString()}`;
      if (k === "currency") return "";
      if (typeof v === "boolean") return `${label}: ${v ? "yes" : "no"}`;
      return `${label}: ${v}`;
    })
    .filter(Boolean)
    .join(" · ");
}
// The member's own trail: what they changed, paid or were told, newest first.
function MyActivity({ state, actor }) {
  const mine = (state.audit || [])
    .filter((a) => a.actor === actor.id || a.target === actor.id)
    .filter((a) => !["save", "choosePhoto", "apiKeyCreated", "apiKeyRevoked", "setCatalog", "setFees", "setSignup", "broadcast", "openYear", "editReference", "hideReference", "deleteReference", "addReference"].includes(a.action))
    .slice()
    .reverse()
    .slice(0, 50);
  if (!mine.length) return null;
  return (
    <div className="reg-my-activity">
      <h3>Your activity</h3>
      <ul>
        {mine.map((a) => {
          const words = detailWords(a.detail, state);
          const byOffice = a.actor !== actor.id;
          return (
            <li key={a.id}>
              <div>
                <b>{ACTION_LABELS[a.action] || a.action}{byOffice ? " (by the office)" : ""}</b>
                {words && <small>{words}</small>}
              </div>
              <time>{shortDateTime(a.at)}</time>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
function Participant({
  fixedRole = "",
  actor,
  state,
  current,
  profile,
  perform,
  run,
  busy,
  refresh,
}) {
  const previous = state.registrations
    .filter((r) => r.userId === actor.id && r.year < state.year)
    .sort((a, b) => b.year - a.year)[0];
  const [editing, setEditing] = useState(false), [editDetails, setEditDetails] = useState(false);
  // The thank-you is for the moment of finishing; anyone returning later sees their profile.
  const [startedHere] = useState(() => !current || current.status === "draft");
  const [viewedProfile, setViewedProfile] = useState(false);
  if (!current || current.status === "draft" || editing)
    return (
      <RegistrationForm
        editing={editing}
        fixedRole={fixedRole}
        onDone={() => setEditing(false)}
        key={`${state.year}-${actor.id}`}
        actor={actor}
        initial={current?.data || previous?.data}
        profile={profile}
        state={state}
        run={run}
        refresh={refresh}
        busy={busy}
      />
    );
  const bishop = state.directory.find((b) => b.id === current.data.bishopId);
  const pastorCount = state.rosters.filter((r) => r.year === state.year && r.bishopId === actor.id && r.status === "active").length;
  // Right after finishing: one confirmation card, then the profile (which is also what every later sign-in shows).
  if (startedHere && !viewedProfile)
    return (
      <div className="reg-page-heading">
        <div className="reg-card reg-finished">
          <span className="reg-eyebrow">{state.year} / REGISTRATION</span>
          <h1>Thank you, {current.data.name.split(" ")[0]}.</h1>
          <p>
            {current.status === "confirmed"
              ? `Your registration has been confirmed. You are in good standing for ${state.year}.`
              : "Your registration has been submitted. The office is reviewing it, and your status will appear on your profile."}
            {current.payment === "verified" ? " Your payment has been received." : ""}
            {pastorCount ? ` ${pastorCount} pastor${pastorCount === 1 ? "" : "s"} uploaded.` : ""}
          </p>
          <button className="reg-primary" onClick={() => setViewedProfile(true)}>View my profile →</button>
          {PREVIEW && current.data.role === "bishop" && (
            <button className="reg-secondary" style={{ marginLeft: 10 }} onClick={() => Promise.resolve(api.signOut(false, true)).finally(() => location.assign(`${base}/signup/pastor/`))}>Sign up as one of your pastors →</button>
          )}
          {PREVIEW && current.data.role === "pastor" && bishop && (
            <button className="reg-secondary" style={{ marginLeft: 10 }} onClick={() => { const all = [...(state.profiles || []), ...((JSON.parse(localStorage.getItem("drogs-registration-v1") || "{}").profiles) || [])]; const b = all.find((x) => x.id === bishop.accountId || x.referenceId === bishop.id || x.id === bishop.id); if (!b?.email) return; sessionStorage.setItem("kc-open-tab", "My pastors"); api.demoSignIn(b.email, false, "signin"); location.assign(`${base}/signup/`); }}>Open your bishop’s account →</button>
          )}
        </div>
      </div>
    );
  return (
    <>
      <div className="reg-page-heading">
        <div>
          <span className="reg-eyebrow">{state.year} / MY PROFILE</span>
          <h1>My profile</h1>
          <p>Your place on the Roll of Good Standing. You can update your details at any time.</p>
        </div>
        <Badge status={current.status === "unclaimed" ? "pending" : current.status} />
      </div>
      <div className="reg-status-layout">
        <section className="reg-card">
          <div className="reg-profile-hero">
            <Media
              path={current.data.photo}
              alt={current.data.name}
              className="reg-record-photo"
            />
            <div>
              <span className="reg-eyebrow">{titleFor(current.data).toUpperCase()}</span>
              <h2>{current.data.name}</h2>
              <span className={`reg-status-pill ${current.status === "confirmed" ? "good" : current.status === "denied" || current.resubmit ? "action" : "pending"}`}>
                Status: {current.status === "confirmed" ? "In Good Standing" : current.status === "denied" || current.resubmit ? "Action Required" : "Pending Review"}
              </span>
              <p>
                {[orgLabel(current.data.organization), caps(current.data.denomination || current.data.church)]
                  .filter((v, i, a) => v && a.indexOf(v) === i)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <dl className="reg-details">
            <div>
              <dt>Email</dt>
              <dd>{current.data.email}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{current.data.phone}</dd>
            </div>
            <div>
              <dt>Date of birth</dt>
              <dd>{longDate(current.data.dob)}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{[current.data.city, current.data.country].filter(Boolean).join(", ")}</dd>
            </div>
            {current.data.role === "pastor" && (
              <div>
                <dt>Bishop</dt>
                <dd>{bishop?.name || current.data.bishopName}</dd>
              </div>
            )}
          </dl>
          {(current.status !== "confirmed" || current.resubmit) && (
          <div className={`reg-status-message ${current.status === "unclaimed" ? "pending" : current.status}`}>
            <h3>
              {current.status === "confirmed"
                ? "Your registration is confirmed."
                : current.status === "denied"
                  ? "Your registration was not approved."
                  : current.resubmit
                    ? "The office has asked you to update your registration."
                    : current.status === "pending"
                      ? "Thank you. Your registration has been submitted."
                      : current.status === "removed"
                        ? "Your place on this year’s list has changed."
                        : "Thank you. Your registration has been submitted."}
            </h3>
            <p>
              {current.status === "confirmed"
                ? "You can now pay your Annual Good Standing Renewal Fee."
                : current.status === "denied" || current.resubmit
                  ? current.bishopNote || "Please get in touch with the office for details."
                  : current.status === "pending"
                    ? `${current.payment === "verified" ? "Your payment has been received. " : ""}${pastorCount ? `${pastorCount} pastor${pastorCount === 1 ? "" : "s"} uploaded. ` : ""}The office is reviewing your registration. Once it has been approved, your status will appear here. You can add more pastors under “My pastors” at any time.`
                    : current.status === "removed"
                      ? "Please speak to your bishop or the office about this change. Your registration and payment history are kept on file."
                      : `${current.payment === "verified" ? "Your payment has been received. " : ""}Your bishop and the office are reviewing your registration. Once it has been confirmed, your status will appear here.`}
            </p>
          </div>
          )}
          {current.resubmit ? (
            <button className="reg-secondary" onClick={() => setEditing(true)}>
              Update my registration
            </button>
          ) : (
            <button className="reg-secondary" onClick={() => setEditDetails(true)}>
              Edit my details
            </button>
          )}
          {editDetails && (
            <Dialog title="Edit my details" onClose={() => setEditDetails(false)}>
              <ProfileEditor current={current} state={state} actor={actor} perform={perform} onDone={() => setEditDetails(false)} />
            </Dialog>
          )}
          <MyActivity state={state} actor={actor} />
        </section>
        <Payment
          current={current}
          actor={actor}
          run={run}
          refresh={refresh}
          paystackKey={state.paystackKey || ""}
        />
      </div>
    </>
  );
}
function RegistrationForm({
  editing = false,
  fixedRole = "",
  onDone,
  actor,
  initial,
  profile,
  state,
  run,
  refresh,
  busy,
}) {
  const entrance = useContext(EntranceContext);
  const [data, setData] = useState(() => ({
      ...{
        entrance,
        role: fixedRole || profile?.role || "pastor",
        gender: "",
        title: "",
        name: "",
        firstName: "",
        lastName: "",
        denomination: "",
        country: "",
        city: "",
        photoConfirmed: false,
        phone: "",
        dob: "",
        church: "",
        organization: "",
        photo: "",
        bishopId: "",
        referenceId: "",
        bishopFirstName: "",
        bishopLastName: "",
      },
      ...initial,
      email: registrationEmail(actor.email, initial?.email),
    })),
    // Onboarding is one guided path: details → (bishops: pastors) → payment → review → confirm.
    [step, setStep] = useState("details"),
    [rosterRows, setRosterRows] = useState([]),
    [slots, setSlots] = useState(() => blankSlots(4)),
    [rosterError, setRosterError] = useState(""),
    [rates, setRates] = useState(null),
    [accurate, setAccurate] = useState(false),
    [consent, setConsent] = useState(false),
    [fileBusy, setFileBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Existing records with this name; the registrant confirms from the photo and
  // the form is pre-filled with what Kuriake Castle already holds.
  const candidates = useMemo(() => {
    if (data.referenceId || dismissed || !data.firstName || !data.lastName) return [];
    return referenceMatches(index, { name: data.name, email: data.email, phone: data.phone }, data.role)
      .slice(0, 3)
      .map((m) => m.reference);
  }, [data.firstName, data.lastName, data.email, data.phone, data.role, data.referenceId, dismissed]);
  const adopt = (ref) =>
    setData((d) => {
      // Photo and phone are never taken from the old record: both are asked for afresh.
      const next = { ...d, referenceId: ref.id, photoConfirmed: false };
      if (!d.country && ref.country) next.country = ref.country;
      if (!d.city && ref.city) next.city = ref.city;
      if (!d.organization && ORGANIZATIONS.includes(ref.organization)) next.organization = ref.organization;
      // Older records shout their denomination in capitals; match it to the list by normalised name.
      const listed = (catalog.denominations[next.organization] || []).find((d) => normalName(d) === normalName(ref.denomination));
      if (!next.denomination && listed) next.denomination = listed;
      if (d.role === "pastor" && ref.bishop && !d.bishopFirstName && !d.bishopLastName) {
        const parts = ref.bishop.trim().split(/\s+/);
        next.bishopFirstName = parts.slice(0, -1).join(" ") || parts[0];
        next.bishopLastName = parts.length > 1 ? parts.at(-1) : "";
      }
      return next;
    });
  // Pastors pick their bishop from a list of those who have already registered.
  const registeredBishops = [...(state.bishops || [])].filter((b) => b.approved && (!data.organization || b.organization === data.organization)).sort((a, b) => a.name.localeCompare(b.name));
  const chosenBishop = registeredBishops.find((b) => b.id === data.bishopId) || null;
  const pickBishop = (b) =>
    setData((d) => {
      const parts = (b?.name || "").trim().split(/\s+/);
      return {
        ...d,
        bishopId: b?.id || "",
        bishopFirstName: b ? parts.slice(0, -1).join(" ") : "",
        bishopLastName: b ? parts.at(-1) || "" : "",
        photoConfirmed: false,
      };
    });
  const set = (key, value) =>
    setData((d) => {
      const next = { ...d, [key]: value, photoConfirmed: false };
      if (key === "organization") {
        next.denomination = "";
        if (d.bishopId && (state.bishops || []).find((b) => b.id === d.bishopId)?.organization !== value) { next.bishopId = ""; next.bishopFirstName = ""; next.bishopLastName = ""; }
        // FLOW is an online fellowship: its members are listed as Online, Ghana.
        if (value === "FLOW") { next.city = "Online"; next.country = "Ghana"; }
      }
      if (key === "firstName" || key === "lastName")
        next.name = [next.firstName, next.lastName].filter(Boolean).join(" ");
      return next;
    });
  const catalog = state.catalog || catalogOf(state);
  const fees = state.fees || AMOUNTS;
  const steps = editing
    ? ["details", "review"]
    : data.role === "bishop"
      ? ["details", "pastors", "payment", "review"]
      : ["details", "payment", "review"];
  const review = step === "review";
  const stepLabel = { details: "Your details", pastors: "Pastors Under Your Oversight", payment: "Payment", review: "Review" };
  const next = () => setStep(steps[Math.min(steps.indexOf(step) + 1, steps.length - 1)]);
  const back = () => setStep(steps[Math.max(steps.indexOf(step) - 1, 0)]);
  const currency = currencyFor(data.country);
  useEffect(() => {
    if (step !== "payment" || !currency || currency === "USD") return;
    let live = true;
    loadRates().then((value) => live && setRates(value));
    return () => { live = false; };
  }, [step, currency]);
  const rate = rateFor(rates, currency);
  // This year's record for the person (a draft once the payment step saves it).
  const mine = state.registrations.find((r) => r.userId === actor.id && r.year === state.year);
  async function save() {
    await run(async () => {
      await api.action(actor, "save", data);
      await refresh();
    }, "Draft saved. You can return to finish it.");
  }
  async function send() {
    const ok = await run(async () => {
      await api.action(actor, editing ? "update" : "submit", { ...data, consentedAt: data.consentedAt || new Date().toISOString() });
      // The pastors and the payment proof gathered on the way are sent right after.
      if (!editing && rosterRows.length) await api.action(actor, "addRoster", { rows: rosterRows });
      await refresh();
    }, editing ? "Your details are updated." : "Thank you. Your registration has been received and is being processed.");
    if (ok && editing) onDone?.();
  }
  return (
    <>
      <div className="reg-page-heading">
        <div>
          <h1>
            {step === "review"
              ? "Review your details."
              : step === "pastors"
                ? "Pastors Under Your Oversight."
                : step === "payment"
                  ? "Annual Good Standing Renewal Fee."
                  : editing
                    ? "Update my details."
                    : "Roll of Good Standing."}
          </h1>
          <p>
            {step === "review"
              ? "Check that all the information below is correct before submitting."
              : step === "pastors"
                ? "Add the pastors under your oversight. When they register, they will automatically be linked to you."
                : step === "payment"
                  ? "Pay your Annual Good Standing Renewal Fee securely by card or mobile money."
                  : `Complete your ${state.year} annual renewal to remain on the Roll of Good Standing.`}
          </p>
        </div>
        <Badge status="draft">
          {`0${steps.indexOf(step) + 1} / ${stepLabel[step]}`}
        </Badge>
      </div>
      <div className="reg-form-layout">
        <aside className="reg-form-aside">
          <div className="reg-upload-card">
            {/* The picture area is the upload control: tap it to choose a photo. */}
            <label className={`reg-upload-target ${fileBusy ? "busy" : ""}`}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Photo in official attire"
                disabled={fileBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file)
                    run(async () => {
                      setFileBusy(true);
                      try {
                        const key = await api.upload(actor, file);
                        setData((d) => ({ ...d, photo: key, photoCheck: { verdict: "checking", note: "" }, photoConfirmed: false }));
                        // The attire check runs after the upload and never blocks it.
                        checkAttire(file, { role: data.role, gender: data.gender, organization: data.organization, title: titleFor(data) }).then((result) => setData((d) => (d.photo === key ? { ...d, photoCheck: result } : d)));
                      } finally {
                        setFileBusy(false);
                      }
                    });
                }}
              />
              {data.photo ? (
                <Media
                  path={data.photo}
                  alt="Your uploaded portrait"
                  className="reg-upload-preview"
                />
              ) : (
                <div className="reg-silhouette" aria-hidden="true">
                  <svg viewBox="0 0 120 150">
                    <circle cx="60" cy="48" r="30" />
                    <path d="M10 150c0-34 22-56 50-56s50 22 50 56z" />
                  </svg>
                  <span>Tap to upload your photo</span>
                </div>
              )}
              <span className="reg-upload-hint">
                {fileBusy ? "Uploading…" : data.photo ? "Photo uploaded · tap to replace it" : "JPG, PNG or WebP · up to 5 MB"}
              </span>
            </label>
            <AttireNotice check={data.photoCheck} onChoose={() => document.querySelector('input[aria-label="Photo in official attire"]')?.click()} />
            <figure className="reg-attire-example">
              <img src={`${base}/${attireExample(data).file}`} alt={attireExample(data).alt} />
              <figcaption>
                <b>{attireExample(data).caption}</b>
                Face the camera against a plain white background, with your face fully visible. You must be wearing {expectedAttire(data).words}.
                {titleFor(data) === "Rev." ? " Selfies, casual clothing or photos showing only the collar will not be accepted." : " Selfies and casual clothing will not be accepted."}
              </figcaption>
            </figure>
          </div>
          <div className="reg-amount">
            <span>Annual Good Standing Renewal Fee</span>
            <strong>
              ${fees[data.role]}
              <small>USD</small>
            </strong>
            <p>
              {titleCase(data.role)} · {state.year}
            </p>
            <hr />
            <b>Non-refundable</b>
          </div>
        </aside>
        <section className="reg-card reg-form-card">
          {step === "details" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  validateProfile(data, actor.email, { catalog });
                  setData((d) => ({ ...d, photoConfirmed: false }));
                  setAccurate(false);
                  next();
                });
              }}
            >
              <div className="reg-section-head">
                <h2>Your Details</h2>
                <span>All fields are required</span>
              </div>
              <div className="reg-fields">
                <Field
                  label="Ministerial title"
                >
                  <select
                    value={`${data.role === "bishop" ? "bishop" : "pastor"}|${titleFor(data)}`}
                    onChange={(e) => { const [role, title] = e.target.value.split("|"); setData((d) => ({ ...d, role, title: title || "", photoConfirmed: false })); }}
                    disabled={(profile?.role || fixedRole) === "bishop" && data.gender !== "female"}
                  >
                    {(profile?.role || fixedRole) !== "bishop" && PASTOR_TITLES.filter((t) => t !== "Lady Rev." || data.gender === "female").map((t) => <option key={t} value={`pastor|${t}`}>{t}</option>)}
                    {(profile?.role || fixedRole) !== "pastor" && (data.gender === "female" ? BISHOP_TITLES_FEMALE : ["Bishop"]).map((t) => <option key={t} value={`bishop|${t}`}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Organization">
                  <select
                    value={data.organization}
                    onChange={(e) => set("organization", e.target.value)}
                    required
                  >
                    <option value="">Select organization</option>
                    {catalog.organizations.map((o) => (
                      <option key={o} value={o}>{orgLabel(o)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="First name">
                  <input
                    required
                    maxLength={80}
                    value={data.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Last name">
                  <input
                    required
                    maxLength={80}
                    value={data.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    autoComplete="family-name"
                  />
                </Field>
                <Field
                  label="Gender"
                >
                  <select required value={data.gender} onChange={(e) => set("gender", e.target.value)}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>
                {(candidates.length > 0 || data.referenceId) && (
                  <div className="reg-is-this-you reg-field wide">
                    {data.referenceId ? (
                      <p>
                        Thank you for confirming. Your existing record will be updated with the
                        details you give here. Check them below.{" "}
                        <button type="button" className="reg-text" onClick={() => set("referenceId", "")}>
                          Not me
                        </button>
                      </p>
                    ) : (
                      <>
                        <p>Is this you? We already have a record with this name.</p>
                        <div className="reg-candidates">
                          {candidates.map((ref) => (
                            <div key={ref.id} className="reg-candidate">
                              <Portrait person={ref} />
                              <div>
                                <b>{ref.name}</b>
                                <small>
                                  {[ref.denomination, ref.city, ref.country].filter(Boolean).join(" · ")}
                                </small>
                                <button type="button" className="reg-secondary" onClick={() => adopt(ref)}>
                                  Yes, this is me
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button type="button" className="reg-text" onClick={() => setDismissed(true)}>
                          {candidates.length === 1 ? "This is not me" : "None of these are me"}
                        </button>
                      </>
                    )}
                  </div>
                )}
                <Field label="Email address">
                  <input
                    type="email"
                    required
                    readOnly={!actor.email.endsWith("@drogs.invalid")}
                    value={data.email}
                    onChange={(e) => set("email", e.target.value)}
                    autoComplete="email"
                  />
                </Field>
                <Field
                  label="WhatsApp number"
                  hint="Include your country code, e.g. +233 24 123 4567. Registration updates will be sent to you on WhatsApp."
                >
                  <input
                    required
                    type="tel"
                    value={data.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    autoComplete="tel"
                  />
                </Field>
                <Field label="Date of birth">
                  <input
                    required
                    type="date"
                    min="1900-01-01"
                    max={new Date(Date.now() - 86400000)
                      .toISOString()
                      .slice(0, 10)}
                    value={data.dob}
                    onChange={(e) => set("dob", e.target.value)}
                    autoComplete="bday"
                  />
                </Field>
                {(catalog.denominations[data.organization] || []).length > 0 && (
                  <Field label="Denomination">
                    <select
                      value={data.denomination}
                      onChange={(e) => set("denomination", e.target.value)}
                      required
                    >
                      <option value="">Select denomination</option>
                      {(catalog.denominations[data.organization] || []).map((d) => (
                        <option key={d} value={d}>{caps(d)}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Country where you currently serve">
                  <input
                    required
                    value={data.country}
                    onChange={(e) => set("country", e.target.value)}
                    autoComplete="country-name"
                  />
                </Field>
                <Field label="City">
                  <input
                    required
                    value={data.city}
                    onChange={(e) => set("city", e.target.value)}
                    autoComplete="address-level2"
                  />
                </Field>
                <CommitmentPreview role={data.role} country={data.country} />
                {data.role === "pastor" && (
                  <Field label="Your bishop" wide hint={registeredBishops.length
                    ? "Only bishops who have already registered appear here. If yours is missing, ask them to sign up first at kuriakecastle.org/signup/bishop/."
                    : "No bishop has registered yet. Ask your bishop to sign up first at kuriakecastle.org/signup/bishop/."}>
                    <select
                      value={data.bishopId}
                      onChange={(e) => pickBishop(registeredBishops.find((b) => b.id === e.target.value))}
                    >
                      <option value="">Choose your bishop…</option>
                      {registeredBishops.map((b) => (
                        <option key={b.id} value={b.id}>{[b.name, caps(b.denomination)].filter(Boolean).join(" · ")}</option>
                      ))}
                    </select>
                    {chosenBishop && (
                      <div className="reg-candidate chosen">
                        <Portrait person={chosenBishop} />
                        <div>
                          <b>{chosenBishop.name}</b>
                          <small>{[caps(chosenBishop.denomination), chosenBishop.organization].filter(Boolean).join(" · ")}</small>
                        </div>
                      </div>
                    )}
                  </Field>
                )}
              </div>
              <div className="reg-form-actions">
                <button
                  type="button"
                  className="reg-secondary"
                  onClick={save}
                  disabled={busy || fileBusy}
                >
                  Save draft
                </button>
                <button className="reg-primary" disabled={busy || fileBusy || attireBlocked(data.photoCheck)} title={attireBlocked(data.photoCheck) ? "Upload a photo in your official attire to continue" : undefined}>
                  {editing ? "Review changes →" : "Continue →"}
                </button>
              </div>
            </form>
          ) : step === "pastors" ? (
            <div>
              <div className="reg-section-head">
                <div>
                  <h2>Add pastors under your oversight</h2>
                  <p>
                    Enter each pastor’s <b>full name</b> and <b>date of birth</b> below. Each pastor will add their own photo when they register.
                  </p>
                </div>
              </div>
              <PastorSlots slots={slots} setSlots={setSlots} />
              <details className="reg-upload-alt">
                <summary>Have a list of pastors in a spreadsheet? Upload it here</summary>
                <Field label="Upload a spreadsheet" hint="Excel (.xlsx, .xls) or CSV: full name in the first column, date of birth (day/month/year) in the second. The rows above fill in from the file.">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      readSpreadsheet(file)
                        .then((t) => {
                          const rows = parseRoster(t).map((r) => ({ name: r.name, dob: /^\d{4}-\d{2}-\d{2}$/.test(r.dob) ? r.dob : "" }));
                          setSlots((cur) => { const kept = cur.filter((r) => r.name.trim() || r.dob); const merged = [...kept, ...rows]; return merged.length < 4 ? [...merged, ...blankSlots(4 - merged.length)] : merged; });
                          setRosterError("");
                        })
                        .catch((err) => setRosterError(err.message));
                    }}
                  />
                </Field>
              </details>
              {rosterError && <p role="alert" className="reg-status-message unclaimed">{rosterError}</p>}
              <p className="reg-small">{filledSlots(slots).length ? `${uniqueRows(filledSlots(slots)).length} pastor${uniqueRows(filledSlots(slots)).length === 1 ? "" : "s"} ready to submit. You will see them again on the review page before confirming.` : "No pastors added yet."}</p>
              <div className="reg-form-actions">
                <button type="button" className="reg-secondary" onClick={back}>← Back</button>
                <button
                  type="button"
                  className="reg-primary"
                  disabled={!slotsComplete(slots)}
                  title={slotsComplete(slots) ? undefined : "Finish or clear the highlighted rows first"}
                  onClick={() => { setRosterRows(uniqueRows(filledSlots(slots))); next(); }}
                >
                  Continue →
                </button>
              </div>
            </div>
          ) : step === "payment" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
            >
              <div className="reg-section-head">
                <div>
                  <h2>
                    ${fees[data.role]} <small>USD</small>
                    {rate > 0 ? <small> · approximately {localAmount(fees[data.role], rate, currency)}</small> : null}
                  </h2>
                  <p>Annual Good Standing Renewal Fee · {titleCase(data.role)} • {state.year} · Non-refundable.</p>
                </div>
              </div>
              {mine?.payment === "verified" ? (
                <div className="reg-status-message confirmed">
                  <h3>Thank you for your commitment.</h3>
                  <p>${fees[data.role]} USD received by card or mobile money. Next, look over your profile{data.role === "bishop" ? " and your pastors" : ""} and confirm.</p>
                </div>
              ) : state.paystackKey ? (
                <>
                  <p>Pay securely by card or mobile money (MTN, Telecel, AT). Once your payment is successful, you will automatically return to this page.</p>
                  <PaystackButton
                    current={{ amount: fees[data.role], year: state.year, data }}
                    actor={actor}
                    run={run}
                    refresh={refresh}
                    currency={currency}
                    rate={rate}
                    paystackKey={state.paystackKey}
                    beforePay={() => api.action(actor, "save", data)}
                  />
                </>
              ) : PREVIEW ? (
                <div className="reg-payment-instructions">
                  <p>Pay securely by card or mobile money (MTN, Telecel, AT). This walkthrough simulates the payment.</p>
                  <button type="button" className="reg-primary reg-paystack" disabled={busy} onClick={() => run(async () => { await api.action(actor, "save", data); await api.action(actor, "recordPaystack", { reference: `SIM-${Date.now()}`, amount: fees[data.role] * 100, expectedMinor: fees[data.role] * 100, currency: "USD" }); await refresh(); }, "Payment received. Thank you.")}>Pay ${fees[data.role]} by card →</button>
                </div>
              ) : (
                <p className="reg-payment-instructions">Card and mobile-money payment is not switched on yet. Continue for now; the office will let you know when to pay.</p>
              )}
              <div className="reg-form-actions">
                <button type="button" className="reg-secondary" onClick={back}>← Back</button>
                {/* Payment comes first: with checkout available, the only way forward is to pay. */}
                {mine?.payment === "verified" ? (
                  <button className="reg-primary" disabled={busy}>View your profile →</button>
                ) : state.paystackKey ? (
                  <span className="reg-small">Complete your payment to continue.</span>
                ) : (
                  <button className="reg-primary" disabled={busy}>Continue →</button>
                )}
              </div>
            </form>
          ) : (
            <>
              <section
                className="reg-attire-review"
                aria-label="Confirm your official portrait"
              >
                <h2>Confirm your photo</h2>
                <p>
                  Your photo must show you wearing {expectedAttire(data).words}. Your face must be fully visible, facing the camera, against a plain white background.{" "}
                  {titleFor(data) === "Rev." ? "Photos showing only the collar, selfies or casual clothing will not be accepted." : "Selfies and casual clothing will not be accepted."}
                </p>
                <div className="reg-photo-comparison">
                  <figure>
                    <Media
                      path={data.photo}
                      alt="Your uploaded photo for confirmation"
                    />
                    <figcaption>Your uploaded photo</figcaption>
                  </figure>
                  <figure>
                    <img src={`${base}/${attireExample(data).file}`} alt={attireExample(data).alt} />
                    <figcaption>{attireExample(data).caption}</figcaption>
                  </figure>
                </div>
                <label className="reg-check">
                  <input
                    type="checkbox"
                    checked={data.photoConfirmed === true}
                    onChange={(e) =>
                      setData((d) => ({
                        ...d,
                        photoConfirmed: e.target.checked,
                      }))
                    }
                  />
                  {data.role === "bishop"
                    ? "I confirm this is me wearing my official red jacket, with my face fully visible against a plain white background."
                    : "I confirm this is me in official pastoral attire, with my face fully visible against a plain white background."}
                </label>
                <button
                  type="button"
                  className="reg-text reg-choose-other"
                  onClick={() => {
                    set("photoConfirmed", false);
                    setStep("details");
                  }}
                >
                  Choose a different photo
                </button>
              </section>
              <ProfileDetails record={{ data }} directory={state.directory} />
              {!editing && data.role === "bishop" && (
                <section className="reg-review-block">
                  <h3>Pastors Under Your Oversight <b>{rosterRows.length}</b></h3>
                  {rosterRows.length ? (
                    <RowsTable rows={rosterRows} />
                  ) : (
                    <p className="reg-small">None added yet. You can add them under My pastors.</p>
                  )}
                  <button type="button" className="reg-text" onClick={() => setStep("pastors")}>Change</button>
                </section>
              )}
              {!editing && (
                <section className="reg-review-block">
                  <h3>Payment</h3>
                  {mine?.payment === "verified" ? (
                    <p>${fees[data.role]} USD paid by card or mobile money. <Badge status="verified" /></p>
                  ) : (
                    <p className="reg-small">Payment is not switched on yet; the office will let you know when to pay.</p>
                  )}
                  <button type="button" className="reg-text" onClick={() => setStep("payment")}>Change</button>
                </section>
              )}
              <label className="reg-check">
                <input
                  type="checkbox"
                  checked={accurate}
                  onChange={(e) => setAccurate(e.target.checked)}
                />
                I confirm that these details are accurate and this photograph is
                mine.
              </label>
              <label className="reg-check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I consent to Kuriake Castle displaying my name, title, photograph,
                  organization, denomination, city and country on the public Roll
                  of Good Standing. My email address, phone number and date of
                  birth will remain private and will only be used by the office
                  and my bishop to verify my registration. I have read the{" "}
                  <a href={`${base}/privacy/`} target="_blank" rel="noreferrer">Privacy Policy</a>{" "}
                  and <a href={`${base}/terms/`} target="_blank" rel="noreferrer">Terms</a>.
                </span>
              </label>
              <p className="reg-small">
                The Annual Good Standing Renewal Fee is ${fees[data.role]} USD and is
                non-refundable.
              </p>
              <div className="reg-form-actions">
                <button
                  className="reg-secondary"
                  onClick={back}
                >
                  ← Back
                </button>
                <button
                  className="reg-primary"
                  onClick={send}
                  disabled={!accurate || !consent || !data.photoConfirmed || busy}
                >
                  {editing ? "Submit changes →" : "Confirm and submit →"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
// Shown as soon as a country is typed, so the amount to send is clear before
// anyone reaches payment. Same indicative-rate rules as the payment card.
function CommitmentPreview({ role, country }) {
  const [rates, setRates] = useState(null);
  const currency = currencyFor(country),
    amount = AMOUNTS[role] || AMOUNTS.pastor;
  useEffect(() => {
    if (!currency || currency === "USD") return;
    let live = true;
    loadRates().then((value) => live && setRates(value));
    return () => {
      live = false;
    };
  }, [currency]);
  if (!String(country || "").trim()) return null;
  const rate = rateFor(rates, currency);
  return (
    <p className="reg-local-amount reg-field wide">
      Annual Good Standing Renewal Fee: ${amount} USD
      {rate > 0
        ? ` · approximately ${localAmount(amount, rate, currency)}`
        : currency === "USD"
          ? ""
          : currency
            ? " · fetching today’s rate…"
            : " · we could not match that country to a currency; the amount is charged in USD"}
      <small>
        The fee is set in US dollars. The Ghana cedi amount shown is an estimate; your
        bank or mobile-money provider determines the final amount charged.
      </small>
    </p>
  );
}
// Card or mobile money through Paystack's inline checkout. The amount is charged
// in GHS at the same indicative rate the member sees; the server confirms the
// reference with Paystack before the payment is recorded.
function PaystackButton({ current, actor, run, refresh, paystackKey, beforePay, label }) {
  const [ready, setReady] = useState(Boolean(globalThis.PaystackPop));
  // Paystack Ghana accounts settle in cedis only, so every member is charged
  // in GHS converted from the USD fee at today's rate. No rate, no charge:
  // falling back to USD made Paystack refuse the currency.
  const [rates, setRates] = useState(undefined);
  useEffect(() => {
    let live = true;
    loadRates().then((value) => live && setRates(value));
    if (globalThis.PaystackPop) setReady(true);
    else {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      script.onload = () => setReady(true);
      document.body.appendChild(script);
    }
    return () => { live = false; };
  }, []);
  const rate = rateFor(rates, "GHS");
  const ghs = rate ? Math.ceil(current.amount * rate) : 0;
  return (
    <div className="reg-paystack">
      <button
        type="button"
        className="reg-primary full"
        disabled={!ready || !ghs}
        onClick={() =>
          run(async () => {
            await beforePay?.();
            const reference = await new Promise((resolve, reject) => {
              const handler = globalThis.PaystackPop.setup({
                key: paystackKey,
                email: actor.email,
                amount: ghs * 100,
                currency: "GHS",
                channels: ["card", "mobile_money", "bank", "bank_transfer"],
                metadata: { custom_fields: [{ display_name: "Kuriake Castle", variable_name: "registration", value: `${current.year} ${current.data.role} ${current.data.name}` }] },
                callback: (response) => resolve(response.reference),
                onClose: () => reject(Error("Payment window closed. Nothing was charged; you can pay later from My profile.")),
              });
              handler.openIframe();
            });
            await api.paystackVerify(reference);
            await refresh();
          }, "Payment received. Thank you for your commitment.")
        }
      >
        {ghs ? (label || `Pay GHS ${ghs.toLocaleString()} securely →`) : rates === null ? "Today’s rate is unavailable. Try again in a minute." : "Getting today’s rate…"}
      </button>
      <small className="reg-small">
        Secure payment by Paystack. The ${current.amount} USD fee will be charged in Ghana cedis at the current exchange rate.
      </small>
    </div>
  );
}
function Payment({ current, actor, run, refresh, paystackKey = "" }) {
  const [rates, setRates] = useState(null);
  const currency = currencyFor(current.data.country);
  useEffect(() => {
    if (!currency || currency === "USD") return;
    let live = true;
    loadRates().then((value) => live && setRates(value));
    return () => { live = false; };
  }, [currency]);
  const rate = rateFor(rates, currency);
  return (
    <section className="reg-card reg-payment">
      <span className="reg-eyebrow">ANNUAL GOOD STANDING RENEWAL FEE</span>
      <h2>
        ${current.amount}
        <small> USD</small>
      </h2>
      {rate > 0 && (
        <p className="reg-local-amount">
          Approximately {localAmount(current.amount, rate, currency)}
          <small>Indicative rate. Your bank or mobile-money provider sets the final amount.</small>
        </p>
      )}
      <b>Non-refundable</b>
      <p>
        {titleCase(current.data.role)} • {current.year}
      </p>
      <Badge status={current.payment} />
      {current.payment === "verified" ? (
        <div className="reg-status-message confirmed">
          <h3>Thank you for your commitment.</h3>
          <p>Your payment has been received.</p>
        </div>
      ) : ["draft", "denied"].includes(current.status) ? (
        <p className="reg-small">Payment opens once your registration has been submitted.</p>
      ) : paystackKey ? (
        <PaystackButton current={current} actor={actor} run={run} refresh={refresh} currency={currency} rate={rate} paystackKey={paystackKey} />
      ) : (
        <p className="reg-small">Card and mobile-money payment opens shortly. You will be able to pay here.</p>
      )}
    </section>
  );
}
function ProfileDetails({ record, directory = [] }) {
  const p = record.data;
  return (
    <>
      <div className="reg-person-summary">
        <Media path={p.photo} alt={p.name} className="reg-avatar" />
        <div>
          <h2>{p.name}</h2>
          <p>
            {titleFor(p)} · {orgLabel(p.organization)}
          </p>
          {record.status && <Badge status={record.status} />}
        </div>
      </div>
      <dl className="reg-details">
        {[
          ["Email", p.email],
          ["Phone", p.phone],
          ["Date of birth", longDate(p.dob)],
          ["Denomination", caps(p.denomination || p.church) || "Not applicable"],
          ["Country", p.country || "—"],
          ["City", p.city || "—"],
          ...(p.role === "pastor"
            ? [
                [
                  "Bishop",
                  directory.find((b) => b.id === p.bishopId)?.name ||
                    `${p.bishopName || "Not given"} (as typed, not yet matched)`,
                ],
              ]
            : []),
          ...(record.submittedAt
            ? [["Submitted", new Date(record.submittedAt).toLocaleString()]]
            : []),
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
function Filters({ filter, setFilter, roles = false }) {
  return (
    <div className="reg-filters">
      <input
        aria-label="Search registrations"
        placeholder="Search by name, email or church"
        type="search"
        value={filter.q}
        onChange={(e) => setFilter({ ...filter, q: e.target.value })}
      />
      <select
        aria-label="Filter organization"
        value={filter.org}
        onChange={(e) => setFilter({ ...filter, org: e.target.value })}
      >
        <option value="">All organizations</option>
        {ORGANIZATIONS.map((o) => (
          <option key={o} value={o}>{orgLabel(o)}</option>
        ))}
      </select>
      {roles && (
        <select
          aria-label="Filter role"
          value={filter.role}
          onChange={(e) => setFilter({ ...filter, role: e.target.value })}
        >
          <option value="">All roles</option>
          <option value="bishop">Bishops</option>
          <option value="pastor">Pastors</option>
        </select>
      )}
    </div>
  );
}
const filtered = (records, f) =>
  records.filter(
    (r) =>
      (!f.org || r.data.organization === f.org) &&
      (!f.role || r.data.role === f.role) &&
      normalName([r.data.name, r.data.email, r.data.church].join(" ")).includes(
        normalName(f.q),
      ),
  );
const PAGE = 60;
// Bishops are few enough to show at once; pastors page in blocks of 300.
const pageFor = (role) => (role === "bishop" ? Infinity : 300);
const initials = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
// A registration photo is private and fetched through a signed URL; an existing
// record's portrait is a published asset.
// Grids load a 240px thumbnail (a tenth of the weight of the 640px portrait); dialogs ask for the full file with `full`.
const thumbOf = (image) => image.replace(/^(assets\/(?:portraits|bishops|pastors))\/([^/]+)\.[^.]+$/, "$1/thumbs/$2.webp");
function Portrait({ person, className = "", full = false }) {
  if (person.photo)
    return (
      <Media path={person.photo} alt={person.name} className={className} />
    );
  if (person.image) {
    const src = `${base}/${full ? person.image : thumbOf(person.image)}`;
    return (
      <img
        className={className}
        style={{ cssText: portraitStyle(person.image) }}
        src={src}
        onError={(e) => { if (!full && e.currentTarget.src.includes("/thumbs/")) e.currentTarget.src = `${base}/${person.image}`; }}
        alt={person.name}
        loading="lazy"
        decoding="async"
      />
    );
  }
  if (person.standing === false)
    return (
      <div className={`reg-placeholder reg-unconfirmed ${className}`} role="img" aria-label={`${person.name} · not yet confirmed`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7v1H4z" /></svg>
      </div>
    );
  return (
    <div className={`reg-placeholder ${className}`} aria-label={person.name}>
      {initials(person.name) || "◯"}
    </div>
  );
}
// Red means: a bishop has not registered yet, or a pastor has not been claimed yet.
const statusWords = (p) =>
  p.role === "bishop"
    ? p.updated
      ? "Registered this year"
      : "Not yet registered"
    : p.updated
      ? "Claimed by their bishop"
      : "Not yet claimed";
function Dot({ person }) {
  const words = statusWords(person);
  return (
    <span
      className={`reg-dot ${person.updated ? "updated" : "stale"}`}
      title={words}
    >
      <span className="reg-visually-hidden">{words}</span>
    </span>
  );
}
const personMatches = (p, f) =>
  (!f.org || p.organization === f.org) &&
  (!f.group || p.group === f.group) &&
  (!f.denomination || (f.denomination === NO_DENOMINATION ? p.denominationListed === false : p.denomination === f.denomination)) &&
  (!f.country || p.country === f.country) &&
  (!f.state ||
    (f.state === "updated" && p.updated) ||
    (f.state === "stale" && !p.updated)) &&
  (!f.q ||
    normalName(`${p.name} ${p.city} ${p.country} ${p.denomination}`).includes(
      normalName(f.q),
    ));
function DirectoryFilters({ filter, setFilter, options }) {
  const set = (patch) => setFilter({ ...filter, ...patch });
  return (
    <div className="reg-filters">
      <input
        aria-label="Search people"
        placeholder="Search by name, city or denomination"
        type="search"
        value={filter.q}
        onChange={(e) => set({ q: e.target.value })}
      />
      <select
        aria-label="Filter organization"
        value={filter.org}
        onChange={(e) =>
          set({ org: e.target.value, group: "", denomination: "", country: "" })
        }
      >
        <option value="">All organizations</option>
        {options.organization.map((o) => (
          <option key={o} value={o}>{orgLabel(o)}</option>
        ))}
      </select>
      {"group" in filter && (
        <select
          aria-label="Filter group"
          value={filter.group}
          onChange={(e) => set({ group: e.target.value, denomination: "" })}
        >
          <option value="">All groups</option>
          {options.group.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      )}
      <select
        aria-label="Filter denomination"
        value={filter.denomination}
        onChange={(e) => set({ denomination: e.target.value })}
      >
        <option value="">All denominations</option>
        {options.unlisted > 0 && <option value={NO_DENOMINATION}>No denomination · {options.unlisted.toLocaleString()}</option>}
        {options.denomination.map((d) => (
          <option key={d} value={d}>{caps(d)}</option>
        ))}
      </select>
      {"country" in filter && (
        <select
          aria-label="Filter country"
          value={filter.country}
          onChange={(e) => set({ country: e.target.value })}
        >
          <option value="">All countries</option>
          {options.country.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      )}
      {"state" in filter && (
        <select
          aria-label="Filter updated people"
          value={filter.state}
          onChange={(e) => set({ state: e.target.value })}
        >
          <option value="">Everyone</option>
          <option value="updated">Registered · claimed</option>
          <option value="stale">Not yet registered · claimed</option>
        </select>
      )}
    </div>
  );
}
// Choices come from the records in view, so an organization narrows the
// denominations and countries offered.
const filterOptions = (list, org, group = "") => {
  const scope = list.filter((p) => (!org || p.organization === org) && (!group || p.group === group));
  const unique = (field, from) =>
    [...new Set(from.map((p) => p[field]).filter(Boolean))].sort();
  return {
    organization: unique("organization", list),
    group: unique("group", scope),
    // Only denominations that still exist; the rest fall under "No denomination".
    denomination: unique("denomination", scope.filter((p) => p.denominationListed !== false)),
    unlisted: scope.filter((p) => p.denominationListed === false).length,
    country: unique("country", scope),
  };
};
// The same duplicate rule the server applies, so the preview matches what will be kept.
const uniqueRows = (rows) =>
  rows.filter((r, i) => !rows.slice(0, i).some((x) => namesAlike(x.name, r.name) && dobClose(x.dob, r.dob)));
// A sheet of blank rows to fill in: full name and date of birth per pastor.
// Empty rows are ignored; a spreadsheet can fill rows too; more rows on demand.
const blankSlots = (n) => Array.from({ length: n }, () => ({ name: "", dob: "" }));
function PastorSlots({ slots, setSlots, count = 4 }) {
  const update = (i, key, value) => setSlots((rows) => rows.map((r, k) => (k === i ? { ...r, [key]: value } : r)));
  const problem = (r) => {
    if (!r.name.trim() && !r.dob) return "";
    if (r.name.trim().split(/\s+/).length < 2) return "Full name needed (first and last).";
    if (!r.dob) return "Date of birth needed.";
    return "";
  };
  return (
    <div className="reg-slots">
      <div className="reg-slot head" aria-hidden="true"><span>#</span><span>Pastor’s full name</span><span>Date of birth</span></div>
      {slots.map((r, i) => (
        <div key={i} className={`reg-slot ${problem(r) ? "bad" : r.name.trim() && r.dob ? "ok" : ""}`}>
          <span className="reg-slot-n">{i + 1}</span>
          <input aria-label={`Pastor ${i + 1} full name`} value={r.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Full name" autoComplete="off" />
          <input aria-label={`Pastor ${i + 1} date of birth`} type="date" value={r.dob} onChange={(e) => update(i, "dob", e.target.value)} max={new Date().toISOString().slice(0, 10)} />
          {problem(r) && <small className="reg-slot-error">{problem(r)}</small>}
        </div>
      ))}
      <button type="button" className="reg-text" onClick={() => setSlots((rows) => [...rows, ...blankSlots(count)])}>+ Add {count} more rows</button>
    </div>
  );
}
// Rows that are actually filled in, as the list expects them.
const filledSlots = (slots) => slots.filter((r) => r.name.trim() && r.dob).map((r) => ({ name: r.name.trim().replace(/\s+/g, " "), dob: r.dob }));
const slotsComplete = (slots) => slots.every((r) => (!r.name.trim() && !r.dob) || (r.name.trim().split(/\s+/).length >= 2 && r.dob));
// A clean, read-only look at rows about to be submitted: name and date of birth.
function RowsTable({ rows, title, onRemove }) {
  if (!rows.length) return null;
  return (
    <div className="reg-rows">
      {title && <p className="reg-rows-title">{title} <b>{rows.length}</b></p>}
      <div className="reg-rows-scroll">
        <table>
          <thead><tr><th>#</th><th>Full name</th><th>Date of birth</th>{onRemove && <th />}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}><td>{i + 1}</td><td>{r.name}</td><td>{longDate(r.dob)}</td>{onRemove && <td><button type="button" className="reg-text danger" onClick={() => onRemove(i)} aria-label={`Remove ${r.name}`}>×</button></td>}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
// Given names in normal weight, the surname bold: lists are ordered by surname.
function PersonName({ name }) {
  const { given, surname } = splitName(name);
  return <>{given && <span className="reg-given">{given} </span>}{surname}</>;
}
function PeopleGrid({ list, limit, onMore, onOpen, dots = true, compact = false, counts = null }) {
  return (
    <>
      <div className={`reg-people-grid ${compact ? "compact" : ""}`}>
        {list.slice(0, limit).map((p) => p.standing === false ? (
          <button className="reg-person-card reg-dark" key={p.id} onClick={() => onOpen(p)} aria-label={`${p.role === "bishop" ? "Bishop" : "Pastor"} ${p.n || ""} · not yet approved`}>
            <span className="reg-person-portrait">
              {p.n && <span className="reg-person-n">{p.n}</span>}
              <Portrait person={p} />
            </span>
          </button>
        ) : (
          <button
            className="reg-person-card"
            key={p.id}
            onClick={() => onOpen(p)}
          >
            <span className="reg-person-portrait">
              {p.n && <span className="reg-person-n">{p.n}</span>}
              <Portrait person={p} />
            </span>
            <div className="reg-person-name">
              <h3><PersonName name={p.name} /></h3>
              {p.role === "bishop" && counts?.get(p.id) > 0 && <span className="reg-count-pill">{overseeing(counts.get(p.id))}</span>}
              {dots && <Dot person={p} />}
              {dots && p.denominationListed === false && <small className="reg-no-denomination">No denomination{p.denomination ? ` · was ${p.denomination}` : ""}</small>}
            </div>
          </button>
        ))}
      </div>
      {list.length > limit && (
        <button className="reg-secondary full" onClick={onMore}>
          Show more · {(list.length - limit).toLocaleString()} remaining
        </button>
      )}
    </>
  );
}
const directoryHeading = (role) =>
  `${role === "bishop" ? "Bishops’" : "Pastors’"} Roll of Good Standing`;
// Members open each roll from the sidebar; the tab name doubles as the heading.
const ROLL_TABS = ["Bishops in Good Standing", "Pastors in Good Standing"];
const rollTabRole = (tab) => (tab === ROLL_TABS[0] ? "bishop" : tab === ROLL_TABS[1] ? "pastor" : null);
function Directory({ state, year, role, setRole, perform, actor, mode = "original" }) {
  const [filter, setFilter] = useState({
      q: "",
      org: "",
      group: "",
      denomination: "",
      state: "",
    }),
    [limit, setLimit] = useState(PAGE),
    [selectedId, setSelectedId] = useState(null);
  const all = useMemo(() => {
    const catalog = catalogOf(state);
    const everyone = directoryPeople(state, people, year).map((p) => ({ ...p, ...(state.contacts?.[p.id] || {}), denominationListed: denominationListed(catalog, p) }));
    // The registered view is what the public roll counts: people confirmed this year.
    return mode === "registered"
      ? everyone.filter((p) => p.registration?.status === "confirmed")
      : everyone;
  }, [state, year, mode]);
  // The open record follows the live list, so office edits show at once and a deleted record closes.
  const selected = selectedId ? all.find((p) => p.id === selectedId) || null : null;
  const setSelected = (p) => setSelectedId(p ? p.id : null);
  const trail = useTrail(selected, setSelected);
  const scope = useMemo(
    () => all.filter((p) => personMatches(p, filter)),
    [all, filter],
  );
  const list = useMemo(
    () => scope.filter((p) => p.role === role).sort(bySurname),
    [scope, role],
  );
  useEffect(() => setLimit(pageFor(role)), [filter, role]);
  const options = useMemo(
    () => filterOptions(all, filter.org, filter.group),
    [all, filter.org, filter.group],
  );
  // Pastors a bishop confirmed on this cycle's annual list.
  const linkedPastors = (bishop) => {
    const account =
      bishop.registration?.userId ||
      state.profiles.find((x) => x.bishopApproved && x.referenceId === bishop.id)?.id;
    if (!account) return [];
    const keys = new Set([bishop.id, account]);
    const ids = new Set(
      state.rosters
        .filter((r) => r.year === year && r.bishopId === account && r.status === "active" && r.referenceId)
        .map((r) => r.referenceId),
    );
    // Pastors linked to an old record, plus anyone who registered and was claimed under this bishop this year.
    return all.filter(
      (q) =>
        q.role === "pastor" &&
        (ids.has(q.id) || (q.registration?.status === "confirmed" && keys.has(q.registration.data.bishopId))),
    );
  };
  const [adding, setAdding] = useState(false);
  return (
    <>
      {perform && (
        <div className="reg-office-bar">
          <button className="reg-secondary" onClick={() => setAdding(true)}>
            {mode === "registered" ? "+ Add a person to the roll" : "+ Add a record"}
          </button>
        </div>
      )}
      {adding && (
        <Dialog title={mode === "registered" ? "Add a person to the roll" : "Add a record"} onClose={() => setAdding(false)}>
          <AddPersonForm state={state} mode={mode} onDone={() => setAdding(false)} perform={perform} actor={actor} />
        </Dialog>
      )}
      <div className="reg-stats">
        {[
          ["Bishops", scope.filter((p) => p.role === "bishop").length],
          ["Pastors", scope.filter((p) => p.role === "pastor").length],
          ["Bishops and pastors", scope.length],
          [
            role === "bishop" ? "Registered this year" : "Claimed by a bishop",
            list.filter((p) => p.updated).length,
          ],
          [
            role === "bishop" ? "Not yet registered" : "Not yet claimed",
            list.filter((p) => !p.updated).length,
          ],
        ].map(([label, n]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{n.toLocaleString()}</strong>
          </div>
        ))}
      </div>
      <DirectoryFilters
        filter={filter}
        setFilter={setFilter}
        options={options}
      />
          <div className="reg-switch" role="group" aria-label="Role">
            {[
              ["bishop", "Bishops"],
              ["pastor", "Pastors"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-label={label}
                aria-pressed={role === value}
                className={role === value ? "active" : ""}
                onClick={() => setRole(value)}
              >
                {label}{" "}
                <strong>
                  {scope.filter((p) => p.role === value).length.toLocaleString()}
                </strong>
              </button>
            ))}
          </div>
          {list.length ? (
            <PeopleGrid
          compact={role === "pastor"}
              list={list}
              limit={limit}
              onMore={() => setLimit((n) => n + 300)}
              onOpen={setSelected}
            />
          ) : (
            <Empty title={`No ${role === "bishop" ? "bishops" : "pastors"} found`}>
              Try changing your search or filters.
            </Empty>
          )}
      {selected && (
        <Dialog title={selected.name} onClose={trail.close} onBack={trail.back} backLabel={trail.backLabel} {...stepper(list, selected, trail.step)}>
          <RecordDetails
            person={selected}
            under={linkedPastors(selected)}
            onOpen={trail.open}
            perform={perform}
            state={state}
            actor={actor}
          />
        </Dialog>
      )}
    </>
  );
}
function RecordDetails({ person: p, under = [], onOpen, perform, state, actor }) {
  const changed = (field) =>
    p.recorded && p.recorded[field] && p.recorded[field] !== p[field];
  const r = p.registration;
  const canChoose = Boolean(r && r.data?.photo && p.image && perform);
  const showing = r?.displayPhoto === "reference" ? "reference" : "upload";
  return (
    <>
      <div className="reg-record-hero centred">
        <Portrait person={p} className="reg-record-photo large" full />
        {r?.photoChangedAt && <p className="reg-attire-flag warn">Photo changed after approval · {shortDateTime(r.photoChangedAt)}</p>}
        {r?.data?.photoCheck && attireWords(r.data.photoCheck) && (
          <p className={`reg-attire-flag ${r.data.photoCheck.verdict === "ok" ? "ok" : "warn"}`}>{attireWords(r.data.photoCheck)}</p>
        )}
        {canChoose && (
          <div className="reg-photo-choice">
            <p>Which photo should the roll show?</p>
            {[
              ["upload", "New upload", { photo: r.data.photo, name: p.name }],
              ["reference", "Existing photo", { image: p.image, name: p.name }],
            ].map(([source, label, person]) => (
              <button
                key={source}
                className={showing === source ? "active" : ""}
                onClick={() =>
                  perform(
                    "choosePhoto",
                    { userId: r.userId, source },
                    `The roll now shows the ${label.toLowerCase()}.`,
                  )
                }
              >
                <Portrait person={person} />
                <span>
                  {label}
                  {showing === source ? " · showing" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
        <div>
          <span className="reg-eyebrow">{(p.title || p.role).toUpperCase()}</span>
          <h2>{p.name}</h2>
          <p className="reg-record-country">
            {[p.city, p.country].filter(Boolean).join(", ") || "Location not recorded"}
          </p>
          {p.denomination && (
            <p className="reg-record-denomination">
              <DenominationLogo person={p} catalog={catalogOf(state)} />
              <span>{caps(p.denomination)}</span>
            </p>
          )}
          {normalName(orgLabel(p.organization)) !== normalName(p.denomination || "") && normalName(p.organization) !== normalName(p.denomination || "") && (
            <p className="reg-record-line">{orgLabel(p.organization)}</p>
          )}
          <span className={`reg-badge ${p.updated ? "verified" : "unclaimed"}`}>
            {statusWords(p)}
          </span>
        </div>
      </div>
      <dl className="reg-details">
        {[
          // Everything the roster holds on this person.
          ["Record", p.id],
          ["Title", p.title || "—"],
          ["Organization", p.organization || "—"],
          ["Denomination", caps(p.denomination) || "—"],
          ["Branch", p.branch || "—"],
          ["City", p.city || "—"],
          ["Country", p.country || "—"],
          ["Email", p.email || "—"],
          ["Phone", p.phone || "—"],
          ["Photo on file", p.image ? "Yes" : "No"],
          ...(changed("email")
            ? [["Previous email on record", p.recorded.email]]
            : []),
          ...(changed("phone")
            ? [["Previous phone on record", p.recorded.phone]]
            : []),
          ...(p.role === "pastor" ? [["Bishop", p.bishop || "Not recorded"]] : []),
          ...(p.updatedAt
            ? [["Updated", new Date(p.updatedAt).toLocaleString()]]
            : []),
          ...(p.registration
            ? [
                ["Registration", statusLabel[p.registration.status]],
                ["Payment", statusLabel[p.registration.payment]],
                // Then every field they typed on the form this year.
                ...Object.entries(p.registration.data || {})
                  .filter(
                    ([k, v]) =>
                      v !== "" && v != null && typeof v !== "object" &&
                      !["photo", "photoConfirmed", "referenceId", "bishopId", "firstName", "lastName", "role"].includes(k),
                  )
                  .map(([k, v]) => [
                    `Submitted ${fieldLabel[k] || k}`,
                    typeof v === "boolean" ? (v ? "Yes" : "No") : String(v),
                  ]),
              ]
            : []),
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {p.role === "bishop" && (
        <PastorsUnder bishop={p} extra={under} onOpen={onOpen} dots />
      )}
      {perform && state && (p.registration
        ? <OfficeEditor registration={p.registration} state={state} perform={perform} actor={actor} />
        : <ReferenceEditor person={p} state={state} perform={perform} actor={actor} />)}
    </>
  );
}
// ---- Office editing ----------------------------------------------------
// Every detail of a registration is editable by the office; each save is one
// `officeEdit` action and lands in History with what changed.
function OfficeEditor({ registration: r, state, perform, actor }) {
  const [open, setOpen] = useState(false),
    [form, setForm] = useState(null),
    [note, setNote] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false),
    [busyPhoto, setBusyPhoto] = useState(false);
  const catalog = state.catalog || catalogOf(state);
  const d = r.data;
  const begin = () => { setForm({ firstName: d.firstName || "", lastName: d.lastName || "", title: d.title || "", gender: d.gender || "", organization: d.organization || "", denomination: d.denomination || "", phone: d.phone || "", dob: d.dob || "", country: d.country || "", city: d.city || "", email: d.email || "", bishopId: d.bishopId || "", role: d.role }); setOpen(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v, ...(k === "organization" ? { denomination: "" } : {}) }));
  const save = () => perform("officeEdit", { userId: r.userId, data: form }, "Details updated.").then((ok) => ok && setOpen(false));
  const statuses = d.role === "bishop" ? ["confirmed", "pending", "denied"] : ["confirmed", "unclaimed", "removed"];
  const bishops = state.bishops || [];
  return (
    <section className="reg-office-editor">
      <h3>Office tools</h3>
      <div className="reg-office-actions">
        <button type="button" className="reg-secondary" onClick={() => (open ? setOpen(false) : begin())}>{open ? "Close editor" : "Edit details"}</button>
        <label className={`reg-secondary reg-file-button ${busyPhoto ? "busy" : ""}`}>
          {busyPhoto ? "Uploading…" : "Replace photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busyPhoto} onChange={(e) => {
            const file = e.target.files?.[0]; e.target.value = "";
            if (!file) return;
            setBusyPhoto(true);
            api.upload(actor, file, "portrait").then((key) => perform("officeEdit", { userId: r.userId, data: { photo: key } }, "Photo replaced.")).finally(() => setBusyPhoto(false));
          }} />
        </label>
        <button type="button" className="reg-secondary" onClick={() => perform("setVisibility", { userId: r.userId, hidden: !r.hidden }, r.hidden ? "Shown on the public roll again." : "Hidden from the public roll.")}>
          {r.hidden ? "Show on public roll" : "Hide from public roll"}
        </button>
        {r.payment === "verified" ? (
          r.paymentMethod !== "paystack" && <button type="button" className="reg-secondary" onClick={() => perform("markPaid", { userId: r.userId, paid: false }, "Marked unpaid.")}>Mark unpaid</button>
        ) : (
          <button type="button" className="reg-secondary" onClick={() => perform("markPaid", { userId: r.userId, paid: true, note: note || "Received by the office" }, "Marked as paid.")}>Mark paid (other means)</button>
        )}
      </div>
      <div className="reg-office-actions">
        <label className="reg-inline">Status
          <select value={r.status} onChange={(e) => perform("setStatus", { userId: r.userId, status: e.target.value }, `Status set to ${statusLabel[e.target.value] || e.target.value}.`)}>
            {statuses.map((x) => <option key={x} value={x}>{statusLabel[x] || x}</option>)}
          </select>
        </label>
        {r.payment !== "verified" && <input className="reg-inline-input" placeholder="Payment note (e.g. cash, 12 Oct)" value={note} onChange={(e) => setNote(e.target.value)} />}
        {!confirmDelete ? (
          <button type="button" className="reg-text danger" onClick={() => setConfirmDelete(true)}>Delete this registration</button>
        ) : (
          <span className="reg-confirm-inline">Delete {d.name}’s {r.year} registration? Their account stays.
            <button type="button" className="reg-secondary danger" onClick={() => perform("deleteRegistration", { userId: r.userId }, "Registration deleted.")}>Yes, delete</button>
            <button type="button" className="reg-text" onClick={() => setConfirmDelete(false)}>Keep</button>
          </span>
        )}
      </div>
      {open && form && (
        <div className="reg-fields reg-office-form">
          <Field label="Ministerial category"><select value={form.role} onChange={(e) => set("role", e.target.value)}><option value="bishop">Bishop</option><option value="pastor">Pastor</option></select></Field>
          {form.role === "pastor" && <Field label="Title"><select value={titleFor(form)} onChange={(e) => set("title", e.target.value)}>{PASTOR_TITLES.filter((t) => t !== "Lady Rev." || form.gender === "female").map((t) => <option key={t}>{t}</option>)}</select></Field>}
          <Field label="Organization"><select value={form.organization} onChange={(e) => set("organization", e.target.value)}><option value="">Select</option>{catalog.organizations.map((o) => <option key={o} value={o}>{orgLabel(o)}</option>)}</select></Field>
          <Field label="First name"><input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
          <Field label="Last name"><input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
          <Field label="Gender"><select value={form.gender} onChange={(e) => set("gender", e.target.value)}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option></select></Field>
          <Field label="Email address"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="WhatsApp number"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Date of birth"><input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
          {(catalog.denominations[form.organization] || []).length > 0 && (
            <Field label="Denomination"><select value={form.denomination} onChange={(e) => set("denomination", e.target.value)}><option value="">Select</option>{catalog.denominations[form.organization].map((x) => <option key={x} value={x}>{caps(x)}</option>)}</select></Field>
          )}
          <Field label="Country"><Choice value={form.country} options={[...new Set(overlayReferences(people, state).map((x) => x.country).filter(Boolean))].sort()} onChange={(v) => set("country", v)} blank="Choose…" /></Field>
          <Field label="City"><input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
          {form.role === "pastor" && (
            <Field label="Bishop"><select value={form.bishopId} onChange={(e) => set("bishopId", e.target.value)}><option value="">None</option>{bishops.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          )}
          <div className="reg-form-actions wide">
            <button type="button" className="reg-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="reg-primary" onClick={save}>Save changes</button>
          </div>
        </div>
      )}
    </section>
  );
}
// Corrections to a record from the original data: fields, hide/show, delete/restore.
// A select that always offers the record's current value, even when it is
// not in the list, so opening the editor never silently changes a field.
function Choice({ value, options, onChange, labelOf = (v) => v, blank = "", ...rest }) {
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select {...rest} value={value} onChange={(e) => onChange(e.target.value)}>
      {blank !== null && <option value="">{blank}</option>}
      {all.map((o) => <option key={o} value={o}>{labelOf(o)}</option>)}
    </select>
  );
}
const TITLES = ["Bishop", "Pastor", "Reverend", "Dr", "Mother", "Episcopal Sister", "Lady Pastor"];
function ReferenceEditor({ person: p, state, perform, actor }) {
  const [open, setOpen] = useState(false),
    [form, setForm] = useState(null);
  const hidden = (state.hidden || []).includes(p.id), deleted = Boolean((state.overrides || {})[p.id]?.deleted);
  const begin = () => { setForm(Object.fromEntries(REFERENCE_FIELDS.filter((f) => f !== "photo").map((f) => [f, p[f] || ""]))); setOpen(true); };
  const set = (f) => (v) => setForm((x) => ({ ...x, [f]: v, ...(f === "organization" ? { denomination: "" } : {}) }));
  const [busyPhoto, setBusyPhoto] = useState(false), [photoProblem, setPhotoProblem] = useState("");
  // Choices: the office's organizations and denominations, plus whatever the
  // original data already uses, so old spellings stay selectable.
  const catalog = state.catalog || catalogOf(state);
  const roster = overlayReferences(people, state);
  const unique = (list) => [...new Set(list.filter(Boolean))].sort();
  const denominations = form && unique([...(catalog.denominations[form.organization] || []), ...roster.filter((x) => x.organization === form.organization).map((x) => x.denomination)]);
  const countries = unique(roster.map((x) => x.country));
  const bishops = unique(roster.filter((x) => x.role === "bishop" && !x.deleted).map((x) => x.name));
  return (
    <section className="reg-office-editor">
      <h3>Office tools · original record</h3>
      <div className="reg-office-actions">
        <button type="button" className="reg-secondary" onClick={() => (open ? setOpen(false) : begin())}>{open ? "Close editor" : "Edit record"}</button>
        <label className={`reg-secondary reg-file-button ${busyPhoto ? "busy" : ""}`}>
          {busyPhoto ? "Uploading…" : p.photo || p.image ? "Replace photo" : "Add photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busyPhoto} onChange={(e) => {
            const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setBusyPhoto(true);
            setPhotoProblem("");
            api.upload(actor, file, "portrait").then((key) => perform("editReference", { referenceId: p.id, fields: { photo: key } }, "Photo updated.")).catch((err) => setPhotoProblem(err.message || "The photo could not be uploaded.")).finally(() => setBusyPhoto(false));
          }} />
        </label>
        {photoProblem && <small className="reg-error-text" role="alert">{photoProblem}</small>}
        <button type="button" className="reg-secondary" onClick={() => perform("hideReference", { referenceId: p.id, hidden: !hidden }, hidden ? "Shown on the public roll again." : "Hidden from the public roll.")}>{hidden ? "Show on public roll" : "Hide from public roll"}</button>
        <button type="button" className={`reg-secondary ${deleted ? "" : "danger"}`} onClick={() => perform("deleteReference", { referenceId: p.id, deleted: !deleted }, deleted ? "Record restored." : "Record deleted from the directory.")}>{deleted ? "Restore record" : "Delete record"}</button>
      </div>
      {open && form && (
        <div className="reg-fields reg-office-form">
          <Field label="Full name"><input value={form.name} onChange={(e) => set("name")(e.target.value)} /></Field>
          <Field label="Title"><Choice value={form.title} options={TITLES} onChange={set("title")} blank={null} /></Field>
          <Field label="Organization"><Choice value={form.organization} options={catalog.organizations} onChange={set("organization")} labelOf={orgLabel} blank="Choose…" /></Field>
          <Field label="Denomination"><Choice value={form.denomination} options={denominations} onChange={set("denomination")} blank="None" /></Field>
          <Field label="Group"><Choice value={form.group} options={Object.keys(catalog.groups || {}).filter((g) => !form.organization || catalog.groups[g].organization === form.organization)} onChange={set("group")} blank="By denomination" /></Field>
          <Field label="City"><input value={form.city} onChange={(e) => set("city")(e.target.value)} /></Field>
          <Field label="Country"><Choice value={form.country} options={countries} onChange={set("country")} blank="Choose…" /></Field>
          {p.role !== "bishop" && (
            <Field label="Bishop"><Choice value={form.bishop} options={bishops} onChange={set("bishop")} blank="None listed" /></Field>
          )}
          <Field label="Branch"><input value={form.branch} onChange={(e) => set("branch")(e.target.value)} /></Field>
          <div className="reg-form-actions wide">
            <button type="button" className="reg-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="reg-primary" onClick={() => perform("editReference", { referenceId: p.id, fields: form }, "Record updated.").then((ok) => ok && setOpen(false))}>Save changes</button>
          </div>
        </div>
      )}
    </section>
  );
}
// A person added by the office: straight onto this year's roll, or into the original data.
function AddPersonForm({ state, mode, perform, onDone, actor }) {
  const catalog = state.catalog || catalogOf(state);
  const [f, setF] = useState({ role: "pastor", firstName: "", lastName: "", gender: "", organization: catalog.organizations[0] || "", denomination: "", city: "", country: "", phone: "", email: "", dob: "", bishopId: "", bishop: "", title: "" });
  const [file, setFile] = useState(null), [preview, setPreview] = useState(""), [busy, setBusy] = useState(false), [problem, setProblem] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === "organization" ? { denomination: "" } : {}) }));
  const roster = overlayReferences(people, state);
  const unique = (list) => [...new Set(list.filter(Boolean))].sort();
  const countries = unique(roster.map((x) => x.country));
  const bishopNames = unique(roster.filter((x) => x.role === "bishop").map((x) => x.name));
  const choose = (e) => {
    const next = e.target.files?.[0]; e.target.value = "";
    if (!next) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next)); setProblem("");
  };
  const submit = async () => {
    setBusy(true); setProblem("");
    try {
      const photo = file ? await api.upload(actor, file, "portrait") : "";
      const ok = mode === "registered"
        ? await perform("addPerson", { data: { ...f, photo } }, "Added to the roll.")
        : await perform("addReference", { fields: { role: f.role, name: `${f.firstName} ${f.lastName}`.trim(), title: f.title, organization: f.organization, denomination: f.denomination, city: f.city, country: f.country, bishop: f.bishop, photo } }, "Added to the original data.");
      if (ok) onDone();
    } catch (err) { setProblem(err.message || "The photo could not be uploaded."); } finally { setBusy(false); }
  };
  return (
    <div className="reg-fields reg-office-form">
      <Field label="Ministerial category"><select value={f.role} onChange={(e) => set("role", e.target.value)}><option value="bishop">Bishop</option><option value="pastor">Pastor</option></select></Field>
      <Field label="Organization"><select value={f.organization} onChange={(e) => set("organization", e.target.value)}>{catalog.organizations.map((o) => <option key={o} value={o}>{orgLabel(o)}</option>)}</select></Field>
      <Field label="First name"><input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
      <Field label="Last name"><input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
      {mode === "registered" && <Field label="Gender"><select value={f.gender} onChange={(e) => set("gender", e.target.value)}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option></select></Field>}
      {(catalog.denominations[f.organization] || []).length > 0 && (
        <Field label="Denomination"><select value={f.denomination} onChange={(e) => set("denomination", e.target.value)}><option value="">Select</option>{catalog.denominations[f.organization].map((x) => <option key={x} value={x}>{caps(x)}</option>)}</select></Field>
      )}
      <Field label="Country"><Choice value={f.country} options={countries} onChange={(v) => set("country", v)} blank="Choose…" /></Field>
      <Field label="City"><input value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
      {mode === "registered" ? (
        <>
          <Field label="Email (optional)"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="WhatsApp number (optional)"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Date of birth (optional)"><input type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
          {f.role === "pastor" && <Field label="Bishop (optional)"><select value={f.bishopId} onChange={(e) => set("bishopId", e.target.value)}><option value="">None</option>{(state.bishops || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
        </>
      ) : (
        <>
          <Field label="Title"><Choice value={f.title || (f.role === "bishop" ? "Bishop" : "Pastor")} options={TITLES} onChange={(v) => set("title", v)} blank={null} /></Field>
          {f.role === "pastor" && <Field label="Bishop (optional)"><Choice value={f.bishop} options={bishopNames} onChange={(v) => set("bishop", v)} blank="None listed" /></Field>}
        </>
      )}
      <div className="reg-field wide reg-add-photo">
        <label>Photo</label>
        <div className="reg-add-photo-row">
          {preview ? <img src={preview} alt="" className="reg-add-photo-preview" /> : <div className="reg-placeholder reg-add-photo-preview">◯</div>}
          <label className="reg-secondary reg-file-button">
            {file ? "Choose a different photo" : "Choose a photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} />
          </label>
          {file && <button type="button" className="reg-text" onClick={() => { URL.revokeObjectURL(preview); setFile(null); setPreview(""); }}>Remove</button>}
        </div>
        <small>JPG, PNG or WebP, under 5 MB. Optional; a placeholder shows until a photo is added.</small>
      </div>
      {problem && <p className="reg-field wide reg-error-text" role="alert">{problem}</p>}
      <div className="reg-form-actions wide">
        <button type="button" className="reg-secondary" onClick={onDone} disabled={busy}>Cancel</button>
        <button type="button" className="reg-primary" onClick={submit} disabled={busy}>{busy ? "Adding…" : "Add"}</button>
      </div>
    </div>
  );
}
// A list row's name, date of birth and (office) owning bishop.
function RosterRowEditor({ row, state, office, perform, onDone }) {
  const [name, setName] = useState(row.name), [dob, setDob] = useState(row.dob || ""), [bishopId, setBishopId] = useState("");
  const owner = (state.bishops || []).find((b) => b.accountId === row.bishopId);
  return (
    <div className="reg-fields reg-office-form">
      <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Date of birth"><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
      {office && (
        <Field label="Move to another bishop" hint={owner ? `Currently under ${owner.name}.` : undefined}>
          <select value={bishopId} onChange={(e) => setBishopId(e.target.value)}><option value="">Keep current bishop</option>{(state.bishops || []).filter((b) => b.accountId !== row.bishopId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        </Field>
      )}
      <div className="reg-form-actions wide">
        <button type="button" className="reg-secondary" onClick={onDone}>Cancel</button>
        <button type="button" className="reg-primary" onClick={async () => {
          const ok = await perform("editRoster", { id: row.id, name, dob }, "List entry updated.");
          if (ok && bishopId) await perform("moveRoster", { id: row.id, bishopId }, "Pastor moved to the other bishop’s list.");
          if (ok) onDone();
        }}>Save</button>
      </div>
    </div>
  );
}
// Members search the published roster: portrait, name, title, country,
// denomination, branch and who oversees whom. Contact details and dates of
// birth are removed before the roster reaches the browser.
const publicPeople = people.map(({ email, phone, ...rest }) => rest);
// Pastors whose record names this bishop as overseer (typo-tolerant). A bishop
// nobody named has no pastors listed; a pastor who named nobody sits under no one.
const bishopPastors = (bishop, from = publicPeople) => ({
  list: pastorsOf(bishop, from),
  heading: "Pastors under their oversight",
});
function PastorsUnder({ bishop, extra = [], onOpen, dots = false, from }) {
  const [limit, setLimit] = useState(24);
  const named = bishopPastors(bishop, from);
  const seen = new Set(extra.map((q) => q.id));
  const list = [...extra, ...named.list.filter((q) => !seen.has(q.id))].sort(bySurname);
  if (!list.length) return <section className="reg-record-group"><h3>No pastors under their oversight</h3></section>;
  return (
    <section className="reg-record-group">
      <h3>{named.heading}</h3>
      <div className="reg-thumb-grid">
        {list.slice(0, limit).map((q) => q.standing === false ? (
          <button key={q.id} type="button" className="reg-thumb-dark" onClick={() => onOpen?.(q)} disabled={!onOpen} aria-label="Pastor · not yet approved"><Portrait person={q} /></button>
        ) : (
          <button key={q.id} onClick={() => onOpen?.(q)} disabled={!onOpen}>
            <Portrait person={q} />
            <span className="reg-thumb-name">
              <b>{q.name}</b>
              {dots && <Dot person={q} />}
            </span>
            <small>{[q.branch && normalName(q.branch) !== normalName(q.city || "") ? q.branch : "", placeOf(q)].filter(Boolean).join(" · ")}</small>
          </button>
        ))}
      </div>
      {list.length > limit && (
        <button
          className="reg-secondary full"
          onClick={() => setLimit((n) => n + 24)}
        >
          Show more · {(list.length - limit).toLocaleString()} remaining
        </button>
      )}
    </section>
  );
}
function PublicRecord({ person: p, onOpen, from, pastors = true, catalog = null, count = 0 }) {
  return (
    <>
      <div className="reg-record-hero">
        <Portrait person={p} className="reg-record-photo" full />
        <div>
          <span className="reg-eyebrow">{(p.title || p.role).toUpperCase()}</span>
          <h2>{p.name}</h2>
          <p className="reg-record-country">
            {placeOf(p) || "Location not recorded"}
          </p>
          {p.standing !== undefined && (
            <p className={`reg-record-line reg-standing ${p.standing ? "good" : "pending"}`}>{p.standing ? "In Good Standing" : "Standing not yet confirmed"}</p>
          )}
          {p.role === "bishop" && count > 0 && <p className="reg-record-line"><span className="reg-count-pill">{overseeing(count)}</span></p>}
          {p.denomination && (
            <p className="reg-record-denomination">
              <DenominationLogo person={p} catalog={catalog || catalogOf(null)} />
              <span>{caps(p.denomination)}</span>
            </p>
          )}
          {p.role === "pastor" && p.branch && (
            <p className="reg-record-line">Branch · {p.branch}</p>
          )}
          {(p.yearAppointed || p.yearOrdained || (p.role === "bishop" && p.yearConsecrated)) && (
            <p className="reg-record-line reg-record-years">
              {[p.yearAppointed && `Appointed ${p.yearAppointed}`, p.yearOrdained && `Ordained ${p.yearOrdained}`, p.role === "bishop" && p.yearConsecrated && `Consecrated ${p.yearConsecrated}`].filter(Boolean).join(" · ")}
            </p>
          )}
          {p.role === "pastor" && (
            <p className="reg-record-line">
              Bishop · {p.bishop || "Not recorded"}
            </p>
          )}
        </div>
      </div>
      {pastors && p.role === "bishop" && p.pastors ? (
        <section className="reg-record-group">
          <h3>{p.pastors.length ? "Pastors under their oversight" : "No pastors under their oversight"}</h3>
          {p.pastors.length > 0 && (
            <div className="reg-thumb-grid">
              {p.pastors.map((q) => q.standing === false || (!q.registered && !q.photo) ? (
                <button key={q.id} type="button" className="reg-thumb-dark" onClick={() => onOpen?.({ ...q, standing: false })} disabled={!onOpen} aria-label="Pastor · not yet approved"><Portrait person={{ ...q, standing: false }} /></button>
              ) : (
                <button key={q.id} disabled>
                  <Portrait person={q} />
                  <span className="reg-thumb-name"><b>{q.name}</b></span>
                  <small>{q.registered ? placeOf(q) || "Registered" : "Not yet registered"}</small>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : pastors && p.role === "bishop" ? (
        <PastorsUnder bishop={p} onOpen={onOpen} from={from} />
      ) : null}
    </>
  );
}
// The public directory: a search bar, then two doors — Bishops and Pastors with
// their totals — before any faces are shown. Lists the existing roster until the
// office switches the source to this year's roll.
function PublicDirectory({ data, embedded = false, role: fixedRole = null }) {
  // Built once per data load, not per render: the people, then the bishop → pastor index (the
  // expensive matching), then the lit/dark flags which are the only part the face switch changes.
  const people = useMemo(() => (data.source === "roll" ? data.roll : overlayReferences(publicPeople, data)), [data.source, data.roll, data.catalog, data.year, data.hidden, data.overrides]);
  const index = useMemo(() => new Map([...pastorsByBishop(people)].map(([id, qs]) => [id, qs.map((q) => q.id)])), [people]);
  const list = useMemo(() => {
    const base = data.source !== "roll" && data.photos === "confirmed" ? withStanding(people, data.roll || []) : people;
    return base.map((p) => ({ ...p, denomination: caps(p.denomination), ...(data.catalog ? { denominationListed: denominationListed(data.catalog, p) } : {}) }));
  }, [people, data.source, data.photos, data.roll, data.catalog]);
  const [role, setRole] = useState(fixedRole),
    [q, setQ] = useState("");
  const legend = data.photos === "confirmed" && (
    <p className="reg-roll-legend">A photograph appears once a bishop or pastor is in good standing.</p>
  );
  if (!role)
    return (
      <section className={`reg-doors ${embedded ? "embedded" : ""} ${q ? "searching" : ""}`}>
        {!embedded && <h1 className="reg-doors-title">Roll of Good Standing</h1>}
        <input
          type="search"
          className="reg-doors-search"
          aria-label="Search people"
          placeholder="Search by name, city or denomination"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q ? (
          <SearchResults list={list} q={q} onPick={(r) => { setRole(r); }} />
        ) : (
        <div className="reg-doors-grid">
          {[
            ["bishop", "Bishops"],
            ["pastor", "Pastors"],
          ].map(([value, label]) => (
            <button key={value} className="reg-door" onClick={() => setRole(value)}>
              <span>{label}</span>
              <small className="reg-door-hint">Click here to see all {label.toLowerCase()} in good standing</small>
            </button>
          ))}
        </div>
        )}
        {!embedded && !q && <GoodStandingNotice />}
      </section>
    );
  return (
    <section className={embedded ? "" : "reg-public-list"}>
      {!embedded && <h1 className="reg-doors-title">Roll of Good Standing</h1>}
      {!embedded && legend}
      <div className="reg-member-roll">
        <MemberDirectory role={role || "bishop"} setRole={setRole} roll={list} index={index} initialQuery={q} switcher={!fixedRole} counts={embedded} />
      </div>
    </section>
  );
}
// Results for the single search box on the doors page: names first.
function SearchResults({ list, q }) {
  const [selected, setSelected] = useState(null);
  const trail = useTrail(selected, setSelected);
  const words = normalName(q);
  const byName = list.filter((p) => normalName(p.name).includes(words));
  const elsewhere = list.filter(
    (p) => !normalName(p.name).includes(words) && normalName(`${p.city} ${p.country} ${p.denomination}`).includes(words),
  );
  const shown = [...byName, ...elsewhere].slice(0, 60);
  return (
    <div className="reg-search-results">
      <p className="reg-small">
        {byName.length.toLocaleString()} name{byName.length === 1 ? "" : "s"}
        {elsewhere.length ? ` · ${elsewhere.length.toLocaleString()} by place or denomination` : ""}
      </p>
      {shown.length ? (
        <PeopleGrid list={shown} limit={60} onMore={() => {}} onOpen={trail.open} dots={false} />
      ) : (
        <Empty title="No one matches">Try another spelling.</Empty>
      )}
      {selected && (
        <Dialog title={selected.name} onClose={trail.close} onBack={trail.back} backLabel={trail.backLabel} {...stepper(shown, selected, trail.step)}>
          <PublicRecord person={selected} onOpen={trail.open} from={list} />
        </Dialog>
      )}
    </div>
  );
}
// Bishops are pastors too, so the pastors' list carries everyone; the bishops' list only bishops.
const inRole = (p, role) => role === "pastor" || p.role === role;
// The pastors shown under a bishop: the list they uploaded this year (lit once registered with a photo), then pastors whose record names them.
const pastorsUnder = (b, byBishop) => {
  const uploaded = (b.pastors || []).map((q) => ({ id: q.id, role: "pastor", name: q.name, photo: q.photo || "", image: "", city: q.city || "", country: q.country || "", standing: Boolean(q.registered && q.photo), bishop: b.name }));
  return [...uploaded, ...(byBishop.get(b.id) || []).filter((q) => !uploaded.some((u) => namesAlike(u.name, q.name)))];
};
const overseeing = (n) => (n ? <>Overseeing <b>{n}</b> pastor{n === 1 ? "" : "s"}</> : "");
// The Roll of Good Standing notice under the two doors on the public page: the
// opening lines show, the rest unfolds behind "Read more".
function GoodStandingNotice() {
  const [open, setOpen] = useState(false);
  const one = "bishop or pastor", many = "bishops and pastors";
  return (
    <section className={`reg-standing-notice ${open ? "open" : ""}`} aria-label="Roll of Good Standing">
      <h2>Roll of Good Standing</h2>
      <h3>What it means to be in good standing</h3>
      <p>A Bishop or pastor is of good standing when he or she fulfills the requirements, expectations, and responsibilities of the office as determined. Such a Bishop or minister is entitled to exercise all rights, privileges, titles, and functions attached to that ministerial office.</p>
      {open && (<>
      <h3>What it means to not be in good standing</h3>
      <p>A Bishop or pastor who is not in good standing is not entitled to exercise the rights, privileges, titles, or functions attached to that ministerial office for the period in which they remain not in good standing.</p>
      <p>While a Bishop or pastor is not in good standing in their office, the following restrictions apply:</p>
      <ul>
        <li>You may not use the title or designation of the office in which you are not in good standing.</li>
        <li>You may not present or describe yourself as holding the office of a {one} whether privately, publicly, professionally, online, or in official correspondence.</li>
        <li>You may not attend meetings, councils, conferences, or other forums specifically reserved for {many} of good standing.</li>
        <li>You may not wear or use official garments, insignia, identification, jewellery, or other items specifically assigned to {many}.</li>
        <li>You may not exercise privileges or receive courtesies that are specifically attached to {many}.</li>
        <li>You may not perform functions or services that are reserved for {many}.</li>
        <li>You may be required to withdraw from official communication channels, including WhatsApp groups, mailing lists, directories, and other forums reserved for {many}.</li>
        <li>Your name will not appear on the Roll of {many} in Good Standing.</li>
      </ul>
      <h3>Restoration to good standing</h3>
      <p>Being not in good standing does not necessarily mean permanent removal from ministry or permanent loss of office.</p>
      <p>A Bishop or minister may be restored to good standing when the requirements and expectations of the office have been satisfied.</p>
      <p>Upon restoration, the minister's name may be returned to the Roll of ministers in Good Standing, together with the rights, functions, recognition, and privileges applicable to that office.</p>
      </>)}
      <button type="button" className="reg-text reg-read-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Show less" : "Read more"}</button>
    </section>
  );
}
function MemberDirectory({ role, setRole, roll = [], index = null, initialQuery = "", switcher = true, counts = true }) {
  const [filter, setFilter] = useState({
      q: initialQuery,
      org: "",
      group: "",
      denomination: "",
      country: "",
    }),
    [limit, setLimit] = useState(PAGE),
    [selected, setSelected] = useState(null);
  const trail = useTrail(selected, setSelected);
  // Surname order, numbered once for the whole list so a search keeps each person's number.
  const numbered = useMemo(
    () => [...roll.filter((p) => inRole(p, role))].sort(bySurname).map((p, i) => ({ ...p, n: i + 1 })),
    [roll, role],
  );
  const list = useMemo(
    () => numbered.filter((p) => personMatches(p, filter)),
    [numbered, filter],
  );
  useEffect(() => setLimit(pageFor(role)), [filter, role]);
  const options = useMemo(
    () => filterOptions(roll, filter.org, filter.group),
    [roll, filter.org, filter.group],
  );
  // The pastors' side groups pastors under their bishop while no search or filter is active.
  const filtering = Boolean(filter.q || filter.org || filter.group || filter.denomination || filter.country);
  // Bishop → pastors as roll entries. The public page hands in the id index so it survives the face switch; elsewhere it is built here.
  const byBishop = useMemo(() => {
    const byId = new Map(roll.map((p) => [p.id, p]));
    const ids = index || new Map([...pastorsByBishop(roll)].map(([id, qs]) => [id, qs.map((q) => q.id)]));
    return new Map([...ids].map(([id, list]) => [id, list.map((i) => byId.get(i)).filter(Boolean)]));
  }, [roll, index]);
  const grouped = useMemo(() => {
    if (role !== "pastor" || filtering) return null;
    const bishopsSorted = [...roll.filter((p) => p.role === "bishop")].sort(bySurname).map((p, i) => ({ ...p, n: i + 1 }));
    const taken = new Set(), blocks = [];
    for (const b of bishopsSorted) {
      const list = pastorsUnder(b, byBishop).filter((q) => !taken.has(q.id)).sort(bySurname);
      list.forEach((q) => taken.add(q.id));
      blocks.push({ bishop: b, pastors: list });
    }
    let k = 0;
    const number = (q) => ({ ...q, n: ++k });
    // Approved bishops with pastors lead; every other bishop (not yet approved, or without pastors) sits at the very bottom as a circle.
    const withPastors = blocks.filter((x) => x.pastors.length && x.bishop.standing !== false).map((x) => ({ ...x, pastors: x.pastors.map(number) }));
    const alone = blocks.filter((x) => !x.pastors.length || x.bishop.standing === false).map((x) => x.bishop);
    const rest = roll.filter((q) => q.role === "pastor" && !taken.has(q.id)).sort(bySurname).map(number);
    // The order people appear on screen, so the dialog's arrows move to the neighbour.
    const order = [...withPastors.flatMap((x) => [x.bishop, ...x.pastors]), ...alone, ...rest];
    return { withPastors, alone, rest, order };
  }, [roll, role, filtering, byBishop]);
  const pastorCount = useMemo(() => new Map(roll.filter((p) => p.role === "bishop").map((b) => [b.id, pastorsUnder(b, byBishop).length])), [roll, byBishop]);
  const unapproved = selected?.standing === false;
  // Which sequence the dialog arrows step through: the grid as shown, or one bishop's pastors.
  const [stepList, setStepList] = useState(null);
  const pick = (seq) => (p) => { setStepList(seq); setSelected(p); };
  const openUnder = (bishop) => (q) => { setStepList(pastorsOf(bishop, roll).sort(bySurname)); trail.open(q); };
  const steps = stepList || (grouped ? grouped.order : list);
  return (
    <>
      {switcher && <div className="reg-toggle" role="group" aria-label="Bishops or pastors">
        {[
          ["bishop", "Bishops"],
          ["pastor", "Pastors"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-label={label}
            aria-pressed={role === value}
            className={role === value ? "active" : ""}
            onClick={() => setRole(value)}
          >
            {label}
            {counts && <b>{roll.filter((p) => inRole(p, value)).length.toLocaleString()}</b>}
          </button>
        ))}
      </div>}
      <DirectoryFilters
        filter={filter}
        setFilter={setFilter}
        options={options}
      />
      {grouped ? (
        <div className="reg-grouped">
          {grouped.withPastors.map(({ bishop: b, pastors: ps }) => (
            <section key={b.id} className={`reg-bishop-block ${b.standing === false ? "dark" : ""}`}>
              <button type="button" className="reg-bishop-head" onClick={() => pick(grouped.order)(b)}>
                <span className="reg-person-n">{b.n}</span>
                <Portrait person={b} className="reg-circle" />
                {b.standing !== false && (
                  <span className="reg-bishop-who">
                    <b><PersonName name={b.name} /></b>
                    <small>{[caps(b.denomination), placeOf(b)].filter(Boolean).join(" · ")}</small>
                    <span className="reg-count-pill">{overseeing(ps.length)}</span>
                  </span>
                )}
              </button>
              {ps.length > 0 && <PeopleGrid list={ps} limit={ps.length} onOpen={pick(grouped.order)} dots={false} />}
            </section>
          ))}
          {grouped.alone.length > 0 && (
            <section className="reg-bishop-block plain">
              <h3 className="reg-group-heading">Bishops</h3>
              <div className="reg-circles">
                {grouped.alone.map((b) => (
                  <button key={b.id} type="button" className="reg-circle-item" onClick={() => pick(grouped.order)(b)}>
                    <span className="reg-person-n">{b.n}</span>
                    <Portrait person={b} className="reg-circle" />
                    {b.standing !== false && <small><PersonName name={b.name} /></small>}
                  </button>
                ))}
              </div>
            </section>
          )}
          {grouped.rest.length > 0 && (
            <section className="reg-bishop-block plain">
              <h3 className="reg-group-heading">Pastors</h3>
              <PeopleGrid list={grouped.rest} limit={limit} onMore={() => setLimit((n) => n + 300)} onOpen={pick(grouped.order)} dots={false} />
            </section>
          )}
        </div>
      ) : list.length ? (
        <PeopleGrid
          list={list}
          limit={limit}
          onMore={() => setLimit((n) => n + 300)}
          onOpen={pick(null)}
          dots={false}
          counts={pastorCount}
        />
      ) : (
        <Empty title={roll.length ? "No one matches this search" : "The roll is filling up"}>
          {roll.length
            ? "Try another name, denomination or country."
            : "Bishops and pastors appear here as they register this year."}
        </Empty>
      )}
      {selected && unapproved && (
        <Dialog title={`${selected.role === "bishop" ? "Bishop" : "Pastor"}${selected.n ? ` · No. ${selected.n}` : ""}`} onClose={trail.close}>
          <p className="reg-unapproved">This {selected.role === "bishop" ? "bishop" : "pastor"} has not yet been approved.</p>
        </Dialog>
      )}
      {selected && !unapproved && (
        <Dialog title={selected.name} onClose={trail.close} onBack={trail.back} backLabel={trail.backLabel} {...stepper(steps, selected, trail.step)}>
          <PublicRecord person={selected} onOpen={selected.role === "bishop" ? openUnder(selected) : trail.open} from={roll} count={selected.role === "bishop" ? pastorCount.get(selected.id) : 0} />
        </Dialog>
      )}
    </>
  );
}
function ReviewQueue({ records, state, perform, actor, office, canEdit }) {
  const [filter, setFilter] = useState({ q: "", org: "" }),
    [selectedId, setSelectedId] = useState(null),
    [bishopId, setBishopId] = useState(""),
    [rosterId, setRosterId] = useState("");
  const selected = records.find((r) => r.userId === selectedId);
  const bishops = state.bishops || [];
  const bishop =
    selected && bishops.find((b) => b.id === selected.data.bishopId);
  const claimable = Boolean(bishop?.accountId) || (!office && !bishop);
  const candidates = selected
    ? state.rosters.filter(
        (r) =>
          (bishop ? r.bishopId === bishop.accountId : true) &&
          r.year === selected.year &&
          r.status === "active" &&
          !r.pastorId,
      )
    : [];
  // Yellow: the list nearly matches (wrong birthday, or a changed surname). Red: nothing like them on the list.
  const hintsFor = (r) => nearMatches(state, r);
  const reasonText = { name: "same name, different birthday", first: "same birthday and first name, different surname", several: "more than one entry fits" };
  const shown = filtered(records, filter);
  const groups = [
    ["Possible matches", "review", shown.filter((r) => hintsFor(r).length), "The name or birthday on the bishop’s list is close. Open one to link it."],
    ["No match on the list", "unclaimed", shown.filter((r) => !hintsFor(r).length), "Nothing on the bishop’s list resembles these registrations."],
  ];
  const selectedHints = selected ? hintsFor(selected) : [];
  return (
    <>
      <Filters filter={filter} setFilter={setFilter} />
      {groups.map(([label, tone, list, help]) =>
        list.length ? (
          <section key={label} className={`reg-queue-group ${tone}`}>
            <h3>
              {label} <b>{list.length}</b>
            </h3>
            <p className="reg-small">{help}</p>
            <div className="reg-queue">
              {list.map((r) => {
                const hints = hintsFor(r);
                return (
                  <button
                    key={r.userId}
                    className={`reg-queue-row ${tone}`}
                    onClick={() => {
                      setSelectedId(r.userId);
                      setBishopId("");
                      setRosterId(hints.length === 1 ? hints[0].row.id : "");
                    }}
                  >
                    <Media path={r.data.photo} alt="" className="reg-avatar small" />
                    <div>
                      <h3>{r.data.name}</h3>
                      <p>
                        {orgLabel(r.data.organization)} · {r.data.denomination || r.data.church}{r.entrance === "appointments" ? " · Pastoral appointment" : ""}{r.data.photoCheck && r.data.photoCheck.verdict !== "ok" && r.data.photoCheck.verdict !== "skipped" ? ` · ${attireWords(r.data.photoCheck)}` : ""}
                      </p>
                      <small>
                        Bishop:{" "}
                        {bishops.find((b) => b.id === r.data.bishopId)?.name ||
                          `${r.data.bishopName || "not given"} (typed, not matched)`}
                        {hints.length ? ` · list has “${hints[0].row.name}” (${reasonText[hints[0].reason]})` : ""}
                      </small>
                    </div>
                    <Badge status={tone === "review" ? "pending" : "unclaimed"}>{tone === "review" ? "Check the list" : "No match"}</Badge>
                    <span>Review →</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null,
      )}
      {!records.length && (
        <Empty title="No unclaimed pastors">
          Pastors who cannot be matched to a bishop’s list will appear here for review.
          <br /><small>Yellow = Possible match · Red = No match found</small>
        </Empty>
      )}
      {records.length > 0 && !filtered(records, filter).length && (
        <Empty title="No matching results">
          Try another name or organization.
        </Empty>
      )}
      {selected && (
        <Dialog
          title="Review Unclaimed registration"
          onClose={() => setSelectedId(null)}
        >
          <ProfileDetails record={selected} directory={state.directory} />
          {office && <OfficeEditor registration={selected} state={state} perform={perform} actor={actor} />}
          {selectedHints.length > 0 && (
            <div className="reg-status-message pending">
              <b>The list nearly matches</b>
              <ul className="reg-hints">
                {selectedHints.map(({ row, reason }) => (
                  <li key={row.id}>
                    <b>{row.name}</b> · born {row.dob ? row.dob.split("-").reverse().join("/") : "—"} — {reasonText[reason]}.{" "}
                    <button type="button" className="reg-text" onClick={() => setRosterId(row.id)}>Link to this entry</button>
                  </li>
                ))}
              </ul>
              <p>Registered as {selected.data.name}, born {selected.data.dob ? selected.data.dob.split("-").reverse().join("/") : "—"}.</p>
            </div>
          )}
          <div className="reg-status-message unclaimed">
            <b>Not yet matched</b>
            <p>
              {bishop?.accountId
                ? "Check the registration against this bishop’s list. A spelling difference can be resolved by linking the correct entry below."
                : office
                  ? "No bishop has claimed this pastor yet. Assign one below, or wait for a bishop to confirm them."
                  : `This pastor named “${selected.data.bishopName || "no bishop"}” but that did not match an approved bishop. If they are under your oversight, confirm them below to add them to your list.`}
            </p>
          </div>
          {canEdit && (
            <>
              {office && (
                <div className="reg-card inset">
                  <Field label="Assign or correct supervising bishop">
                    <select
                      value={bishopId}
                      onChange={(e) => setBishopId(e.target.value)}
                    >
                      <option value="">Select a registered bishop</option>
                      {bishops
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <button
                    className="reg-secondary"
                    disabled={!bishopId}
                    onClick={() =>
                      perform(
                        "assignBishop",
                        { userId: selected.userId, bishopId },
                        "Supervising bishop updated.",
                      )
                    }
                  >
                    Assign bishop
                  </button>
                </div>
              )}
              {claimable && (
                <>
                  <Field label="Link to annual list">
                    <select
                      value={rosterId}
                      onChange={(e) => setRosterId(e.target.value)}
                    >
                      <option value="">
                        Confirm and add as a new list entry
                      </option>
                      {candidates.map((r) => (
                        <option value={r.id} key={r.id}>
                          {r.name} · {r.email || r.phone}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <p className="reg-small">
                    Confirm only after checking this person belongs under{" "}
                    {bishop ? bishop.name : "your oversight"}. This adds them to
                    the directory and unlocks their payment.
                  </p>
                  <button
                    className="reg-primary full"
                    onClick={() =>
                      perform(
                        "claim",
                        { userId: selected.userId, rosterId },
                        "Pastor confirmed. Payment is now unlocked.",
                      )
                    }
                  >
                    Confirm pastor · unlock payment
                  </button>
                </>
              )}
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
// Existing bishops whose names are alike this registrant's, best first.
const bishopSuggestionsFor = (r) =>
  references
    .filter((b) => namesAlike(b.name, r.data.name))
    .sort((a, b) => Number(b.id === r.data.referenceId) - Number(a.id === r.data.referenceId))
    .slice(0, 4);
const REVIEW_REASONS = [
  "Your photo does not meet the official attire requirement (red jacket for bishops, face fully visible, plain white background).",
  "Some of your details are incorrect or incomplete.",
  "Your organization or denomination is not right.",
  "Your date of birth or phone number looks wrong.",
  "Your pastor list needs correcting.",
];
// Bishops waiting on the office, plus everyone (bishops and pastors) already
// approved this year. Approved rows open read-only.
function BishopApprovals({ records, directory = [], state, actor, perform, canEdit }) {
  const [selectedId, setSelectedId] = useState(null),
    [ref, setRef] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [note, setNote] = useState(""),
    [reasons, setReasons] = useState([]),
    [view, setView] = useState("awaiting"),
    [q, setQ] = useState("");
  // The ticked reasons and the free note together make the message the bishop sees and is emailed.
  const message = [...reasons.map((r) => `• ${r}`), note.trim()].filter(Boolean).join("\n");
  const bucket = (r) =>
    r.status === "confirmed"
      ? "approved"
      : r.data.role !== "bishop"
        ? ""
        : r.status === "denied"
          ? "denied"
          : r.resubmit
            ? "resubmit"
            : "awaiting";
  const term = normalName(q);
  const shown = records.filter(
    (r) =>
      bucket(r) === view &&
      (!term || normalName(`${r.data.name} ${r.data.email} ${r.data.denomination || ""}`).includes(term)),
  );
  const selected = records.find((r) => r.userId === selectedId);
  const reviewing = selected && selected.status !== "confirmed";
  return (
    <>
      <div className="reg-switch" role="group" aria-label="Approvals">
        {[["awaiting", "Awaiting approval"], ["resubmit", "Needs resubmission"], ["denied", "Denied"], ["approved", "Approved"]].map(([value, label]) => (
          <button key={value} aria-pressed={view === value} className={view === value ? "active" : ""} onClick={() => setView(value)}>
            {label} <strong>{records.filter((r) => bucket(r) === value).length}</strong>
          </button>
        ))}
      </div>
      <input
        type="search"
        className="reg-doors-search"
        aria-label="Search approvals"
        placeholder="Search by name, email or denomination"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {shown.length ? (
        <div className="reg-queue">
          {shown.map((r) => (
            <button
              className="reg-queue-row"
              key={r.userId}
              onClick={() => {
                setSelectedId(r.userId);
                // Preselect the record the registrant confirmed, else the best name match.
                setRef(r.data.referenceId || bishopSuggestionsFor(r)[0]?.id || "");
                setConfirmed(false);
                setReasons([]);
                setNote("");
              }}
            >
              <Media path={r.data.photo} alt="" className="reg-avatar small" />
              <div>
                <h3>{r.data.name}</h3>
                <p>
                  {titleFor(r.data)} · {orgLabel(r.data.organization)} · {r.data.email}{r.entrance === "appointments" ? " · Pastoral appointment" : ""}{r.photoChangedAt ? " · Photo changed after approval" : ""}{r.data.photoCheck && r.data.photoCheck.verdict !== "ok" && r.data.photoCheck.verdict !== "skipped" ? ` · ${attireWords(r.data.photoCheck)}` : ""}
                  {state.profiles.find((p) => p.id === r.userId)?.autoApproved ? " · approved automatically: matched the original data" : ""}
                </p>
              </div>
              <Badge status={r.status === "confirmed" ? "confirmed" : r.status === "denied" ? "denied" : "pending"}>{r.resubmit ? "Asked to resubmit" : null}</Badge>
              <span>{r.status === "confirmed" ? "View →" : "Review →"}</span>
            </button>
          ))}
        </div>
      ) : (
        <Empty title={term ? "Nobody matches that search" : view === "awaiting" ? "No bishops awaiting approval" : view === "denied" ? "No denied registrations" : view === "approved" ? "Nobody has been approved yet" : "Nobody is waiting to resubmit"}>
          {view === "approved"
            ? "Bishops appear here once the office confirms them; pastors once their bishop confirms them."
            : "New bishop registrations that require approval will appear here."}
        </Empty>
      )}
      {selected && !reviewing && (
        <Dialog title={`${titleFor(selected.data)} ${selected.data.name}`} onClose={() => setSelectedId(null)}>
          <ProfileDetails record={selected} directory={directory} />
          {state && <OfficeEditor registration={selected} state={state} perform={perform} actor={actor} />}
        </Dialog>
      )}
      {reviewing && (
        <Dialog
          title="Verify bishop account"
          onClose={() => setSelectedId(null)}
        >
          <ProfileDetails record={selected} />
          {state && <OfficeEditor registration={selected} state={state} perform={perform} actor={actor} />}
          {(() => {
            const suggestions = bishopSuggestionsFor(selected);
            const chosen = index.byId.get(ref);
            const diffs = chosen
              ? [
                  ["Denomination", chosen.denomination, selected.data.denomination],
                  ["City", chosen.city, selected.data.city],
                  ["Country", chosen.country, selected.data.country],
                  ["Organization", chosen.organization, selected.data.organization],
                ].filter(([, was, now]) => was && now && normalName(was) !== normalName(now))
              : [];
            return (
              <div className="reg-is-this-you">
                <p>
                  {suggestions.length
                    ? selected.data.referenceId
                      ? "The bishop confirmed this is their existing record:"
                      : "Who we think this is, from the existing roster:"
                    : "No existing bishop has a name like this — likely a new bishop."}
                </p>
                {suggestions.length > 0 && (
                  <div className="reg-candidates">
                    {suggestions.map((b) => (
                      <div key={b.id} className={`reg-candidate ${ref === b.id ? "chosen" : ""}`}>
                        <Portrait person={b} />
                        <div>
                          <b>{b.name}</b>
                          <small>{[b.title, caps(b.denomination), b.city, b.country].filter(Boolean).join(" · ")}</small>
                          <button type="button" className="reg-secondary" onClick={() => setRef(ref === b.id ? "" : b.id)}>
                            {ref === b.id ? "Selected" : "This is them"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {diffs.length > 0 && (
                  <div className="reg-compare">
                    {diffs.map(([label, was, now]) => (
                      <div key={label} className="changed">
                        <span>{label}</span>
                        <b>{was}</b>
                        <i>now {now}</i>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <Field
            label="Or pick another existing bishop"
            hint="Linking the record keeps their history and photo together; leave as new if they are not in the roster."
          >
            <select value={ref} onChange={(e) => setRef(e.target.value)}>
              <option value="">New bishop — no existing reference</option>
              {references.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} {b.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="reg-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I have verified this person’s identity and bishop role.
          </label>
          {selected.bishopNote && <p className="reg-status-message unclaimed">Last note: {selected.bishopNote}</p>}
          <button
            className="reg-primary full"
            disabled={!confirmed || !canEdit || selected.status === "confirmed"}
            onClick={() =>
              perform(
                "approveBishop",
                { userId: selected.userId, referenceId: ref },
                "Bishop confirmed. They now appear on the roll.",
              ).then((ok) => ok && setSelectedId(null))
            }
          >
            Confirm bishop
          </button>
          <fieldset className="reg-reasons">
            <legend>What needs to change? The bishop is emailed this at the address they registered with.</legend>
            {REVIEW_REASONS.map((text) => (
              <label key={text} className="reg-check">
                <input
                  type="checkbox"
                  checked={reasons.includes(text)}
                  onChange={(e) => setReasons(e.target.checked ? [...reasons, text] : reasons.filter((r) => r !== text))}
                />
                <span>{text}</span>
              </label>
            ))}
          </fieldset>
          <Field label="Anything else" hint="Optional. Added to the email and shown on their profile.">
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="reg-review-buttons">
            <button className="reg-secondary" disabled={!canEdit || !message.trim()} onClick={() => perform("reviewBishop", { userId: selected.userId, decision: "resubmit", note: message }, "The bishop has been asked to resubmit and emailed the reasons.").then((ok) => ok && setSelectedId(null))}>
              Needs resubmission · email them
            </button>
            <button className="reg-secondary danger" disabled={!canEdit || !message.trim()} onClick={() => perform("reviewBishop", { userId: selected.userId, decision: "denied", note: message }, "Registration denied and the bishop emailed.").then((ok) => ok && setSelectedId(null))}>
              Deny
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
function Payments({ records, perform, canEdit }) {
  const [selectedId, setSelectedId] = useState(null),
    [note, setNote] = useState(""),
    [filter, setFilter] = useState({ q: "", org: "", role: "" });
  const rows = records.filter((r) => r.payment === "pending"),
    selected = rows.find((r) => r.userId === selectedId);
  return (
    <>
      <Filters filter={filter} setFilter={setFilter} roles />
      <div className="reg-stats">
        <div>
          <span>Payments to verify</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Verified payments · USD</span>
          <strong>
            $
            {records
              .filter((r) => r.payment === "verified")
              .reduce((a, r) => a + r.amount, 0)
              .toLocaleString()}
          </strong>
        </div>
      </div>
      {rows.length ? (
        <div className="reg-queue">
          {filtered(rows, filter).map((r) => (
            <button
              className="reg-queue-row"
              key={r.userId}
              onClick={() => {
                setSelectedId(r.userId);
                setNote("");
              }}
            >
              <Media path={r.data.photo} alt="" className="reg-avatar small" />
              <div>
                <h3>{r.data.name}</h3>
                <p>{orgLabel(r.data.organization)}</p>
              </div>
              <b>${r.amount} USD</b>
              <span>Check proof →</span>
            </button>
          ))}
        </div>
      ) : (
        <Empty title="No payments awaiting verification">
          Uploaded proof of payment will appear here for verification.
        </Empty>
      )}
      {selected && (
        <Dialog title="Verify payment" onClose={() => setSelectedId(null)}>
          <h3>
            {selected.data.name} · ${selected.amount} USD
          </h3>
          <dl className="reg-details">
            <div><dt>Transaction ID</dt><dd><b>{selected.transactionId || "Not given"}</b></dd></div>
            <div><dt>Reference</dt><dd>{paymentReference(selected)}</dd></div>
          </dl>
          <p>
            Find this Transaction ID on the mobile-money statement and compare the amount and date with the screenshot. Compare the screenshot with the payment received in your account
            before verifying.
          </p>
          <Media
            path={selected.proof}
            alt="Uploaded payment screenshot"
            className="reg-receipt"
          />
          <Field label="Office note">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required if replacement proof is needed"
            />
          </Field>
          <div className="reg-form-actions">
            <button
              className="reg-secondary"
              disabled={!canEdit || !note.trim()}
              onClick={() =>
                perform(
                  "reviewPayment",
                  { userId: selected.userId, result: "rejected", note },
                  "Replacement proof requested.",
                )
              }
            >
              Request replacement
            </button>
            <button
              className="reg-primary"
              disabled={!canEdit}
              onClick={() =>
                perform(
                  "reviewPayment",
                  { userId: selected.userId, result: "verified", note },
                  "Payment verified.",
                )
              }
            >
              Verify received payment
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
// A bishop's pasted list often names people Kuriake Castle already holds. The portrait
// and the recorded details are shown side by side so a person decides whether
// it is the same pastor; confirming links the record and makes the list's
// contact details the current ones.
function ReferenceReview({ rows, perform, canEdit }) {
  const [openId, setOpenId] = useState(null),
    [pick, setPick] = useState(""),
    [same, setSame] = useState(false);
  const pending = useMemo(
    () =>
      rows
        .filter((r) => r.status === "active" && !r.referenceId)
        .map((row) => ({ row, matches: referenceMatches(index, row) }))
        .filter((m) => m.matches.length),
    [rows],
  );
  const entry = pending.find((m) => m.row.id === openId);
  const chosen =
    entry && (entry.matches.find((m) => m.reference.id === pick) || entry.matches[0]);
  const reference = chosen?.reference;
  const row = entry?.row;
  const start = (m) => {
    setOpenId(m.row.id);
    setPick(m.matches[0].reference.id);
    setSame(false);
  };
  const differs = (a, b) => Boolean(a) && Boolean(b) && normalName(a) !== normalName(b);
  if (!pending.length) return null;
  return (
    <section className="reg-card reg-reference-review">
      <div className="reg-section-head">
        <div>
          <h2>Pastors already in Kuriake Castle</h2>
          <p>
            {pending.length.toLocaleString()} on this list already appear in
            Kuriake Castle. Confirm each person so their information is updated instead
            of a second entry being created.
          </p>
        </div>
      </div>
      <div className="reg-queue">
        {pending.slice(0, PAGE).map((m) => (
          <button
            key={m.row.id}
            className="reg-queue-row"
            disabled={!canEdit}
            onClick={() => start(m)}
          >
            <Portrait
              person={m.matches[0].reference}
              className="reg-avatar small"
            />
            <div>
              <h3>{m.row.name}</h3>
              <p>
                {m.matches[0].reference.title} ·{" "}
                {m.matches[0].reference.denomination ||
                  m.matches[0].reference.organization}
              </p>
              <small>
                {m.matches[0].contactMatch
                  ? "Email or phone also matches our record"
                  : "Name matches, contact details differ"}
              </small>
            </div>
            <Badge status={m.matches[0].contactMatch ? "verified" : "unclaimed"}>
              {m.matches[0].contactMatch ? "Likely the same person" : "Check"}
            </Badge>
            <span>Review →</span>
          </button>
        ))}
      </div>
      {pending.length > PAGE && (
        <small>
          Showing the first {PAGE}. Confirm these to reveal the rest.
        </small>
      )}
      {entry && reference && (
        <Dialog
          title="Is this the same person?"
          onClose={() => setOpenId(null)}
        >
          <div className="reg-person-summary">
            <Portrait person={reference} className="reg-avatar" />
            <div>
              <h2>{reference.name}</h2>
              <p>
                {reference.title} · {orgLabel(reference.organization)}
              </p>
              <small>{caps(reference.denomination)}</small>
            </div>
          </div>
          {entry.matches.length > 1 && (
            <Field label="Which pastor is this?">
              <select value={pick} onChange={(e) => setPick(e.target.value)}>
                {entry.matches.map((m) => (
                  <option key={m.reference.id} value={m.reference.id}>
                    {m.reference.name} ·{" "}
                    {m.reference.denomination || m.reference.organization} ·{" "}
                    {m.reference.city || "City not recorded"}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="reg-compare">
            {[
              ["Name", reference.name, row.name],
              ["Email", reference.email, row.email],
              ["Phone", reference.phone, row.phone],
              ["City", reference.city, ""],
            ].map(([label, ours, theirs]) => (
              <div key={label} className={differs(ours, theirs) ? "changed" : ""}>
                <span>{label}</span>
                <b>{ours || "Not recorded"}</b>
                <i>{theirs && differs(ours, theirs) ? `now ${theirs}` : ""}</i>
              </div>
            ))}
          </div>
          {(differs(reference.email, row.email) ||
            differs(reference.phone, row.phone)) && (
            <p className="reg-status-message unclaimed">
              <b>Their contact details have changed</b>
              Confirming replaces the older email and phone with the details on
              your list.
            </p>
          )}
          <label className="reg-check">
            <input
              type="checkbox"
              checked={same}
              onChange={(e) => setSame(e.target.checked)}
            />
            <span>
              I have looked at the photo and confirm this is the same person as{" "}
              {row.name}.
            </span>
          </label>
          <button
            className="reg-primary full"
            disabled={!same || !canEdit}
            onClick={async () => {
              if (
                await perform(
                  "linkReference",
                  { rosterId: row.id, referenceId: reference.id },
                  `${reference.name} confirmed. Kuriake Castle now shows the details on your list.`,
                )
              )
                setOpenId(null);
            }}
          >
            Confirm and update their information
          </button>
          <button className="reg-text" onClick={() => setOpenId(null)}>
            Not the same person · keep as a new pastor
          </button>
        </Dialog>
      )}
    </section>
  );
}
// Turns an uploaded Excel or CSV file into the pasted-list text. Excel dates
// arrive as serial numbers; they are written back as day/month/year.
async function readSpreadsheet(file) {
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  const cell = (v) =>
    v instanceof Date // SheetJS builds local-midnight dates; read them in local time
      ? `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}`
      : typeof v === "number" && v > 20000 && v < 80000
        ? (() => { const d = new Date(Math.round((v - 25569) * 86400000)); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`; })()
        : String(v ?? "").trim();
  const lines = rows.map((r) => r.map(cell)).filter((r) => r.some(Boolean)).map((r) => r.map((c) => (c.includes(",") ? `"${c.replaceAll('"', '""')}"` : c)).join(","));
  if (!lines.length) throw Error("That file has no rows.");
  return lines.join("\n");
}
function Roster({ state, year, actor, office, perform }) {
  const [bishopId, setBishopId] = useState(""),
    [q, setQ] = useState(""),
    [inputError, setInputError] = useState(""),
    [moreSlots, setMoreSlots] = useState(() => blankSlots(5)),
    [editRow, setEditRow] = useState(null),
    [remove, setRemove] = useState(null),
    [reason, setReason] = useState("Transferred"),
    [note, setNote] = useState(""),
    [carry, setCarry] = useState(false);
  const rows = state.rosters.filter(
    (r) =>
      r.year === year &&
      (!office || !bishopId || r.bishopId === bishopId) &&
      normalName(r.name).includes(normalName(q)),
  ).sort(bySurname);
  const own = state.rosters.filter(
    (r) => r.year === year && r.bishopId === actor.id,
  );
  return (
    <>
      <div className="reg-stats">
        <div>
          <span>Total pastors</span>
          <strong>{rows.filter((r) => r.status === "active").length}</strong>
        </div>
        <div>
          <span>Registered</span>
          <strong>
            {rows.filter((r) => r.status === "active" && r.pastorId).length}
          </strong>
        </div>
        <div>
          <span>Not yet registered</span>
          <strong>
            {rows.filter((r) => r.status === "active" && !r.pastorId).length}
          </strong>
        </div>
        <div>
          <span>Removed this year</span>
          <strong>{rows.filter((r) => r.status === "removed").length}</strong>
        </div>
      </div>
      <div className="reg-filters">
        <input
          type="search"
          aria-label="Search annual list"
          placeholder="Search pastor names"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {office && (
          <select
            aria-label="Filter bishop"
            value={bishopId}
            onChange={(e) => setBishopId(e.target.value)}
          >
            <option value="">All bishops</option>
            {(state.bishops || [])
              .map((b) => (
                <option key={b.id} value={b.accountId}>
                  {b.name}
                </option>
              ))}
          </select>
        )}
      </div>
      <ReferenceReview
        rows={rows}
        perform={perform}
        canEdit={year === state.year}
      />
      {rows.length ? (
        <div className="reg-table-scroll">
          <table className="reg-table">
            <thead>
              <tr>
                <th>Pastor</th>
                {office && <th>Bishop</th>}
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // Once a pastor has claimed their place their own photo shows beside the name.
                const reg = r.pastorId && state.registrations.find((x) => x.userId === r.pastorId && x.year === year);
                const claimed = r.status === "active" && Boolean(r.pastorId);
                return (
                <tr key={r.id} className={r.status !== "active" ? "removed" : claimed ? "claimed" : "unclaimed"}>
                  <td>
                    <div className="reg-roster-person">
                      {reg?.data?.photo ? <Media path={reg.data.photo} alt="" className="reg-avatar small" /> : <span className="reg-avatar small reg-placeholder reg-unconfirmed" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7v1H4z" /></svg></span>}
                      <b>{r.name}</b>
                    </div>
                  </td>
                  {office && (
                    <td>
                      {
                        (state.bishops || []).find((b) => b.accountId === r.bishopId)
                          ?.name
                      }
                    </td>
                  )}
                  <td>
                    {r.status !== "active" ? (
                      <Badge status="removed">Removed · {r.reason}</Badge>
                    ) : claimed ? (
                      <Badge status="confirmed">Registered</Badge>
                    ) : (
                      <Badge status="unclaimed">Not yet registered</Badge>
                    )}
                    {r.note && <small>{r.note}</small>}
                  </td>
                  <td className="reg-row-actions">
                    {year === state.year && (
                      <button className="reg-text" onClick={() => setEditRow(r)}>Edit</button>
                    )}
                    {r.status === "active" && year === state.year && (
                      <button
                        className="reg-text danger"
                        onClick={() => {
                          setRemove(r);
                          setReason("Transferred");
                          setNote("");
                        }}
                      >
                        Remove
                      </button>
                    )}
                    {r.status !== "active" && year === state.year && (
                      <button className="reg-text" onClick={() => perform("restoreRoster", { id: r.id }, `${r.name} is back on the list.`)}>Restore</button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No pastors added yet">
          {office ? "Pastors added by bishops will appear here." : "Add the pastors under your oversight. When they register, they will automatically be linked to you."}
        </Empty>
      )}
      {!office && year === state.year && (
        <section className="reg-card reg-roster-input">
          <div className="reg-section-head">
            <div>
              <h2>Add more pastors</h2>
              <p>
                Enter each pastor’s <b>full name</b> and <b>date of birth</b>, then add them. Each pastor will add their own photo when they register.
              </p>
            </div>
          </div>
          <PastorSlots slots={moreSlots} setSlots={setMoreSlots} count={5} />
          <div className="reg-form-actions">
            <small>{filledSlots(moreSlots).length ? `${filledSlots(moreSlots).length} ready to add.` : "Fill in a row, then add."}</small>
            <button
              type="button"
              className="reg-primary"
              disabled={!filledSlots(moreSlots).length || !slotsComplete(moreSlots)}
              onClick={() => perform("addRoster", { rows: filledSlots(moreSlots) }, "Pastors added to your list.").then((ok) => ok && setMoreSlots(blankSlots(5)))}
            >
              Add to my list →
            </button>
          </div>
          <details className="reg-upload-alt">
            <summary>Have a list of pastors in a spreadsheet? Upload it here</summary>
            <Field label="Upload a spreadsheet" hint="Excel (.xlsx, .xls) or CSV: full name in the first column, date of birth (day/month/year) in the second.">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  readSpreadsheet(file)
                    .then((t) => perform("addRoster", { rows: parseRoster(t) }, "Pastors added to your list."))
                    .catch((err) => setInputError(err.message));
                }}
              />
            </Field>
          </details>
          {inputError && <p role="alert" className="reg-status-message unclaimed">{inputError}</p>}
          {state.rosters.some(
            (r) =>
              r.year === year - 1 &&
              r.bishopId === actor.id &&
              r.status === "active",
          ) && (
            <button className="reg-text" onClick={() => setCarry(true)}>
              Review and reconfirm last year’s active list →
            </button>
          )}
        </section>
      )}
      {editRow && (
        <Dialog title={`Edit ${editRow.name}`} onClose={() => setEditRow(null)}>
          <RosterRowEditor row={editRow} state={state} office={office} perform={perform} onDone={() => setEditRow(null)} />
        </Dialog>
      )}
      {remove && (
        <Dialog title={`Remove ${remove.name}`} onClose={() => setRemove(null)}>
          <p>
            This retains the record and its history. A linked pastor will no
            longer appear in this year’s active directory.
          </p>
          <Field label="Reason">
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {["Transferred", "Resigned", "Dismissed", "Other"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Note">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button
            className="reg-primary"
            onClick={async () => {
              if (
                await perform(
                  "removeRoster",
                  { id: remove.id, reason, note },
                  "Annual list updated.",
                )
              )
                setRemove(null);
            }}
          >
            Confirm removal
          </button>
        </Dialog>
      )}
      {carry && (
        <Dialog
          title="Reconfirm last year’s list"
          onClose={() => setCarry(false)}
        >
          <p>
            Confirm that these pastors are still under your oversight for {year}
            . Remove any departed pastors after copying. Previously removed
            entries are excluded; accounts and payments are not copied.
          </p>
          <ul>
            {state.rosters
              .filter(
                (r) =>
                  r.year === year - 1 &&
                  r.bishopId === actor.id &&
                  r.status === "active",
              )
              .map((r) => (
                <li key={r.id}>{r.name}</li>
              ))}
          </ul>
          <button
            className="reg-primary"
            onClick={async () => {
              if (
                await perform(
                  "carryRoster",
                  {},
                  "Active pastors reconfirmed for this year.",
                )
              )
                setCarry(false);
            }}
          >
            Reconfirm listed pastors
          </button>
        </Dialog>
      )}
    </>
  );
}
function History({ state, records, office, actor, year, perform }) {
  const [next, setNext] = useState(false);
  return (
    <>
      <section className="reg-card">
        <h2>{year} registrations</h2>
        {records.length ? (
          <div className="reg-table-scroll">
            <table className="reg-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Registration</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {records
                  .filter((r) => office || r.userId === actor.id)
                  .map((r) => (
                    <tr key={r.userId}>
                      <td>{r.data.name}</td>
                      <td>{titleFor(r.data)}</td>
                      <td>
                        <Badge status={r.status} />
                      </td>
                      <td>
                        <Badge status={r.payment}>
                          {r.payment === "pending"
                            ? "Awaiting verification"
                            : null}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No registrations were recorded for {year}.</p>
        )}
      </section>
      <section className="reg-card reg-audit">
        <h2>Activity</h2>
        {state.audit
          .filter((a) => a.year === year)
          .slice()
          .reverse()
          .slice(0, 100)
          .map((a) => (
            <div key={a.id}>
              <b>
                {ACTION_LABELS[a.action] || a.action}
              </b>
              <time>{shortDateTime(a.at)}</time>
            </div>
          ))}
        {!state.audit.some((a) => a.year === year) && (
          <p>No activity recorded yet.</p>
        )}
      </section>
      {office && (
        <section className="reg-card">
          <h2>Start a new registration year</h2>
          <p>
            Existing accounts and previous records will be kept. Starting a new
            registration year will reset the registration and payment counts for the new year.
          </p>
          <button className="reg-secondary" onClick={() => setNext(true)}>
            Start {state.year + 1} registration
          </button>
        </section>
      )}
      {next && (
        <Dialog
          title={`Start ${state.year + 1} registration?`}
          onClose={() => setNext(false)}
        >
          <p>
            This will open a new registration year. Existing accounts and previous
            records will not be deleted. {state.year} closes to new submissions; bishops
            reconfirm their pastor lists and everyone registers and pays for the new year.
          </p>
          <button className="reg-secondary" onClick={() => setNext(false)}>Cancel</button>{" "}
          <button
            className="reg-primary"
            onClick={async () => {
              if (
                await perform(
                  "openYear",
                  { year: state.year + 1 },
                  "New registration year started.",
                )
              )
                setNext(false);
            }}
          >
            Start {state.year + 1} registration
          </button>
        </Dialog>
      )}
    </>
  );
}
