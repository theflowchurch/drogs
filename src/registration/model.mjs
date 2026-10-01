import { DENOMINATIONS } from "./denominations.mjs";
import { GROUPS } from "./groups.mjs";
// Full names for display; the short keys stay as stored identifiers.
export const ORGANIZATION_LABEL = {
  "First Love": "First Love Church",
  "United Denominations": "United Denominations",
  HJC: "Healing Jesus Campaign",
  FLOW: "FLOW",
  DHMM: "DHMM",
};
export const orgLabel = (key) => ORGANIZATION_LABEL[key] || key || "";
// The official-attire example that applies: women by organization (First Love
// red, United Denominations yellow), men by role (bishop red jacket, pastor
// clerical collar; a dark suit and tie is the accepted alternative).
export function attireExample({ role, gender, organization } = {}) {
  if (gender === "female")
    return organization === "United Denominations"
      ? { file: "assets/brand/female-united-denominations-example.jpg", caption: "Required: official attire (United Denominations)", alt: "Required attire example for women in the United Denominations" }
      : { file: "assets/brand/female-first-love-example.jpg", caption: "Required: official attire (First Love)", alt: "Required attire example for women in First Love" };
  if (role === "bishop")
    return { file: "assets/brand/bishop-example.jpg", caption: "Required: official red jacket", alt: "Required bishop red-jacket example" };
  return { file: "assets/brand/pastor-example.jpg", caption: "Required: official pastoral attire", alt: "Required pastoral attire example", alternative: { file: "assets/brand/pastor-suit-example.jpg", caption: "Also accepted: dark suit and tie", alt: "Accepted alternative: dark suit and tie" } };
}
export const ORGANIZATIONS = [
  "First Love",
  "United Denominations",
  "DHMM",
  "FLOW",
  "HJC",
];
export const STORAGE_KEY = "drogs-registration-v1";
export const AMOUNTS = { bishop: 100, pastor: 50 };
// What a member types as the reference on their mobile-money transfer, so the
// line on the office's statement points back to one registration.
export const paymentReference = (r) =>
  `KC-${r.year}-${String(r.userId).replace(/-/g, "").slice(-6).toUpperCase()}`;
export const normalName = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export const normalEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
export const normalPhone = (value) => String(value || "").replace(/\D/g, "");
// Dialling codes for the countries on the roll, so a number typed the local way
// ("024 123 4567" in Ghana) becomes the international form WhatsApp needs.
export const DIAL_CODES = {
  ghana: "233", nigeria: "234", "united states": "1", usa: "1", "united kingdom": "44", uk: "44", "south africa": "27",
  kenya: "254", mozambique: "258", botswana: "267", zambia: "260", liberia: "231", togo: "228", italy: "39", uganda: "256",
  zimbabwe: "263", namibia: "264", "sierra leone": "232", benin: "229", switzerland: "41", australia: "61", canada: "1",
  cameroon: "237", guyana: "592", rwanda: "250", "cote d'ivoire": "225", "cote d'ivoire (ivory coast)": "225", "ivory coast": "225",
  germany: "49", tanzania: "255", "guinea-bissau": "245", jamaica: "1", guinea: "224", eswatini: "268", "new zealand": "64",
  france: "33", brazil: "55", gabon: "241", madagascar: "261", gambia: "220", "burkina faso": "226", mali: "223", senegal: "221",
  niger: "227", chad: "235", ethiopia: "251", malawi: "265", angola: "244", "cape verde": "238", "cabo verde": "238", netherlands: "31",
  belgium: "32", spain: "34", portugal: "351", ireland: "353", sweden: "46", norway: "47", denmark: "45", india: "91",
  "united arab emirates": "971", uae: "971", "trinidad and tobago": "1", "saint kitts and nevis": "1", "st kitts & nevis": "1", barbados: "1",
  "congo": "242", "dr congo": "243", "democratic republic of the congo": "243", "equatorial guinea": "240", "central african republic": "236",
  "south sudan": "211", sudan: "249", egypt: "20", morocco: "212", lesotho: "266", mauritius: "230", seychelles: "248", haiti: "509",
  "burundi": "257", "sao tome and principe": "239", "fiji": "679", "papua new guinea": "675",
};
// "+233 024 123 4567", "0241234567" (with a country), "233241234567" → "+233241234567".
// Returns "" when the number cannot be made international.
export function whatsappNumber(value, country = "") {
  let digits = normalPhone(value);
  const typedPlus = /^\s*\+/.test(String(value || "")) || /^\s*00/.test(String(value || ""));
  if (/^\s*00/.test(String(value || ""))) digits = digits.replace(/^00/, "");
  const code = DIAL_CODES[String(country || "").trim().toLowerCase()] || "";
  const codes = Object.values(DIAL_CODES).sort((a, b) => b.length - a.length);
  if (!typedPlus) {
    if (digits.startsWith("0")) {
      if (!code) return ""; // a local number with no country to place it in
      digits = code + digits.slice(1); // local form: the 0 stands for the country code
    } else if (code ? !digits.startsWith(code) : !codes.some((c) => digits.startsWith(c))) return "";
  }
  // A trunk 0 kept after the country code ("+233 024…") is dropped.
  const dial = codes.find((c) => digits.startsWith(c));
  if (dial && digits[dial.length] === "0" && digits.length - dial.length > 8) digits = dial + digits.slice(dial.length + 1);
  if (digits.length < 8 || digits.length > 15) return "";
  return `+${digits}`;
}
// Dates come as day/month/year from spreadsheets, or ISO from the form.
export function parseDob(value) {
  const v = String(value ?? "").trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y, mo, d;
  if (m) [y, mo, d] = [m[1], m[2], m[3]];
  else if ((m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/))) {
    [d, mo, y] = [m[1], m[2], m[3]];
    if (y.length === 2) y = (Number(y) > 30 ? "19" : "20") + y;
  } else return "";
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const t = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === iso ? iso : "";
}
// Same birthday, or one written with day and month swapped, or a day out.
export function dobClose(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [ay, am, ad] = a.split("-"), [by, bm, bd] = b.split("-");
  if (ay === by && am === bd && ad === bm) return true;
  return Math.abs(Date.parse(a) - Date.parse(b)) <= 86400000;
}
export const registrationEmail = (accountEmail, submittedEmail) =>
  String(accountEmail || "").endsWith("@drogs.invalid")
    ? normalEmail(submittedEmail)
    : normalEmail(accountEmail);
export const emptyState = () => ({
  version: 1,
  year: 2027,
  profiles: [],
  registrations: [],
  rosters: [],
  audit: [],
  // Office-editable structure and roster corrections (all optional; defaults apply when empty).
  hidden: [], // reference ids hidden from the public roll
  catalog: null, // { organizations: [...], denominations: { org: [...] } } or null for the built-in lists
  fees: null, // { bishop, pastor } in USD or null for AMOUNTS
  overrides: {}, // reference id → corrected fields, or { deleted: true }
  extraReferences: [], // people added to the roster by hand
  // Pause new sign-ups (general door and the pastoral-appointments door separately); existing members carry on.
  signup: { closed: false, notice: "", appointments: { closed: false, notice: "" } },
});
export const SIGNUP_PAUSED = "Registration is paused at the moment. Please check back later.";
export const ENTRANCES = ["general", "appointments"];
export const entranceOf = (value) => (value === "appointments" ? "appointments" : "general");
export const signupOf = (state) => ({
  closed: Boolean(state?.signup?.closed),
  notice: String(state?.signup?.notice || "").trim(),
  appointments: { closed: Boolean(state?.signup?.appointments?.closed), notice: String(state?.signup?.appointments?.notice || "").trim() },
});
// The pause that applies to a given door: { closed, notice }.
export const pauseFor = (state, entrance) => { const s = signupOf(state); return entranceOf(entrance) === "appointments" ? s.appointments : { closed: s.closed, notice: s.notice }; };
// The organizations and denominations in force: the office's edited catalog, else the built-in lists.
// Groups sit between an organization and its denominations (UD Ghana, UD Africa,
// United Islands…). A person's group is the one on their record, else the group
// that lists their denomination.
export const catalogOf = (state) =>
  state?.catalog?.organizations?.length
    ? { ...state.catalog, groups: state.catalog.groups || GROUPS }
    : { organizations: ORGANIZATIONS, denominations: DENOMINATIONS, groups: GROUPS };
