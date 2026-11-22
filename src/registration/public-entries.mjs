import { LOGOS } from './logos.mjs';
import { bishopSurname } from './ministry-organisations.mjs';
import { DENOMINATION_HEADS, HEAD_CHURCHES } from './denomination-heads.mjs';
// What the public registers and the Order of Pastors show for each person
// (office, 15-17 Nov). Used when the pages are built and again in the browser
// once the office's live changes are applied (live-patch.mjs). No contacts.
const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const logos = new Map(Object.entries(LOGOS).map(([name, file]) => [key(name), file]));
// The office's own logos (Denominations tab) once the live data is in.
let officeLogos = new Map();
export const setOfficeLogos = map => { officeLogos = new Map(Object.entries(map || {}).map(([name, file]) => [key(name), file])); };
export const churchLogo = name => officeLogos.get(key(name)) || logos.get(key(name)) || '';
const COUNCILISH = /council|committee|board|adjutancy|ministry|senex|emeritus|^healing jesus$/i;
const byName = (a, b) => bishopSurname(a.name).localeCompare(bishopSurname(b.name)) || a.name.localeCompare(b.name);

// Register of Bishops: a bishop's church is their denomination where their only
// entry is a council; years come from the roll where the page has none.
export function bishopEntries(list, rosterById) {
  return list.map(b => {
    const r = rosterById.get(b.rosterId);
    const church = (!b.church || COUNCILISH.test(b.church)) && r?.denomination ? r.denomination : b.church || r?.denomination || '';
    return { rosterId: b.rosterId || '', name: b.name, title: b.title || 'Bishop', image: b.image || '', photo: b.photo || r?.photo || '', church, logo: churchLogo(church) || churchLogo(r?.denomination), consecrated: b.consecrated || r?.yearConsecrated || '', appointed: b.appointed || r?.yearAppointed || '', ordained: b.ordained || r?.yearOrdained || '' };
  }).sort(byName);
}

// Pastors: church (and logo), branch, year appointed (ordained, for a Rev. or
// Lady Rev.) and the bishop they serve under, A to Z by surname.
export function pastorEntries(people) {
  const bishops = new Map(people.filter(p => p.role === 'bishop').map(b => [b.name, b]));
  // Lay presidents are pastors (Reverends) who perform a bishop's role (office, 19 Nov): they are on the Order of Pastors.
  return people.filter(p => p.role === 'pastor' || p.title === 'Lay President').map(p => {
    const b = bishops.get(p.bishop);
    // Office, 21 Nov: the same details, shown on the card itself.
    const rev = /rev/i.test(p.title || '');
    return { rosterId: p.id, name: p.name, title: p.title || 'Pastor', image: p.image || '', photo: p.photo || '', denomination: p.denomination || '',
      church: p.denomination || '', logo: churchLogo(p.denomination), branch: p.branch || '', appointed: p.yearAppointed || '', ordained: rev ? p.yearOrdained || '' : '',
      bishop: b ? b.name : p.bishop || '', details: [
      { label: 'Church', value: p.denomination, logo: churchLogo(p.denomination) },
      ...(p.branch ? [{ label: 'Branch', value: p.branch }] : []),
      /rev/i.test(p.title || '') ? { label: 'Ordained', value: p.yearOrdained || '' } : { label: 'Appointed', value: p.yearAppointed || '' },
      { label: 'Overseeing Bishop', value: b ? `${b.title || 'Bishop'} ${b.name}` : p.bishop || '' },
    ] };
  }).sort(byName);
}

// Order of Pastors (office, 22 Nov): bishops are pastors too, so the Order lists
// each church's bishops with its pastors: the head first (DENOMINATION_HEADS),
// then the other bishops, then the pastors, each A to Z. The registers stay as
// they are. A bishop whose own church has no box joins the box of the church
// the office's list names them as leading.
const nameKey = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, ' ').trim();
const HEAD_RANK = new Map(DENOMINATION_HEADS.map((n, i) => [nameKey(n), i]));
const HEAD_CHURCH = new Map(Object.entries(HEAD_CHURCHES).map(([n, c]) => [nameKey(n), c]));
export function orderEntries(people) {
  const pastors = pastorEntries(people);
  const churches = new Set(pastors.map(p => p.denomination));
  const listed = new Set(pastors.map(p => p.rosterId));
  const bishops = people.filter(p => p.role === 'bishop' && !listed.has(p.id)).map(p => {
    const church = p.denomination || '';
    const home = churches.has(church) ? church : (HEAD_CHURCH.get(nameKey(p.name)) || []).find(c => churches.has(c)) || church;
    return { rosterId: p.id, name: p.name, title: p.title || 'Bishop', image: p.image || '', photo: p.photo || '', denomination: home,
      church, logo: churchLogo(church), branch: p.branch || '', consecrated: p.yearConsecrated || '', bishop: '' };
  });
  const rank = p => { const h = HEAD_RANK.get(nameKey(p.name)); return h !== undefined ? [0, h] : [p.title === 'Lay President' || !listed.has(p.rosterId) ? 1 : 2, 0]; };
  return [...bishops, ...pastors].map(p => [rank(p), p]).sort(([a, x], [b, y]) => a[0] - b[0] || a[1] - b[1] || byName(x, y)).map(([, p]) => p);
}
// Order of Pastors: one box per denomination, A to Z (ignoring a leading "The").
const slugOf = text => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const plain = d => d.replace(/^The /, '');
// The office can rename a box, fold one church's pastors into another's box,
// and set the boxes' order (admin › Bishops and pastors pages); the rest stay A to Z.
export function pastorGroups(entries, colours, boxes = null) {
  // Office, 22 Nov: the Poimen Church of Senegal and the Gambia is one box, "Poimen Church" (the office's own box settings come on top).
  const merge = { 'Poimen Church Senegal-Gambia': 'Poimen Church Gambia', ...boxes?.merge }, names = { 'Poimen Church Gambia': 'The Pastors of Poimen Church', ...boxes?.names }, order = boxes?.order || [];
  const boxOf = p => { let d = p.denomination || 'Other'; for (let i = 0; i < 5 && merge[d]; i++) d = merge[d]; return d; };
  const rank = d => { const i = order.indexOf(d); return i < 0 ? Infinity : i; };
  return [...new Set(entries.map(boxOf))]
    .sort((a, b) => rank(a) - rank(b) || plain(a).localeCompare(plain(b)))
    .map((d, i) => ({ slug: slugOf(d), denomination: d, name: names[d] || `The Pastors of ${/^The /.test(d) ? d.replace(/^The /, 'the ') : d}`, colour: colours[i % colours.length], people: entries.filter(p => boxOf(p) === d) }));
}
