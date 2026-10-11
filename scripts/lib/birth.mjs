// Do two sheet rows describe the same birth? Birthdays decide when both sheets give one; where a sheet left the
// birthday blank, the age stands in (from the other row's birth year or the sheet's age column). No evidence
// either way → null. Joshua, 11 Oct: a double claim is the same name and the same date of birth.
const THIS_YEAR = new Date().getFullYear();
const yearOf = (k) => { const parts = String(k).split('-').map(Number); const y = parts.find((n) => n > 99) ?? parts[2]; return y == null || Number.isNaN(y) ? null : y > 99 ? y : y > THIS_YEAR % 100 ? 1900 + y : 2000 + y; };
export const ageOf = (row) => { for (const k of row?.dobKeys || []) { const y = yearOf(k); if (y) return THIS_YEAR - y; } const a = Number(row?.age); return Number.isInteger(a) && a > 10 && a < 110 ? a : null; };
export const birthAgrees = (a, b) => { const x = a?.dobKeys || [], y = b?.dobKeys || []; if (x.length && y.length) return x.some((k) => y.includes(k)); const p = ageOf(a), q = ageOf(b); if (p == null || q == null) return null; return Math.abs(p - q) <= 1; };
// self-check: node scripts/lib/birth.mjs
if (process.argv[1] && process.argv[1].endsWith('birth.mjs')) {
  const ok = (v, m) => { if (!v) throw new Error(m); };
  ok(birthAgrees({ dobKeys: ['8-11-77', '11-8-77'] }, { dobKeys: ['11-8-77'] }) === true, 'same key');
  ok(birthAgrees({ dobKeys: ['8-11-77'] }, { dobKeys: ['10-9-98'] }) === false, 'different birthdays');
  ok(birthAgrees({ dobKeys: ['10-11-97'] }, { age: 28 }) === true, 'age stands in for a blank birthday');
  ok(birthAgrees({ dobKeys: ['8-4-93'] }, { age: 46 }) === false, 'age far off');
  ok(birthAgrees({ dobKeys: [] }, { age: 31 }) === null, 'no evidence');
  ok(ageOf({ dobKeys: ['7-22-2'] }) === THIS_YEAR - 2002 && ageOf({ dobKeys: ['1997-9-7'] }) === THIS_YEAR - 1997, 'years');
  console.log('birth.mjs ok');
}