const denominationKey = (value) => normalName(value).replace(/^the /, "");
export function groupOf(catalog, person) {
  if (person?.group) return person.group;
  const want = denominationKey(person?.denomination || "");
  if (!want) return "";
  for (const [name, g] of Object.entries(catalog?.groups || {})) {
    if (g.organization && person.organization && g.organization !== person.organization) continue;
    if ((g.denominations || []).some((d) => { const k = denominationKey(d); return k && (k === want || want.startsWith(k) || k.startsWith(want)); })) return name;
  }
  return "";
}
export const feesOf = (state) => state?.fees?.bishop ? state.fees : AMOUNTS;
// Fields of an old roster record the office may correct.
export const REFERENCE_FIELDS = ["name", "title", "organization", "denomination", "group", "city", "country", "bishop", "branch", "photo", "phone", "email"];
// Contact details never leave the office: the public page and members see the
// corrected records without phone or email.
const CONTACT_FIELDS = ["phone", "email"];
const scrubContacts = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !CONTACT_FIELDS.includes(k)));
export const publicOverlay = (state) => ({
  signup: signupOf(state),
  hidden: state.hidden || [],
  overrides: Object.fromEntries(Object.entries(state.overrides || {}).map(([k, v]) => [k, scrubContacts(v)])),
  extraReferences: (state.extraReferences || []).map(scrubContacts),
});
// A member's own details flow back onto their original-data record, so the
// office always sees the current number, city and denomination.
function syncReference(state, r) {
  const id = r?.data?.referenceId;
  if (!id) return;
  const d = r.data;
  state.overrides = { ...(state.overrides || {}), [id]: { ...((state.overrides || {})[id] || {}), name: d.name, city: d.city, country: d.country, denomination: d.denomination, organization: d.organization, phone: d.phone, email: d.email } };
}
// Who a broadcast reaches: everyone with an account email, all bishops, all
// pastors, or the people picked by hand. Office-created placeholders are skipped.
// Audiences: registered members (all / bishops / pastors), the original data's
// emails (original-all / original-bishops / original-pastors), or people picked
// by hand from either. One email per address.
export const BROADCAST_AUDIENCES = ["all", "bishops", "pastors", "original-all", "original-bishops", "original-pastors", "selected"];
export function broadcastRecipients(state, audience = "all", ids = [], references = []) {
  const chosen = new Set(ids || []);
  const seen = new Set();
  const take = (p) => { const key = normalEmail(p.email); if (!key || seen.has(key)) return false; seen.add(key); return true; };
  const members = state.profiles.filter((p) => p.email && !/@manual\.invalid$/.test(p.email) && (
    audience === "all" || (audience === "bishops" && p.role === "bishop") || (audience === "pastors" && p.role === "pastor") || (audience === "selected" && chosen.has(p.id))));
  const original = overlayReferences(references, state).filter((p) => p.email && (
    audience === "original-all" || (audience === "original-bishops" && p.role === "bishop") || (audience === "original-pastors" && p.role === "pastor") || (audience === "selected" && chosen.has(p.id))));
  return [...members, ...original.map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.role, original: true }))].filter(take);
}
// The old roster as the office has corrected it: hidden and deleted records out,
// corrected fields in, hand-added people appended.
export function overlayReferences(references, state) {
  const hidden = new Set(state?.hidden || []), overrides = state?.overrides || {};
  const out = [];
  for (const p of references) {
    const o = overrides[p.id];
    if (o?.deleted || hidden.has(p.id)) continue;
    out.push(o ? { ...p, ...Object.fromEntries(REFERENCE_FIELDS.filter((f) => o[f] !== undefined).map((f) => [f, o[f]])) } : p);
  }
  for (const p of state?.extraReferences || []) if (!hidden.has(p.id)) out.push(p);
  return out;
}
export function validateProfile(p, email, { draft = false, catalog = { organizations: ORGANIZATIONS, denominations: DENOMINATIONS } } = {}) {
  const q = {
    role: p.role,
    firstName: String(p.firstName || "").trim(),
    lastName: String(p.lastName || "").trim(),
    name: [p.firstName, p.lastName]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .join(" "),
    denomination: p.denomination || "",
    country: String(p.country || "").trim(),
    city: String(p.city || "").trim(),
    photoConfirmed: p.photoConfirmed === true,
    phone: String(p.phone || "").trim(),
    email: registrationEmail(email, p.email),
    dob: p.dob || "",
    church: String(p.church || "").trim(),
    organization: p.organization || "",
    photo: p.photo || "",
    gender: ["male", "female"].includes(p.gender) ? p.gender : "",
    bishopId: p.bishopId || "",
    referenceId: /^[BP]\d+$/.test(String(p.referenceId || "")) ? p.referenceId : "",
    bishopFirstName: String(p.bishopFirstName || "").trim(),
    bishopLastName: String(p.bishopLastName || "").trim(),
    // When the person agreed to the public listing (ISO time); kept as a record.
    consentedAt: Number.isFinite(Date.parse(p.consentedAt)) ? new Date(p.consentedAt).toISOString() : "",
  };
  q.bishopName = [q.bishopFirstName, q.bishopLastName].filter(Boolean).join(" ");
  if (!["bishop", "pastor"].includes(q.role))
    throw Error("Choose Bishop or Pastor.");
  // WhatsApp numbers are always kept in international form; a number that
  // cannot be placed is refused once the registration is submitted.
  if (q.phone) q.phone = whatsappNumber(q.phone, q.country) || (draft ? q.phone : "");
  if (!draft) {
    if (!q.firstName || !q.lastName || q.name.length > 160)
      throw Error("Enter your first and last names.");
    if (!/^\S+@\S+\.\S+$/.test(q.email))
      throw Error("Enter a valid email address.");
    if (!q.phone)
      throw Error("Enter your WhatsApp number with its country code, e.g. +233 24 123 4567 (no leading 0).");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(q.dob) ||
      !Number.isFinite(Date.parse(q.dob)) ||
      new Date(q.dob).toISOString().slice(0, 10) !== q.dob ||
      q.dob < "1900-01-01" ||
      q.dob >= new Date().toISOString().slice(0, 10)
    )
      throw Error("Enter a valid date of birth in the past.");
    if (!q.country || !q.city) throw Error("Enter your country and city.");
    if (!q.gender) throw Error("Select male or female.");
    const denominations = catalog.denominations[q.organization] || [];
    if (denominations.length && !denominations.includes(q.denomination))
      throw Error("Select a denomination listed under your organization.");
    if (!catalog.organizations.includes(q.organization))
      throw Error("Choose your organization.");
    if (!q.photo) throw Error("Upload your official-attire photo.");
    if (q.role === "pastor" && !q.bishopId)
      throw Error("Choose your bishop from the registered bishops.");
  }
  if (q.bishopId === "missing") q.bishopId = "";
  if (!(catalog.denominations[q.organization] || []).length) q.denomination = "";
  if (q.role === "bishop") {
    q.bishopId = "";
    q.bishopName = "";
    q.bishopFirstName = "";
    q.bishopLastName = "";
  }
  return q;
}
export function bishopFor(state, key) {
  return state.profiles.find(
    (p) =>
      p.role === "bishop" &&
      p.bishopApproved &&
      (p.referenceId || p.id) === key,
  );
}
// A bishop who has submitted this year's registration and is not denied.
export const submittedBishop = (state, p) =>
  Boolean(
    p &&
      p.role === "bishop" &&
      p.bishopDecision !== "denied" &&
      state.registrations.some(
        (r) => r.userId === p.id && r.year === state.year && r.status !== "draft",
      ),
  );
