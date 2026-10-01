import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  applyAction,
  visibleState,
  parseRoster,
  validateProfile,
  STORAGE_KEY,
  referenceIndex,
  referenceMatches,
  directoryPeople,
  publicRoll,
  overlayReferences,
  broadcastRecipients,
  catalogOf,
  groupOf,
  signupOf,
  denominationListed,
  logoFor,
  whatsappNumber,
  nearMatches,
  namesAlike,
  titleFor,
} from "../../src/registration/model.mjs";
const bishop = { id: "b1", email: "bishop@example.com" },
  other = { id: "b2", email: "other@example.com" },
  pastor = { id: "p1", email: "john@example.com" },
  office = { id: "office", email: "office@example.com", office: true };
const profile = (actor, role = "pastor", name = "John Doe") => ({
  role,
  name,
  firstName: name.split(" ")[0],
  lastName: name.split(" ").slice(1).join(" ") || "Name",
  denomination: "First Love Church",
  country: "Ghana",
  city: "Accra",
  gender: "male",
  photoConfirmed: true,
  consentedAt: "2026-09-29T08:00:00.000Z",
  email: actor.email,
  phone: "+233201234567",
  dob: "1990-02-01",
  church: "Grace",
  organization: "First Love",
  photo: `${actor.id}/portrait/image.jpg`,
  bishopId: "B1",
  bishopFirstName: "Ama",
  bishopLastName: "Bishop",
});
function setup() {
  let s = emptyState();
  s = applyAction(s, bishop, "submit", profile(bishop, "bishop", "Ama Bishop"));
  s = applyAction(s, office, "approveBishop", {
    userId: bishop.id,
    referenceId: "B1",
  });
  return s;
}
test("fresh registration has a separate storage key and zero counts", () => {
  assert.notEqual(STORAGE_KEY, "drogs-2027");
  assert.equal(emptyState().registrations.length, 0);
  assert.equal(emptyState().profiles.length, 0);
});
test("a bishop cannot self-approve but may list pastors while pending", () => {
  let s = applyAction(
    emptyState(),
    bishop,
    "submit",
    profile(bishop, "bishop"),
  );
  assert.throws(
    () => applyAction(s, bishop, "approveBishop", { userId: "b1" }),
    /Office/,
  );
  assert.throws(
    () =>
      applyAction(s, bishop, "addRoster", {
        rows: [{ name: "John", dob: "01/02/1990" }],
      }),
    /full name/,
  );
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", dob: "01/02/1990" }],
  });
  assert.equal(s.rosters.length, 1, "a pending bishop's list is accepted");
  // A bishop asked to resubmit may edit once; a denied bishop drops off.
  s = applyAction(s, office, "reviewBishop", { userId: "b1", decision: "resubmit", note: "Please use the red jacket photo." });
  assert.equal(s.registrations[0].status, "pending");
  s = applyAction(s, bishop, "update", { ...profile(bishop, "bishop"), city: "Tema" });
  assert.equal(s.registrations[0].data.city, "Tema");
  assert.equal(s.registrations[0].resubmit, false, "answering the office clears the resubmit flag");
  s = applyAction(s, office, "reviewBishop", { userId: "b1", decision: "denied", note: "Not a bishop of this fellowship." });
  assert.equal(s.registrations[0].status, "denied");
  assert.throws(() => applyAction(s, bishop, "addRoster", { rows: [{ name: "Ama Owusu", dob: "02/02/1990" }] }), /Submit your bishop registration/);
});
test("unmatched pastor is Unclaimed but can already send payment proof; linked pastor is confirmed", () => {
  let s = setup();
  assert.throws(
    () => applyAction(s, pastor, "payment", { proof: "a", nonrefundable: true, transactionId: "TX-TEST-0001" }),
    /Submit your registration/,
  );
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.equal(s.registrations.at(-1).status, "unclaimed");
  s = applyAction(s, pastor, "payment", { proof: "a", nonrefundable: true, transactionId: "TX-TEST-0000" });
  assert.equal(s.registrations.at(-1).payment, "pending", "proof accepted while still unclaimed");
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", dob: "01/02/1990", email: pastor.email }],
  });
  assert.equal(s.registrations.at(-1).status, "confirmed");
  assert.equal(s.registrations.at(-1).amount, 50);
  s = applyAction(s, pastor, "payment", { proof: "p1/receipt/a.jpg", nonrefundable: true, transactionId: "TX-TEST-0001" });
  assert.equal(s.registrations.at(-1).payment, "pending");
  assert.throws(
    () => applyAction(s, pastor, "reviewPayment", { result: "verified" }),
    /Office/,
  );
  s = applyAction(s, office, "reviewPayment", {
    userId: "p1",
    result: "verified",
  });
  assert.equal(s.registrations.at(-1).payment, "verified");
});
test("a close name and birthday match automatically; a wrong birthday waits for the bishop", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "Jon Doe", dob: "02/01/1990" }],
  });
  // A spelling slip plus swapped day and month still matches.
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.equal(s.registrations.at(-1).status, "confirmed");
  s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "Jon Doe", dob: "14/07/1988" }],
  });
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.equal(s.registrations.at(-1).status, "unclaimed");
  assert.throws(
    () => applyAction(s, other, "claim", { userId: "p1" }),
    /selected bishop/,
  );
  s = applyAction(s, bishop, "claim", {
    userId: "p1",
    rosterId: s.rosters[0].id,
  });
  assert.equal(s.registrations.at(-1).status, "confirmed");
  assert.equal(s.rosters.length, 1);
  assert.throws(
    () => applyAction(s, bishop, "claim", { userId: "p1" }),
    /no longer/,
  );
});
test("the same person twice on one list is kept once", () => {
  const s = applyAction(setup(), bishop, "addRoster", {
    rows: [
      { name: "John Doe", dob: "01/02/1990" },
      { name: "John K Doe", dob: "02/02/1990" },
    ],
  });
  assert.equal(s.rosters.filter((r) => r.status === "active").length, 1);
});
test("removal preserves payment and next cycle has fresh counts and no copied payment", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", dob: "01/02/1990", email: pastor.email }],
  });
  s = applyAction(s, pastor, "submit", profile(pastor));
  s = applyAction(s, pastor, "payment", { proof: "p1/receipt/a", nonrefundable: true, transactionId: "TX-TEST-0001" });
  s = applyAction(s, bishop, "removeRoster", {
    id: s.rosters[0].id,
    reason: "Dismissed",
  });
  assert.equal(s.registrations.at(-1).status, "removed");
  assert.equal(s.registrations.at(-1).payment, "pending");
  const old = structuredClone(s.registrations);
  s = applyAction(s, office, "openYear", { year: 2028 });
  assert.deepEqual(s.registrations, old);
  assert.equal(s.registrations.filter((r) => r.year === 2028).length, 0);
  s = applyAction(s, bishop, "carryRoster");
  assert.equal(s.rosters.filter((r) => r.year === 2028).length, 0);
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.equal(s.registrations.at(-1).payment, "unpaid");
  assert.equal(s.registrations.at(-1).status, "unclaimed");
});
test("wrong bishop list never matches, drafts and unrelated profiles remain private", () => {
  let s = setup();
  s = applyAction(s, other, "submit", profile(other, "bishop", "Other"));
  s = applyAction(s, office, "approveBishop", {
    userId: "b2",
    referenceId: "B2",
  });
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", dob: "01/02/1990", email: pastor.email }],
  });
  s = applyAction(s, pastor, "save", { ...profile(pastor), bishopId: "B2" });
  assert.equal(visibleState(s, other, []).registrations.length, 1);
  s = applyAction(s, pastor, "submit", { ...profile(pastor), bishopId: "B2" });
  assert.equal(s.registrations.at(-1).status, "unclaimed");
  assert.equal(visibleState(s, bishop, []).registrations.length, 1);
  assert.equal(visibleState(s, pastor, []).profiles.length, 1);
});
test("failed bulk import is atomic, duplicates and invalid birth dates rejected", () => {
  const s = setup();
  assert.throws(() =>
    applyAction(s, bishop, "addRoster", {
      rows: [{ name: "Valid Person", dob: "01/02/1990" }, { name: "Invalid Person", dob: "31/02/1990" }],
    }),
    /date of birth/,
  );
  assert.equal(s.rosters.length, 0);
  assert.throws(() =>
    validateProfile({ ...profile(pastor), dob: "1990-02-31" }, pastor.email),
  );
  // Spreadsheets give full name, date of birth (day/month/year), then optional email and phone.
  assert.deepEqual(
    parseRoster('name,date of birth,email,phone\n"Doe, John",14/03/1985,john@example.com,\nAma Owusu\t3.4.90'),
    [
      { name: "Doe, John", dob: "1985-03-14", email: "john@example.com", phone: "" },
      { name: "Ama Owusu", dob: "1990-04-03", email: "", phone: "" },
    ],
  );
});

