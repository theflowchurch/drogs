"use client";
import Accounts from './Accounts';
import ApiKeys from './ApiKeys';
import Settings from './Settings';
import {
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
  orgLabel,
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
import people from "./reference-people.json";
// Everyone Kuriake Castle already knows. Bishops are the linkable approval references;
// the whole roster backs the Directory and the member search.
const references = people.filter((p) => p.role === "bishop");
const index = referenceIndex(people);
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const statusLabel = {
  draft: "Draft",
  unclaimed: "Unclaimed",
  pending: "Awaiting office confirmation",
  denied: "Not approved",
  confirmed: "Confirmed",
  removed: "Removed from annual list",
  unpaid: "Not paid",
  rejected: "Replacement proof needed",
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
        ["input", "select", "textarea"].includes(child.type)
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
    <img className={className} src={url} alt={alt} />
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
function Dialog({ title, onClose, onPrev, onNext, children }) {
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
  signup = false,
}) {
  // Members sign in with their email; only the office and the browse-only
  // directory sit behind an access code.
  const gated = office;
  const hero = !office && !browse && !signup;
  const [theme, setTheme] = useState("light"),
    [pub, setPub] = useState(null),
    [sidebarHidden, setSidebarHidden] = useState(false),
    [signinOpen, setSigninOpen] = useState(false),
    [directoryRole, setDirectoryRole] = useState("bishop"),
    [gate, setGate] = useState(!gated),
    [actor, setActor] = useState(null),
    [checking, setChecking] = useState(true),
    [state, setState] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState(office ? "Directory" : "Registration"),
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
        // A signed-in member does not pass the office or directory gate.
        if (current && (!gated || (office && current.office))) setGate(true);
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
      if (!gated || (office && actor.office)) setGate(true);
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
    // The bishop / pastor links open straight onto the email box: email first,
    // then the code, then the form with that email locked in.
    else if (typeof signup === "string") setSigninOpen("signup");
  }, [signup]);
  const toggleSidebar = () => {
    const next = !sidebarHidden;
    setSidebarHidden(next);
    localStorage.setItem("kc-sidebar-hidden", next ? "yes" : "no");
  };
  useEffect(() => {
    // The public directory needs no account at all.
    if (browse) api.publicDirectory().then(setPub).catch((e) => setError(e.message));
  }, [browse]);
  useEffect(() => {
    if (!actor) return;
    // Background refreshes stay quiet when the network hiccups; the next tick tries again.
    const update = () => refresh().catch(() => {});
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
    // Someone who chose to stay signed in is not signed out for being idle.
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
  }, [gate]);
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
        "Original data",
        "Unclaimed",
        "Approvals",
        "Payments",
        "Pastor lists",
        "History",
        ...(api.apiKeysAvailable ? ["Accounts", "API keys"] : []),
        ...(api.settingsAvailable ? ["Settings"] : []),
      ]
    : [
        "Registration",
        ...(current && current.status !== "draft" ? ["Directory"] : []),
        ...(profile?.role === "bishop" && current && !["draft", "denied"].includes(current.status)
          ? ["My pastors", "Unclaimed"]
          : []),
        "History",
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
    <div className="reg-app">
      {!hero && (
        <div
          className="reg-app-bg"
          style={{ backgroundImage: `url(${base}/assets/brand/signup-hero.jpg)` }}
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
        <a className="reg-brand" href={`${base}/`}>
          <span className="reg-brand-mark">
            <img src={`${base}/assets/brand/castle-icon.png`} alt="" />
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
          ) : null}
          <button className="reg-theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>}
      {!api.live && (
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
          <button className="reg-theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <div
            className="reg-hero-image"
            style={{ backgroundImage: `url(${base}/assets/brand/signup-hero.jpg)` }}
            aria-hidden="true"
          />
          <h1 className="reg-hero-title">
            <img src={`${base}/assets/brand/castle-icon-white.png`} alt="" />
            Kuriake Castle
          </h1>
          <a className="reg-enter" href={`${base}/directory/`}>
            <span className="reg-shimmer">View the full Pastoral directory</span>
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
          <PublicDirectory data={pub} />
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
                  ? "Confirmed registrations enter the directory. Unclaimed pastors stay in their own review queue."
                  : actor.email}
              </p>
              <small>{api.live ? "Secure account" : "Local account"}</small>
            </div>
          </aside>
          <main className="reg-main" aria-busy={busy}>
            <fieldset className="reg-workspace-fieldset" disabled={busy}>
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
              {tab !== "Registration" && (
                <>
                  <div className="reg-page-heading">
                    <div>
                      <span className="reg-eyebrow">
                        {office ? "KURIAKE CASTLE / OFFICE" : "KURIAKE CASTLE / YOUR MINISTRY"}
                      </span>
                      <h1>
                        {tab === "Directory"
                          ? directoryHeading(directoryRole)
                          : tab === "Original data"
                            ? `Original data · ${directoryRole === "bishop" ? "Bishops" : "Pastors"}`
                            : tab}
                      </h1>
                      <p>
                        {
                          {
                            Directory: office
                              ? "Everyone registered this year, with their details. This is what the public roll counts."
                              : "The same directory the public sees.",
                            "Original data":
                              "The information Kuriake Castle held before this year’s registration. Green: the bishop has registered, or the pastor has been claimed by their bishop. Red: not yet.",
                            Unclaimed:
                              "Registrations waiting for a bishop to confirm their place.",
                            Approvals:
                              "Verify each bishop before they can confirm pastors, and see everyone approved so far.",
                            "My pastors":
                              "Submit and maintain the names of the pastors under your oversight.",
                            "Pastor lists":
                              "Every bishop’s uploaded list of pastors — who was added, who was confirmed, who was removed — across all bishops. Each bishop sees only their own under My pastors.",
                            Payments:
                              "Review payment screenshots and confirm received commitments.",
                            History: "Previous cycles and what changed.",
                            Accounts: "See who has created an account and when they last signed in.",
                            "API keys": "Give connected applications controlled, read-only access to Kuriake Castle.",
                            Settings: "Email delivery, payments, photo storage and access codes.",
                          }[tab]
                        }
                      </p>
                    </div>
                  </div>
                  {tab === "Accounts" && <Accounts run={run} />}
                  {tab === "API keys" && <ApiKeys run={run} />}
                  {tab === "Settings" && <Settings run={run} />}
                  {tab === "Directory" &&
                    (office ? (
                      <Directory
                        state={state}
                        year={Number(year)}
                        role={directoryRole}
                        setRole={setDirectoryRole}
                        perform={perform}
                        mode="registered"
                      />
                    ) : (
                      <PublicDirectory
                        data={{ source: state.publicDirectory || "original", roll: state.roll || [] }}
                        embedded
                      />
                    ))}
                  {tab === "Original data" && (
                    <Directory
                      state={state}
                      year={Number(year)}
                      role={directoryRole}
                      setRole={setDirectoryRole}
                      perform={perform}
                      mode="original"
                    />
                  )}
                  {tab === "Unclaimed" && (
                    <ReviewQueue
                      records={scoped.filter((r) => r.status === "unclaimed")}
                      state={state}
                      perform={perform}
                      office={office}
                      canEdit={Number(year) === state.year}
                    />
                  )}
                  {tab === "Approvals" && (
                    <BishopApprovals
                      records={scoped}
                      directory={state.directory || []}
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
        <img src={`${base}/assets/brand/castle-icon-white.png`} alt="" />
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
  const [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [token, setToken] = useState("");
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
        await api.requestCode(email, mode);
        setSent(true);
      }
    });
  }}
>
  <Field label="Email address" hint={sent ? undefined : "Use an email address you can access now. A 6-digit verification code will be sent to you."}>
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
      <div
        className="reg-hero-image"
        style={{ backgroundImage: `url(${base}/assets/brand/signup-hero.jpg)` }}
        aria-hidden="true"
      />
      {office ? (
        <>
          <div>
            <img
              className="reg-account-mark"
              src={`${base}/assets/brand/castle-icon-white.png`}
              alt=""
            />
            <span className="reg-eyebrow">OFFICE ACCESS</span>
            <h1>{sent ? "Check your email." : "Sign in to the office."}</h1>
            <p>Approved office emails only. A code is sent to your email each time.</p>
          </div>
          <AccountForm office={office} run={run} busy={busy} onActor={onActor} />
        </>
      ) : (
        <>
          <h1 className="reg-hero-title">
            <img src={`${base}/assets/brand/castle-icon-white.png`} alt="" />
            Kuriake Castle
          </h1>
          {open && (
            <Dialog title={open === "signin" ? "Sign in" : "Sign up"} onClose={onClose}>
              <AccountForm office={office} signup={open === "signup"} mode={open} run={run} busy={busy} onActor={onActor} />
            </Dialog>
          )}
        </>
      )}
    </section>
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
  const [editing, setEditing] = useState(false);
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
  return (
    <>
      <div className="reg-page-heading">
        <div>
          <span className="reg-eyebrow">{state.year} / MY PROFILE</span>
          <h1>Thank you, {current.data.name.split(" ")[0]}.</h1>
          <p>Your registration is complete. This is the information you gave us.</p>
        </div>
        <Badge status={current.status === "unclaimed" ? "pending" : current.status} />
      </div>
      <div className="reg-status-layout">
        <section className="reg-card">
          <div className="reg-person-summary">
            <Media
              path={current.data.photo}
              alt={current.data.name}
              className="reg-avatar"
            />
            <div>
              <h2>{current.data.name}</h2>
              <p>
                {titleCase(current.data.role)} · {orgLabel(current.data.organization)}
              </p>
              <small>{current.data.denomination || current.data.church}</small>
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
              <dd>{current.data.dob}</dd>
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
          <div className={`reg-status-message ${current.status === "unclaimed" ? "pending" : current.status}`}>
            <h3>
              {current.status === "confirmed"
                ? "Your registration is confirmed."
                : current.status === "denied"
                  ? "Your registration was not approved."
                  : current.resubmit
                    ? "The office has asked you to update your registration."
                    : current.status === "pending"
                      ? "Thank you. Your registration is being processed."
                      : current.status === "removed"
                        ? "Your annual roster status has changed."
                        : "Thank you. Your registration is being processed."}
            </h3>
            <p>
              {current.status === "confirmed"
                ? "You can now pay your annual renewal ministerial fee."
                : current.status === "denied" || current.resubmit
                  ? current.bishopNote || "Please contact the office."
                  : current.status === "pending"
                    ? `${current.payment === "verified" ? "Your payment has been received. " : ""}${pastorCount ? `${pastorCount} pastor${pastorCount === 1 ? "" : "s"} uploaded. ` : ""}The office is confirming your registration; you will see the result here. You can add more pastors under My pastors at any time.`
                    : current.status === "removed"
                      ? "Contact your bishop or the office to discuss this change. Your registration and payment history have been retained."
                      : `${current.payment === "verified" ? "Your payment has been received. " : ""}Your bishop and the office are confirming your registration; you will see the result here.`}
            </p>
          </div>
          {current.resubmit && (
            <button className="reg-secondary" onClick={() => setEditing(true)}>
              Update my registration
            </button>
          )}
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
  const [data, setData] = useState(() => ({
      ...{
        role: fixedRole || profile?.role || "pastor",
        gender: "",
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
    [slots, setSlots] = useState(() => blankSlots(22)),
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
      const listed = (DENOMINATIONS[next.organization] || []).find((d) => normalName(d) === normalName(ref.denomination));
      if (!next.denomination && listed) next.denomination = listed;
      if (d.role === "pastor" && ref.bishop && !d.bishopFirstName && !d.bishopLastName) {
        const parts = ref.bishop.trim().split(/\s+/);
        next.bishopFirstName = parts.slice(0, -1).join(" ") || parts[0];
        next.bishopLastName = parts.length > 1 ? parts.at(-1) : "";
      }
      return next;
    });
  // Pastors choose from bishops who have already registered; the search forgives
  // spelling and word order.
  const [bishopQuery, setBishopQuery] = useState("");
  const registeredBishops = state.bishops || [];
  const chosenBishop = registeredBishops.find((b) => b.id === data.bishopId) || null;
  const bishopMatches = useMemo(() => {
    const q = normalName(bishopQuery);
    if (data.role !== "pastor" || chosenBishop || q.length < 2) return [];
    return registeredBishops
      .filter((b) => normalName(b.name).includes(q) || namesAlike(b.name, bishopQuery))
      .slice(0, 6);
  }, [bishopQuery, data.role, chosenBishop, registeredBishops]);
  const pickBishop = (b) =>
    setData((d) => {
      const parts = b.name.trim().split(/\s+/);
      return {
        ...d,
        bishopId: b.id,
        bishopFirstName: parts.slice(0, -1).join(" "),
        bishopLastName: parts.at(-1) || "",
        photoConfirmed: false,
      };
    });
  const set = (key, value) =>
    setData((d) => {
      const next = { ...d, [key]: value, photoConfirmed: false };
      if (key === "organization") {
        next.denomination = "";
        // FLOW is an online fellowship: its members are listed as Online, Ghana.
        if (value === "FLOW") { next.city = "Online"; next.country = "Ghana"; }
      }
      if (key === "firstName" || key === "lastName")
        next.name = [next.firstName, next.lastName].filter(Boolean).join(" ");
      return next;
    });
  const steps = editing
    ? ["details", "review"]
    : data.role === "bishop"
      ? ["details", "pastors", "payment", "review"]
      : ["details", "payment", "review"];
  const review = step === "review";
  const stepLabel = { details: "Your details", pastors: "Your pastors", payment: "Payment", review: "Review" };
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
              ? "Review everything."
              : step === "pastors"
                ? "Your pastors."
                : step === "payment"
                  ? "Annual renewal fee."
                  : editing
                    ? "Update my details."
                    : "Roll of Good Standing."}
          </h1>
          <p>
            {step === "review"
              ? "Check everything below, then confirm to submit."
              : step === "pastors"
                ? "Upload or paste the pastors under your oversight. They are recognised automatically when they register."
                : step === "payment"
                  ? "Send the fee by mobile money and upload the confirmation."
                  : `Complete your ${state.year} registration to maintain your place on the Roll of Good Standing.`}
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
                        set("photo", await api.upload(actor, file));
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
            <figure className="reg-attire-example">
              <img src={`${base}/${attireExample(data).file}`} alt={attireExample(data).alt} />
              <figcaption>
                <b>{attireExample(data).caption}</b>
                {data.role === "bishop" && data.gender !== "female" ? "Wear your red pastoral jacket. " : data.gender === "female" ? "" : "Wear pastoral attire. "}Face clearly visible. Plain background. No selfies or casual clothing.
              </figcaption>
            </figure>
          </div>
          <div className="reg-amount">
            <span>Annual renewal ministerial fee</span>
            <strong>
              ${AMOUNTS[data.role]}
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
                  validateProfile(data, actor.email);
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
                  label="Ministerial Category"
                >
                  <select
                    value={data.role}
                    onChange={(e) => set("role", e.target.value)}
                    disabled={Boolean(profile) || Boolean(fixedRole)}
                  >
                    <option value="pastor">Pastor</option>
                    <option value="bishop">
                      Bishop
                    </option>
                  </select>
                </Field>
                <Field label="Organization">
                  <select
                    value={data.organization}
                    onChange={(e) => set("organization", e.target.value)}
                    required
                  >
                    <option value="">Select organization</option>
                    {ORGANIZATIONS.map((o) => (
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
                  hint={data.role === "bishop" && data.gender === "female" ? `You will be listed as ${titleFor(data)}.` : undefined}
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
                        Linked to your existing record. Check the details below are still
                        correct.{" "}
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
                          None of these are me
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
                  hint="Include your country code. Do not add a leading zero. Example: +233 24 123 4567. Registration updates will be sent to you on WhatsApp."
                >
                  <input
                    required
                    type="tel"
                    value={data.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    autoComplete="tel"
                  />
                </Field>
                <Field label="Date of birth" hint={data.role === "pastor" ? "Enter your full name and date of birth exactly as they appear on your bishop’s list." : undefined}>
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
                {(DENOMINATIONS[data.organization] || []).length > 0 && (
                  <Field label="Denomination">
                    <select
                      value={data.denomination}
                      onChange={(e) => set("denomination", e.target.value)}
                      required
                    >
                      <option value="">Select denomination</option>
                      {(DENOMINATIONS[data.organization] || []).map((d) => (
                        <option key={d}>{d}</option>
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
                  <div className="reg-field wide">
                    <label>Your bishop</label>
                    {chosenBishop ? (
                      <div className="reg-candidate chosen">
                        <Portrait person={chosenBishop} />
                        <div>
                          <b>{chosenBishop.name}</b>
                          <small>{[chosenBishop.denomination, chosenBishop.organization].filter(Boolean).join(" · ")}</small>
                          <button type="button" className="reg-text" onClick={() => set("bishopId", "")}>
                            Change bishop
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <input
                          aria-label="Find your bishop"
                          placeholder="Type your bishop’s name"
                          autoComplete="off"
                          value={bishopQuery}
                          onChange={(e) => setBishopQuery(e.target.value)}
                        />
                        {bishopMatches.length > 0 && (
                          <div className="reg-candidates">
                            {bishopMatches.map((b) => (
                              <div key={b.id} className="reg-candidate">
                                <Portrait person={b} />
                                <div>
                                  <b>{b.name}</b>
                                  <small>{[b.denomination, b.organization].filter(Boolean).join(" · ")}</small>
                                  <button type="button" className="reg-secondary" onClick={() => pickBishop(b)}>
                                    This is my bishop
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <small>
                          {registeredBishops.length
                            ? bishopQuery.length >= 2 && !bishopMatches.length
                              ? "No registered bishop matches that name. Bishops must register before their pastors; ask yours to sign up at kuriakecastle.org/signup/bishop/."
                              : "Your bishop must register first. Select your bishop’s name from the list."
                            : "No bishop has registered yet. Ask your bishop to sign up first at kuriakecastle.org/signup/bishop/."}
                        </small>
                      </>
                    )}
                  </div>
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
                <button className="reg-primary" disabled={busy || fileBusy}>
                  {editing ? "Review changes →" : "Continue →"}
                </button>
              </div>
            </form>
          ) : step === "pastors" ? (
            <div>
              <div className="reg-section-head">
                <div>
                  <h2>Add your pastors</h2>
                  <p>
                    Enter each pastor’s <b>Full Name</b> and <b>Date of Birth</b> on a row below, or upload an Excel or CSV file with those two columns (date as DD/MM/YYYY). Empty rows are ignored. Each pastor adds their own photo when they register.
                  </p>
                </div>
              </div>
              <PastorSlots slots={slots} setSlots={setSlots} />
              <details className="reg-upload-alt">
                <summary>Have a spreadsheet instead? Upload it here</summary>
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
                          setSlots((cur) => { const kept = cur.filter((r) => r.name.trim() || r.dob); const merged = [...kept, ...rows]; return merged.length < 22 ? [...merged, ...blankSlots(22 - merged.length)] : merged; });
                          setRosterError("");
                        })
                        .catch((err) => setRosterError(err.message));
                    }}
                  />
                </Field>
              </details>
              {rosterError && <p role="alert" className="reg-status-message unclaimed">{rosterError}</p>}
              <p className="reg-small">{filledSlots(slots).length ? `${uniqueRows(filledSlots(slots)).length} pastor${uniqueRows(filledSlots(slots)).length === 1 ? "" : "s"} ready to submit. You will see them again on the review page before confirming.` : "No pastors entered yet."}</p>
              <div className="reg-form-actions">
                <button type="button" className="reg-secondary" onClick={back}>← Back</button>
                <button
                  type="button"
                  className="reg-primary"
                  disabled={!slotsComplete(slots)}
                  title={slotsComplete(slots) ? undefined : "Finish or clear the highlighted rows first"}
                  onClick={() => { setRosterRows(uniqueRows(filledSlots(slots))); next(); }}
                >
                  {filledSlots(slots).length ? "Continue →" : "I’ll add my pastors later →"}
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
                    ${AMOUNTS[data.role]} <small>USD</small>
                    {rate > 0 ? <small> · about {localAmount(AMOUNTS[data.role], rate, currency)}</small> : null}
                  </h2>
                  <p>${AMOUNTS[data.role]} USD non-refundable registration fee · {titleCase(data.role)} · {state.year}. Pay by card or mobile money through Paystack.</p>
                </div>
              </div>
              {mine?.payment === "verified" ? (
                <div className="reg-status-message confirmed">
                  <h3>Thank you for your commitment.</h3>
                  <p>${AMOUNTS[data.role]} USD received by card or mobile money. Next, look over your profile{data.role === "bishop" ? " and your pastors" : ""} and confirm.</p>
                </div>
              ) : state.paystackKey ? (
                <>
                  <p>Card, or mobile money (MTN, Telecel, AT). You will return here once the payment goes through.</p>
                  <PaystackButton
                    current={{ amount: AMOUNTS[data.role], year: state.year, data }}
                    actor={actor}
                    run={run}
                    refresh={refresh}
                    currency={currency}
                    rate={rate}
                    paystackKey={state.paystackKey}
                    beforePay={() => api.action(actor, "save", data)}
                  />
                </>
              ) : (
                <p className="reg-payment-instructions">Card and mobile-money payment is not switched on yet. Continue for now; the office will let you know when to pay.</p>
              )}
              <div className="reg-form-actions">
                <button type="button" className="reg-secondary" onClick={back}>← Back</button>
                {/* Payment comes first: with checkout available, the only way forward is to pay. */}
                {mine?.payment === "verified" ? (
                  <button className="reg-primary" disabled={busy}>View your profile →</button>
                ) : state.paystackKey ? (
                  <span className="reg-small">Complete the payment above to continue.</span>
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
                <h2>Is this the right photo?</h2>
                <p>
                  {data.role === "bishop"
                    ? "Your photo must show you wearing your official red jacket. A collar without the red jacket is not sufficient."
                    : "Your photo must show you in your official pastoral attire."}{" "}
                  No casual clothing or selfies. Your face must be fully visible
                  against a plain background.
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
                  {attireExample(data).alternative && (
                    <figure>
                      <img src={`${base}/${attireExample(data).alternative.file}`} alt={attireExample(data).alternative.alt} />
                      <figcaption>{attireExample(data).alternative.caption}</figcaption>
                    </figure>
                  )}
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
                    ? "I confirm this is me wearing my official red jacket, with my face fully visible against a plain background."
                    : "I confirm this is me in official pastoral attire, with my face fully visible against a plain background."}
                </label>
                <button
                  className="reg-secondary"
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
                  <h3>Your pastors <b>{rosterRows.length}</b></h3>
                  {rosterRows.length ? (
                    <RowsTable rows={rosterRows} />
                  ) : (
                    <p className="reg-small">None added yet. You can add them later under My pastors.</p>
                  )}
                  <button type="button" className="reg-text" onClick={() => setStep("pastors")}>Change</button>
                </section>
              )}
              {!editing && (
                <section className="reg-review-block">
                  <h3>Payment</h3>
                  {mine?.payment === "verified" ? (
                    <p>${AMOUNTS[data.role]} USD paid by card or mobile money. <Badge status="verified" /></p>
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
                  I consent to Kuriake Castle showing my name, title, photograph,
                  organization, denomination, city and country on the public Roll
                  of Good Standing. My email address, phone number and date of
                  birth are never shown publicly and are used only by the office
                  and my bishop to confirm my registration. I have read the{" "}
                  <a href={`${base}/privacy/`} target="_blank" rel="noreferrer">privacy policy</a>{" "}
                  and <a href={`${base}/terms/`} target="_blank" rel="noreferrer">terms</a>.
                </span>
              </label>
              <p className="reg-small">
                The annual renewal ministerial fee is ${AMOUNTS[data.role]} USD and is
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
      Annual renewal ministerial fee: ${amount} USD
      {rate > 0
        ? ` · about ${localAmount(amount, rate, currency)} in ${country.trim()}`
        : currency === "USD"
          ? ""
          : currency
            ? " · fetching today’s rate…"
            : " · we could not match that country to a currency; the amount is charged in USD"}
      <small>
        Indicative rate. Kuriake Castle is paid in US dollars; your bank or mobile-money
        provider sets the final amount.
      </small>
    </p>
  );
}
// Card or mobile money through Paystack's inline checkout. The amount is charged
// in GHS at the same indicative rate the member sees; the server confirms the
// reference with Paystack before the payment is recorded.
function PaystackButton({ current, actor, run, refresh, rate, currency, paystackKey, beforePay, label }) {
  const [ready, setReady] = useState(Boolean(globalThis.PaystackPop));
  useEffect(() => {
    if (globalThis.PaystackPop) return setReady(true);
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => setReady(true);
    document.body.appendChild(script);
  }, []);
  const ghs = rate && currency === "GHS" ? current.amount * rate : null;
  const usdOnly = !ghs;
  return (
    <div className="reg-paystack">
      <button
        type="button"
        className="reg-primary full"
        disabled={!ready}
        onClick={() =>
          run(async () => {
            await beforePay?.();
            const reference = await new Promise((resolve, reject) => {
              const handler = globalThis.PaystackPop.setup({
                key: paystackKey,
                email: actor.email,
                amount: Math.round((usdOnly ? current.amount : ghs) * 100),
                currency: usdOnly ? "USD" : "GHS",
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
        {label || `Pay ${ghs ? `GHS ${Math.round(ghs).toLocaleString()}` : `$${current.amount}`} by card or mobile money →`}
      </button>
      <small className="reg-small">
        Secure checkout by Paystack: cards, MTN / Telecel / AT mobile money, bank.
        {ghs ? ` Charged in Ghana cedis at today’s indicative rate for $${current.amount} USD.` : ""}
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
      <span className="reg-eyebrow">ANNUAL RENEWAL MINISTERIAL FEE</span>
      <h2>
        ${current.amount}
        <small> USD</small>
      </h2>
      {rate > 0 && (
        <p className="reg-local-amount">
          about {localAmount(current.amount, rate, currency)} in {current.data.country}
          <small>Indicative rate, {rates.updated || "recently updated"}. Your bank or mobile-money provider sets the final amount.</small>
        </p>
      )}
      <b>Non-refundable</b>
      <p>
        {current.year} · {titleCase(current.data.role)}
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
            {titleCase(p.role)} · {orgLabel(p.organization)}
          </p>
          {record.status && <Badge status={record.status} />}
        </div>
      </div>
      <dl className="reg-details">
        {[
          ["Email", p.email],
          ["Phone", p.phone],
          ["Date of birth", p.dob],
          ["Denomination", p.denomination || p.church || "Not applicable"],
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
function Portrait({ person, className = "" }) {
  if (person.photo)
    return (
      <Media path={person.photo} alt={person.name} className={className} />
    );
  if (person.image)
    return (
      <img
        className={className}
        style={{ cssText: portraitStyle(person.image) }}
        src={`${base}/${person.image}`}
        alt={person.name}
        loading="lazy"
        decoding="async"
      />
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
      ? "Registered this cycle"
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
  (!f.denomination || p.denomination === f.denomination) &&
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
          set({ org: e.target.value, denomination: "", country: "" })
        }
      >
        <option value="">All organizations</option>
        {options.organization.map((o) => (
          <option key={o} value={o}>{orgLabel(o)}</option>
        ))}
      </select>
      <select
        aria-label="Filter denomination"
        value={filter.denomination}
        onChange={(e) => set({ denomination: e.target.value })}
      >
        <option value="">All denominations</option>
        {options.denomination.map((d) => (
          <option key={d}>{d}</option>
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
const filterOptions = (list, org) => {
  const scope = list.filter((p) => !org || p.organization === org);
  const unique = (field, from) =>
    [...new Set(from.map((p) => p[field]).filter(Boolean))].sort();
  return {
    organization: unique("organization", list),
    denomination: unique("denomination", scope),
    country: unique("country", scope),
  };
};
// The same duplicate rule the server applies, so the preview matches what will be kept.
const uniqueRows = (rows) =>
  rows.filter((r, i) => !rows.slice(0, i).some((x) => namesAlike(x.name, r.name) && dobClose(x.dob, r.dob)));
// A sheet of blank rows to fill in: full name and date of birth per pastor.
// Empty rows are ignored; a spreadsheet can fill rows too; more rows on demand.
const blankSlots = (n) => Array.from({ length: n }, () => ({ name: "", dob: "" }));
function PastorSlots({ slots, setSlots, count = 22 }) {
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
              <tr key={i}><td>{i + 1}</td><td>{r.name}</td><td>{String(r.dob).includes("-") ? r.dob.split("-").reverse().join("/") : r.dob}</td>{onRemove && <td><button type="button" className="reg-text danger" onClick={() => onRemove(i)} aria-label={`Remove ${r.name}`}>×</button></td>}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function PeopleGrid({ list, limit, onMore, onOpen, dots = true }) {
  return (
    <>
      <div className="reg-people-grid">
        {list.slice(0, limit).map((p) => (
          <button
            className="reg-person-card"
            key={p.id}
            onClick={() => onOpen(p)}
          >
            <span className="reg-person-portrait">
              <Portrait person={p} />
            </span>
            <div className="reg-person-name">
              <h3>{p.name}</h3>
              {dots && <Dot person={p} />}
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
  `Directory · ${role === "bishop" ? "Bishops" : "Pastors"} Roll of Good Standing`;
function Directory({ state, year, role, setRole, perform, mode = "original" }) {
  const [filter, setFilter] = useState({
      q: "",
      org: "",
      denomination: "",
      state: "",
    }),
    [limit, setLimit] = useState(PAGE),
    [selected, setSelected] = useState(null);
  const all = useMemo(() => {
    const everyone = directoryPeople(state, people, year);
    // The registered view is what the public roll counts: people confirmed this year.
    return mode === "registered"
      ? everyone.filter((p) => p.registration?.status === "confirmed")
      : everyone;
  }, [state, year, mode]);
  const scope = useMemo(
    () => all.filter((p) => personMatches(p, filter)),
    [all, filter],
  );
  const list = useMemo(
    () => scope.filter((p) => p.role === role),
    [scope, role],
  );
  useEffect(() => setLimit(pageFor(role)), [filter, role]);
  const options = useMemo(
    () => filterOptions(all, filter.org),
    [all, filter.org],
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
  return (
    <>
      <div className="reg-stats">
        {[
          ["Bishops", scope.filter((p) => p.role === "bishop").length],
          ["Pastors", scope.filter((p) => p.role === "pastor").length],
          ["Bishops and pastors", scope.length],
          [
            role === "bishop" ? "Registered this cycle" : "Claimed by a bishop",
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
              list={list}
              limit={limit}
              onMore={() => setLimit((n) => n + 300)}
              onOpen={setSelected}
            />
          ) : (
            <Empty title={`No ${role === "bishop" ? "bishops" : "pastors"} match these filters`}>
              Change the search, organization or denomination.
            </Empty>
          )}
      {selected && (
        <Dialog title={selected.name} onClose={() => setSelected(null)} {...stepper(list, selected, setSelected)}>
          <RecordDetails
            person={selected}
            under={linkedPastors(selected)}
            onOpen={setSelected}
            perform={perform}
          />
        </Dialog>
      )}
    </>
  );
}
function RecordDetails({ person: p, under = [], onOpen, perform }) {
  const changed = (field) =>
    p.recorded && p.recorded[field] && p.recorded[field] !== p[field];
  const r = p.registration;
  const canChoose = Boolean(r && r.data?.photo && p.image && perform);
  const showing = r?.displayPhoto === "reference" ? "reference" : "upload";
  return (
    <>
      <div className="reg-record-hero centred">
        <Portrait person={p} className="reg-record-photo large" />
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
              {p.denominationLogo && (
                <img src={`${base}/${p.denominationLogo}`} alt="" />
              )}
              <span>{p.denomination}</span>
            </p>
          )}
          <p className="reg-record-line">{orgLabel(p.organization)}</p>
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
          ["Denomination", p.denomination || "—"],
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
    </>
  );
}
// Members search the published roster: portrait, name, title, country,
// denomination, branch and who oversees whom. Contact details and dates of
// birth are removed before the roster reaches the browser.
const publicPeople = people.map(({ email, phone, ...rest }) => rest);
// Pastors whose record names this bishop as overseer (typo-tolerant). A bishop
// nobody named has no pastors listed; a pastor who named nobody sits under no one.
const bishopPastors = (bishop, from = publicPeople) => ({
  list: from.filter(
    (p) => p.role === "pastor" && p.bishop && namesAlike(p.bishop, bishop.name),
  ),
  heading: "Pastors under this bishop",
});
function PastorsUnder({ bishop, extra = [], onOpen, dots = false, from }) {
  const [limit, setLimit] = useState(24);
  const named = bishopPastors(bishop, from);
  const seen = new Set(extra.map((q) => q.id));
  const list = [...extra, ...named.list.filter((q) => !seen.has(q.id))];
  const heading = named.heading;
  if (!list.length) return null;
  return (
    <section className="reg-record-group">
      <h3>
        {heading} <b>{list.length.toLocaleString()}</b>
      </h3>
      <div className="reg-thumb-grid">
        {list.slice(0, limit).map((q) => (
          <button key={q.id} onClick={() => onOpen?.(q)} disabled={!onOpen}>
            <Portrait person={q} />
            <span className="reg-thumb-name">
              <b>{q.name}</b>
              {dots && <Dot person={q} />}
            </span>
            <small>{[q.branch, q.country].filter(Boolean).join(" · ")}</small>
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
function PublicRecord({ person: p, onOpen, from }) {
  return (
    <>
      <div className="reg-record-hero">
        <Portrait person={p} className="reg-record-photo" />
        <div>
          <span className="reg-eyebrow">{(p.title || p.role).toUpperCase()}</span>
          <h2>{p.name}</h2>
          <p className="reg-record-country">
            {[p.city, p.country].filter(Boolean).join(", ") ||
              "Location not recorded"}
          </p>
          {p.denomination && (
            <p className="reg-record-denomination">
              {p.denominationLogo && (
                <img src={`${base}/${p.denominationLogo}`} alt="" />
              )}
              <span>{p.denomination}</span>
            </p>
          )}
          {p.role === "pastor" && p.branch && (
            <p className="reg-record-line">Branch · {p.branch}</p>
          )}
          {p.role === "pastor" && (
            <p className="reg-record-line">
              Bishop · {p.bishop || "Not recorded"}
            </p>
          )}
        </div>
      </div>
      {p.role === "bishop" && p.pastors ? (
        p.pastors.length ? (
          <section className="reg-record-group">
            <h3>
              Pastors under this bishop <b>{p.pastors.length.toLocaleString()}</b>
            </h3>
            <div className="reg-thumb-grid">
              {p.pastors.map((q) => (
                <button key={q.id} disabled>
                  <Portrait person={q} />
                  <span className="reg-thumb-name"><b>{q.name}</b></span>
                  <small>{q.registered ? [q.city, q.country].filter(Boolean).join(" · ") || "Registered" : "Not yet registered"}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null
      ) : p.role === "bishop" ? (
        <PastorsUnder bishop={p} onOpen={onOpen} from={from} />
      ) : null}
    </>
  );
}
// The public directory: a search bar, then two doors — Bishops and Pastors with
// their totals — before any faces are shown. Lists the existing roster until the
// office switches the source to this year's roll.
// The open directory at /directory/: no photos, no titles, no cards. Two
// alphabetical columns, bishops left and pastors right, name in black with the
// denomination and place beneath, and one search box over both.
function PublicList({ list }) {
  const [q, setQ] = useState(""),
    [open, setOpen] = useState(null);
  const term = normalName(q);
  // A bishop's name opens the names of the pastors under them: from this year's
  // roll when it carries them, otherwise from who named them in the old roster.
  const pastorsOf = (bishop) =>
    (bishop.pastors?.length ? bishop.pastors : bishopPastors(bishop, list).list)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  const matches = (p) =>
    !term || normalName(`${p.name} ${p.city || ""} ${p.country || ""} ${p.denomination || ""}`).includes(term);
  const column = (role) =>
    list.filter((p) => p.role === role && matches(p)).sort((a, b) => a.name.localeCompare(b.name));
  const columns = [["bishop", "Bishops"], ["pastor", "Pastors"]].map(([role, label]) => [label, column(role)]);
  return (
    <section className="reg-roll">
      <h1 className="reg-doors-title">Roll of Good Standing</h1>
      <input
        type="search"
        className="reg-doors-search"
        aria-label="Search people"
        placeholder="Search by name, city or denomination"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="reg-roll-columns">
        {columns.map(([label, people]) => (
          <div key={label} className="reg-roll-column">
            <h2>
              {label} <b>{people.length.toLocaleString()}</b>
            </h2>
            {people.length ? (
              <ol>
                {people.map((p) => {
                  const under = p.role === "bishop" ? pastorsOf(p) : [];
                  const isOpen = open === p.id;
                  return (
                    <li key={p.id} className={isOpen ? "open" : ""}>
                      {p.role === "bishop" ? (
                        <button type="button" className="reg-roll-name reg-roll-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                          {p.name}
                        </button>
                      ) : (
                        <span className="reg-roll-name">{p.name}</span>
                      )}
                      <small>{[p.denomination, [p.city, p.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</small>
                      {isOpen && (
                        <ol className="reg-roll-under">
                          {under.length ? under.map((u) => (
                            <li key={u.id}>
                              <span className="reg-roll-name">{u.name}</span>
                              <small>{[u.denomination, [u.city, u.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</small>
                            </li>
                          )) : <li><small>No pastors listed under this bishop yet.</small></li>}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="reg-small">{term ? "No one matches." : "Nobody listed yet."}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
function PublicDirectory({ data, embedded = false }) {
  const list = data.source === "roll" ? data.roll : publicPeople;
  const [role, setRole] = useState(null),
    [q, setQ] = useState("");
  if (!embedded) return <PublicList list={list} />;
  const counts = {
    bishop: list.filter((p) => p.role === "bishop").length,
    pastor: list.filter((p) => p.role === "pastor").length,
  };
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
              <strong>{counts[value].toLocaleString()}</strong>
            </button>
          ))}
        </div>
        )}
      </section>
    );
  return (
    <section className={embedded ? "" : "reg-public-list"}>
      {!embedded && <h1 className="reg-doors-title">Roll of Good Standing</h1>}
      <button className="reg-back" onClick={() => { setRole(null); setQ(""); }}>
        <span className="reg-back-arrow" aria-hidden="true">←</span> Back to Bishops and Pastors
      </button>
      <MemberDirectory role={role || "bishop"} setRole={setRole} roll={list} initialQuery={q} />
    </section>
  );
}
// Results for the single search box on the doors page: names first.
function SearchResults({ list, q }) {
  const [selected, setSelected] = useState(null);
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
        <PeopleGrid list={shown} limit={60} onMore={() => {}} onOpen={setSelected} dots={false} />
      ) : (
        <Empty title="No one matches">Try another spelling.</Empty>
      )}
      {selected && (
        <Dialog title={selected.name} onClose={() => setSelected(null)} {...stepper(shown, selected, setSelected)}>
          <PublicRecord person={selected} onOpen={setSelected} from={list} />
        </Dialog>
      )}
    </div>
  );
}
function MemberDirectory({ role, setRole, roll = [], initialQuery = "" }) {
  const [filter, setFilter] = useState({
      q: initialQuery,
      org: "",
      denomination: "",
      country: "",
    }),
    [limit, setLimit] = useState(PAGE),
    [selected, setSelected] = useState(null);
  const scope = useMemo(
    () => roll.filter((p) => personMatches(p, filter)),
    [roll, filter],
  );
  const list = useMemo(
    () => scope.filter((p) => p.role === role),
    [scope, role],
  );
  useEffect(() => setLimit(pageFor(role)), [filter, role]);
  const options = useMemo(
    () => filterOptions(roll, filter.org),
    [roll, filter.org],
  );
  return (
    <>
      <div className="reg-toggle" role="group" aria-label="Bishops or pastors">
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
            <b>{scope.filter((p) => p.role === value).length.toLocaleString()}</b>
          </button>
        ))}
      </div>
      <DirectoryFilters
        filter={filter}
        setFilter={setFilter}
        options={options}
      />
      {list.length ? (
        <PeopleGrid
          list={list}
          limit={limit}
          onMore={() => setLimit((n) => n + 300)}
          onOpen={setSelected}
          dots={false}
        />
      ) : (
        <Empty title={roll.length ? "No one matches this search" : "The roll is filling up"}>
          {roll.length
            ? "Try another name, denomination or country."
            : "Bishops and pastors appear here as they register this year."}
        </Empty>
      )}
      {selected && (
        <Dialog title={selected.name} onClose={() => setSelected(null)} {...stepper(list, selected, setSelected)}>
          <PublicRecord person={selected} onOpen={setSelected} from={roll} />
        </Dialog>
      )}
    </>
  );
}
function ReviewQueue({ records, state, perform, office, canEdit }) {
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
                        {orgLabel(r.data.organization)} · {r.data.denomination || r.data.church}
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
        <Empty title="No Unclaimed registrations">
          Registrations that do not match a bishop’s annual list appear here: yellow when the list nearly matches, red when nothing on it resembles them.
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
  "Your photo does not meet the official attire requirement (red jacket for bishops, face fully visible, plain background).",
  "Some of your details are incorrect or incomplete.",
  "Your organization or denomination is not right.",
  "Your date of birth or phone number looks wrong.",
  "Your pastor list needs correcting.",
];
// Bishops waiting on the office, plus everyone (bishops and pastors) already
// approved this year. Approved rows open read-only.
function BishopApprovals({ records, directory = [], perform, canEdit }) {
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
        {[["awaiting", "Awaiting confirmation"], ["resubmit", "Needs resubmission"], ["denied", "Denied"], ["approved", "Approved"]].map(([value, label]) => (
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
                  {titleFor(r.data)} · {orgLabel(r.data.organization)} · {r.data.email}
                </p>
              </div>
              <Badge status={r.status === "confirmed" ? "confirmed" : r.status === "denied" ? "denied" : "pending"}>{r.resubmit ? "Asked to resubmit" : null}</Badge>
              <span>{r.status === "confirmed" ? "View →" : "Review →"}</span>
            </button>
          ))}
        </div>
      ) : (
        <Empty title={term ? "Nobody matches that search" : view === "awaiting" ? "No bishop registrations awaiting confirmation" : view === "denied" ? "No denied registrations" : view === "approved" ? "Nobody has been approved yet" : "Nobody is waiting to resubmit"}>
          {view === "approved"
            ? "Bishops appear here once the office confirms them; pastors once their bishop confirms them."
            : "Bishops appear here as soon as they submit; they can add their pastors in the meantime."}
        </Empty>
      )}
      {selected && !reviewing && (
        <Dialog title={`${titleFor(selected.data)} ${selected.data.name}`} onClose={() => setSelectedId(null)}>
          <ProfileDetails record={selected} directory={directory} />
        </Dialog>
      )}
      {reviewing && (
        <Dialog
          title="Verify bishop account"
          onClose={() => setSelectedId(null)}
        >
          <ProfileDetails record={selected} />
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
                          <small>{[b.title, b.denomination, b.city, b.country].filter(Boolean).join(" · ")}</small>
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
          <span>Awaiting verification</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Verified commitments · USD</span>
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
        <Empty title="No payments waiting">
          Uploaded payment screenshots will appear here for verification.
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
              <small>{reference.denomination}</small>
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
    [remove, setRemove] = useState(null),
    [reason, setReason] = useState("Transferred"),
    [note, setNote] = useState(""),
    [carry, setCarry] = useState(false);
  const rows = state.rosters.filter(
    (r) =>
      r.year === year &&
      (!office || !bishopId || r.bishopId === bishopId) &&
      normalName(r.name).includes(normalName(q)),
  );
  const own = state.rosters.filter(
    (r) => r.year === year && r.bishopId === actor.id,
  );
  return (
    <>
      <div className="reg-stats">
        <div>
          <span>On the list</span>
          <strong>{rows.filter((r) => r.status === "active").length}</strong>
        </div>
        <div>
          <span>Claimed</span>
          <strong>
            {rows.filter((r) => r.status === "active" && r.pastorId).length}
          </strong>
        </div>
        <div>
          <span>Unclaimed</span>
          <strong>
            {rows.filter((r) => r.status === "active" && !r.pastorId).length}
          </strong>
        </div>
        <div>
          <span>Removed this cycle</span>
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
                      {reg?.data?.photo ? <Media path={reg.data.photo} alt="" className="reg-avatar small" /> : <span className="reg-avatar small reg-placeholder" aria-hidden="true">◯</span>}
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
                      <Badge status="confirmed">Claimed</Badge>
                    ) : (
                      <Badge status="unclaimed">Unclaimed</Badge>
                    )}
                    {r.note && <small>{r.note}</small>}
                  </td>
                  <td>
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
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No pastors on this list yet">
          {office ? "Bishops add their pastors during registration and under My pastors." : "Add your pastors below; they are recognised automatically when they register."}
        </Empty>
      )}
      {!office && year === state.year && (
        <section className="reg-card reg-roster-input">
          <div className="reg-section-head">
            <div>
              <h2>Add more pastors</h2>
              <p>
                Type each pastor’s <b>full name</b> and <b>date of birth</b>, then add them. Each pastor adds their own photo when they register.
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
            <summary>Have a spreadsheet instead? Upload it here</summary>
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
      {remove && (
        <Dialog title={`Remove ${remove.name}`} onClose={() => setRemove(null)}>
          <p>
            This retains the record and its history. A linked pastor will no
            longer appear in this cycle’s active directory.
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
                      <td>{titleCase(r.data.role)}</td>
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
          <p>No registrations in this cycle.</p>
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
                {{
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
                }[a.action] || a.action}
              </b>
              <time>{new Date(a.at).toLocaleString()}</time>
            </div>
          ))}
        {!state.audit.some((a) => a.year === year) && (
          <p>No activity recorded yet.</p>
        )}
      </section>
      {office && (
        <section className="reg-card">
          <h2>Next year</h2>
          <p>
            Accounts and historical records persist. Opening a new cycle starts
            fresh registration and payment counts.
          </p>
          <button className="reg-secondary" onClick={() => setNext(true)}>
            Open {state.year + 1} registration cycle
          </button>
        </section>
      )}
      {next && (
        <Dialog
          title={`Open ${state.year + 1} registration?`}
          onClose={() => setNext(false)}
        >
          <p>
            This closes new submissions and changes for {state.year}. Everyone
            stays viewable. Bishops must reconfirm their annual lists,
            and everyone must register and pay for the new year.
          </p>
          <button
            className="reg-primary"
            onClick={async () => {
              if (
                await perform(
                  "openYear",
                  { year: state.year + 1 },
                  "New annual cycle opened.",
                )
              )
                setNext(false);
            }}
          >
            Open new cycle
          </button>
        </Dialog>
      )}
    </>
  );
}