export function bishopKeyed(state, key) {
  return state.profiles.find(
    (p) => (p.referenceId || p.id) === key && submittedBishop(state, p),
  );
}
export const registeredBishops = (state) =>
  state.profiles
    .filter((p) => submittedBishop(state, p))
    .map((p) => {
      const r = state.registrations.find((x) => x.userId === p.id && x.year === state.year);
      return { id: bishopKey(p), accountId: p.id, name: p.name, approved: Boolean(p.bishopApproved), photo: r?.data.photo || "", organization: p.organization || "", denomination: r?.data.denomination || "" };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
export const approvedBishop = (state, id) =>
  state.profiles.some(
    (p) => p.id === id && p.role === "bishop" && p.bishopApproved,
  );
export const bishopKey = (bishop) => bishop.referenceId || bishop.id;
const editDistance = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length][b.length];
};
// An initial only stands in for a word when it is in the name being checked
// (the shorter one); initials in the longer name must not act as wildcards,
// or "Kent Njeru" would be alike to "Farrell N.K.A Bruce".
const wordsAlike = (a, b) =>
  a === b ||
  (Math.min(a.length, b.length) >= 3 &&
    editDistance(a, b) <= (Math.max(a.length, b.length) > 6 ? 2 : 1)) ||
  (a.length === 1 && b.startsWith(a));