test("new form enforces split names, location, organization denomination and attire acknowledgement", () => {
  const p = profile(pastor);
  for (const field of ["firstName", "lastName", "country", "city"])
    assert.throws(() => validateProfile({ ...p, [field]: "" }, pastor.email));
  assert.throws(
    () =>
      validateProfile({ ...p, denomination: "Invented Church" }, pastor.email),
    /denomination/,
  );
  for (const organization of ["DHMM", "FLOW", "HJC"])
    assert.equal(
      validateProfile({ ...p, organization }, pastor.email).denomination,
      "",
    );
  assert.throws(
    () =>
      applyAction(setup(), pastor, "submit", { ...p, photoConfirmed: false }),
    /Confirm your photo/,
  );
});
test("confirming an existing record updates it, and the directory marks who is updated", () => {
  // A bishop whose annual list names a pastor DROGS already holds, with a new email.
  const references = [
    {
      id: "B1",
      role: "bishop",
      name: "Ama Bishop",
      title: "Bishop",
      organization: "First Love",
      denomination: "First Love Church",
      city: "Accra",
      country: "Ghana",
      email: "old-bishop@example.com",
      phone: "+233200000001",
    },
    {
      id: "P7",
      role: "pastor",
      name: "John Doe",
      title: "Pastor",
      organization: "First Love",
      denomination: "First Love Church",
      city: "Kumasi",
      country: "Ghana",
      email: "old-john@example.com",
      phone: "00233 20 123 4567",
    },
    {
      id: "P8",
      role: "pastor",
      name: "Never Listed",
      title: "Pastor",
      organization: "First Love",
      denomination: "First Love Church",
      city: "Tema",
      country: "Ghana",
      email: "quiet@example.com",
      phone: "+233201111111",
    },
  ];
  let s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [
      { name: "John Doe", dob: "01/02/1990", email: "john@example.com", phone: "+233201234567" },
    ],
  });
  const row = s.rosters[0];
  const index = referenceIndex(references);
  const matches = referenceMatches(index, row);
  assert.deepEqual(
    matches.map((m) => m.reference.id),
    ["P7"],
    "the existing record is offered by name",
  );
  assert.equal(
    matches[0].contactMatch,
    true,
    "the same number written differently still matches",
  );

  const before = directoryPeople(s, references);
  assert.equal(before.find((p) => p.id === "P7").updated, false);
  assert.equal(before.find((p) => p.id === "P7").email, "old-john@example.com");
  assert.equal(before.find((p) => p.id === "B1").updated, true, "the bishop registered");

  // Only the supervising bishop or the office confirms the match.
  assert.throws(
    () =>
      applyAction(s, other, "linkReference", {
        rosterId: row.id,
        referenceId: "P7",
      }),
    /bishop or office/,
  );
  s = applyAction(s, bishop, "linkReference", {
    rosterId: row.id,
    referenceId: "P7",
  });
  const after = directoryPeople(s, references);
  const john = after.find((p) => p.id === "P7");
  assert.equal(john.updated, true);
  assert.equal(john.claimed, true);
  assert.equal(john.email, "john@example.com", "our record now holds the new email");
  assert.equal(john.recorded.email, "old-john@example.com", "the previous email stays visible");
  assert.equal(after.find((p) => p.id === "P8").claimed, false, "nobody has claimed P8");

  // The same existing record cannot be confirmed for two people in one cycle.
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", dob: "09/09/1975", email: "other-john@example.com" }],
  });
  const second = s.rosters.find((r) => r.email === "other-john@example.com");
  assert.throws(
    () =>
      applyAction(s, bishop, "linkReference", {
        rosterId: second.id,
        referenceId: "P7",
      }),
    /already confirmed/,
  );
});
test("a pastor must pick a registered bishop and is matched or left for that bishop", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", dob: "01/02/1990" }],
  });
  assert.throws(
    () => applyAction(s, pastor, "submit", { ...profile(pastor), bishopId: "" }),
    /Choose your bishop/,
  );
  assert.deepEqual(
    visibleState(s, pastor, []).bishops.map((b) => b.id),
    ["B1"],
    "only registered bishops are offered",
  );
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.equal(s.registrations.find((r) => r.userId === pastor.id).status, "confirmed");

  // Not on the bishop's list: floats in that bishop's Unclaimed until they confirm.
  const lone = { id: "p2", email: "mary@example.com" };
  s = applyAction(s, lone, "submit", profile(lone, "pastor", "Mary Owusu"));
  assert.equal(s.registrations.find((r) => r.userId === lone.id).status, "unclaimed");
  assert.ok(visibleState(s, bishop, []).registrations.some((r) => r.userId === lone.id));
  assert.ok(!visibleState(s, other, []).registrations.some((r) => r.userId === lone.id));
  s = applyAction(s, bishop, "claim", { userId: lone.id });
  assert.equal(s.registrations.find((r) => r.userId === lone.id).status, "confirmed");
});
test("a Paystack payment is recorded only once, only when enough was paid", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", { rows: [{ name: "John Doe", dob: "01/02/1990", email: pastor.email }] });
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.throws(() => applyAction(s, pastor, "recordPaystack", { reference: "ref-1", amount: 40_00, currency: "GHS", expectedMinor: 575_00 }), /less than/);
  s = applyAction(s, pastor, "recordPaystack", { reference: "ref-1", amount: 580_00, currency: "GHS", expectedMinor: 575_00 });
  const paid = s.registrations.find((r) => r.userId === pastor.id);
  assert.equal(paid.payment, "verified");
  assert.equal(paid.paymentMethod, "paystack");
  assert.throws(() => applyAction(s, pastor, "recordPaystack", { reference: "ref-1", amount: 580_00, currency: "GHS", expectedMinor: 575_00 }), /already/);
});
test("a mobile-money Transaction ID pays for one person only", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", dob: "01/02/1990", email: pastor.email }, { name: "Nina Masuku", dob: "03/03/1991" }],
  });
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.throws(
    () => applyAction(s, pastor, "payment", { proof: "p1/receipt/a.jpg", nonrefundable: true, transactionId: "12" }),
    /Transaction ID/,
  );
  s = applyAction(s, pastor, "payment", { proof: "p1/receipt/a.jpg", nonrefundable: true, transactionId: " mp2409.1234.a1 " });
  const paid = s.registrations.find((r) => r.userId === pastor.id);
  assert.equal(paid.payment, "pending");
  assert.equal(paid.transactionId, "MP2409.1234.A1", "stored trimmed and upper-cased");
  const twin = { id: "p2", email: "nina@example.com" };
  s = applyAction(s, twin, "submit", { ...profile(twin, "pastor", "Nina Masuku"), dob: "1991-03-03", email: twin.email });
  assert.throws(
    () => applyAction(s, twin, "payment", { proof: "p2/receipt/a.jpg", nonrefundable: true, transactionId: "MP2409.1234.A1" }),
    /already been used/,
  );
});
test("the public roll lists only confirmed people and the office can pick the photo", () => {
  const references = [
    { id: "B1", role: "bishop", name: "Ama Bishop", title: "Bishop", organization: "First Love", denomination: "First Love Church", city: "Accra", country: "Ghana", image: "assets/bishops/001.jpg", email: "old@example.com", phone: "+233200000001" },
  ];
  let s = applyAction(emptyState(), bishop, "submit", { ...profile(bishop, "bishop", "Ama Bishop"), referenceId: "B1" });
  assert.equal(publicRoll(s, references).length, 0, "a pending bishop is not on the roll");
  s = applyAction(s, office, "approveBishop", { userId: bishop.id, referenceId: "B1" });
  const roll = publicRoll(s, references);
  assert.equal(roll.length, 1);
  assert.equal(roll[0].photo, profile(bishop).photo, "the new upload shows by default");
  assert.equal(roll[0].email, undefined, "no contact details on the roll");
  assert.equal(directoryPeople(s, references).find((p) => p.id === "B1").updated, true);
  assert.throws(() => applyAction(s, bishop, "choosePhoto", { userId: bishop.id, source: "reference" }), /Office/);
  s = applyAction(s, office, "choosePhoto", { userId: bishop.id, source: "reference" });
  const shown = directoryPeople(s, references).find((p) => p.id === "B1");
  assert.equal(shown.photo, "", "the office directory shows the existing photo too");
  assert.equal(shown.image, "assets/bishops/001.jpg");
  const chosen = publicRoll(s, references)[0];
  assert.equal(chosen.image, "assets/bishops/001.jpg");
  assert.equal(chosen.photo, "");
});

