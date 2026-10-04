// Walks the office's photo folders ("BISHOPS AND PASTORS UNDER THEM IN PICTURES") and writes an
// index of every portrait: group folder, bishop folder, cleaned person name, and whether the file
// is the bishop's own portrait. Zips are read from their extracted copies in /tmp/pics-zips.
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { namesAlike, normalName } from '../src/registration/model.mjs';
// The office's folders, newest first; earlier photo deliveries are searched too so nothing sent before is lost.
const ROOTS = [process.env.PICS_ROOT || `${process.env.HOME}/Downloads/BISHOPS AND PASTORS UNDER THEM IN PICTURES`, `${process.env.HOME}/Downloads/Bishop's project/BISHOPS PICTURES`, `${process.env.HOME}/Downloads/Bishop's project/MASTER PORTRAITS`, `${process.env.HOME}/Downloads/Bishop's project/MASTER PORTRAITS IMPORT`];
const IMG = new Set(['.jpg', '.jpeg', '.png', '.heic', '.webp']);
const GROUP = { 'UD GHANA': 'UD Ghana', 'UD AF': 'UD Africa', 'UD EU': 'UD Europe', 'UD NA': 'UD North America', 'UJ': 'United Jesus', 'FIRST LOVE': 'First Love', 'REASONABLE SERVICE': 'Reasonable Service', 'ESCHATOS INT': 'Eschatos', 'UNITED ISLANDS': 'United Islands' };
const groupOf = (dir) => GROUP[dir.toUpperCase().replace(/\s*\d+$/, '').trim()] || dir;
const TITLE = /^(bishop|bishops|bs|b\.s\.|es|episcopal sister|sister|apostle|reverend|revd|rev|lady rev|lady pastor|lady|lp|lr|ps|pastor|pasteur|pst|mr|mrs|ms|dr|minister|prophet|copy|whatsapp|image|img|photo|picture|updated)\b\.?\s*/i;
export const cleanName = (raw) => {
  let s = String(raw).replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s*\(\d+\)\s*$/, '').replace(/\s*-\s*updated\b/i, '').replace(/^copy of\b/i, ' ').replace(/\bcopy\b/ig, ' ');
  s = s.replace(/^[^A-Za-zÀ-ÿ]+/, '').replace(/\b(\d{6,}|IMG[-_ ]?\d+|WhatsApp Image.*)\b/ig, ' ');
  for (let i = 0; i < 4; i++) s = s.replace(TITLE, '');
  s = s.replace(/\.(?=\S)/g, '. ').replace(/\s*\.\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
};
const bishopFolderName = (dir) => cleanName(dir.replace(/^[^-]*-\s*(?=bishop|bs|es|sister|apostle|rev)/i, '').replace(/\s+-\s*$/, '').replace(/^e\.?s\.?\s+/i, '').split(/\s+-\s*/)[0]);
// Folder names the office wrote differently from the official list.
const ALIAS = { 'nii nortey quist therson': 'James Quist-Therson', 'kay francis kwao': 'Kay Francis Quao', 'andrw osei': 'Andrews Osei', 'sam gasper': 'Samuel Gaspar', 'yoku a neizer': 'Kweku Amonoo-Neizer', 'joojo': 'Joojo Stephens', 'adelaide': 'Adelaide Heward-Mills', 'courage': 'Courage Ahedor', 'sackey': 'Eat Sackey', 'edwin ogoe': 'Edwin Morgan Ogoe', 'nterful': 'Emmanuel Nterful', 'patrick': 'Patrick Bruce', 'sam': 'Ishmael Sam', 'steve': 'Steve Asare', 'eddy': 'Eddy Addy', 'nassib': 'Nassib Hage', 'kwabena asamoah': 'Kwabena Junior Asamoah', 'edwin osei-tutu': 'Edwin Adu-Tutu', 'sam gasper': '', 'emmanuel baiden': '', 'ebenezer johnson': '', 'kobby quansah': '', 'alex kofi-opata': 'Alexander Gottlieb Kofi-Opata', 'joseph owusu adjei': 'Joseph Owusu Adjei', 'rebecca joana addae': 'Rebecca-Joana Addae', 'esther carina okyere': 'Esther-Richie Okyere', 'bjosh': '', 'rudyvaye': '', 'joe wachirah kabiro': '' };
const findBishop = (folderName, group) => {
  const key = normalName(folderName);
  if (key in ALIAS) return ALIAS[key] ? bishops.find((x) => normalName(x.name) === normalName(ALIAS[key])) || null : null;
  const exact = bishops.find((x) => normalName(x.name) === key); if (exact) return exact;
  const alike = bishops.filter((x) => namesAlike(x.name, folderName)); if (alike.length === 1) return alike[0];
  const first = alike.filter((x) => normalName(x.name).split(' ')[0] === key.split(' ')[0]); if (first.length === 1) return first[0];
  if (!key.includes(' ')) { const sur = bishops.filter((x) => (x.group === group || !group) && normalName(x.name).split(' ').at(-1) === key); if (sur.length === 1) return sur[0]; }
  return null;
};
const people = JSON.parse(readFileSync(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8'));
const bishops = people.filter((p) => p.role === 'bishop');
const walk = (dir, out = []) => { for (const e of readdirSync(dir)) { if (e === '.DS_Store' || e.startsWith('._')) continue; const p = join(dir, e); const st = statSync(p); if (st.isDirectory()) walk(p, out); else if (IMG.has(extname(e).toLowerCase())) out.push(p); } return out; };
const index = [];
for (const root of ROOTS) {
  let entries = []; try { entries = readdirSync(root); } catch { continue; }
  for (const g of entries) {
    const gp = join(root, g); if (!statSync(gp).isDirectory()) continue;
    // A group folder holds bishop folders; a denomination folder inside it holds bishop folders one level down.
    const bishopDirs = [];
    for (const b of readdirSync(gp)) {
      const bp = join(gp, b); if (!statSync(bp).isDirectory()) continue;
      const direct = findBishop(bishopFolderName(b), groupOf(g));
      const subs = readdirSync(bp).filter((x) => statSync(join(bp, x)).isDirectory() && /bishop|^bs\b|^es\b|sister|apostle|rev/i.test(x));
      if (!direct && subs.length) { for (const x of subs) bishopDirs.push([join(bp, x), x]); const rest = walk(bp).filter((f) => !subs.some((x) => f.startsWith(join(bp, x) + '/'))); if (rest.length) bishopDirs.push([bp, b, rest]); }
      else bishopDirs.push([bp, b]);
    }
    for (const [bp, b, files] of bishopDirs) {
      const folderName = bishopFolderName(b);
      const bishop = findBishop(folderName, groupOf(g));
      for (const f of files || walk(bp)) {
        const name = cleanName(basename(f));
        const own = /^(bishop|bs|es|sister|apostle)\b/i.test(basename(f)) || (bishop && namesAlike(name, bishop.name)) || namesAlike(name, folderName);
        index.push({ path: f, group: groupOf(g), folder: b.trim(), folderName, bishopId: bishop?.id || null, name, own: Boolean(own) });
      }
    }
  }
}
writeFileSync('/tmp/photo-index.json', JSON.stringify(index));
const folders = new Map(); for (const e of index) folders.set(e.folder, e);
const unmatched = [...folders.values()].filter((e) => !e.bishopId);
console.log('files indexed', index.length, '| bishop folders', folders.size, '| matched to a bishop', folders.size - unmatched.length);
console.log('UNMATCHED FOLDERS:', unmatched.map((e) => `${e.group} / ${e.folder} → "${e.folderName}"`).join('\n  '));
console.log('own portraits', index.filter((e) => e.own).length);
console.log('files without a bishop folder match', index.filter((e) => !e.bishopId).length); console.log('name samples:', index.filter((e) => !e.own).slice(0, 40).map((e) => `${basename(e.path)} → ${e.name}`).join('\n  '));
