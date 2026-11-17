// These duplicate pairs are supported by the current submitted rows and the
// supplied photo names. Relink saved work before removing the redundant IDs.
export const CURRENT_REFERENCE_MERGES = [
  { from: 'P3682', to: 'PF538', source: '16 Oct 2026: Rebecca Siwoyle / Rebecca Siyolwe, same birthday on current Stephen Poku sheet; supplied portrait uses Rebecca Siyolwe' },
  { from: 'P465', to: 'PF612', source: '16 Oct 2026: Berima Samuel Twum / Samuel Twum Boateng, same birthday and phone on current Emmanuel Tetteh sheet; supplied Jamase portrait uses Samuel Twum Boateng' },
  { from: 'S4994a2da', to: 'S4994a2da-5272', source: 'Joshua 17 Oct 2026: Isaac Bonuedi is under ES Joy only; remove the duplicate assignment under Isaac Agyeman' },
  // Office, 17 Nov 2026: listed under two bishops; kept under the one whose record has the correct edited photo.
  { from: 'P5071', to: 'Sb8c7d044', source: 'Office 17 Nov 2026: Angela Mpundu kept under Geraldo Amoa (removed from Clement Asante)' },
  { from: 'S45729b62-c685', to: 'S45729b62', source: 'Office 17 Nov 2026: Mwenda Machima kept under Clement Asante (removed from Geraldo Amoa)' },
  { from: 'S7128fcc4', to: 'PF158', source: 'Office 17 Nov 2026: Shelly Amoa / Shelly Amoah kept under Geraldo Amoa (removed from Clement Asante)' },
  { from: 'Sdb542231-bed5', to: 'Sdb542231', source: 'Office 17 Nov 2026: Wisdom Dery kept under Charles Kwame Bonsu (removed from David Afreh)' },
  { from: 'P1317', to: 'S0ec63b27', source: 'Office 17 Nov 2026: Emmanuel Opuni kept under Norman Kwadwo Darkwa (removed from Glen Kwame Opoku)' },
  { from: 'P2471', to: 'S391d2dfe', source: 'Office 17 Nov 2026: Jude Baiden kept under Stephen Poku (removed from Kent Njeru)' },
];

// Relink saved work before the general submitted-roster cleanup can treat a
// duplicate ID as an orphan. Accounts, registrations and their uploads survive.
export function mergeCurrentReferences(state, people, merges = CURRENT_REFERENCE_MERGES) {
  const ids = new Set(people.map(p => p.id));
  let next = state;
  for (const { from, to, source } of merges) {
    if (ids.has(from) || !ids.has(to)) continue;
    const affected = next.profiles.some(p => p.referenceId === from) ||
      next.registrations.some(r => r.data.referenceId === from) ||
      next.rosters.some(r => r.referenceId === from) || next.overrides?.[from] ||
      next.photoReviews?.[from] || next.hidden?.includes(from);
    if (!affected) continue;
    if (next === state) next = structuredClone(state);
    for (const p of next.profiles) if (p.referenceId === from) p.referenceId = to;
    for (const r of next.registrations) if (r.data.referenceId === from) r.data.referenceId = to;
    for (const r of next.rosters) if (r.referenceId === from) r.referenceId = to;
    if (next.overrides?.[from]) {
      const old = next.overrides[from], keep = next.overrides[to] || {};
      next.overrides[to] = { ...old, ...keep, _officeFields: [...new Set([...(old._officeFields || []), ...(keep._officeFields || [])])] };
      delete next.overrides[from];
    }
    if (next.photoReviews?.[from]) {
      if (!next.photoReviews[to]) next.photoReviews[to] = next.photoReviews[from];
      delete next.photoReviews[from];
    }
    next.hidden = [...new Set((next.hidden || []).map(id => id === from ? to : id))];
    next.audit.push({ id: crypto.randomUUID(), actor: 'system', at: new Date().toISOString(), action: 'referenceMerge', detail: { from, to, source } });
  }
  return next;
}