test("a registration cannot be submitted without consent to the public listing", () => {
  assert.throws(
    () => applyAction(emptyState(), pastor, "submit", { ...profile(pastor), consentedAt: "" }),
    /consent/,
  );
  // Reviewing (full validation) does not need consent yet; it comes on that screen.
  assert.ok(validateProfile({ ...profile(pastor), consentedAt: "" }, pastor.email));
  assert.equal(validateProfile(profile(pastor), pastor.email).consentedAt, "2026-09-29T08:00:00.000Z");
});
test("names are alike across order, missing middle names and small typos", () => {
  assert.ok(namesAlike("Nina Masuko", "Nely Nina Masuku"));
  assert.ok(namesAlike("Masuku Nina", "Nina Masuku"));
  assert.ok(namesAlike("Henry Asare Duah", "Henry Asare-Duah"));
  assert.ok(!namesAlike("Nina Masuku", "Brian Masuku"), "a different first name is a different person");
  assert.ok(namesAlike("J Smith", "John Smith"), "an initial stands in for a word");
  assert.ok(!namesAlike("Kent Njeru", "Farrell N.K.A Bruce"), "initials in the longer name are not wildcards");
  assert.ok(!namesAlike("Nina", "Nina Masuku"), "one word is never enough");
});

test("a submitted profile stays editable, but status and payment are untouched", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", { rows: [{ name: "John Doe", dob: "01/02/1990" }] });
  s = applyAction(s, pastor, "submit", profile(pastor));
  s = applyAction(s, pastor, "update", { city: "Kumasi", photoConfirmed: true });
  const r = s.registrations.find((x) => x.userId === pastor.id);
  assert.equal(r.data.city, "Kumasi");
  assert.equal(r.status, "confirmed", "still matched under the same bishop");
  assert.equal(r.payment, "unpaid");
});

