import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const ids = {
  office: "00000000-0000-0000-0000-000000000001",
  bishop: "00000000-0000-0000-0000-000000000002",
  other: "00000000-0000-0000-0000-000000000003",
  pastor: "00000000-0000-0000-0000-000000000004",
  stranger: "00000000-0000-0000-0000-000000000005",
};
test("PostgreSQL registration workflow enforces isolation, claims, payment locks and annual history", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema public,auth,storage to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 grant select,insert on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
    await db.exec(
      await fs.readFile(
        "supabase/migrations/202609250002_registration.sql",
        "utf8",
      ),
    );
    await db.exec(
      await fs.readFile(
        "supabase/migrations/202609250003_registration_details.sql",
        "utf8",
      ),
    );
    for (const [name, id] of Object.entries(ids))
      await db.query("insert into auth.users values($1,$2,now())", [
        id,
        `${name}@example.com`,
      ]);
    await db.query("insert into public.registration_office values($1)", [
      ids.office,
    ]);
    await db.exec(
      "insert into public.registration_references(id,name) values('B1','First Bishop'),('B2','Other Bishop');",
    );
    const as = async (who) => {
      await db.exec("reset role");
      await db.query("select set_config('test.uid',$1,false)", [
        who ? ids[who] : "",
      ]);
      await db.exec(`set role ${who ? "authenticated" : "anon"}`);
    };
    const call = (name, payload = {}) =>
      db.query("select public.registration_action($1,$2::jsonb)", [
        name,
        JSON.stringify(payload),
      ]);
    const snap = async () =>
      (await db.query("select public.registration_snapshot() as data")).rows[0]
        .data;
    const form = (who, role = "pastor") => ({
      role,
      name: who === "pastor" ? "John Doe" : `${who} Name`,
      firstName: who === "pastor" ? "John" : who,
      lastName: who === "pastor" ? "Doe" : "Name",
      denomination: "First Love Church",
      country: "Ghana",
      city: "Accra",
      photoConfirmed: true,
      phone: who === "pastor" ? "+233201234567" : "+233209998888",
      dob: "1990-02-01",
      church: "Grace",
      organization: "First Love",
      photo: `${ids[who]}/portrait/test.jpg`,
      gender: "male",
      bishopId: "B1",
      bishopFirstName: "Test",
      bishopLastName: "Bishop",
    });
    const upload = async (who, kind = "portrait") => {
      await as(who);
      await db.query(
        "insert into storage.objects(bucket_id,name) values('registration-media',$1)",
        [`${ids[who]}/${kind}/test.jpg`],
      );
    };
    await as(null);
    await assert.rejects(() => snap(), /permission denied/);
    await as("bishop");
    await assert.rejects(
      () => db.query("select * from registration_profiles"),
      /permission denied/,
    );
    await upload("bishop");
    await call("submit", form("bishop", "bishop"));
    await assert.rejects(
      () => call("approveBishop", { userId: ids.bishop }),
      /Office access/,
    );
    await assert.rejects(
      () =>
        call("addRoster", {
          rows: [{ name: "John Doe", email: "pastor@example.com" }],
        }),
      /approved/,
    );
    await as("office");
    await call("approveBishop", { userId: ids.bishop, referenceId: "B1" });
    await upload("other");
    await call("submit", form("other", "bishop"));
    await as("office");
    await call("approveBishop", { userId: ids.other, referenceId: "B2" });
    await as("bishop");
    await call("addRoster", {
      rows: [{ name: "Jon Doe", email: "pastor@example.com" }],
    });
    await upload("pastor");
    await call("save", form("pastor"));
    await as("bishop");
    assert.equal(
      (await snap()).registrations.length,
      1,
      "bishop cannot read a pastor draft",
    );
    await as("pastor");
    await assert.rejects(
      () => call("submit", { ...form("pastor"), photoConfirmed: false }),
      /Confirm your photo/,
    );
    await assert.rejects(
      () => call("submit", { ...form("pastor"), denomination: "Invented" }),
      /denomination/,
    );
    await call("submit", { ...form("pastor"), status: "confirmed", amount: 0 });
    let s = await snap();
    assert.equal(s.registrations[0].status, "unclaimed");
    assert.equal(s.registrations[0].amount, 50);
    await assert.rejects(
      () =>
        call("payment", {
          proof: `${ids.pastor}/receipt/test.jpg`,
          nonrefundable: true,
        }),
      /unlocks/,
    );
    await as("other");
    assert.equal(
      (await snap()).registrations.length,
      1,
      "other bishop sees only own registration",
    );
    await assert.rejects(
      () => call("claim", { userId: ids.pastor }),
      /selected bishop/,
    );
    await as("bishop");
    const roster = (await snap()).rosters[0];
    await call("claim", { userId: ids.pastor, rosterId: roster.id });
    await assert.rejects(
      () => call("claim", { userId: ids.pastor }),
      /no longer/,
    );
    await as("pastor");
    assert.equal((await snap()).registrations[0].status, "confirmed");
    await assert.rejects(
      () =>
        call("payment", {
          proof: `${ids.bishop}/portrait/test.jpg`,
          nonrefundable: true,
        }),
      /payment proof/,
    );
    await upload("pastor", "receipt");
    await call("payment", {
      proof: `${ids.pastor}/receipt/test.jpg`,
      nonrefundable: true,
    });
    await assert.rejects(
      () => call("reviewPayment", { userId: ids.pastor, result: "verified" }),
      /Office/,
    );
    await as("other");
    assert.equal(
      (
        await db.query("select * from storage.objects where name=$1", [
          `${ids.pastor}/portrait/test.jpg`,
        ])
      ).rows.length,
      0,
      "unrelated bishop cannot see portrait",
    );
    await as("bishop");
    assert.equal(
      (
        await db.query("select * from storage.objects where name=$1", [
          `${ids.pastor}/portrait/test.jpg`,
        ])
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query("select * from storage.objects where name=$1", [
          `${ids.pastor}/receipt/test.jpg`,
        ])
      ).rows.length,
      0,
      "bishop cannot read receipt",
    );
    await as("office");
    await call("reviewPayment", { userId: ids.pastor, result: "verified" });
    await as("bishop");
    await call("removeRoster", { id: roster.id, reason: "Dismissed" });
    s = await snap();
    assert.equal(
      s.registrations.find((r) => r.userId === ids.pastor).status,
      "removed",
    );
    assert.equal(
      s.registrations.find((r) => r.userId === ids.pastor).payment,
      "verified",
    );
    await as("office");
    await call("openYear", { year: 2028 });
    s = await snap();
    assert.equal(s.year, 2028);
    assert.equal(s.registrations.filter((r) => r.year === 2028).length, 0);
    await as("pastor");
    await call("submit", form("pastor"));
    s = await snap();
    assert.equal(
      s.registrations.find((r) => r.year === 2028).payment,
      "unpaid",
    );
    assert.equal(
      s.registrations.find((r) => r.year === 2027).status,
      "removed",
    );
    await as("stranger");
    await assert.rejects(
      () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('registration-media',$1)",
          [`${ids.bishop}/portrait/forged.jpg`],
        ),
      /row-level security/,
    );
    await assert.rejects(
      () =>
        call("submit", {
          ...form("stranger"),
          photo: `${ids.bishop}/portrait/test.jpg`,
        }),
      /own official/,
    );
  } finally {
    await db.close();
  }
});
