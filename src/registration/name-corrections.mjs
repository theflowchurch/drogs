// The office's spelling for Bishop B39 (Joshua, 14 October 2026).
// Keep older sheet spellings usable as aliases without displaying them again.
export function canonicalBishopName(value) {
  const name = String(value || '');
  const match = name.trim().match(/^((?:bishop|rev\.?|reverend)\s+)?(?:eat|e[.\s]*a[.\s]*t\.?)\s+sackey$/i);
  return match ? `${match[1] || ''}E.A.T Sackey` : name;
}
export function canonicalPerson(person) {
  return { ...person,
    ...(person.id === 'B39' && person.name !== undefined ? { name: canonicalBishopName(person.name) } : {}),
    ...(person.bishop !== undefined ? { bishop: canonicalBishopName(person.bishop) } : {}),
  };
}
export function canonicalOfficeNames(state) {
  const next = structuredClone(state);
  const accounts = new Set([...next.profiles.filter(p => p.referenceId === 'B39').map(p => p.id), ...next.registrations.filter(r => r.data.referenceId === 'B39').map(r => r.userId)]);
  for (const p of next.profiles) if (accounts.has(p.id)) p.name = canonicalBishopName(p.name);
  for (const r of next.registrations) {
    const d = r.data;
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
