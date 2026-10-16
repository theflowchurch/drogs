// The office's spelling for Bishop B39 (Joshua, 14 October 2026).
// Keep older sheet spellings usable as aliases without displaying them again.
export function canonicalBishopName(value) {
  const name = String(value || '');
  const match = name.trim().match(/^((?:bishop|rev\.?|reverend)\s+)?(?:eat|e[.\s]*a[.\s]*t\.?)\s+sackey$/i);
  return match ? `${match[1] || ''}E.A.T Sackey` : name;
}
// Joshua, 16 October: photo names resolve these current-sheet variants;
// Thérèse's full name was explicitly confirmed in the supplied conversation.
const photoNames = {
  PF612: ['Samuel Twum Boateng', ['Berima Samuel Twum', 'Samuel Twum Boateng']],
  P481: ['Bernice Agyapong Larbi', ['Bernice Agyapomaa Larbi', 'Bernice Agyapong Larbi']],
  P762: ['Charity Tabitha Effah-Kodom', ['Cynthia Tabitha Effah Kodom', 'Charity Tabitha Effah-Kodom']],
  PN85865896d372: ['Prosper Afedzi Oddom', ['Prosper Afedzi Odoom', 'Prosper Afedzi Oddom']],
  PN0995efeca5cb: ['Brian Adwanzo Omondi', ['Brian Abwanzo Omondi', 'Brian Adwanzo Omondi']],
  P5031: ['Azbeta Awya', ['Azbeta Aywa', 'Azbeta Awya']],
  P5032: ['Derick Dickson Ouma', ['Derrick Dickson Ouma', 'Derick Dickson Ouma']],
  P5033: ['Ayub Otieno Aketch', ['Ayub Otieno Akech', 'Ayub Otieno Aketch']],
  P1216: ['Emmanuel Arwuah-Blay', ['Emmanauel Arwuah-Blay', 'Emmanuel Arwuah-Blay']],
  PF538: ['Rebecca Siyolwe', ['Rebecca Siwoyle', 'Rebecca Siyolwe']],
  P5095: ['Thérèse Dennis', ['Therese Omera Dennis', 'Therese Bassen', 'Therese Dennis']],
  PNd783e0961f5a: ['Victor Eghan Jnr', ['Thomas Eghan Jnr', 'Victor Eghan Jnr']],
  PN7224b850d261: ['Beverly Sanganza', ['Beverly Ngubani', 'Beverly Sanganza']],
  Sac2f575d: ['Busani Shoba', ['Busane Oamogetswe Shoba', 'Busani Shoba']],
};
const nameKey = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
export function canonicalPersonName(id, value) {
  if (id === 'B39') return canonicalBishopName(value);
  // Joshua's correction, 14 October. Match the linked record, not every
  // person who happens to share an older name; later office edits still work.
  if (id === 'S10325a07' && /^(paulina ama (ansah|drah)|osylina ama ansah)$/i.test(String(value || '').trim()))
    return 'Osylina Ama Ansah';
  const confirmed = photoNames[id];
  if (confirmed && confirmed[1].some(alias => nameKey(alias) === nameKey(value))) return confirmed[0];
  return value;
}
export function canonicalPerson(person) {
  return { ...person,
    ...(person.name !== undefined ? { name: canonicalPersonName(person.id, person.name) } : {}),
    ...(person.bishop !== undefined ? { bishop: canonicalBishopName(person.bishop) } : {}),
  };
}
export function canonicalOfficeNames(state) {
  const next = structuredClone(state);
  const accounts = new Set([...next.profiles.filter(p => p.referenceId === 'B39').map(p => p.id), ...next.registrations.filter(r => r.data.referenceId === 'B39').map(r => r.userId)]);
  const linked = new Map([...next.profiles.filter(p => p.referenceId).map(p => [p.id, p.referenceId]), ...next.registrations.filter(r => r.data.referenceId).map(r => [r.userId, r.data.referenceId])]);
  for (const p of next.profiles) if (accounts.has(p.id)) p.name = canonicalBishopName(p.name);
  for (const p of next.profiles) p.name = canonicalPersonName(p.referenceId || linked.get(p.id), p.name);
  for (const r of next.registrations) {
    const d = r.data;
    const corrected = canonicalPersonName(d.referenceId || linked.get(r.userId), d.name);
    if (corrected !== d.name) {
      d.name = corrected;
      const [firstName, ...lastName] = corrected.split(' ');
      d.firstName = firstName; d.lastName = lastName.join(' ');
    }
    if (d.referenceId === 'B39' || accounts.has(r.userId)) {
      d.name = canonicalBishopName(d.name);
      if (d.name === 'E.A.T Sackey') { d.firstName = 'E.A.T'; d.lastName = 'Sackey'; }
    }
    if (d.bishopName !== undefined) d.bishopName = canonicalBishopName(d.bishopName);
    if (d.bishopName === 'E.A.T Sackey') { d.bishopFirstName = 'E.A.T'; d.bishopLastName = 'Sackey'; }
  }
  for (const [id, fields] of Object.entries(next.overrides || {})) next.overrides[id] = canonicalPerson({ ...fields, id });
  // IDs are the map keys, not another editable field in a correction.
  for (const fields of Object.values(next.overrides || {})) delete fields.id;
  next.extraReferences = (next.extraReferences || []).map(canonicalPerson);
  return next;
}
