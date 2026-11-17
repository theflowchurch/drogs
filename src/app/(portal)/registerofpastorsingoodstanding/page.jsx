import BishopsApp from '../../../registration/BishopsApp';
import people from '../../../registration/reference-people.json';
import { LOGOS } from '../../../registration/logos.mjs';
import { bishopSurname } from '../../../registration/ministry-organisations.mjs';
// The public register of pastors (office, 17 Nov): every pastor on the roll, A to
// Z by surname, in the same style as the Register of Bishops. A pastor's card
// opens their church, their year appointed (ordained, for a Reverend) and the
// bishop they serve under. Built here so the browser gets only what is shown.
export const metadata = { title: 'Register of Pastors in Good Standing', description: 'Every pastor of the Worldwide Fellowship of Bishops, A to Z.' };
const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const logos = new Map(Object.entries(LOGOS).map(([name, file]) => [key(name), file]));
const bishops = new Map(people.filter(p => p.role === 'bishop').map(b => [b.name, b]));
const reverend = t => /rev/i.test(t || '');
const list = people.filter(p => p.role === 'pastor')
  .map(p => {
    const b = bishops.get(p.bishop);
    const ordained = reverend(p.title);
    return { rosterId: p.id, name: p.name, title: p.title || 'Pastor', image: p.image || '', details: [
      { label: 'Church', value: p.denomination, logo: logos.get(key(p.denomination)) || '' },
      ...(p.branch ? [{ label: 'Branch', value: p.branch }] : []),
      ordained ? { label: 'Ordained', value: p.yearOrdained || '' } : { label: 'Appointed', value: p.yearAppointed || '' },
      { label: 'Overseeing Bishop', value: b ? `${b.title === 'Lay President' ? 'Lay President' : b.title || 'Bishop'} ${b.name}` : p.bishop || '' },
    ] };
  })
  .sort((a, b) => bishopSurname(a.name).localeCompare(bishopSurname(b.name)) || a.name.localeCompare(b.name));
export default function Page() { return <BishopsApp bishops={list} kind="pastor" masthead={{ line: 'Register of Pastors in Good Standing' }}/>; }
