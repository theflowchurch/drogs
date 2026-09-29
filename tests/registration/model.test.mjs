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
  photoConfirmed: true,
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
test("bishop cannot self-approve or add a list while pending", () => {
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
        rows: [{ name: "John", email: "john@example.com" }],
      }),
    /approved/,
  );
});
test("unmatched pastor is Unclaimed and cannot pay, linked pastor can", () => {
  let s = setup();
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.equal(s.registrations.at(-1).status, "unclaimed");
  assert.throws(
    () =>
      applyAction(s, pastor, "payment", { proof: "a", nonrefundable: true }),
    /unlocks/,
  );
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", email: pastor.email }],
  });
  assert.equal(s.registrations.at(-1).status, "confirmed");
  assert.equal(s.registrations.at(-1).amount, 50);
  s = applyAction(s, pastor, "payment", {
    proof: "p1/receipt/a.jpg",
    nonrefundable: true,
  });
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
test("name-only and fuzzy-name matches require explicit confirmation", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "Jon Doe", email: pastor.email }],
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
test("duplicate-contact ambiguous candidates are not auto matched", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [
      { name: "John Doe", email: pastor.email },
      { name: "John Doe", phone: "+233201234567" },
    ],
  });
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.equal(s.registrations.at(-1).status, "unclaimed");
});
test("removal preserves payment and next cycle has fresh counts and no copied payment", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", email: pastor.email }],
  });
  s = applyAction(s, pastor, "submit", profile(pastor));
  s = applyAction(s, pastor, "payment", {
    proof: "p1/receipt/a",
    nonrefundable: true,
  });
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
    rows: [{ name: "John Doe", email: pastor.email }],
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
      rows: [{ name: "Valid", email: "v@example.com" }, { name: "Invalid" }],
    }),
  );
  assert.equal(s.rosters.length, 0);
  assert.throws(() =>
    validateProfile({ ...profile(pastor), dob: "1990-02-31" }, pastor.email),
  );
  assert.deepEqual(
    parseRoster('name,email,phone,church\n"Doe, John",john@example.com,,Grace'),
    [
      {
        name: "Doe, John",
        email: "john@example.com",
        phone: "",
        church: "Grace",
      },
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
  for (const organization of ["DHMM", "FLOW", "Healing Jesus Campaign"])
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
      { name: "John Doe", email: "john@example.com", phone: "+233201234567" },
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
    rows: [{ name: "John Doe", email: "other-john@example.com" }],
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
test("a pastor registers without choosing a bishop and is matched or claimed", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", email: pastor.email }],
  });
  // Matched against every approved bishop's list, then assigned to that bishop.
  s = applyAction(s, pastor, "submit", {
    ...profile(pastor),
    bishopId: "",
    bishopFirstName: "Bishop",
    bishopLastName: "Ama",
  });
  const matched = s.registrations.find((r) => r.userId === pastor.id);
  assert.equal(matched.status, "confirmed");
  assert.equal(
    matched.data.bishopId,
    "B1",
    "the typed name, in either order, resolves the bishop",
  );

  // Not on any list: unclaimed, visible to approved bishops, claimable by one.
  const lone = { id: "p2", email: "mary@example.com" };
  s = applyAction(s, lone, "submit", {
    ...profile(lone, "pastor", "Mary Owusu"),
    bishopId: "",
    bishopFirstName: "Unknown",
    bishopLastName: "Person",
  });
  const third = { id: "p3", email: "x@example.com" };
  assert.throws(
    () =>
      applyAction(s, third, "submit", {
        ...profile(third),
        bishopId: "",
        bishopLastName: "",
      }),
    /first name and surname/,
  );
  assert.equal(s.registrations.find((r) => r.userId === lone.id).status, "unclaimed");
  assert.ok(
    visibleState(s, bishop, []).registrations.some((r) => r.userId === lone.id),
    "an approved bishop sees the unassigned pastor",
  );
  assert.throws(
    () => applyAction(s, pastor, "claim", { userId: lone.id }),
    /Assign an approved bishop|bishop or office/,
  );
  s = applyAction(s, bishop, "claim", { userId: lone.id });
  const claimed = s.registrations.find((r) => r.userId === lone.id);
  assert.equal(claimed.status, "confirmed");
  assert.equal(claimed.data.bishopId, "B1");
});

test("a Paystack payment is recorded only once, only when enough was paid", () => {
  let s = setup();
  s = applyAction(s, bishop, "addRoster", {
    rows: [{ name: "John Doe", email: pastor.email }],
  });
  s = applyAction(s, pastor, "submit", profile(pastor));
  assert.equal(s.registrations.find((r) => r.userId === pastor.id).status, "confirmed");
  assert.throws(
    () =>
      applyAction(s, pastor, "recordPaystack", {
        reference: "ref-1",
        amount: 40_00,
        currency: "GHS",
        expectedMinor: 575_00,
      }),
    /less than/,
  );
  s = applyAction(s, pastor, "recordPaystack", {
    reference: "ref-1",
    amount: 580_00,
    currency: "GHS",
    expectedMinor: 575_00,
  });
  const paid = s.registrations.find((r) => r.userId === pastor.id);
  assert.equal(paid.payment, "verified");
  assert.equal(paid.paymentMethod, "paystack");
  assert.throws(
    () =>
      applyAction(s, pastor, "recordPaystack", {
        reference: "ref-1",
        amount: 580_00,
        currency: "GHS",
        expectedMinor: 575_00,
      }),
    /already/,
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
  const chosen = publicRoll(s, references)[0];
  assert.equal(chosen.image, "assets/bishops/001.jpg");
  assert.equal(chosen.photo, "");
});
