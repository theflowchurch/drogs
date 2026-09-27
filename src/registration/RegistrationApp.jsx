"use client";
import Accounts from './Accounts';
import ApiKeys from './ApiKeys';
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
import { DENOMINATIONS } from "./denominations.mjs";
import {
  ORGANIZATIONS,
  registrationEmail,
  AMOUNTS,
  parseRoster,
  validateProfile,
  normalName,
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
const paymentInstructions = process.env.NEXT_PUBLIC_PAYMENT_INSTRUCTIONS || "";
const statusLabel = {
  draft: "Draft",
  unclaimed: "Unclaimed",
  pending: "Awaiting office approval",
  confirmed: "Confirmed",
  removed: "Removed from annual list",
  unpaid: "Not paid",
  rejected: "Replacement proof needed",
  verified: "Payment verified",
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
function Dialog({ title, onClose, children }) {
  const host = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
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
      >
        <div className="reg-section-head">
          <h2>{title}</h2>
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
  const gated = office || browse;
  const [gate, setGate] = useState(!gated),
    [actor, setActor] = useState(null),
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
    api
      .currentActor(office)
      .then((current) => {
        setActor(current);
        // A signed-in member does not pass the office or directory gate.
        if (current && (!gated || (office && current.office))) setGate(true);
      })
      .catch((e) => setError(e.message));
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
    if (!actor) return;
    const update = () => refresh().catch((e) => setError(e.message));
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
        "Unclaimed",
        "Bishop approvals",
        "Payments",
        "Annual lists",
        "History",
        ...(api.apiKeysAvailable ? ["Accounts", "API keys"] : []),
      ]
    : [
        "Registration",
        ...(current && current.status !== "draft" ? ["Directory"] : []),
        ...(profile?.bishopApproved ? ["My pastors", "Unclaimed"] : []),
        "History",
      ];
  async function logout() {
    await run(async () => {
      await api.signOut(office);
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
      <header className="reg-header">
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
          ) : office || browse ? (
            <a className="reg-text" href={`${base}/`}>
              Sign in ↗
            </a>
          ) : signup ? (
            <a className="reg-text" href={`${base}/`}>
              Already have an account? Sign in ↗
            </a>
          ) : (
            <a className="reg-text" href={`${base}/signup/`}>
              Create an account ↗
            </a>
          )}
        </div>
      </header>
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
      {!gate ? (
        <Gate
          office={office}
          onEnter={(code) => run(async () => {
            if (api.live) setActor(await api.accessWithCode(code, office));
            else if (code !== "1234") throw Error("That access code is not correct.");
            sessionStorage.setItem("drogs-registration-gate", String(Date.now() + 1800000));
            setGate(true);
          })}
        />
      ) : browse ? (
        <div className="reg-shell">
          <aside className="reg-sidebar">
            <span className="reg-eyebrow">Kuriake Castle</span>
            <div className="reg-nav">
              <button className="active">
                <span>Directory</span>
              </button>
            </div>
            <div className="reg-side-note">
              <b>Every bishop and pastor</b>
              <p>
                To update your own information, <a href={`${base}/`}>register</a>.
              </p>
            </div>
          </aside>
          <main className="reg-main">
            <div className="reg-page-heading">
              <div>
                <span className="reg-eyebrow">Kuriake Castle</span>
                <h1>Directory</h1>
                <p>Every bishop and pastor in Kuriake Castle.</p>
              </div>
            </div>
            <MemberDirectory />
          </main>
        </div>
      ) : !actor && !office ? (
        <Account
          office={office}
          signup={signup}
          run={run}
          busy={busy}
          onActor={setActor}
        />
      ) : !actor ? (
        <div className="reg-loading" role="status">
          Opening your workspace…
        </div>
      ) : !state ? (
        <div className="reg-loading" role="status">
          Opening your workspace…
        </div>
      ) : office && !isOffice ? (
        <Empty title="Office access is required">
          This account has not been assigned office access.
        </Empty>
      ) : (
        <div className="reg-shell">
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
                      <h1>{tab}</h1>
                      <p>
                        {
                          {
                            Directory: office
                              ? "Every bishop and pastor in Kuriake Castle. Green: the bishop has registered, or the pastor has been claimed by their bishop this cycle. Red: not yet."
                              : "Every bishop and pastor in Kuriake Castle.",
                            Unclaimed:
                              "Registrations waiting for a bishop to confirm their place.",
                            "Bishop approvals":
                              "Verify each bishop before they can confirm pastors.",
                            "My pastors":
                              "Submit and maintain the names of the pastors under your oversight.",
                            "Annual lists":
                              "The pastors submitted by each bishop, including changes during the year.",
                            Payments:
                              "Review payment screenshots and confirm received commitments.",
                            History: "Previous cycles and what changed.",
                            Accounts: "See who has created an account and when they last signed in.",
                            "API keys": "Give connected applications controlled, read-only access to Kuriake Castle.",
                          }[tab]
                        }
                      </p>
                    </div>
                  </div>
                  {tab === "Accounts" && <Accounts run={run} />}
                  {tab === "API keys" && <ApiKeys run={run} />}
                  {tab === "Directory" &&
                    (office ? (
                      <Directory state={state} year={Number(year)} />
                    ) : (
                      <MemberDirectory />
                    ))}
                  {tab === "Unclaimed" && (
                    <ReviewQueue
                      records={scoped.filter((r) => r.status === "unclaimed")}
                      state={state}
                      perform={perform}
                      office={office}
                      canEdit={Number(year) === state.year}
                    />
                  )}
                  {tab === "Bishop approvals" && (
                    <BishopApprovals
                      records={scoped.filter(
                        (r) =>
                          r.data.role === "bishop" && r.status === "pending",
                      )}
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
                  {(tab === "My pastors" || tab === "Annual lists") && (
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
        <img src={`${base}/assets/brand/castle-icon.png`} alt="" />
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
            {office ? "Admin code" : "Website code"}
          </label>
          <input
            id="entrance"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={office ? "Enter admin code" : "Enter website code"}
            type="password"
            required
            autoComplete="current-password"
          />
          <button className="reg-primary">
            Enter Kuriake Castle <span>→</span>
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
function Account({ office, signup = false, run, busy, onActor }) {
  const [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [token, setToken] = useState("");
  return (
    <section className={`reg-account ${signup ? "signup" : "signin"}`}>
      {signup && (
        <div
          className="reg-hero-image"
          style={{ backgroundImage: `url(${base}/assets/brand/signup-hero.jpg)` }}
          aria-hidden="true"
        />
      )}
      <div>
        <img
          className="reg-account-mark"
          src={`${base}/assets/brand/castle-icon.png`}
          alt=""
        />
        <span className="reg-eyebrow">
          {office ? "OFFICE ACCESS" : signup ? "NEW ACCOUNT" : "KURIAKE CASTLE"}
        </span>
        <h1>
          {sent
            ? "Check your email."
            : signup
              ? "Create your account."
              : "Sign in."}
        </h1>
        <p>
          {signup
            ? api.live
              ? "Enter your email and we’ll send a one-time code. Then register your details and complete your commitment."
              : "Enter your email to create your account on this device."
            : api.live
              ? "Use the email you registered with. We’ll send a one-time code."
              : "Enter the email you registered with on this device."}
        </p>
        {signup ? (
          <ol className="reg-steps">
            <li>
              <b>01</b> Create your account
            </li>
            <li>
              <b>02</b> Register your details
            </li>
            <li>
              <b>03</b> Confirm and pay
            </li>
          </ol>
        ) : (
          <p className="reg-account-switch">
            New to Kuriake Castle?{" "}
            <a href={`${base}/signup/`}>Create an account →</a>
          </p>
        )}
      </div>
      <form
        className="reg-card"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            if (!api.live) {
              onActor(api.demoSignIn(email, office));
              return;
            }
            if (sent) onActor(await api.verifyCode(email, token));
            else {
              await api.requestCode(email);
              setSent(true);
            }
          });
        }}
      >
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
        <button className="reg-primary full" disabled={busy}>
          {busy
            ? "Please wait…"
            : !api.live
              ? "Continue"
              : sent
                ? signup
                  ? "Verify and create account"
                  : "Verify and sign in"
                : signup
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
        <p className="reg-small">
          {api.live
            ? "Your email is your account identity. Keep using the same address each year."
            : "Accounts and uploads remain on this device until the site is connected."}
        </p>
        {signup && (
          <p className="reg-small">
            Already registered? <a href={`${base}/`}>Sign in</a>
          </p>
        )}
      </form>
    </section>
  );
}
function Participant({
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
  if (!current || current.status === "draft")
    return (
      <RegistrationForm
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
  return (
    <>
      <div className="reg-page-heading">
        <div>
          <span className="reg-eyebrow">{state.year} / MY PROFILE</span>
          <h1>Thank you, {current.data.name.split(" ")[0]}.</h1>
          <p>Your registration is complete. This is the information you gave us.</p>
        </div>
        <Badge status={current.status} />
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
                {titleCase(current.data.role)} · {current.data.organization}
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
            {current.data.role === "pastor" && (
              <div>
                <dt>Bishop</dt>
                <dd>{bishop?.name || current.data.bishopName}</dd>
              </div>
            )}
          </dl>
          <div className={`reg-status-message ${current.status}`}>
            <h3>
              {current.status === "confirmed"
                ? "Your registration is confirmed."
                : current.status === "pending"
                  ? "Your bishop account is awaiting verification."
                  : current.status === "removed"
                    ? "Your annual roster status has changed."
                    : "Your bishop has not confirmed you yet."}
            </h3>
            <p>
              {current.status === "confirmed"
                ? "You can now submit your annual commitment."
                : current.status === "pending"
                  ? "The office will verify your account. Once approved, you can submit your pastor list and make your commitment."
                  : current.status === "removed"
                    ? "Contact your bishop or the office to discuss this change. Your registration and payment history have been retained."
                    : "Your details are safely saved in Unclaimed. Your bishop or the office can confirm your registration. Payment will unlock after confirmation."}
            </p>
          </div>
          <small className="reg-small">
            Need a correction? Contact the office before registering a second
            account.
          </small>
        </section>
        <Payment current={current} actor={actor} run={run} refresh={refresh} />
      </div>
    </>
  );
}
function RegistrationForm({
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
        role: profile?.role || "pastor",
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
        bishopFirstName: "",
        bishopLastName: "",
      },
      ...initial,
      email: registrationEmail(actor.email, initial?.email),
    })),
    [review, setReview] = useState(false),
    [accurate, setAccurate] = useState(false),
    [fileBusy, setFileBusy] = useState(false);
  const set = (key, value) =>
    setData((d) => {
      const next = { ...d, [key]: value, photoConfirmed: false };
      if (key === "organization") next.denomination = "";
      if (key === "firstName" || key === "lastName")
        next.name = [next.firstName, next.lastName].filter(Boolean).join(" ");
      return next;
    });
  async function save() {
    await run(async () => {
      await api.action(actor, "save", data);
      await refresh();
    }, "Draft saved. You can return to finish it.");
  }
  async function send() {
    await run(async () => {
      await api.action(actor, "submit", data);
      await refresh();
    }, "Registration submitted.");
  }
  return (
    <>
      <div className="reg-page-heading">
        <div>
          <span className="reg-eyebrow">
            {state.year} / ANNUAL REGISTRATION
          </span>
          <h1>{review ? "Review your details." : "Let’s make it official."}</h1>
          <p>
            {review
              ? "Check your details before submitting your annual registration."
              : "A few details, an official portrait, and your place in the ministry."}
          </p>
        </div>
        <Badge status="draft">
          {review ? "02 / Review" : "01 / Your details"}
        </Badge>
      </div>
      <div className="reg-form-layout">
        <aside className="reg-form-aside">
          <div className="reg-amount">
            <span>Annual commitment</span>
            <strong>
              ${AMOUNTS[data.role]}
              <small>USD</small>
            </strong>
            <p>
              {titleCase(data.role)} · {state.year}
            </p>
            <hr />
            <b>Non-refundable</b>
            <p>Payment opens after your registration is confirmed.</p>
          </div>
          <div className="reg-guidance">
            <h3>Your official portrait</h3>
            <img
              src={`${base}/${data.role === "bishop" ? "assets/outreach/brian-masuku.png" : "assets/pastors/reconciled-5.webp"}`}
              alt={`Example ${data.role} portrait in official attire`}
            />
            <p>
              {data.role === "bishop"
                ? "Bishops must wear their official red jacket. A collar alone is not sufficient."
                : "Wear your official pastoral attire."}{" "}
              Face the camera, use a plain background and keep your face fully
              visible.
            </p>
            <small>JPG, PNG or WebP · up to 5 MB</small>
          </div>
        </aside>
        <section className="reg-card reg-form-card">
          {!review ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  validateProfile(data, actor.email);
                  setData((d) => ({ ...d, photoConfirmed: false }));
                  setAccurate(false);
                  setReview(true);
                });
              }}
            >
              <div className="reg-section-head">
                <h2>Your registration</h2>
                <span>All fields are required</span>
              </div>
              <div className="reg-fields">
                <Field label="Registering as">
                  <select
                    value={data.role}
                    onChange={(e) => set("role", e.target.value)}
                    disabled={Boolean(profile)}
                  >
                    <option value="pastor">Pastor</option>
                    <option value="bishop">
                      Bishop / Mother / Episcopal Sister
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
                      <option key={o}>{o}</option>
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
                  label="Phone number"
                  hint="Include your country code, e.g. +233"
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
                <Field
                  label="Denomination"
                  hint={
                    !(DENOMINATIONS[data.organization] || []).length
                      ? "Not applicable to this organization."
                      : undefined
                  }
                >
                  <select
                    value={data.denomination}
                    onChange={(e) => set("denomination", e.target.value)}
                    disabled={!(DENOMINATIONS[data.organization] || []).length}
                    required={
                      (DENOMINATIONS[data.organization] || []).length > 0
                    }
                  >
                    <option value="">
                      {(DENOMINATIONS[data.organization] || []).length
                        ? "Select denomination"
                        : "Not applicable"}
                    </option>
                    {(DENOMINATIONS[data.organization] || []).map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Country">
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
                  <>
                    <Field
                      label="Your bishop’s first name"
                      hint="Type both names exactly as your bishop is known, so we can compare them with their annual list."
                    >
                      <input
                        required
                        minLength={2}
                        autoComplete="off"
                        value={data.bishopFirstName}
                        onChange={(e) => set("bishopFirstName", e.target.value)}
                      />
                    </Field>
                    <Field label="Your bishop’s surname">
                      <input
                        required
                        minLength={2}
                        autoComplete="off"
                        value={data.bishopLastName}
                        onChange={(e) => set("bishopLastName", e.target.value)}
                      />
                    </Field>
                  </>
                )}
                <Field label="Photo in official attire" wide>
                  {data.photo && (
                    <Media
                      path={data.photo}
                      alt="Your uploaded portrait"
                      className="reg-upload-preview"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={fileBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
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
                  <small>
                    {fileBusy
                      ? "Uploading…"
                      : data.photo
                        ? "Photo uploaded. Choose a new image to replace it."
                        : "Use the example alongside as a guide."}
                  </small>
                </Field>
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
                  Review registration →
                </button>
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
                    <img
                      src={`${base}/${data.role === "bishop" ? "assets/outreach/brian-masuku.png" : "assets/pastors/reconciled-5.webp"}`}
                      alt={
                        data.role === "bishop"
                          ? "Required bishop red-jacket example"
                          : "Required pastoral attire example"
                      }
                    />
                    <figcaption>
                      {data.role === "bishop"
                        ? "Required: official red jacket"
                        : "Example: official pastoral attire"}
                    </figcaption>
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
                    ? "I confirm this is me wearing my official red jacket, with my face fully visible against a plain background."
                    : "I confirm this is me in official pastoral attire, with my face fully visible against a plain background."}
                </label>
                <button
                  className="reg-secondary"
                  onClick={() => {
                    set("photoConfirmed", false);
                    setReview(false);
                  }}
                >
                  Choose a different photo
                </button>
              </section>
              <ProfileDetails record={{ data }} directory={state.directory} />
              <label className="reg-check">
                <input
                  type="checkbox"
                  checked={accurate}
                  onChange={(e) => setAccurate(e.target.checked)}
                />
                I confirm that these details are accurate and this photograph is
                mine.
              </label>
              <p className="reg-small">
                The annual commitment is ${AMOUNTS[data.role]} USD and is
                non-refundable. No payment is collected on this screen.
              </p>
              <div className="reg-form-actions">
                <button
                  className="reg-secondary"
                  onClick={() => setReview(false)}
                >
                  ← Edit details
                </button>
                <button
                  className="reg-primary"
                  onClick={send}
                  disabled={!accurate || !data.photoConfirmed || busy}
                >
                  Submit registration →
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
      Annual commitment: ${amount} USD
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
function Payment({ current, actor, run, refresh }) {
  const [proof, setProof] = useState(current.proof || ""),
    [ack, setAck] = useState(false),
    [receiptNote, setReceiptNote] = useState(""),
    [rates, setRates] = useState(null);
  const currency = currencyFor(current.data.country);
  useEffect(() => {
    if (!currency || currency === "USD") return;
    let live = true;
    loadRates().then((value) => live && setRates(value));
    return () => {
      live = false;
    };
  }, [currency]);
  const rate = rateFor(rates, currency);
  return (
    <section className="reg-card reg-payment">
      <span className="reg-eyebrow">ANNUAL COMMITMENT</span>
      <h2>
        ${current.amount}
        <small> USD</small>
      </h2>
      {rate > 0 && (
        <p className="reg-local-amount">
          about {localAmount(current.amount, rate, currency)} in{" "}
          {current.data.country}
          <small>
            Indicative rate, {rates.updated || "recently updated"}. Kuriake Castle is
            paid in US dollars; your bank or mobile-money provider sets the
            final amount.
          </small>
        </p>
      )}
      <b>Non-refundable</b>
      <p>
        {current.year} · {titleCase(current.data.role)}
      </p>
      <Badge status={current.payment}>
        {current.payment === "pending" ? "Payment awaiting verification" : null}
      </Badge>
      {current.status !== "confirmed" ? (
        <p className="reg-small">
          Payment is locked until your registration is confirmed.
        </p>
      ) : current.payment === "verified" ? (
        <div className="reg-status-message confirmed">
          <h3>Thank you for your commitment.</h3>
          <p>Your payment has been verified by the office.</p>
        </div>
      ) : (
        <>
          {paymentInstructions ? (
            <div className="reg-payment-instructions">
              {paymentInstructions}
            </div>
          ) : (
            <p className="reg-payment-instructions">
              Payment account details will be provided by the office.
              {!api.live ? " You can test a sample receipt below." : ""}
            </p>
          )}
          {current.paymentNote && (
            <p className="reg-status-message unclaimed">
              {current.paymentNote}
            </p>
          )}
          {current.payment === "pending" ? (
            <p>The office will check your screenshot and confirm receipt.</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api.action(actor, "payment", {
                    proof,
                    nonrefundable: ack,
                  });
                  await refresh();
                }, "Payment proof submitted for verification.");
              }}
            >
              <Field label="Payment screenshot">
                {proof && (
                  <Media
                    path={proof}
                    alt="Payment proof preview"
                    className="reg-proof"
                  />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={api.live && !paymentInstructions}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    run(async () => {
                      const check = await checkReceiptImage(file);
                      if (check.verdict === "photograph") {
                        setReceiptNote("");
                        throw Error(check.reason);
                      }
                      setProof(await api.upload(actor, file, "receipt"));
                      setReceiptNote(
                        check.verdict === "unclear" ? check.reason : "",
                      );
                    });
                  }}
                />
              </Field>
              {receiptNote && (
                <p className="reg-status-message unclaimed">{receiptNote}</p>
              )}
              <label className="reg-check">
                <input
                  required
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I understand that my ${current.amount} USD commitment is
                non-refundable.
              </label>
              <button
                className="reg-primary full"
                disabled={!proof || !ack || (api.live && !paymentInstructions)}
              >
                Submit payment proof →
              </button>
            </form>
          )}
        </>
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
            {titleCase(p.role)} · {p.organization}
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
          <option key={o}>{o}</option>
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
          <option key={o}>{o}</option>
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
function Directory({ state, year }) {
  const [role, setRole] = useState("bishop"),
    [filter, setFilter] = useState({
      q: "",
      org: "",
      denomination: "",
      state: "",
    }),
    [limit, setLimit] = useState(PAGE),
    [selected, setSelected] = useState(null);
  const all = useMemo(
    () => directoryPeople(state, people, year),
    [state, year],
  );
  const scope = useMemo(
    () => all.filter((p) => personMatches(p, filter)),
    [all, filter],
  );
  const list = useMemo(
    () => scope.filter((p) => p.role === role),
    [scope, role],
  );
  useEffect(() => setLimit(PAGE), [filter, role]);
  const options = useMemo(
    () => filterOptions(all, filter.org),
    [all, filter.org],
  );
  // Pastors a bishop confirmed on this cycle's annual list.
  const linkedPastors = (bishop) => {
    const account = state.profiles.find(
      (x) => x.bishopApproved && x.referenceId === bishop.id,
    )?.id;
    if (!account) return [];
    const ids = new Set(
      state.rosters
        .filter(
          (r) =>
            r.year === year &&
            r.bishopId === account &&
            r.status === "active" &&
            r.referenceId,
        )
        .map((r) => r.referenceId),
    );
    return all.filter((q) => ids.has(q.id));
  };
  return (
    <>
      <div className="reg-stats">
        {[
          ["Bishops", scope.filter((p) => p.role === "bishop").length],
          ["Pastors", scope.filter((p) => p.role === "pastor").length],
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
              onMore={() => setLimit((n) => n + PAGE)}
              onOpen={setSelected}
            />
          ) : (
            <Empty title={`No ${role === "bishop" ? "bishops" : "pastors"} match these filters`}>
              Change the search, organization or denomination.
            </Empty>
          )}
      {selected && (
        <Dialog title={selected.name} onClose={() => setSelected(null)}>
          <RecordDetails
            person={selected}
            under={linkedPastors(selected)}
            onOpen={setSelected}
          />
        </Dialog>
      )}
    </>
  );
}
function RecordDetails({ person: p, under = [], onOpen }) {
  const changed = (field) =>
    p.recorded && p.recorded[field] && p.recorded[field] !== p[field];
  return (
    <>
      <div className="reg-record-hero centred">
        <Portrait person={p} className="reg-record-photo large" />
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
          <p className="reg-record-line">{p.organization}</p>
          <span className={`reg-badge ${p.updated ? "verified" : "unclaimed"}`}>
            {statusWords(p)}
          </span>
        </div>
      </div>
      <dl className="reg-details">
        {[
          ["Email", p.email || "—"],
          ["Phone", p.phone || "—"],
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
const bishopPastors = (bishop) => {
  const named = publicPeople.filter(
    (p) => p.role === "pastor" && p.bishop && normalName(p.bishop) === normalName(bishop.name),
  );
  if (named.length) return { list: named, heading: "Pastors under this bishop" };
  if (!bishop.denomination) return { list: [], heading: "" };
  return {
    list: publicPeople.filter(
      (p) => p.role === "pastor" && p.denomination === bishop.denomination,
    ),
    heading: `Pastors in ${bishop.denomination}`,
  };
};
function PastorsUnder({ bishop, extra = [], onOpen, dots = false }) {
  const [limit, setLimit] = useState(24);
  const named = bishopPastors(bishop);
  const seen = new Set(extra.map((q) => q.id));
  const list = [...extra, ...named.list.filter((q) => !seen.has(q.id))];
  const heading = extra.length
    ? named.list.length && named.heading.startsWith("Pastors in")
      ? `Pastors under this bishop and in ${bishop.denomination}`
      : "Pastors under this bishop"
    : named.heading;
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
function PublicRecord({ person: p, onOpen }) {
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
      {p.role === "bishop" && <PastorsUnder bishop={p} onOpen={onOpen} />}
    </>
  );
}
function MemberDirectory() {
  const [role, setRole] = useState("bishop"),
    [filter, setFilter] = useState({
      q: "",
      org: "",
      denomination: "",
      country: "",
    }),
    [limit, setLimit] = useState(PAGE),
    [selected, setSelected] = useState(null);
  const scope = useMemo(
    () => publicPeople.filter((p) => personMatches(p, filter)),
    [filter],
  );
  const list = useMemo(
    () => scope.filter((p) => p.role === role),
    [scope, role],
  );
  useEffect(() => setLimit(PAGE), [filter, role]);
  const options = useMemo(
    () => filterOptions(publicPeople, filter.org),
    [filter.org],
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
          onMore={() => setLimit((n) => n + PAGE)}
          onOpen={setSelected}
          dots={false}
        />
      ) : (
        <Empty title="No one matches this search">
          Try another name, denomination or country.
        </Empty>
      )}
      {selected && (
        <Dialog title={selected.name} onClose={() => setSelected(null)}>
          <PublicRecord person={selected} onOpen={setSelected} />
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
  const bishop =
    selected && state.directory.find((b) => b.id === selected.data.bishopId);
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
  return (
    <>
      <Filters filter={filter} setFilter={setFilter} />
      <div className="reg-queue">
        {filtered(records, filter).map((r) => (
          <button
            key={r.userId}
            className="reg-queue-row unclaimed"
            onClick={() => {
              setSelectedId(r.userId);
              setBishopId("");
              setRosterId("");
            }}
          >
            <Media path={r.data.photo} alt="" className="reg-avatar small" />
            <div>
              <h3>{r.data.name}</h3>
              <p>
                {r.data.organization} · {r.data.denomination || r.data.church}
              </p>
              <small>
                Bishop:{" "}
                {state.directory.find((b) => b.id === r.data.bishopId)?.name ||
                  `${r.data.bishopName || "not given"} (typed, not matched)`}
              </small>
            </div>
            <Badge status="unclaimed" />
            <span>Review →</span>
          </button>
        ))}
      </div>
      {!records.length && (
        <Empty title="No Unclaimed registrations">
          Registrations that do not match a bishop’s annual list will appear
          here in red.
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
                      <option value="">Select approved bishop</option>
                      {state.directory
                        .filter((b) => b.accountId)
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
function BishopApprovals({ records, perform, canEdit }) {
  const [selectedId, setSelectedId] = useState(null),
    [ref, setRef] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const selected = records.find((r) => r.userId === selectedId);
  return (
    <>
      {records.length ? (
        <div className="reg-queue">
          {records.map((r) => (
            <button
              className="reg-queue-row"
              key={r.userId}
              onClick={() => {
                setSelectedId(r.userId);
                setRef("");
                setConfirmed(false);
              }}
            >
              <Media path={r.data.photo} alt="" className="reg-avatar small" />
              <div>
                <h3>{r.data.name}</h3>
                <p>
                  {r.data.organization} · {r.data.email}
                </p>
              </div>
              <Badge status="pending" />
              <span>Verify →</span>
            </button>
          ))}
        </div>
      ) : (
        <Empty title="No bishop accounts awaiting approval">
          New bishop registrations appear here for office verification.
        </Empty>
      )}
      {selected && (
        <Dialog
          title="Verify bishop account"
          onClose={() => setSelectedId(null)}
        >
          <ProfileDetails record={selected} />
          <Field
            label="Match to existing bishop reference"
            hint="Link the correct reference so pastors who selected that name reach this bishop’s account."
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
          <button
            className="reg-primary full"
            disabled={!confirmed || !canEdit}
            onClick={() =>
              perform(
                "approveBishop",
                { userId: selected.userId, referenceId: ref },
                "Bishop account approved.",
              )
            }
          >
            Approve bishop account
          </button>
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
                <p>{r.data.organization}</p>
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
          <p>
            Compare the screenshot with the payment received in your account
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
                {reference.title} · {reference.organization}
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
function Roster({ state, year, actor, office, perform }) {
  const [bishopId, setBishopId] = useState(""),
    [q, setQ] = useState(""),
    [text, setText] = useState(""),
    [inputError, setInputError] = useState(""),
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
          <span>Active pastors on list</span>
          <strong>{rows.filter((r) => r.status === "active").length}</strong>
        </div>
        <div>
          <span>Registered and linked</span>
          <strong>
            {rows.filter((r) => r.status === "active" && r.pastorId).length}
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
            {state.directory
              .filter((b) => b.accountId)
              .map((b) => (
                <option key={b.id} value={b.accountId}>
                  {b.name}
                </option>
              ))}
          </select>
        )}
      </div>
      {!office && year === state.year && (
        <section className="reg-card reg-roster-input">
          <div className="reg-section-head">
            <div>
              <h2>Add your pastors</h2>
              <p>
                One person per line: name, email, phone, church. An email or
                phone is required.
              </p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const rows = parseRoster(text);
                setInputError("");
                perform(
                  "addRoster",
                  { rows },
                  "Pastors added to the annual list.",
                ).then((ok) => {
                  if (ok) setText("");
                });
              } catch (e) {
                setInputError(e.message);
              }
            }}
          >
            <Field label="Pastor list">
              <textarea
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                placeholder={
                  "John Mensah, john@example.com, +233201234567, Grace Church\nMary Owusu, mary@example.com, +233209876543, Hope Church"
                }
              />
            </Field>
            {inputError && <p role="alert">{inputError}</p>}
            <div className="reg-form-actions">
              <small>
                Up to 500 rows. Copy from a spreadsheet or type names.
              </small>
              <button className="reg-primary">Add to annual list →</button>
            </div>
          </form>
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
                <th>Contact</th>
                <th>Kuriake Castle</th>
                {office && <th>Bishop</th>}
                <th>Registration</th>
                <th>List status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.name}</b>
                    <small>{r.church}</small>
                  </td>
                  <td>
                    {r.email}
                    <small>{r.phone}</small>
                  </td>
                  <td>
                    {r.referenceId ? (
                      <Badge status="verified">Confirmed · {r.referenceId}</Badge>
                    ) : (
                      <small>Not linked</small>
                    )}
                  </td>
                  {office && (
                    <td>
                      {
                        state.directory.find((b) => b.accountId === r.bishopId)
                          ?.name
                      }
                    </td>
                  )}
                  <td>{r.pastorId ? "Linked" : "Not yet linked"}</td>
                  <td>
                    <Badge
                      status={r.status === "active" ? "confirmed" : "removed"}
                    >
                      {r.status === "active" ? "Active" : r.reason}
                    </Badge>
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No pastors on this list yet">
          Annual lists are submitted by approved bishops. Old directory entries
          are reference data only.
        </Empty>
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
