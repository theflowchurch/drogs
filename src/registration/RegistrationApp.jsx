"use client";
import Accounts from './Accounts';
import ApiKeys from './ApiKeys';
import {
  useEffect,
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
} from "./model.mjs";
import references from "./reference-bishops.json";
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
export default function RegistrationApp({ office = false }) {
  const [gate, setGate] = useState(false),
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
      .currentActor()
      .then((current) => {
        setActor(current);
        if (current) setGate(true);
      })
      .catch((e) => setError(e.message));
    const until = Number(
      sessionStorage.getItem("drogs-registration-gate") || 0,
    );
    setGate(until > Date.now());
  }, []);
  useEffect(() => {
    if (actor) {
      setGate(true);
      refresh().catch((e) => setError(e.message));
    }
  }, [actor, refresh]);
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
      sessionStorage.setItem(
        "drogs-registration-gate",
        String(Date.now() + 1800000),
      );
      timeout = setTimeout(() => {
        api.signOut().finally(() => {
          setActor(null);
          setGate(false);
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
    : profile?.bishopApproved
      ? ["Registration", "My pastors", "Unclaimed", "History"]
      : ["Registration", "History"];
  async function logout() {
    await run(async () => {
      await api.signOut();
      setActor(null);
      setState(null);
      setGate(false);
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
          <img src={`${base}/assets/mitre-transparent.png`} alt="" />
          <strong>DROGS</strong>
        </a>
        <div className="reg-header-right">
          {gate && actor ? (
            <button className="reg-text" onClick={logout}>
              Sign out
            </button>
          ) : (
            <a className="reg-text" href={`${base}/${office ? "" : "admin/"}`}>
              {office ? "Registration" : "Sign in"} ↗
            </a>
          )}
        </div>
      </header>
      {!api.live && (
        <div className="reg-demo">
          Demo · saved in this browser only · email delivery and shared accounts
          are not connected
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
      ) : !actor && !api.live ? (
        <Account office={office} run={run} busy={busy} onActor={setActor} />
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
                  <span>{n}</span>
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
                  ? "A clear record. Every year."
                  : profile?.name || "Welcome to DROGS"}
              </b>
              <p>
                {office
                  ? "Confirmed registrations enter the directory. Unclaimed pastors stay in their own review queue."
                  : actor.email}
              </p>
              <small>{api.live ? "Secure account" : "Demo account"}</small>
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
                        {office ? "DROGS / OFFICE" : "DROGS / YOUR MINISTRY"}
                      </span>
                      <h1>{tab}</h1>
                      <p>
                        {
                          {
                            Directory:
                              "People registered and confirmed for this annual cycle.",
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
                            History: "Previous cycles and a record of changes.",
                            Accounts: "See who has created an account and when they last signed in.",
                            "API keys": "Give connected applications controlled, read-only access to DROGS.",
                          }[tab]
                        }
                      </p>
                    </div>
                    {!["Accounts", "API keys"].includes(tab) && <Field label="Annual cycle">
                      <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                      >
                        {Array.from(
                          new Set([
                            state.year,
                            ...state.registrations.map((r) => r.year),
                            ...state.rosters.map((r) => r.year),
                          ]),
                        )
                          .sort((a, b) => b - a)
                          .map((y) => (
                            <option key={y}>{y}</option>
                          ))}
                      </select>
                    </Field>}
                  </div>
                  {tab === "Accounts" && <Accounts run={run} />}
                  {tab === "API keys" && <ApiKeys run={run} />}
                  {tab === "Directory" && (
                    <Directory records={scoped} directory={state.directory} />
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
        </div>
      )}
    </div>
  );
}
function Gate({ office, onEnter }) {
  const [password, setPassword] = useState(""),
    [error, setError] = useState("");
  return (
    <section className="reg-gate">
      <div className="reg-gate-glow" />
      <div className="reg-gate-inner">
        <img src={`${base}/assets/mitre-transparent.png`} alt="" />
        <h1>
          <em>DROGS</em>
        </h1>
        <p className="reg-gate-tagline">Digital roll call of good standing</p>
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
            Enter DROGS <span>→</span>
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
function Account({ office, run, busy, onActor }) {
  const [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [token, setToken] = useState("");
  return (
    <section className="reg-account">
      <div>
        <span className="reg-eyebrow">
          {office ? "OFFICE ACCESS" : "YOUR ACCOUNT"}
        </span>
        <h1>{sent ? "Check your email." : "Start with your email."}</h1>
        <p>
          {api.live
            ? "We’ll send a one-time sign-in code. New members create their account here; returning members use the same email."
            : "Explore the new registration flow with a demo account. No email is sent in this version."}
        </p>
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
              ? "Continue with demo account"
              : sent
                ? "Verify and sign in"
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
            : "Demo accounts and uploads remain on this device. Use sample information while testing."}
        </p>
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
          <span className="reg-eyebrow">{state.year} / YOUR REGISTRATION</span>
          <h1>Thank you, {current.data.name.split(" ")[0]}.</h1>
          <p>Your registration has been received.</p>
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
                <dt>Supervising bishop</dt>
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
        bishopName: "",
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
  const [bishopSearch, setBishopSearch] = useState("");
  const options = state.directory.filter(
    (b) =>
      !bishopSearch ||
      normalName(b.name).includes(normalName(bishopSearch)) ||
      b.id === data.bishopId,
  );
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
                {data.role === "pastor" && (
                  <>
                    <Field label="Find your bishop" wide>
                      <input
                        type="search"
                        placeholder="Search bishops by name"
                        value={bishopSearch}
                        onChange={(e) => setBishopSearch(e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Supervising bishop"
                      wide
                      hint="Your bishop must confirm you on this year’s list."
                    >
                      <select
                        required
                        value={data.bishopId}
                        onChange={(e) => set("bishopId", e.target.value)}
                      >
                        <option value="">Select your bishop</option>
                        <option value="missing">My bishop is not listed</option>
                        {options.map((b) => (
                          <option value={b.id} key={b.id}>
                            {b.title || "Bishop"} {b.name}
                            {b.organization ? ` · ${b.organization}` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {data.bishopId === "missing" && (
                      <Field label="Bishop’s full name" wide>
                        <input
                          required
                          value={data.bishopName}
                          onChange={(e) => set("bishopName", e.target.value)}
                        />
                      </Field>
                    )}
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
function Payment({ current, actor, run, refresh }) {
  const [proof, setProof] = useState(current.proof || ""),
    [ack, setAck] = useState(false);
  return (
    <section className="reg-card reg-payment">
      <span className="reg-eyebrow">ANNUAL COMMITMENT</span>
      <h2>
        ${current.amount}
        <small> USD</small>
      </h2>
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
                    if (file)
                      run(async () =>
                        setProof(await api.upload(actor, file, "receipt")),
                      );
                  }}
                />
              </Field>
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
                  "Selected bishop",
                  directory.find((b) => b.id === p.bishopId)?.name ||
                    p.bishopName,
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
function Directory({ records, directory }) {
  const [filter, setFilter] = useState({ q: "", org: "", role: "" }),
    [selected, setSelected] = useState(null);
  const confirmed = records.filter((r) => r.status === "confirmed"),
    shown = filtered(confirmed, filter);
  return (
    <>
      <div className="reg-stats">
        {[
          ["Confirmed registrations", confirmed.length],
          ["Bishops", confirmed.filter((r) => r.data.role === "bishop").length],
          ["Pastors", confirmed.filter((r) => r.data.role === "pastor").length],
          [
            "Payments verified",
            confirmed.filter((r) => r.payment === "verified").length,
          ],
        ].map(([label, n]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <Filters filter={filter} setFilter={setFilter} roles />
      {!shown.length ? (
        <Empty title="No confirmed registrations yet">
          New registrations appear here after confirmation. Existing reference
          records are not counted as registrations.
        </Empty>
      ) : (
        <div className="reg-people-grid">
          {shown.map((r) => (
            <button
              className="reg-person-card"
              key={r.userId}
              onClick={() => setSelected(r)}
            >
              <Media path={r.data.photo} alt={r.data.name} />
              <div>
                <small>
                  {titleCase(r.data.role)} · {r.data.organization}
                </small>
                <h3>{r.data.name}</h3>
                <p>{r.data.denomination || r.data.church}</p>
                <Badge status={r.payment}>
                  {r.payment === "pending" ? "Payment under review" : null}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <Dialog title="Registration details" onClose={() => setSelected(null)}>
          <ProfileDetails record={selected} directory={directory} />
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
  const candidates = selected
    ? state.rosters.filter(
        (r) =>
          r.bishopId === bishop?.accountId &&
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
                Claims:{" "}
                {state.directory.find((b) => b.id === r.data.bishopId)?.name ||
                  r.data.bishopName}
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
                : "The selected bishop does not yet have an approved account, or has not been listed."}
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
              {bishop?.accountId && (
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
                    {bishop.name}. This adds them to the directory and unlocks
                    their payment.
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
      {rows.length ? (
        <div className="reg-table-scroll">
          <table className="reg-table">
            <thead>
              <tr>
                <th>Pastor</th>
                <th>Contact</th>
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
                  openYear: "Annual cycle opened",
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
          <h2>Annual cycle</h2>
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
            This closes new submissions and changes for {state.year}. Existing
            records remain viewable. Bishops must reconfirm their annual lists,
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
