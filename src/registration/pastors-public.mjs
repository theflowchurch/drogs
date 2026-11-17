import people from './reference-people.json' with { type: 'json' };
import { LOGOS } from './logos.mjs';
import { bishopSurname } from './ministry-organisations.mjs';
// The public pastor pages (Register and Order of Pastors in Good Standing,
// office 17 Nov): each pastor once, with what their card opens: church (and
// logo), branch, year appointed (ordained, for a Rev. or Lady Rev.) and the
// bishop they serve under. Built at publish time; no contacts or birthdays.
const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const logos = new Map(Object.entries(LOGOS).map(([name, file]) => [key(name), file]));
const bishops = new Map(people.filter(p => p.role === 'bishop').map(b => [b.name, b]));
export const churchLogo = name => logos.get(key(name)) || '';
const byName = (a, b) => bishopSurname(a.name).localeCompare(bishopSurname(b.name)) || a.name.localeCompare(b.name);
export const PUBLIC_PASTORS = people.filter(p => p.role === 'pastor').map(p => {
  const b = bishops.get(p.bishop);
  return { rosterId: p.id, name: p.name, title: p.title || 'Pastor', image: p.image || '', denomination: p.denomination || '', details: [
    { label: 'Church', value: p.denomination, logo: churchLogo(p.denomination) },
    ...(p.branch ? [{ label: 'Branch', value: p.branch }] : []),
    /rev/i.test(p.title || '') ? { label: 'Ordained', value: p.yearOrdained || '' } : { label: 'Appointed', value: p.yearAppointed || '' },
    { label: 'Overseeing Bishop', value: b ? `${b.title || 'Bishop'} ${b.name}` : p.bishop || '' },
  ] };
}).sort(byName);
// One box per denomination, A to Z (ignoring a leading "The").
const slugOf = text => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const plain = d => d.replace(/^The /, '');
export const PASTOR_GROUPS = [...new Set(PUBLIC_PASTORS.map(p => p.denomination || 'Other'))]
  .sort((a, b) => plain(a).localeCompare(plain(b)))
  .map(d => ({ slug: slugOf(d), name: `The Pastors of ${/^The /.test(d) ? d.replace(/^The /, 'the ') : d}`, denomination: d, logo: churchLogo(d), people: PUBLIC_PASTORS.filter(p => (p.denomination || 'Other') === d) }));
