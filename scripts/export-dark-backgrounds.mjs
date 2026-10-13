// Exports every pastor photo flagged for a dark, grey or coloured background (data/reports/attire-review.json, BGCOLOUR) into
// ~/Downloads/Pastor photos with dark or grey backgrounds/<Bishop>/<Name - id>.jpg with a CSV, for the office to whiten in bulk.
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs"; import sharp from "sharp";
const root = process.cwd() + "/";
const p = JSON.parse(readFileSync("src/registration/reference-people.json", "utf8")); const r = JSON.parse(readFileSync("data/reports/attire-review.json", "utf8"));
const list = p.filter((x) => x.role === "pastor" && x.organization !== "FLOW" && r[x.id] && r[x.id].codes.includes("BGCOLOUR") && x.image && existsSync(x.image)).sort((a, b) => (a.bishop || "").localeCompare(b.bishop || "") || a.name.localeCompare(b.name));
const base = process.env.HOME + "/Downloads/Pastor photos with dark or grey backgrounds"; rmSync(base, { recursive: true, force: true }); mkdirSync(base, { recursive: true });
const safe = (s) => String(s).replace(/[\/\\:*?"<>|]/g, "-").trim(); const rows = ["id,name,bishop,denomination,file"];
const q = (v) => '"' + String(v || "").replace(/"/g, '""') + '"';
for (const x of list) { const folder = safe("Bishop " + (x.bishop || "Unclaimed")); mkdirSync(`${base}/${folder}`, { recursive: true }); const file = `${safe(x.name)} - ${x.id}.jpg`; await sharp(x.image).jpeg({ quality: 92 }).toFile(`${base}/${folder}/${file}`); rows.push([x.id, x.name, x.bishop, x.denomination, `${folder}/${file}`].map(q).join(",")); }
writeFileSync(`${base}/README.txt`, `Pastor photos whose background is dark, grey or coloured (not white), as reviewed on 13 October 2026.\n${list.length} photos, one folder per bishop. File names carry the pastor's record id (for example "Name - P1234.jpg"). Keep the id in the file name when returning the corrected photo so it can be matched automatically.\nFull list in photos.csv.\n`);
writeFileSync(`${base}/photos.csv`, rows.join("\n") + "\n"); console.log("exported", list.length, "photos");
