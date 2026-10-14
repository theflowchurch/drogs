import { normalName } from '../../src/registration/model.mjs';

// An explicit office addition is independent of the source spreadsheet. Keep
// its stable ID, validate its bishop, and never infer private profile details.
export function applyOfficePastorAdditions(pastors, bishops, additions) {
  const seen = new Set();
  return additions.map(addition => {
    const { id, name, bishopId, source } = addition;
    if (!/^PN[a-f0-9]{12}$/.test(id || '') || !name?.trim().includes(' ') || !source?.trim())
      throw Error('Office pastor additions require a stable ID, full name and approval source');
    if (seen.has(id)) throw Error(`Duplicate office addition: ${id}`);
    seen.add(id);
    const bishop = bishops.find(p => p.id === bishopId && p.role === 'bishop' && !p.lay);
    if (!bishop) throw Error(`Unknown bishop for office addition: ${name}`);
    if (bishops.some(p => p.id === id || normalName(p.name) === normalName(name)))
      throw Error(`Cannot add a bishop as a pastor: ${name}`);
    if (pastors.some(p => p.id !== id && normalName(p.name) === normalName(name)))
      throw Error(`Existing pastor needs reconciliation before addition: ${name}`);
    if (addition.title && !['Pastor', 'Rev.', 'Lady Rev.', 'Apostle'].includes(addition.title))
      throw Error(`Invalid pastor title: ${name}`);
    if (addition.gender && !['male', 'female'].includes(addition.gender))
      throw Error(`Invalid pastor gender: ${name}`);
    if (!/^assets\/portraits\/[A-Za-z0-9-]+\.webp$/.test(addition.image || ''))
      throw Error(`Invalid office portrait: ${name}`);
    let person = pastors.find(p => p.id === id);
    if (person && person.role !== 'pastor') throw Error(`Not a pastor record: ${id}`);
    if (!person) {
      person = { id, role: 'pastor', city: '', branch: '', country: '', image: addition.image,
        gender: '', yearAppointed: '', yearOrdained: '', yearConsecrated: '',
        source: { type: 'office-addition', approval: source } };
      pastors.push(person);
    }
    Object.assign(person, { name: name.trim(), title: addition.title || 'Pastor',
      organization: bishop.organization, denomination: bishop.denomination,
      denominationLogo: bishop.denominationLogo || '', group: bishop.group, bishop: bishop.name });
    if (addition.gender) person.gender = addition.gender;
    for (const field of ['city', 'country', 'branch'])
      if (addition[field] !== undefined) person[field] = String(addition[field]).trim();
    delete person.unclaimed;
    return { id, name: person.name, bishopId, bishop: bishop.name, source };
  });
}