test("female bishops are addressed by their organization's title", () => {
  assert.equal(titleFor({ role: "bishop", gender: "female", organization: "United Denominations" }), "Episcopal Sister");
  assert.equal(titleFor({ role: "bishop", gender: "female", organization: "First Love" }), "Mother");
  assert.equal(titleFor({ role: "bishop", gender: "male", organization: "First Love" }), "Bishop");
  assert.equal(titleFor({ role: "pastor", gender: "female", organization: "First Love" }), "Pastor");
  assert.throws(() => validateProfile({ ...profile(pastor), gender: "" }, pastor.email), /male or female/);
});
test("a pastor matched under a pending bishop stays on the roll when the office confirms the bishop with a reference", () => {
  let s = applyAction(emptyState(), bishop, "submit", profile(bishop, "bishop", "Ama Bishop"));
  s = applyAction(s, bishop, "addRoster", { rows: [{ name: "John Doe", dob: "01/02/1990" }] });
  s = applyAction(s, pastor, "submit", { ...profile(pastor), bishopId: bishop.id });
  assert.equal(s.registrations.at(-1).status, "confirmed");
  s = applyAction(s, office, "approveBishop", { userId: bishop.id, referenceId: "B1" });
  const reg = s.registrations.find((r) => r.userId === pastor.id);
  assert.equal(reg.status, "confirmed");
  assert.equal(reg.data.bishopId, "B1", "the pastor follows the bishop's new key");
  const roll = publicRoll(s, [{ id: "B1", role: "bishop", name: "Ama Bishop", title: "Bishop", organization: "First Love", denomination: "First Love Church", image: "", city: "Accra", country: "Ghana" }]);
  assert.ok(roll.some((p) => p.role === "pastor" && p.name === "John Doe"), "the pastor keeps their own public card");
});
test("a pastor removed from the list by mistake is matched again when re-added", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", { rows: [{ name: "John Doe", dob: "01/02/1990" }] });
  s = applyAction(s, pastor, "submit", { ...profile(pastor), bishopId: "B1" });
  assert.equal(s.registrations.at(-1).status, "confirmed");
  s = applyAction(s, bishop, "removeRoster", { id: s.rosters[0].id, reason: "Transferred" });
  assert.equal(s.registrations.at(-1).status, "removed");
  s = applyAction(s, bishop, "addRoster", { rows: [{ name: "John Doe", dob: "01/02/1990" }] });
  assert.equal(s.registrations.at(-1).status, "confirmed");
  assert.equal(s.rosters.filter((r) => r.status === "active" && r.pastorId === pastor.id).length, 1);
});
test("a header row without digits is skipped whatever it says", () => {
  assert.deepEqual(parseRoster("Full Name,Date of Birth\nJohn Doe,01/02/1990").map((r) => r.name), ["John Doe"]);
  assert.deepEqual(parseRoster("Pastor,Date of birth\nJohn Doe,01/02/1990").map((r) => r.name), ["John Doe"]);
  assert.equal(parseRoster("John Doe,01/02/1990").length, 1, "a single data row is not a header");
});
test("a pastor confirmed by hand gets a row with a date of birth so a later upload does not duplicate them", () => {
  let s = setup();
  s = applyAction(s, pastor, "submit", { ...profile(pastor), bishopId: "B1" });
  assert.equal(s.registrations.at(-1).status, "unclaimed");
  s = applyAction(s, bishop, "claim", { userId: pastor.id });
  assert.equal(s.rosters[0].dob, profile(pastor).dob);
  s = applyAction(s, bishop, "addRoster", { rows: [{ name: "John Doe", dob: "01/02/1990" }] });
  assert.equal(s.rosters.filter((r) => r.status === "active").length, 1, "the upload is recognised as the same person");
});

