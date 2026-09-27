import fs from "node:fs";
const records = JSON.parse(
  fs.readFileSync("src/registration/reference-people.json", "utf8"),
).filter((r) => r.role === "bishop");
const quote = (s) => `'${String(s || "").replaceAll("'", "''")}'`;
const sql =
  "-- Reference names only: no registrations, accounts, dates of birth or contact details.\nINSERT INTO public.registration_references(id,name,title,organization,image) VALUES\n" +
  records
    .map(
      (r) =>
        "(" +
        [r.id, r.name, r.title, r.organization, r.image].map(quote).join(",") +
        ")",
    )
    .join(",\n") +
  "\nON CONFLICT(id) DO NOTHING;\n";
fs.writeFileSync("supabase/registration-reference-seed.sql", sql);
