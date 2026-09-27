import { DENOMINATIONS } from "./denominations.mjs";
export const ORGANIZATIONS = [
  "First Love",
  "United Denominations",
  "DHMM",
  "FLOW",
  "Healing Jesus Campaign",
];
export const STORAGE_KEY = "drogs-registration-v1";
export const AMOUNTS = { bishop: 100, pastor: 50 };
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
});
export function validateProfile(p, email, { draft = false } = {}) {
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
    bishopId: p.bishopId || "",
    bishopName: String(p.bishopName || "").trim(),
  };
  if (!["bishop", "pastor"].includes(q.role))
    throw Error("Choose Bishop or Pastor.");
  if (!draft) {
    if (!q.firstName || !q.lastName || q.name.length > 160)
      throw Error("Enter your first and last names.");
    if (!/^\S+@\S+\.\S+$/.test(q.email))
      throw Error("Enter a valid email address.");
    if (normalPhone(q.phone).length < 7 || normalPhone(q.phone).length > 15)
      throw Error("Enter a phone number with its country code.");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(q.dob) ||
      !Number.isFinite(Date.parse(q.dob)) ||
      new Date(q.dob).toISOString().slice(0, 10) !== q.dob ||
      q.dob < "1900-01-01" ||
      q.dob >= new Date().toISOString().slice(0, 10)
    )
      throw Error("Enter a valid date of birth in the past.");
    if (!q.country || !q.city) throw Error("Enter your country and city.");
    const denominations = DENOMINATIONS[q.organization] || [];
    if (denominations.length && !denominations.includes(q.denomination))
      throw Error("Select a denomination listed under your organization.");
    if (!ORGANIZATIONS.includes(q.organization))
      throw Error("Choose your organization.");
    if (!q.photo) throw Error("Upload your official-attire photo.");
    if (q.role === "pastor" && !q.bishopId)
      throw Error("Select your bishop, or choose Bishop not listed.");
    if (q.bishopId === "missing" && !q.bishopName)
      throw Error("Enter the name of your bishop.");
  }
  if (!(DENOMINATIONS[q.organization] || []).length) q.denomination = "";
  if (q.role === "bishop") {
    q.bishopId = "";
    q.bishopName = "";
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
export function matchFor(state, registration) {
  const p = registration.data,
    bishop = bishopFor(state, p.bishopId);
  if (!bishop) return null;
  const candidates = state.rosters.filter(
    (r) =>
      r.year === registration.year &&
      r.bishopId === bishop.id &&
      r.status === "active" &&
      (!r.pastorId || r.pastorId === registration.userId) &&
      normalName(r.name) === normalName(p.name) &&
      ((normalEmail(r.email) &&
        normalEmail(r.email) === normalEmail(p.email)) ||
        (normalPhone(r.phone) &&
          normalPhone(r.phone) === normalPhone(p.phone))),
  );
  return candidates.length === 1 ? candidates[0] : null;
}
function reconcile(state) {
  for (const r of state.registrations.filter(
    (r) => r.status !== "draft" && r.year === state.year,
  )) {
    const profile = state.profiles.find((p) => p.id === r.userId);
    if (r.data.role === "bishop") {
      r.status = profile?.bishopApproved ? "confirmed" : "pending";
      continue;
    }
    const assigned = state.rosters.find(
      (x) => x.year === r.year && x.pastorId === r.userId,
    );
    if (assigned) {
      r.status = assigned.status === "active" ? "confirmed" : "removed";
      continue;
    }
    const match = matchFor(state, r);
    if (match) {
      match.pastorId = r.userId;
      r.status = "confirmed";
    } else r.status = "unclaimed";
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
  if (rows[0]?.[0]?.toLowerCase() === "name") rows.shift();
  return rows.map(([name, email = "", phone = "", church = ""]) => ({
    name,
    email,
    phone,
    church,
  }));
}
export function applyAction(
  source,
  actor,
  action,
  payload = {},
  makeId = () => crypto.randomUUID(),
) {
  const state = structuredClone(source);
  if (!actor?.id) throw Error("Sign in first.");
  const now = new Date().toISOString();
  let profile = state.profiles.find((p) => p.id === actor.id);
  const office = () => {
    if (!actor.office) throw Error("Office access required.");
  };
  const verifiedBishop = () => {
    if (!profile?.bishopApproved || profile.role !== "bishop")
      throw Error("Your bishop account must be approved by the office.");
  };
  const registration = () =>
    state.registrations.find(
      (r) => r.userId === (payload.userId || actor.id) && r.year === state.year,
    );
  if (action === "save" || action === "submit") {
    const data = validateProfile(payload, actor.email, {
      draft: action === "save",
    });
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
        amount: AMOUNTS[data.role],
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
    p.referenceId = payload.referenceId || null;
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
        email: normalEmail(input.email),
        phone: String(input.phone || "").trim(),
        church: String(input.church || "").trim(),
      };
      if (
        !r.name ||
        (!/^\S+@\S+\.\S+$/.test(r.email) && normalPhone(r.phone).length < 7)
      )
        throw Error(
          "Each pastor needs a name and a valid email or phone number.",
        );
      if (
        state.rosters.some(
          (x) =>
            x.bishopId === actor.id &&
            x.year === state.year &&
            normalName(x.name) === normalName(r.name) &&
            ((r.email && normalEmail(x.email) === r.email) ||
              (normalPhone(r.phone) &&
                normalPhone(x.phone) === normalPhone(r.phone))),
        )
      )
        throw Error(`${r.name} is already in this year’s list.`);
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
    const bishop = bishopFor(state, r.data.bishopId);
    if (!bishop) throw Error("Assign an approved bishop first.");
    if (!actor.office && bishop.id !== actor.id)
      throw Error(
        "Only the selected bishop or office can confirm this pastor.",
      );
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
    if (!bishopFor(state, payload.bishopId))
      throw Error("Select an approved bishop.");
    r.data.bishopId = payload.bishopId;
    r.data.bishopName = "";
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
      throw Error("Choose an existing record to confirm.");
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
        "That existing record is already confirmed for another pastor this year.",
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
    if (r?.status !== "confirmed")
      throw Error("Payment unlocks after confirmation.");
    if (r.payment === "verified")
      throw Error("This payment has already been verified.");
    if (!payload.nonrefundable || !payload.proof)
      throw Error(
        "Upload payment proof and acknowledge that the commitment is non-refundable.",
      );
    r.payment = "pending";
    r.proof = payload.proof;
    r.nonrefundableAt = now;
    r.paymentSubmittedAt = now;
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
    target: payload.userId || payload.id || actor.id,
    at: now,
  });
  return state;
}
export function directoryFor(state, references) {
  const records = references.map((p) => ({
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
export function visibleState(state, actor, references) {
  const scope = (r) =>
    actor.office ||
    r.userId === actor.id ||
    (r.status !== "draft" &&
      r.data.role === "pastor" &&
      bishopFor(state, r.data.bishopId)?.id === actor.id);
  return {
    ...state,
    profiles: state.profiles.filter((p) => actor.office || p.id === actor.id),
    registrations: state.registrations.filter(scope),
    rosters: state.rosters.filter(
      (r) => actor.office || r.bishopId === actor.id,
    ),
    audit: state.audit.filter((r) => actor.office || r.actor === actor.id),
    directory: directoryFor(state, references),
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
// Existing records that may be the same person as an annual-list entry. The
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
      photo: d?.photo || "",
      recorded: { email: p.email, phone: p.phone },
      updated: Boolean(registration || row?.referenceConfirmedAt),
      updatedAt:
        registration?.submittedAt || row?.referenceConfirmedAt || null,
      updatedBy: registration ? "registration" : row ? "bishop" : "",
      claimed: p.role === "bishop" ? Boolean(registration) : linked.has(p.id),
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
      title: r.data.role === "bishop" ? "Bishop" : "Pastor",
      organization: r.data.organization,
      denomination: r.data.denomination || r.data.church,
      denominationLogo: "",
      city: r.data.city,
      country: r.data.country,
      image: "",
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