test("unclaimed pastors are flagged yellow when the list nearly matches, red when it does not", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", dob: "05/05/1980" }, { name: "Mary Owusu", dob: "01/02/1990" }],
  });
  // Same name as the list, but the birthday differs → yellow, pointing at John's row.
  s = applyAction(s, pastor, "submit", { ...profile(pastor), bishopId: "B1" });
  const reg = s.registrations.find((r) => r.userId === pastor.id);
  assert.equal(reg.status, "unclaimed");
  assert.deepEqual(nearMatches(s, reg).map((m) => [m.row.name, m.reason]), [["John Doe", "name"]]);
  // Same birthday and first name, married surname → yellow, pointing at Mary's row.
  const mary = { id: "p3", email: "mary@example.com" };
  s = applyAction(s, mary, "submit", { ...profile(mary, "pastor", "Mary Mensah"), dob: "1990-02-01", email: mary.email, bishopId: "B1" });
  assert.deepEqual(nearMatches(s, s.registrations.find((r) => r.userId === mary.id)).map((m) => [m.row.name, m.reason]), [["Mary Owusu", "first"]]);
  // Nothing like them on the list → red.
  const kojo = { id: "p4", email: "kojo@example.com" };
  s = applyAction(s, kojo, "submit", { ...profile(kojo, "pastor", "Kojo Denzel"), dob: "1985-09-09", email: kojo.email, bishopId: "B1" });
  assert.deepEqual(nearMatches(s, s.registrations.find((r) => r.userId === kojo.id)), []);
});

test("WhatsApp numbers are stored in international form without the trunk zero", () => {
  assert.equal(whatsappNumber("+233 024 123 4567", "Ghana"), "+233241234567", "zero after the code is dropped");
  assert.equal(whatsappNumber("0241234567", "Ghana"), "+233241234567", "local form takes the country's code");
  assert.equal(whatsappNumber("233241234567", "Ghana"), "+233241234567", "bare digits with the code are accepted");
  assert.equal(whatsappNumber("00233241234567", ""), "+233241234567", "00 prefix is the same as +");
  assert.equal(whatsappNumber("+44 7700 900123", "United Kingdom"), "+447700900123");
  assert.equal(whatsappNumber("+1 702 945 8407", "United States"), "+17029458407", "a 1 code never loses a digit");
  assert.equal(whatsappNumber("0241234567", ""), "", "a local number without a known country cannot be placed");
  assert.equal(whatsappNumber("12345", "Ghana"), "", "too short");
  const p = validateProfile({ ...profile(pastor), phone: "024 123 4567", country: "Ghana" }, pastor.email);
  assert.equal(p.phone, "+233241234567");
  assert.throws(() => validateProfile({ ...profile(pastor), phone: "0241234567", country: "Atlantis" }, pastor.email), /country code/);
});

