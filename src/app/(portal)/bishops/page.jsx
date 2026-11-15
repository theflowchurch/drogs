import BishopsApp from '../../../registration/BishopsApp';
import { ALL_BISHOPS } from '../../../registration/ministry-organisations.mjs';
import people from '../../../registration/reference-people.json';
// The public list of bishops (office, 15 Nov): everyone on the Organisations
// page, A to Z. Built here so the browser gets only what the cards show. Where
// a bishop's only entry is a council, the church is their denomination on the roll.
export const metadata = { title: 'Bishops', description: 'Every bishop of the Worldwide Fellowship of Bishops, A to Z.' };
const COUNCILISH = /council|committee|board|adjutancy|ministry|senex|emeritus|^healing jesus$/i;
const byId = new Map(people.map(p => [p.id, p]));
const list = ALL_BISHOPS.map(b => {
  const r = byId.get(b.rosterId);
  const church = (!b.church || COUNCILISH.test(b.church)) && r?.denomination ? r.denomination : b.church || r?.denomination || '';
  return { rosterId: b.rosterId || '', name: b.name, title: b.title || 'Bishop', image: b.image || '', church, consecrated: b.consecrated || r?.yearConsecrated || '', appointed: b.appointed || r?.yearAppointed || '' };
});
export default function Page() { return <BishopsApp bishops={list}/>; }
