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
  assert.throws(() => applyAction(s, bishop, "update", { ...profile(bishop, "bishop") }), /locked/);
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

test("a submitted profile is locked", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", { rows: [{ name: "John Doe", dob: "01/02/1990" }] });
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.throws(() => applyAction(s, pastor, "update", { ...profile(pastor), city: "Kumasi" }), /locked/);
  assert.equal(s.registrations.find((x) => x.userId === pastor.id).data.city, "Accra");
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