test("the office can edit any detail of a registration and the change is recorded", () => {
  let s = setup();
  s = applyAction(s, pastor, "submit", { ...profile(pastor), bishopId: "B1" });
  s = applyAction(s, office, "officeEdit", { userId: pastor.id, data: { lastName: "Doe-Mensah", city: "Kumasi", phone: "024 999 8888", country: "Ghana" } });
  const r = s.registrations.find((x) => x.userId === pastor.id);
  assert.equal(r.data.name, "John Doe-Mensah");
  assert.equal(r.data.city, "Kumasi");
  assert.equal(r.data.phone, "+233249998888", "phone normalised like any member's");
  assert.equal(s.profiles.find((p) => p.id === pastor.id).name, "John Doe-Mensah");
  const last = s.audit.at(-1);
  assert.equal(last.action, "officeEdit");
  assert.deepEqual(last.detail.city, ["Accra", "Kumasi"]);
  assert.throws(() => applyAction(s, pastor, "officeEdit", { userId: pastor.id, data: { city: "X" } }), /Office/);
});
test("the office sets status, marks fees paid by other means, hides people and deletes registrations", () => {
  let s = setup();
  s = applyAction(s, pastor, "submit", { ...profile(pastor), bishopId: "B1" });
  assert.equal(s.registrations.at(-1).status, "unclaimed");
  s = applyAction(s, office, "setStatus", { userId: pastor.id, status: "confirmed" });
  assert.equal(s.registrations.find((x) => x.userId === pastor.id).status, "confirmed", "a list row is created under the bishop");
  s = applyAction(s, office, "markPaid", { userId: pastor.id, paid: true, note: "Cash at the office" });
  assert.equal(s.registrations.find((x) => x.userId === pastor.id).payment, "verified");
  assert.equal(s.registrations.find((x) => x.userId === pastor.id).paymentMethod, "manual");
  s = applyAction(s, office, "setVisibility", { userId: pastor.id, hidden: true });
  assert.ok(!publicRoll(s, []).some((p) => p.name === "John Doe"), "hidden people leave the roll");
  s = applyAction(s, office, "setVisibility", { userId: pastor.id, hidden: false });
  s = applyAction(s, office, "setStatus", { userId: pastor.id, status: "unclaimed" });
  assert.equal(s.registrations.find((x) => x.userId === pastor.id).status, "unclaimed");
  s = applyAction(s, office, "setStatus", { userId: bishop.id, status: "pending" });
  assert.equal(s.registrations.find((x) => x.userId === bishop.id).status, "pending");
  s = applyAction(s, office, "deleteRegistration", { userId: pastor.id });
  assert.ok(!s.registrations.some((x) => x.userId === pastor.id));
  assert.ok(s.rosters.every((x) => x.pastorId !== pastor.id), "list rows are unlinked, not lost");
});
test("the office adds people to the roll by hand and edits, restores and moves list rows", () => {
  let s = setup();
  s = applyAction(s, office, "addPerson", { data: { role: "bishop", firstName: "Elder", lastName: "Mensah", gender: "male", organization: "First Love", denomination: "First Love Church", city: "Accra", country: "Ghana" } });
  const added = publicRoll(s, []).find((p) => p.name === "Elder Mensah");
  assert.ok(added, "hand-added bishops appear on the roll at once");
  s = applyAction(s, bishop, "addRoster", { rows: [{ name: "Jon Doe", dob: "01/02/1990" }] });
  const row = s.rosters[0];
  s = applyAction(s, office, "editRoster", { id: row.id, name: "John Doe", dob: "02/02/1990" });
  assert.equal(s.rosters[0].name, "John Doe");
  assert.equal(s.rosters[0].dob, "1990-02-02");
  s = applyAction(s, bishop, "removeRoster", { id: row.id, reason: "Transferred" });
  assert.equal(s.rosters[0].status, "removed");
  s = applyAction(s, office, "restoreRoster", { id: row.id });
  assert.equal(s.rosters[0].status, "active");
  s = applyAction(s, office, "moveRoster", { id: row.id, bishopId: added.bishopKey });
  assert.equal(s.rosters[0].bishopId, s.profiles.find((p) => p.name === "Elder Mensah").id);
});
test("the office corrects, hides, deletes and adds old roster records without touching the source file", () => {
  const references = [
    { id: "B1", role: "bishop", name: "Ama Bishop", title: "Bishop", organization: "First Love", denomination: "FIRST LOVE CHURCH", city: "Accra", country: "Ghana", image: "" },
    { id: "P9", role: "pastor", name: "Kofi Mensa", title: "Pastor", organization: "First Love", denomination: "FIRST LOVE CHURCH", city: "Accra", country: "Ghana", image: "", bishop: "Ama Bishop" },
  ];
  let s = emptyState();
  s = applyAction(s, office, "editReference", { referenceId: "P9", fields: { name: "Kofi Mensah", city: "Tema" } });
  s = applyAction(s, office, "hideReference", { referenceId: "B1", hidden: true });
  s = applyAction(s, office, "addReference", { fields: { role: "pastor", name: "New Person", organization: "First Love", denomination: "FIRST LOVE CHURCH", city: "Accra", country: "Ghana" } });
  const shown = overlayReferences(references, s);
  assert.deepEqual(shown.map((p) => p.name), ["Kofi Mensah", "New Person"]);
  assert.equal(shown[0].city, "Tema");
  s = applyAction(s, office, "deleteReference", { referenceId: "P9" });
  assert.deepEqual(overlayReferences(references, s).map((p) => p.name), ["New Person"]);
  s = applyAction(s, office, "deleteReference", { referenceId: "P9", deleted: false });
  s = applyAction(s, office, "hideReference", { referenceId: "B1", hidden: false });
  assert.equal(overlayReferences(references, s).length, 3);
});
test("the office edits the organization and denomination lists and the fees, and sign-up follows", () => {
  let s = setup();
  s = applyAction(s, office, "setCatalog", { catalog: { organizations: ["First Love", "New Fellowship"], denominations: { "First Love": ["First Love Church"], "New Fellowship": ["Zion Assembly", "Grace House"] } } });
  assert.deepEqual(catalogOf(s).organizations, ["First Love", "New Fellowship"]);
  const other = { id: "p7", email: "p7@example.com" };
  s = applyAction(s, other, "submit", { ...profile(other, "pastor", "Zion Member"), organization: "New Fellowship", denomination: "Grace House", bishopId: "B1" });
  assert.equal(s.registrations.at(-1).data.denomination, "Grace House");
  assert.throws(() => applyAction(s, other, "update", { organization: "United Denominations" }), /organization|Denomination|locked/i);
  s = applyAction(s, office, "setFees", { bishop: 120, pastor: 60 });
  const p8 = { id: "p8", email: "p8@example.com" };
  s = applyAction(s, p8, "submit", { ...profile(p8, "pastor", "Fee Tester"), organization: "First Love", denomination: "First Love Church", bishopId: "B1" });
  assert.equal(s.registrations.at(-1).amount, 60);
  assert.throws(() => applyAction(s, office, "setCatalog", { catalog: { organizations: [] } }), /at least one/);
});
test("office adds an original-data record with an uploaded photo; the overlay carries it", () => {
  let s = applyAction(emptyState(), office, "addReference", { fields: { role: "bishop", name: "Kwame Added", organization: "First Love", denomination: "First Love Church", country: "Ghana", photo: "office/portrait/k.webp" } });
  const added = s.extraReferences[0];
  assert.equal(added.photo, "office/portrait/k.webp");
  assert.equal(overlayReferences([], s).find((p) => p.id === added.id).photo, "office/portrait/k.webp");
  s = applyAction(s, office, "editReference", { referenceId: added.id, fields: { photo: "office/portrait/k2.webp" } });
  assert.equal(overlayReferences([], s).find((p) => p.id === added.id).photo, "office/portrait/k2.webp");
});
test("a bishop whose linked original record carries their name is approved on submit; others wait", () => {
  const refs = [{ id: "B9", role: "bishop", name: "Ama Bishop", organization: "First Love" }];
  let s = applyAction(emptyState(), bishop, "submit", { ...profile(bishop, "bishop", "Ama Bishop"), referenceId: "B9" }, undefined, refs);
  assert.equal(s.registrations[0].status, "confirmed", "name matches the linked record");
  assert.equal(s.profiles[0].autoApproved, true);
  assert.equal(s.profiles[0].referenceId, "B9");
  // Same record claimed by a second account: not automatic.
  s = applyAction(s, other, "submit", { ...profile(other, "bishop", "Ama Bishop"), referenceId: "B9" }, undefined, refs);
  assert.equal(s.registrations[1].status, "pending", "a record already linked elsewhere waits for the Archbishop");
  // A different name on the linked record: not automatic.
  let t = applyAction(emptyState(), bishop, "submit", { ...profile(bishop, "bishop", "Kofi Other"), referenceId: "B9" }, undefined, refs);
  assert.equal(t.registrations[0].status, "pending");
  // No link at all: not automatic.
  t = applyAction(emptyState(), bishop, "submit", profile(bishop, "bishop", "Ama Bishop"), undefined, refs);
  assert.equal(t.registrations[0].status, "pending");
});
test("members update their own details any time; date of birth is fixed; corrections reach the original record", () => {
  let s = applyAction(emptyState(), bishop, "submit", { ...profile(bishop, "bishop", "Ama Bishop"), referenceId: "B1" });
  assert.equal(s.overrides.B1.phone, "+233201234567", "the submitted number lands on the original record");
  s = applyAction(s, bishop, "update", { city: "Kumasi", phone: "+233 24 000 0000", dob: "1950-01-01", photoConfirmed: true });
  const r = s.registrations[0];
  assert.equal(r.data.city, "Kumasi");
  assert.equal(r.data.dob, "1990-02-01", "date of birth cannot be changed by the member");
  assert.equal(s.overrides.B1.city, "Kumasi");
  assert.equal(s.overrides.B1.phone, "+233240000000");
  assert.deepEqual(Object.keys(s.audit.at(-1).detail).sort(), ["city", "phone"]);
});
test("a pastor who picks a different bishop is re-matched under the new one", () => {
  let s = setup();
  s = applyAction(s, other, "submit", profile(other, "bishop", "Kofi Other"));
  s = applyAction(s, office, "approveBishop", { userId: other.id });
  s = applyAction(s, bishop, "addRoster", { rows: [{ name: "John Doe", dob: "01/02/1990" }] });
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.equal(s.registrations.at(-1).status, "confirmed", "matched under the first bishop");
  s = applyAction(s, pastor, "update", { bishopId: other.id, photoConfirmed: true });
  const r = s.registrations.find((x) => x.userId === pastor.id);
  assert.equal(r.data.bishopId, other.id);
  assert.equal(r.status, "unclaimed", "no list row under the new bishop yet");
  assert.equal(s.rosters[0].pastorId, null, "the old row is released");
});
test("broadcast audiences: everyone, bishops, pastors or chosen people; placeholders skipped", () => {
  let s = setup();
  s = applyAction(s, pastor, "submit", profile(pastor));
  s = applyAction(s, office, "addPerson", { data: { role: "pastor", firstName: "Hand", lastName: "Added", gender: "male", organization: "First Love", denomination: "First Love Church", country: "Ghana", city: "Accra" } });
  assert.deepEqual(broadcastRecipients(s, "all").map((p) => p.email).sort(), ["bishop@example.com", "john@example.com"]);
  assert.deepEqual(broadcastRecipients(s, "bishops").map((p) => p.email), ["bishop@example.com"]);
  assert.deepEqual(broadcastRecipients(s, "pastors").map((p) => p.email), ["john@example.com"]);
  assert.deepEqual(broadcastRecipients(s, "selected", [pastor.id]).map((p) => p.email), ["john@example.com"]);
  const refs = [{ id: "B1", role: "bishop", name: "Ama Bishop", email: "bishop@example.com" }, { id: "B2", role: "bishop", name: "Old Bishop", email: "old@example.com" }, { id: "P1", role: "pastor", name: "Old Pastor", email: "oldp@example.com" }, { id: "P2", role: "pastor", name: "No Email", email: "" }];
  assert.deepEqual(broadcastRecipients(s, "original-bishops", [], refs).map((p) => p.email).sort(), ["bishop@example.com", "old@example.com"]);
  assert.deepEqual(broadcastRecipients(s, "original-pastors", [], refs).map((p) => p.email), ["oldp@example.com"]);
  assert.deepEqual(broadcastRecipients(s, "selected", [pastor.id, "P1"], refs).map((p) => p.email), ["john@example.com", "oldp@example.com"]);
  assert.equal(broadcastRecipients(s, "original-all", [], refs).length, 3, "one email per address");
  assert.throws(() => applyAction(s, bishop, "broadcast", { subject: "x" }), /Office/);
  s = applyAction(s, office, "broadcast", { subject: "Convention dates", audience: "bishops", recipients: 1 });
  assert.deepEqual(s.audit.at(-1).detail, { subject: "Convention dates", audience: "bishops", recipients: 1 });
  s = applyAction(s, office, "broadcast", { subject: "Big send", audience: "original-all", recipients: 4400, failed: 12 });
  assert.deepEqual(s.audit.at(-1).detail, { subject: "Big send", audience: "original-all", recipients: 4400, failed: 12 });
});
test("paused sign-up blocks new registrations but not existing members", () => {
  let s = setup();
  s = applyAction(s, office, "setSignup", { closed: true, notice: "Registration for 2027 has closed." });
  assert.throws(() => applyAction(s, pastor, "save", profile(pastor)), /has closed/);
  assert.throws(() => applyAction(s, pastor, "submit", profile(pastor)), /has closed/);
  s = applyAction(s, bishop, "update", { city: "Tema", photoConfirmed: true });
  assert.equal(s.registrations[0].data.city, "Tema", "a submitted member still edits");
  assert.throws(() => applyAction(s, bishop, "setSignup", { closed: false }), /Office/);
  s = applyAction(s, office, "setSignup", { closed: false });
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.equal(s.registrations.at(-1).data.name, "John Doe");
});
test("groups: a person's group comes from their record or their denomination; the office can regroup", () => {
  const cat = catalogOf(emptyState());
  assert.equal(groupOf(cat, { organization: "United Denominations", denomination: "Makarios Church" }), "UD Ghana");
  assert.equal(groupOf(cat, { group: "UD Asia", denomination: "Makarios Church" }), "UD Asia", "a group on the record wins");
  assert.equal(groupOf(cat, { organization: "United Denominations", denomination: "Unknown Chapel" }), "");
  let s = applyAction(emptyState(), office, "setCatalog", { catalog: { ...cat, groups: { ...cat.groups, "UD Asia": { organization: "United Denominations", denominations: ["Unknown Chapel"] } } } });
  assert.equal(groupOf(catalogOf(s), { organization: "United Denominations", denomination: "Unknown Chapel" }), "UD Asia");
  assert.throws(() => applyAction(s, office, "setCatalog", { catalog: { ...cat, groups: { Loose: { organization: "Nowhere", denominations: [] } } } }), /must belong/);
});
test("the appointments door pauses separately from the general sign-up", () => {
  let s = setup();
  s = applyAction(s, office, "setSignup", { scope: "general", closed: true, notice: "Yearly registration has closed." });
  assert.throws(() => applyAction(s, pastor, "submit", profile(pastor)), /has closed/);
  s = applyAction(s, pastor, "submit", { ...profile(pastor), entrance: "appointments" });
  assert.equal(s.registrations.at(-1).entrance, "appointments", "the appointments door stays open and is recorded");
  s = applyAction(s, office, "setSignup", { scope: "appointments", closed: true, notice: "No appointments right now." });
  const p9 = { id: "p9", email: "p9@example.com" };
  assert.throws(() => applyAction(s, p9, "submit", { ...profile(p9, "pastor", "New Appointee"), entrance: "appointments" }), /No appointments/);
  assert.equal(signupOf(s).closed, true); assert.equal(signupOf(s).appointments.closed, true);
});
test("a denomination removed from the lists leaves its people as No denomination", () => {
  const cat = catalogOf(emptyState());
  assert.equal(denominationListed(cat, { organization: "First Love", denomination: "First Love Church" }), true);
  assert.equal(denominationListed(cat, { organization: "United Denominations", denomination: "THE MAKARIOS CHURCH" }), true, "case and a leading The do not matter");
  assert.equal(denominationListed(cat, { organization: "First Love", denomination: "Gone Chapel" }), false);
  assert.equal(denominationListed(cat, { organization: "First Love", denomination: "" }), false);
  assert.equal(denominationListed(cat, { organization: "FLOW", denomination: "FLOW" }), true, "an organization without a list has nothing to check");
  assert.equal(denominationListed(cat, { organization: "United Denominations", denomination: "Eschatos" }), true, "a group name counts as a denomination");
  assert.equal(groupOf(cat, { organization: "United Denominations", denomination: "Eschatos" }), "Eschatos");
  assert.deepEqual(cat.groups.Eschatos.denominations, ["Eschatos"], "Eschatos is its own denomination; people keep their own countries");
  const saved = catalogOf({ catalog: { ...cat, groups: { ...cat.groups, Eschatos: { organization: "United Denominations", denominations: ["Eschatos", "Revelation Church Of Asia"] } } } });
  assert.deepEqual(saved.groups.Eschatos.denominations, ["Eschatos", "Revelation Church Of Asia"], "the office's saved card is returned exactly as saved");
  const trimmed = { ...cat, denominations: { ...cat.denominations, "First Love": cat.denominations["First Love"].filter((d) => d !== "Go Ye Church") } };
  assert.equal(denominationListed(trimmed, { organization: "First Love", denomination: "Go Ye Church" }), false);
});
test("denomination logos: defaults from the old records, office uploads saved with the lists", () => {
  const cat = catalogOf(emptyState());
  assert.ok(logoFor(cat, "First Love Church").startsWith("assets/"), "the old artwork is the default");
  assert.equal(logoFor(cat, "No Such Chapel"), "");
  const s = applyAction(emptyState(), office, "setCatalog", { catalog: { ...cat, logos: { ...cat.logos, "No Such Chapel": "office/logo/x.webp" } } });
  assert.equal(logoFor(catalogOf(s), "no such chapel"), "office/logo/x.webp");
});
test("the attire check verdict travels with the photo and is cleared when the office replaces it", () => {
  let s = setup();
  s = applyAction(s, pastor, "submit", { ...profile(pastor), photoCheck: { verdict: "colour", note: "We could not see a dark jacket." } });
  let r = s.registrations.find((x) => x.userId === pastor.id);
  assert.deepEqual(r.data.photoCheck, { verdict: "colour", note: "We could not see a dark jacket." });
  s = applyAction(s, office, "officeEdit", { userId: pastor.id, data: { photo: "office/portrait/new.webp" } });
  r = s.registrations.find((x) => x.userId === pastor.id);
  assert.equal(r.data.photoCheck, null, "a replaced photo has no stale verdict");
  const t = validateProfile({ ...profile(pastor), photoCheck: { verdict: "nonsense" } }, pastor.email);
  assert.equal(t.photoCheck, null, "unknown verdicts are dropped");
});
test("a date of birth that gives an age under sixteen is rejected", () => {
  const young = new Date(Date.now() - 10 * 365.25 * 86400000).toISOString().slice(0, 10);
  assert.throws(() => validateProfile({ ...profile(pastor), dob: young }, pastor.email), /under 16/);
  assert.equal(validateProfile({ ...profile(pastor), dob: "1990-02-01" }, pastor.email).dob, "1990-02-01");
});