// Two names are alike when every word of the shorter one has a close match in
// the longer, in any order: "Nina Masuko" ~ "Nely Nina Masuku", "Masuku Nina".
export function namesAlike(a, b) {
  const x = normalName(a).split(" ").filter(Boolean),
    y = normalName(b).split(" ").filter(Boolean);
  if (x.length < 2 || y.length < 2) return false;
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
  const pool = [...longer];
  return shorter.every((w) => {
    const i = pool.findIndex((v) => wordsAlike(w, v));
    if (i < 0) return false;
    pool.splice(i, 1);
    return true;
  });
}
// The bishop the pastor named, when exactly one approved bishop's name is alike.
// Anything ambiguous is left for the office.
export function bishopNamed(state, name) {
  if (!normalName(name)) return null;
  const found = state.profiles.filter(
    (p) => p.role === "bishop" && p.bishopApproved && namesAlike(p.name, name),
  );
  return found.length === 1 ? found[0] : null;
}
// A pastor matches an entry on the list of the bishop they claimed when the
// name is alike and the birthday is the same or nearly so. Exactly one match.
export function matchFor(state, registration) {
  const p = registration.data,
    bishop = bishopKeyed(state, p.bishopId);
  if (!bishop) return null;
  const candidates = state.rosters.filter(
    (r) =>
      r.year === registration.year &&
      r.bishopId === bishop.id &&
      r.status === "active" &&
      (!r.pastorId || r.pastorId === registration.userId) &&
      namesAlike(r.name, p.name) &&
      dobClose(r.dob, p.dob),
  );
  return candidates.length === 1 ? candidates[0] : null;
}
// Why an unclaimed pastor did not match, with the list rows that nearly did:
// "name" = same name, different birthday (someone typed the date wrong);
// "first" = same birthday and first name, different surname (marriage, spelling);
// "several" = more than one row fits exactly. None of these → nothing on the list.
export function nearMatches(state, registration) {
  const p = registration.data,
    bishop = bishopKeyed(state, p.bishopId);
  if (!bishop) return [];
  const first = (name) => normalName(name).split(" ")[0] || "";
  const rows = state.rosters.filter(
    (r) => r.year === registration.year && r.bishopId === bishop.id && r.status === "active" && !r.pastorId,
  );
  const exact = rows.filter((r) => namesAlike(r.name, p.name) && dobClose(r.dob, p.dob));
  if (exact.length > 1) return exact.map((row) => ({ row, reason: "several" }));
  return rows
    .map((r) =>
      namesAlike(r.name, p.name) && !dobClose(r.dob, p.dob)
        ? { row: r, reason: "name" }
        : dobClose(r.dob, p.dob) && first(r.name) === first(p.name) && !namesAlike(r.name, p.name)
          ? { row: r, reason: "first" }
          : null,
    )
    .filter(Boolean);
}
function reconcile(state) {
  for (const r of state.registrations.filter(
    (r) => r.status !== "draft" && r.year === state.year,
  )) {
    const profile = state.profiles.find((p) => p.id === r.userId);
    if (r.manual) { r.status = "confirmed"; continue; }
    if (r.data.role === "bishop") {
      r.status = profile?.bishopApproved
        ? "confirmed"
        : profile?.bishopDecision === "denied"
          ? "denied"
          : "pending";
      continue;
    }
    // An active list row already linked to this pastor settles it. The key the
    // pastor stored may predate the bishop's confirmation, so re-key from the
    // row's owner every time. Removed rows do not pin the pastor: a re-added
    // name can match again below.
    const assigned = state.rosters.find(
      (x) => x.year === r.year && x.pastorId === r.userId && x.status === "active",
    );
    if (assigned) {
      r.status = "confirmed";
      const owner = state.profiles.find((p) => p.id === assigned.bishopId);
      if (owner) r.data.bishopId = bishopKey(owner);
      continue;
    }
    if (!bishopKeyed(state, r.data.bishopId)) {
      const named = bishopNamed(state, r.data.bishopName);
      if (named) r.data.bishopId = bishopKey(named);
    }
    const match = r.holdMatch ? null : matchFor(state, r);
    if (match) {
      match.pastorId = r.userId;
      r.status = "confirmed";
      const owner = state.profiles.find((p) => p.id === match.bishopId);
      if (owner) r.data.bishopId = bishopKey(owner);
    } else
      r.status = state.rosters.some((x) => x.year === r.year && x.pastorId === r.userId)
        ? "removed"
        : "unclaimed";
  }
}
export function parseRoster(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i] || "\n";
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\t" || c === "\n")) {
      row.push(field.trim());
      field = "";
      if (c === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (c !== "\r") field += c;
  }
  if (quoted) throw Error("The pasted list has an unclosed quote.");
  // A header row never contains a digit; every data row carries a date of birth.
  if (rows.length > 1 && !/\d/.test(rows[0].join(""))) rows.shift();
  return rows.map(([name, dob = "", email = "", phone = ""]) => ({
    name,
    dob: parseDob(dob) || dob,
    email,
    phone,
  }));
}
export function applyAction(
  source,
  actor,
  action,
  payload = {},
  makeId = () => crypto.randomUUID(),
  references = [],
) {
  const state = { ...emptyState(), ...structuredClone(source) };
  if (!actor?.id) throw Error("Sign in first.");
  const now = new Date().toISOString();
  const catalog = catalogOf(state);
  let detail = null; // what an office edit changed, kept in the audit trail
  let profile = state.profiles.find((p) => p.id === actor.id);
  const office = () => {
    if (!actor.office) throw Error("Office access required.");
  };
  // An approved bishop keeps acting between years; a new one acts once submitted.
  const verifiedBishop = () => {
    if (!profile?.bishopApproved && !submittedBishop(state, profile))
      throw Error("Submit your bishop registration first.");
  };
  const registration = () =>
    state.registrations.find(
      (r) => r.userId === (payload.userId || actor.id) && r.year === state.year,
    );
  if (action === "save" || action === "submit") {
    // While sign-up is paused, nobody new may start or finish a registration;
    // people who already submitted keep full use of their account.
    const pause = pauseFor(state, payload.entrance);
    if (pause.closed && !state.registrations.some((x) => x.userId === actor.id && x.year === state.year && x.status !== "draft"))
      throw Error(pause.notice || SIGNUP_PAUSED);
    const data = validateProfile(payload, actor.email, {
      draft: action === "save",
      catalog,
    });
    // Consent is collected on the review screen, so it is checked at submit only.
    if (action === "submit" && !data.consentedAt)
      throw Error("Please consent to the public listing before submitting.");
    if (action === "submit" && !data.photoConfirmed)
      throw Error(
        "Confirm your photo and required official attire before submitting.",
      );
    if (profile && profile.role !== data.role)
      throw Error("Contact the office to change your account role.");
    if (!profile) {
      profile = {
        id: actor.id,
        role: data.role,
        name: data.name,
        email: data.email,
        bishopApproved: false,
        referenceId: null,
      };
      state.profiles.push(profile);
    }
    let r = state.registrations.find(
      (r) => r.userId === actor.id && r.year === state.year,
    );
    if (r && r.status !== "draft")
      throw Error(
        "This year’s registration has already been submitted. Contact the office for corrections.",
      );
    profile.name = data.name;
    profile.organization = data.organization;
    if (!r) {
      r = {
        userId: actor.id,
        year: state.year,
        status: "draft",
        payment: "unpaid",
        amount: feesOf(state)[data.role],
        entrance: entranceOf(payload.entrance),
        createdAt: now,
      };
      state.registrations.push(r);
    }
    r.data = data;
    r.updatedAt = now;
    r.status =
      action === "save"
        ? "draft"
        : data.role === "bishop"
          ? "pending"
          : "unclaimed";
    if (action === "submit") r.submittedAt = now;
    // A bishop already in the original data is approved on the spot: the linked
    // record must be a bishop, unclaimed by another account, and carry the same
    // name. Everyone else waits in Approvals for the Archbishop.
    if (action === "submit" && data.role === "bishop" && !profile.bishopApproved && data.referenceId) {
      const ref = overlayReferences(references, state).find((x) => x.id === data.referenceId && x.role === "bishop");
      const taken = state.profiles.some((p) => p.id !== actor.id && p.referenceId === data.referenceId);
      if (ref && !taken && namesAlike(ref.name, data.name)) {
        profile.bishopApproved = true;
        profile.bishopDecision = null;
        profile.referenceId = data.referenceId;
        profile.approvedAt = now;
        profile.autoApproved = true;
        detail = { autoApproved: ref.name, referenceId: ref.id };
      }
    }
    // Only after the name check: the member's details then flow onto their original record.
    if (action === "submit") syncReference(state, r);
  } else if (action === "update") {
    // A member keeps their own details current after submitting; status and
    // payment are untouched and the record stays linked.
    const r = state.registrations.find(
      (x) => x.userId === actor.id && x.year === state.year,
    );
    if (!r || r.status === "draft") throw Error("Submit your registration first.");
    // Everything but the date of birth may change; a different bishop re-runs the match.
    const data = validateProfile({ ...r.data, ...payload, role: r.data.role, dob: r.data.dob }, actor.email, { catalog });
    if (!data.photoConfirmed) throw Error("Confirm your photo before saving.");
    const newBishop = data.role === "pastor" && data.bishopId && data.bishopId !== r.data.bishopId;
    if (newBishop) {
      for (const row of state.rosters) if (row.pastorId === r.userId) row.pastorId = null;
      r.holdMatch = false;
    }
    r.data = { ...data, referenceId: data.referenceId || r.data.referenceId, bishopId: newBishop ? data.bishopId : r.data.bishopId };
    if (profile) {
      profile.name = data.name;
      profile.organization = data.organization;
      profile.bishopDecision = null;
    }
    if (r.resubmit) { r.resubmit = false; r.resubmittedAt = now; }
    r.updatedAt = now;
    detail = Object.fromEntries(Object.keys(payload).filter((k) => k in data && JSON.stringify(data[k]) !== JSON.stringify(source.registrations.find((x) => x.userId === actor.id && x.year === state.year)?.data?.[k])).map((k) => [k, data[k]]));
    syncReference(state, r);
  } else if (action === "approveBishop") {
    office();
    const p = state.profiles.find((p) => p.id === payload.userId);
    const r = registration();
    if (p?.role !== "bishop" || !r || r.status === "draft")
      throw Error("Select a submitted bishop registration.");
    if (
      payload.referenceId &&
      state.profiles.some(
        (p) => p.id !== payload.userId && p.referenceId === payload.referenceId,
      )
    )
      throw Error(
        "That bishop reference is already linked to another account.",
      );
    if (p.bishopApproved) throw Error("This bishop is already approved.");
    p.bishopApproved = true;
    p.bishopDecision = null;
    r.resubmit = false;
    p.referenceId = payload.referenceId || r.data.referenceId || null;
  } else if (action === "reviewBishop") {
    office();
    const p = state.profiles.find((p) => p.id === payload.userId);
    const r = registration();
    if (p?.role !== "bishop" || !r || r.status === "draft")
      throw Error("Select a submitted bishop registration.");
    if (!["denied", "resubmit"].includes(payload.decision))
      throw Error("Choose deny or needs resubmission.");
    if (!String(payload.note || "").trim())
      throw Error("Tell the bishop why, in a sentence.");
    p.bishopApproved = false;
    p.bishopDecision = payload.decision;
    r.bishopNote = String(payload.note).trim();
    r.resubmit = payload.decision === "resubmit";
    r.reviewedAt = now;
  } else if (action === "addRoster") {
    verifiedBishop();
    if (
      !Array.isArray(payload.rows) ||
      !payload.rows.length ||
      payload.rows.length > 500
    )
      throw Error("Add between 1 and 500 pastors at a time.");
    for (const input of payload.rows) {
      const r = {
        name: String(input.name || "").trim(),
        dob: parseDob(input.dob),
        email: normalEmail(input.email),
        phone: String(input.phone || "").trim(),
      };
      if (!r.name || r.name.split(/\s+/).length < 2)
        throw Error(`“${r.name || "(blank)"}”: each pastor needs their full name.`);
      if (!r.dob)
        throw Error(`${r.name}: enter the date of birth as day/month/year, e.g. 14/03/1985.`);
      if (
        state.rosters.some(
          (x) =>
            x.bishopId === actor.id &&
            x.year === state.year &&
            x.status === "active" &&
            namesAlike(x.name, r.name) &&
            dobClose(x.dob, r.dob),
        )
      )
        continue; // already on this year's list (e.g. re-uploading an updated spreadsheet)
      state.rosters.push({
        ...r,
        id: makeId(),
        bishopId: actor.id,
        year: state.year,
        status: "active",
        pastorId: null,
        createdAt: now,
      });
    }
  } else if (action === "claim") {
    const r = registration();
    if (!r || r.status !== "unclaimed" || r.data.role !== "pastor")
      throw Error(
        "This registration is no longer Unclaimed. Refresh the page.",
      );
    // The bishop the pastor named may confirm them even when the spelling did
    // not resolve automatically; anyone else needs the office.
    const bishop =
      bishopKeyed(state, r.data.bishopId) ||
      (!actor.office &&
      submittedBishop(state, profile) &&
      namesAlike(profile.name, r.data.bishopName)
        ? profile
        : null);
    if (!bishop) throw Error("Assign a registered bishop first.");
    if (!actor.office && bishop.id !== actor.id)
      throw Error(
        "Only the selected bishop or office can confirm this pastor.",
      );
    r.data.bishopId = bishopKey(bishop);
    r.holdMatch = false;
    let row = state.rosters.find(
      (x) =>
        x.id === payload.rosterId &&
        x.year === state.year &&
        x.bishopId === bishop.id &&
        x.status === "active" &&
        !x.pastorId,
    );
    if (payload.rosterId && !row)
      throw Error("That roster entry is no longer available.");
    if (!row) {
      row = {
        id: makeId(),
        bishopId: bishop.id,
        year: state.year,
        name: r.data.name,
        dob: r.data.dob,
        email: r.data.email,
        phone: r.data.phone,
        church: r.data.church,
        status: "active",
      };
      state.rosters.push(row);
    }
    row.pastorId = r.userId;
    row.confirmedBy = actor.id;
    row.confirmedAt = now;
  } else if (action === "assignBishop") {
    office();
    const r = registration();
    if (!r || r.data.role !== "pastor" || r.status !== "unclaimed")
      throw Error("Select an Unclaimed pastor.");
    if (!bishopKeyed(state, payload.bishopId))
      throw Error("Select a registered bishop.");
    r.data.bishopId = payload.bishopId;
  } else if (action === "linkReference") {
    const row = state.rosters.find(
      (r) => r.id === payload.rosterId && r.year === state.year,
    );
    if (!row || row.status !== "active")
      throw Error("This annual list entry is not active.");
    if (!actor.office && row.bishopId !== actor.id)
      throw Error(
        "Only the supervising bishop or office can confirm this entry.",
      );
    const id = String(payload.referenceId || "");
    if (!/^[BP]\d+$/.test(id))
      throw Error("Choose the pastor to confirm.");
    if (
      state.rosters.some(
        (r) =>
          r.id !== row.id &&
          r.year === state.year &&
          r.status === "active" &&
          r.referenceId === id,
      )
    )
      throw Error(
        "That person is already confirmed for another pastor this year.",
      );
    row.referenceId = id;
    row.referenceConfirmedBy = actor.id;
    row.referenceConfirmedAt = now;
  } else if (action === "removeRoster") {
    const r = state.rosters.find(
      (r) => r.id === payload.id && r.year === state.year,
    );
    if (!r || r.status !== "active")
      throw Error("This roster entry is not active.");
    if (!actor.office && r.bishopId !== actor.id)
      throw Error(
        "Only the supervising bishop or office can update this entry.",
      );
    if (
      !["Transferred", "Resigned", "Dismissed", "Other"].includes(
        payload.reason,
      )
    )
      throw Error("Choose a reason.");
    if (payload.reason === "Other" && !String(payload.note || "").trim())
      throw Error("Explain the removal reason.");
    r.status = "removed";
    r.reason = payload.reason;
    r.note = String(payload.note || "").trim();
    r.removedAt = now;
  } else if (action === "carryRoster") {
    verifiedBishop();
    const rows = state.rosters.filter(
      (r) =>
        r.bishopId === actor.id &&
        r.year === state.year - 1 &&
        r.status === "active",
    );
    for (const r of rows) {
      if (
        !state.rosters.some(
          (x) =>
            x.bishopId === actor.id &&
            x.year === state.year &&
            normalName(x.name) === normalName(r.name) &&
            normalEmail(x.email) === normalEmail(r.email) &&
            normalPhone(x.phone) === normalPhone(r.phone),
        )
      )
        state.rosters.push({
          ...r,
          id: makeId(),
          year: state.year,
          pastorId: null,
          confirmedAt: null,
          confirmedBy: null,
          createdAt: now,
        });
    }
  } else if (action === "payment") {
    const r = state.registrations.find(
      (r) => r.userId === actor.id && r.year === state.year,
    );
    // Proof is sent during onboarding, before the office confirms anyone.
    if (!r || ["draft", "denied"].includes(r.status))
      throw Error("Submit your registration before sending payment.");
    if (r.payment === "verified")
      throw Error("This payment has already been verified.");
    if (!payload.nonrefundable || !payload.proof)
      throw Error(
        "Upload payment proof and acknowledge that the commitment is non-refundable.",
      );
    // The mobile-money Transaction ID ties the screenshot to a line on the
    // office's MoMo statement; one ID can only ever pay for one person.
    const transactionId = String(payload.transactionId || "").trim().toUpperCase();
    if (!/^[A-Z0-9.-]{6,40}$/.test(transactionId))
      throw Error("Enter the Transaction ID from your mobile-money confirmation (letters and numbers, at least 6).");
    if (
      state.registrations.some(
        (x) => x.userId !== r.userId && x.transactionId === transactionId,
      )
    )
      throw Error("This Transaction ID has already been used for another registration.");
    r.payment = "pending";
    r.proof = payload.proof;
    r.transactionId = transactionId;
    r.paymentMethod = "momo";
    r.nonrefundableAt = now;
    r.paymentSubmittedAt = now;
  } else if (action === "recordPaystack") {
    // Only the server calls this, after Paystack confirmed the reference.
    const r = state.registrations.find(
      (r) => r.userId === actor.id && r.year === state.year,
    );
    // A draft saved on the payment step is enough: the fee is fixed per role.
    if (!r || r.status === "denied")
      throw Error("Start your registration before paying.");
    if (r.payment === "verified")
      throw Error("This payment has already been verified.");
    if (
      state.registrations.some((x) => x.paystackReference === payload.reference)
    )
      throw Error("This payment reference has already been used.");
    if (!(Number(payload.amount) >= Number(payload.expectedMinor)))
      throw Error("The amount paid is less than the annual commitment.");
    r.payment = "verified";
    r.paymentMethod = "paystack";
    r.paystackReference = String(payload.reference);
    r.paystackAmount = Number(payload.amount);
    r.paystackCurrency = String(payload.currency || "");
    detail = { amount: Number(payload.amount), currency: r.paystackCurrency };
    r.nonrefundableAt = now;
    r.paymentSubmittedAt = now;
    r.paymentReviewedAt = now;
  } else if (action === "choosePhoto") {
    office();
    const r = registration();
    if (!r || r.status === "draft") throw Error("Select a submitted registration.");
    if (!["upload", "reference"].includes(payload.source))
      throw Error("Choose the uploaded photo or the existing one.");
    if (payload.source === "reference" && !r.data.referenceId)
      throw Error("This registration is not linked to an existing record.");
    r.displayPhoto = payload.source;
  } else if (action === "reviewPayment") {
    office();
    const r = registration();
    if (r?.payment !== "pending")
      throw Error("Select a payment awaiting verification.");
    if (!["verified", "rejected"].includes(payload.result))
      throw Error("Choose a payment decision.");
    if (payload.result === "rejected" && !String(payload.note || "").trim())
      throw Error("Explain why the payment proof needs replacement.");
    r.payment = payload.result;
    r.paymentNote = String(payload.note || "");
    r.paymentReviewedAt = now;
  } else if (action === "officeEdit") {
    // The office corrects any detail of any registration; the change is recorded.
    office();
    const r = registration();
    if (!r) throw Error("Select a registration.");
    const EDITABLE = ["firstName", "lastName", "gender", "organization", "denomination", "church", "phone", "dob", "country", "city", "email", "bishopId", "referenceId", "photo", "role"];
    const incoming = Object.fromEntries(Object.entries(payload.data || {}).filter(([k, v]) => EDITABLE.includes(k) && v !== undefined));
    const merged = { ...r.data, ...incoming };
    if (!["bishop", "pastor"].includes(merged.role)) throw Error("Choose Bishop or Pastor.");
    const data = validateProfile(merged, merged.email || r.data.email, { draft: true, catalog });
    if (incoming.phone && !data.phone) throw Error("Enter the WhatsApp number with its country code.");
    detail = Object.fromEntries(Object.keys(incoming).filter((k) => JSON.stringify(r.data[k] ?? "") !== JSON.stringify(data[k] ?? "")).map((k) => [k, [r.data[k] ?? "", data[k] ?? ""]]));
    r.data = { ...data, consentedAt: r.data.consentedAt, photoConfirmed: true, referenceId: data.referenceId || r.data.referenceId || "", bishopId: data.bishopId || r.data.bishopId || "" };
    r.updatedAt = now;
    const p = state.profiles.find((x) => x.id === r.userId);
    if (p) { p.name = data.name; p.organization = data.organization; p.role = data.role; if (incoming.referenceId !== undefined) p.referenceId = data.referenceId || ""; }
    syncReference(state, r);
  } else if (action === "setStatus") {
    office();
    const r = registration();
    if (!r || r.status === "draft") throw Error("Select a submitted registration.");
    const p = state.profiles.find((x) => x.id === r.userId);
    detail = { status: [r.status, payload.status] };
    if (r.data.role === "bishop") {
      if (!["confirmed", "pending", "denied"].includes(payload.status)) throw Error("A bishop can be confirmed, pending or denied.");
      p.bishopApproved = payload.status === "confirmed";
      p.bishopDecision = payload.status === "denied" ? "denied" : null;
      r.resubmit = false;
      if (payload.status === "confirmed") { p.approvedAt = now; if (!p.referenceId && r.data.referenceId) p.referenceId = r.data.referenceId; }
    } else {
      if (!["confirmed", "unclaimed", "removed"].includes(payload.status)) throw Error("A pastor can be confirmed, unclaimed or removed.");
      const mine = state.rosters.filter((x) => x.year === r.year && x.pastorId === r.userId);
      if (payload.status === "confirmed") {
        r.holdMatch = false;
        const bishop = bishopKeyed(state, r.data.bishopId);
        if (!bishop) throw Error("Give this pastor a registered bishop first.");
        if (!mine.some((x) => x.status === "active")) {
          const row = mine[0] || { id: makeId(), bishopId: bishop.id, year: state.year, name: r.data.name, dob: r.data.dob, email: r.data.email, phone: r.data.phone, status: "active" };
          if (!mine[0]) state.rosters.push(row);
          row.status = "active"; row.reason = undefined; row.note = undefined; row.pastorId = r.userId; row.confirmedBy = actor.id; row.confirmedAt = now;
        }
      } else if (payload.status === "unclaimed") {
        // Unlink and hold: automatic matching must not re-link them until someone confirms by hand.
        for (const x of mine) { x.pastorId = null; }
        r.holdMatch = true;
      } else {
        for (const x of mine.filter((x) => x.status === "active")) { x.status = "removed"; x.reason = "Other"; x.note = String(payload.note || "Set by the office"); x.removedAt = now; x.removedBy = actor.id; }
        if (!mine.length) throw Error("This pastor is not on any list to remove from.");
      }
    }
  } else if (action === "markPaid") {
    // Fee received some other way (cash, transfer) or a payment mark undone.
    office();
    const r = registration();
    if (!r || r.status === "draft") throw Error("Select a submitted registration.");
    if (r.paymentMethod === "paystack" && r.payment === "verified" && payload.paid === false)
      throw Error("A Paystack payment cannot be marked unpaid; refund it in Paystack instead.");
    detail = { payment: [r.payment, payload.paid ? "verified" : "unpaid"] };
    if (payload.paid) {
      r.payment = "verified"; r.paymentMethod = "manual"; r.paymentNote = String(payload.note || "").trim(); r.paymentReviewedAt = now; r.paymentSubmittedAt = r.paymentSubmittedAt || now; r.nonrefundableAt = r.nonrefundableAt || now;
    } else {
      r.payment = "unpaid"; r.paymentMethod = ""; r.paymentNote = String(payload.note || "").trim(); r.paymentReviewedAt = now;
    }
  } else if (action === "setVisibility") {
    office();
    const r = registration();
    if (!r) throw Error("Select a registration.");
    r.hidden = payload.hidden === true;
    detail = { hidden: [!payload.hidden, Boolean(payload.hidden)] };
  } else if (action === "deleteRegistration") {
    // Removes this year's registration; the person keeps their account and can register again.
    office();
    const r = registration();
    if (!r) throw Error("Select a registration.");
    state.registrations = state.registrations.filter((x) => x !== r);
    for (const x of state.rosters) if (x.pastorId === r.userId) x.pastorId = null;
    const p = state.profiles.find((x) => x.id === r.userId);
    if (p && r.data.role === "bishop") { p.bishopApproved = false; p.bishopDecision = null; }
    detail = { deleted: r.data.name };
  } else if (action === "addPerson") {
    // A person the office puts on the roll directly, without them registering.
    office();
    const d = payload.data || {};
    if (!["bishop", "pastor"].includes(d.role)) throw Error("Choose Bishop or Pastor.");
    const id = `manual:${makeId()}`;
    const data = validateProfile({ ...d, photoConfirmed: true }, d.email || `${id}@manual.invalid`, { draft: true, catalog });
    if (!data.firstName || !data.lastName) throw Error("Enter the person’s first and last names.");
    if (d.role === "pastor" && data.bishopId && !bishopKeyed(state, data.bishopId)) throw Error("Choose a registered bishop, or leave the bishop empty.");
    state.profiles.push({ id, email: data.email, role: d.role, name: data.name, organization: data.organization, bishopApproved: d.role === "bishop", referenceId: "", manual: true, createdAt: now });
    state.registrations.push({ userId: id, year: state.year, status: "confirmed", payment: "waived", amount: 0, manual: true, data: { ...data, photoConfirmed: true }, createdAt: now, submittedAt: now, updatedAt: now });
    detail = { added: data.name };
  } else if (action === "editRoster") {
    const row = state.rosters.find((x) => x.id === payload.id && x.year === state.year);
    if (!row) throw Error("Select a list entry.");
    if (!actor.office && row.bishopId !== actor.id) throw Error("Only the supervising bishop or office can edit this entry.");
    const name = String(payload.name ?? row.name).trim().replace(/\s+/g, " ");
    if (name.split(" ").length < 2) throw Error("Enter the pastor’s full name.");
    const dob = payload.dob === undefined ? row.dob : parseDob(payload.dob);
    if (payload.dob !== undefined && !dob) throw Error("Enter the date of birth as day/month/year.");
    detail = { name: [row.name, name], dob: [row.dob, dob] };
    row.name = name; row.dob = dob;
    if (payload.email !== undefined) row.email = normalEmail(payload.email);
    if (payload.phone !== undefined) row.phone = String(payload.phone || "").trim();
    row.editedAt = now; row.editedBy = actor.id;
  } else if (action === "restoreRoster") {
    const row = state.rosters.find((x) => x.id === payload.id && x.year === state.year);
    if (!row || row.status === "active") throw Error("Select a removed list entry.");
    if (!actor.office && row.bishopId !== actor.id) throw Error("Only the supervising bishop or office can restore this entry.");
    row.status = "active"; row.reason = undefined; row.note = undefined; row.restoredAt = now; row.restoredBy = actor.id;
    detail = { restored: row.name };
  } else if (action === "moveRoster") {
    office();
    const row = state.rosters.find((x) => x.id === payload.id && x.year === state.year);
    if (!row) throw Error("Select a list entry.");
    const target = bishopKeyed(state, payload.bishopId);
    if (!target) throw Error("Choose a registered bishop to move this pastor to.");
    detail = { bishopId: [row.bishopId, target.id] };
    row.bishopId = target.id; row.movedAt = now; row.movedBy = actor.id;
    const reg = row.pastorId && state.registrations.find((x) => x.userId === row.pastorId && x.year === state.year);
    if (reg) reg.data.bishopId = bishopKey(target);
  } else if (action === "hideReference") {
    office();
    const id = String(payload.referenceId || "");
    if (!id) throw Error("Select a record.");
    state.hidden = (state.hidden || []).filter((x) => x !== id);
    if (payload.hidden) state.hidden.push(id);
    detail = { hidden: [!payload.hidden, Boolean(payload.hidden)] };
  } else if (action === "editReference") {
    office();
    const id = String(payload.referenceId || "");
    if (!id) throw Error("Select a record.");
    const fields = Object.fromEntries(Object.entries(payload.fields || {}).filter(([k]) => REFERENCE_FIELDS.includes(k)).map(([k, v]) => [k, String(v ?? "").trim()]));
    if (fields.name !== undefined && fields.name.split(/\s+/).length < 2) throw Error("Enter the full name.");
    state.overrides = { ...(state.overrides || {}), [id]: { ...((state.overrides || {})[id] || {}), ...fields, deleted: false } };
    const extra = (state.extraReferences || []).find((x) => x.id === id);
    if (extra) Object.assign(extra, fields);
    detail = fields;
  } else if (action === "deleteReference") {
    office();
    const id = String(payload.referenceId || "");
    if (!id) throw Error("Select a record.");
    state.overrides = { ...(state.overrides || {}), [id]: { ...((state.overrides || {})[id] || {}), deleted: payload.deleted !== false } };
    if (payload.deleted === false) delete state.overrides[id].deleted;
    detail = { deleted: payload.deleted !== false };
  } else if (action === "addReference") {
    office();
    const d = payload.fields || {};
    const name = String(d.name || "").trim().replace(/\s+/g, " ");
    if (name.split(" ").length < 2) throw Error("Enter the full name.");
    if (!["bishop", "pastor"].includes(d.role)) throw Error("Choose Bishop or Pastor.");
    const id = `X${makeId().replace(/-/g, "").slice(0, 10)}`;
    state.extraReferences = [...(state.extraReferences || []), { id, role: d.role, name, title: String(d.title || (d.role === "bishop" ? "Bishop" : "Pastor")), organization: String(d.organization || ""), denomination: String(d.denomination || ""), denominationLogo: "", city: String(d.city || ""), country: String(d.country || ""), branch: String(d.branch || ""), image: String(d.image || ""), photo: String(d.photo || ""), email: "", phone: "", ...(d.role === "pastor" && d.bishop ? { bishop: String(d.bishop) } : {}) }];
    detail = { added: name, id };
  } else if (action === "setCatalog") {
    // Organizations and denominations offered on the sign-up form.
    office();
    const c = payload.catalog || {};
    const organizations = [...new Set((c.organizations || []).map((o) => String(o || "").trim()).filter(Boolean))];
    if (!organizations.length) throw Error("Keep at least one organization.");
    const denominations = {};
    for (const o of organizations) denominations[o] = [...new Set(((c.denominations || {})[o] || []).map((d) => String(d || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const groups = {};
    const supplied = Boolean(c.groups);
    for (const [name, g] of Object.entries(c.groups || catalogOf(state).groups || {})) {
      const key = String(name || "").trim();
      if (!key) continue;
      const organization = String(g?.organization || "").trim();
      // Groups of a removed organization go with it; a supplied group must name a real one.
      if (!organizations.includes(organization)) { if (supplied) throw Error(`The group “${key}” must belong to one of the organizations.`); continue; }
      groups[key] = { organization, denominations: [...new Set((g.denominations || []).map((d) => String(d || "").trim()).filter(Boolean))] };
    }
    state.catalog = { organizations, denominations, groups };
    detail = { organizations: organizations.length, denominations: Object.values(denominations).reduce((n, d) => n + d.length, 0), groups: Object.keys(groups).length };
  } else if (action === "setFees") {
    office();
    const bishop = Number(payload.bishop), pastor = Number(payload.pastor);
    if (!(bishop > 0 && pastor > 0 && Number.isInteger(bishop) && Number.isInteger(pastor))) throw Error("Enter whole-dollar amounts above zero.");
    detail = { fees: [feesOf(state), { bishop, pastor }] };
    state.fees = { bishop, pastor };
  } else if (action === "setSignup") {
    office();
    const next = { closed: Boolean(payload.closed), notice: String(payload.notice || "").trim().slice(0, 500) };
    const current = signupOf(state);
    state.signup = entranceOf(payload.scope) === "appointments"
      ? { closed: current.closed, notice: current.notice, appointments: next }
      : { ...next, appointments: current.appointments };
    detail = { scope: entranceOf(payload.scope), ...next };
  } else if (action === "broadcast") {
    // The message itself goes out by email; the audit trail keeps what was sent and to how many.
    office();
    detail = { subject: String(payload.subject || "").slice(0, 200), audience: String(payload.audience || "all"), recipients: Number(payload.recipients) || 0, ...(payload.failed ? { failed: Number(payload.failed) } : {}) };
  } else if (action === "openYear") {
    office();
    if (Number(payload.year) !== state.year + 1)
      throw Error("The next cycle must be the following year.");
    state.year += 1;
  } else throw Error("Unknown action.");
  reconcile(state);
  state.audit.push({
    id: makeId(),
    actor: actor.id,
    action,
    year: state.year,
    target: payload.userId || payload.id || payload.referenceId || actor.id,
    at: now,
    ...(detail && Object.keys(detail).length ? { detail } : {}),
  });
  return state;
}
export function directoryFor(state, references) {
  const records = overlayReferences(references, state).map((p) => ({
    ...p,
    accountId:
      state.profiles.find((x) => x.bishopApproved && x.referenceId === p.id)
        ?.id || null,
  }));
  for (const p of state.profiles.filter(
    (p) => p.bishopApproved && !p.referenceId,
  ))
    records.push({
      id: p.id,
      name: p.name,
      title: "Bishop",
      organization: p.organization,
      accountId: p.id,
    });
  return records.sort((a, b) => a.name.localeCompare(b.name));
}
// How a person is addressed: a female bishop is an Episcopal Sister in United
// Denominations and a Mother in First Love; everyone else is Bishop or Pastor.
export function titleFor({ role, gender, organization }) {
  if (role !== "bishop") return "Pastor";
  if (gender === "female") return organization === "United Denominations" ? "Episcopal Sister" : organization === "First Love" ? "Mother" : "Bishop";
  return "Bishop";
}
export function publicRoll(state, people, year = state.year) {
  const byId = new Map(overlayReferences(people, state).map((p) => [p.id, p]));
  const bishopOf = (r) => state.profiles.find((p) => (p.referenceId || p.id) === r.data.bishopId && p.bishopApproved);
  return state.registrations
    .filter((r) => r.year === year && r.status === "confirmed" && !r.hidden && (r.data.role === "bishop" || r.manual || bishopOf(r)))
    .map((r) => {
      const ref = byId.get(r.data.referenceId) || null;
      const profile = state.profiles.find((p) => p.id === r.userId);
      // The pastors a bishop listed, with photos for those who have registered.
      const pastors = r.data.role === "bishop"
        ? state.rosters
            .filter((x) => x.year === year && x.bishopId === r.userId && x.status === "active")
            .map((x) => {
              const reg = x.pastorId && state.registrations.find((y) => y.userId === x.pastorId && y.year === year);
              return { id: `p:${x.id}`, role: "pastor", name: reg?.data.name || x.name, title: "Pastor", photo: reg?.data.photo || "", city: reg?.data.city || "", country: reg?.data.country || "", registered: Boolean(reg) };
            })
            .sort((a, b) => a.name.localeCompare(b.name))
        : undefined;
      return {
        pastors,
        bishopKey: r.data.role === "bishop" ? bishopKey(profile) : r.data.bishopId,
        id: `u:${r.userId}`,
        role: r.data.role,
        name: r.data.name,
        title: r.data.gender ? titleFor(r.data) : ref?.title || (r.data.role === "bishop" ? "Bishop" : "Pastor"),
        organization: r.data.organization,
        denomination: r.data.denomination || r.data.church || ref?.denomination || "",
        group: ref?.group || groupOf(catalogOf(state), r.data),
        denominationLogo:
          ref?.denominationLogo ||
          ({ FLOW: "assets/brand/flow-logo.png", HJC: "assets/brand/hjc-logo.png", DHMM: "assets/brand/dhmm-logo-black.png" })[r.data.organization] ||
          "",
        city: r.data.city,
        country: r.data.country,
        branch: ref?.branch || "",
        bishop: ref?.bishop || "",
        // The office may prefer the existing portrait over the new upload.
        photo: r.displayPhoto === "reference" && ref?.image ? "" : r.data.photo,
        image: r.displayPhoto === "reference" ? ref?.image || "" : "",
        referenceId: r.data.referenceId || "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function visibleState(state, actor, references, people = references) {
  // A floating pastor is shown only to the bishop they named (and the office).
  const me = state.profiles.find((p) => p.id === actor.id);
  const scope = (r) =>
    actor.office ||
    r.userId === actor.id ||
    (r.status !== "draft" &&
      r.data.role === "pastor" &&
      (bishopKeyed(state, r.data.bishopId)?.id === actor.id ||
        (r.status === "unclaimed" &&
          !bishopKeyed(state, r.data.bishopId) &&
          submittedBishop(state, me) &&
          namesAlike(me.name, r.data.bishopName))));
  return {
    ...state,
    profiles: state.profiles.filter((p) => actor.office || p.id === actor.id),
    registrations: state.registrations.filter(scope),
    rosters: state.rosters.filter(
      (r) => actor.office || r.bishopId === actor.id,
    ),
    audit: state.audit.filter((r) => actor.office || r.actor === actor.id),
    directory: directoryFor(state, references),
    roll: publicRoll(state, people),
    bishops: registeredBishops(state),
    catalog: catalogOf(state),
    fees: feesOf(state),
    signup: signupOf(state),
    hidden: state.hidden || [],
    overrides: actor.office ? state.overrides || {} : publicOverlay(state).overrides,
    extraReferences: actor.office ? state.extraReferences || [] : publicOverlay(state).extraReferences,
  };
}
export const samePhone = (a, b) => {
  // ponytail: legacy numbers were stored with inconsistent country prefixes, so
  // the last nine digits decide. Replace with E.164 normalization once the
  // source rosters store a country code for every row.
  const x = normalPhone(a),
    y = normalPhone(b);
  return x.length >= 7 && y.length >= 7 && x.slice(-9) === y.slice(-9);
};
export function referenceIndex(references) {
  const byId = new Map(),
    byName = new Map();
  for (const p of references) {
    byId.set(p.id, p);
    const key = normalName(p.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(p);
  }
  return { byId, byName, all: references };
}
// People DROGS already holds who may be the same person as an annual-list entry. The
// name must match exactly once normalized; a matching email or phone makes it
// near certain. A person still confirms from the photo before any record
// changes, so a close spelling is never linked automatically.
export function referenceMatches(index, row, role = "pastor") {
  return (index.byName.get(normalName(row.name)) || [])
    .filter((p) => p.role === role)
    .map((p) => ({
      reference: p,
      emailMatch: Boolean(
        normalEmail(row.email) && normalEmail(p.email) === normalEmail(row.email),
      ),
      phoneMatch: samePhone(p.phone, row.phone),
    }))
    .map((m) => ({ ...m, contactMatch: m.emailMatch || m.phoneMatch }))
    .sort((a, b) => Number(b.contactMatch) - Number(a.contactMatch));
}
// The office directory: every existing record, showing whichever information is
// current. Green (updated) means the person registered this cycle or their
// bishop confirmed their details; red means this is still the older record.
export function directoryPeople(state, references, year = state.year) {
  references = overlayReferences(references, state);
  const rows = state.rosters.filter(
    (r) => r.year === year && r.status === "active",
  );
  const linked = new Map();
  for (const row of rows) if (row.referenceId) linked.set(row.referenceId, row);
  const submitted = state.registrations.filter(
    (r) => r.year === year && r.status !== "draft",
  );
  const byUser = new Map(submitted.map((r) => [r.userId, r]));
  const registrations = new Map();
  for (const p of state.profiles)
    if (p.referenceId && byUser.has(p.id))
      registrations.set(p.referenceId, byUser.get(p.id));
  for (const r of submitted)
    if (r.data.referenceId && !registrations.has(r.data.referenceId))
      registrations.set(r.data.referenceId, r);
  for (const row of rows)
    if (row.referenceId && row.pastorId && byUser.has(row.pastorId))
      registrations.set(row.referenceId, byUser.get(row.pastorId));
  const people = references.map((p) => {
    const row = linked.get(p.id),
      registration = registrations.get(p.id),
      d = registration?.data;
    return {
      ...p,
      email: d?.email || row?.email || p.email,
      phone: d?.phone || row?.phone || p.phone,
      city: d?.city || p.city,
      country: d?.country || p.country,
      denomination: d?.denomination || p.denomination,
      // The office's "which photo" choice applies everywhere, not only on the public roll.
      photo: registration?.displayPhoto === "reference" && p.image ? "" : d?.photo || p.photo || "",
      recorded: { email: p.email, phone: p.phone },
      updated: Boolean(registration || row?.referenceConfirmedAt),
      updatedAt:
        registration?.submittedAt || row?.referenceConfirmedAt || null,
      updatedBy: registration ? "registration" : row ? "bishop" : "",
      claimed: p.role === "bishop" || linked.has(p.id),
      registration: registration || null,
    };
  });
  const matched = new Set([...registrations.values()].map((r) => r.userId));
  for (const r of submitted.filter(
    (r) => r.status === "confirmed" && !matched.has(r.userId),
  ))
    people.push({
      id: `new:${r.userId}`,
      role: r.data.role,
      name: r.data.name,
      title: titleFor(r.data),
      organization: r.data.organization,
      denomination: r.data.denomination || r.data.church,
      denominationLogo: "",
      city: r.data.city,
      country: r.data.country,
      image: "",
      group: groupOf(catalogOf(state), r.data),
      photo: r.data.photo,
      email: r.data.email,
      phone: r.data.phone,
      recorded: null,
      updated: true,
      updatedAt: r.submittedAt,
      updatedBy: "registration",
      claimed: true,
      registration: r,
    });
  return people.sort((a, b) => a.name.localeCompare(b.name));
}
