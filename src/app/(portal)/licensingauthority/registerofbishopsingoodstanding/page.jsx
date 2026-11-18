import BishopsApp from '../../../../registration/BishopsApp';
import { ALL_BISHOPS } from '../../../../registration/ministry-organisations.mjs';
import people from '../../../../registration/reference-people.json';
import { bishopEntries } from '../../../../registration/public-entries.mjs';
// The public list of bishops (office, 15 Nov; at /licensingauthority/registerofbishopsingoodstanding/ since 19 Nov; before that /registerofbishopsingoodstanding/
// since 17 Nov): everyone on the Order of Bishops page, A to Z. Once open, the
// page follows the office's live changes (live-patch.mjs).
export const metadata = { title: 'Register of Bishops in Good Standing', description: 'Every bishop of the Worldwide Fellowship of Bishops, A to Z.' };
const list = bishopEntries(ALL_BISHOPS, new Map(people.map(p => [p.id, p])));
export default function Page() { return <BishopsApp bishops={list}/>; }
