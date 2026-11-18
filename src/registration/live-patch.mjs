import { overlayReferences } from './model.mjs';
// Office, 17 Nov: every public page follows the office's corrections the way the
// main directory does. The pages are built ahead of time from the roll; once
// open they fetch the same public data as the directory (no contacts) and apply
// the office's changes: corrections, photos, deletions, hides, role changes and
// people the office added.

// The live roll: the published records with the office's changes applied.
export function liveRoll(referencePeople, publicData) {
  // People who registered but are not on our list (19 Nov) join the Order pages too.
  const listed = overlayReferences(referencePeople, publicData);
  const known = new Set(listed.map(p => p.id));
  const newcomers = (publicData.roll || []).filter(r => !r.referenceId || !known.has(r.referenceId)).map(r => ({ id: r.id, role: r.role, name: r.name, title: r.title, organization: r.organization, denomination: r.denomination || '', group: r.group || '', city: r.city || '', country: r.country || '', image: r.image || '', photo: r.photo || '', bishop: r.bishop || '', registered: true }));
  const people = [...listed, ...newcomers];
  return {
    people,
    byId: new Map(people.map(p => [p.id, p])),
    baseById: new Map(referencePeople.map(p => [p.id, p])),
    overrides: publicData.overrides || {},
    logos: publicData.catalog?.logos || {}, // the office's church logos (Denominations tab)
    structure: publicData.pageStructure || null, // the office's Order of Bishops structure, if edited
    pastorBoxes: publicData.pastorBoxes || null, // the office's pastors' boxes, if edited
  };
}

// One curated bishop card (Order of Bishops, Councils): dropped when the office
// deleted, hid or made them a pastor; otherwise the office's corrections win.
export function patchBishop(entry, live) {
  const id = entry.rosterId;
  if (!id || !live.baseById.has(id) && !live.byId.has(id)) return entry; // not on the roll: keep as published
  const p = live.byId.get(id);
  const o = live.overrides[id] || {}, base = live.baseById.get(id) || {};
  // Deleted or hidden, or made a pastor by the office. (A few bishops are listed
  // here from a pastor record the roll has not caught up with; they stay.)
  if (!p || (p.role !== 'bishop' && o.role !== undefined)) return null;
  if (p.title === 'Lay President') return null; // lay presidents are pastors (office, 19 Nov): never among the bishops
  const out = { ...entry };
  if (o.name !== undefined) out.name = p.name;
  if (o.title !== undefined) out.title = p.title;
  if (o.denomination !== undefined && (!entry.church || entry.church === base.denomination)) out.church = p.denomination;
  if (o.yearConsecrated !== undefined) out.consecrated = p.yearConsecrated;
  if (o.yearAppointed !== undefined) out.appointed = p.yearAppointed;
  if (p.photo) out.photo = p.photo; // a portrait the office uploaded
  if (o.country !== undefined && entry.country !== undefined) out.country = p.country;
  return out;
}

const cardOf = p => ({ name: p.name, rosterId: p.id, bishop: true, church: p.denomination || '', title: p.title || 'Bishop', image: p.image || '', photo: p.photo || '', consecrated: p.yearConsecrated || '', appointed: p.yearAppointed || '', country: p.country || '' });

// The Order of Bishops / Councils groups with the office's changes. A bishop the
// office added or made a bishop joins the group (or line) where bishops of the
// same church already are; failing that, a group of the same name.
export function patchGroups(groups, live) {
  const patchList = list => list.map(e => patchBishop(e, live)).filter(Boolean);
  const out = groups.map(g => ({ ...g,
    people: patchList(g.people || []),
    ...(g.all ? { all: patchList(g.all) } : {}),
    ...(g.parts ? { parts: g.parts.map(part => ({ ...part, people: patchList(part.people) })) } : {}),
  }));
  const everyone = () => out.flatMap(g => [...g.people, ...(g.all || []), ...(g.parts || []).flatMap(p => p.people)]);
  const shown = new Set(everyone().map(p => p.rosterId).filter(Boolean));
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  // A bishop the office re-entered as a new record (the same name as one this page
  // lists, whose own record is gone or not a bishop) takes that card's place,
  // wherever it is, so they keep their councils and groups.
  const dropped = new Map(groups.flatMap(g => [...(g.people || []), ...(g.all || []), ...(g.parts || []).flatMap(x => x.people)])
    .filter(e => e.rosterId && !shown.has(e.rosterId)).map(e => [norm(e.name), e.rosterId]));
  for (const p of live.people.filter(p => p.role === 'bishop' && !shown.has(p.id))) {
    const from = dropped.get(norm(p.name));
    const same = everyone().find(e => norm(e.name) === norm(p.name)); // still listed under its old record
    if (!from && !same) continue;
    const card = cardOf(p);
    if (same) { if (p.photo) for (const e of everyone()) if (norm(e.name) === norm(p.name)) e.photo = p.photo; shown.add(p.id); continue; } // already on the page under that name: no second card, but the office's photo
    // the dropped card was filtered out already: put it back where it stood
    groups.forEach((g, gi) => {
      const put = (src, dst) => src.forEach((e, i) => { if (e.rosterId === from) dst.splice(Math.min(i, dst.length), 0, { ...e, rosterId: p.id, name: p.name, title: p.title || e.title, photo: p.photo || '', church: e.church || card.church }); });
      put(g.people || [], out[gi].people); if (g.all) put(g.all, out[gi].all); (g.parts || []).forEach((x, pi) => put(x.people, out[gi].parts[pi].people));
    });
    shown.add(p.id);
  }
  const churchOf = id => (live.byId.get(id) || live.baseById.get(id) || {}).denomination;
  const orgOf = id => (live.byId.get(id) || live.baseById.get(id) || {}).organization;
  for (const p of live.people.filter(p => p.role === 'bishop' && !p.lay && p.title !== 'Lay President' && !shown.has(p.id))) {
    const card = cardOf(p);
    const sameChurch = list => list.some(e => e.rosterId && churchOf(e.rosterId) === p.denomination && orgOf(e.rosterId) === p.organization);
    let placed = false;
    const home = p.organization === 'First Love' ? 'first-love-church' : p.organization === 'United Denominations' ? 'united-denominations' : '';
    for (const g of [...out.filter(g => g.section === home), ...out.filter(g => g.section !== home)]) {
      if (placed || ['councils', 'para-church'].includes(g.section)) continue;
      const part = (g.parts || []).find(x => sameChurch(x.people));
      if (part) { part.people.push(card); if (g.all) g.all.push(card); placed = true; }
      else if (sameChurch(g.people) || (g.all && sameChurch(g.all))) { if (g.all) g.all.push(card); else g.people.push(card); placed = true; }
    }
    if (!placed) { const g = out.find(g => p.group && g.name.toLowerCase().includes(p.group.toLowerCase())); if (g) { (g.all || g.people).push(card); placed = true; } }
    // A church new to these pages gets its own box at the end.
    if (!placed) { const slug = `office-${String(p.denomination || p.group || p.organization || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; let g = out.find(x => x.slug === slug); if (!g) { g = { slug, name: `The Bishops of ${p.denomination || p.group || p.organization || 'Other Churches'}`, section: 'office', people: [], initials: '', colour: out[out.length % out.length]?.colour || '#1f3a5f' }; out.push(g); } g.people.push(card); placed = true; }
    shown.add(p.id);
  }
  const key = p => p.rosterId || p.name;
  const countOf = list => new Set(list.map(key)).size;
  for (const g of out) g.count = countOf(g.parts ? g.parts.flatMap(p => p.people) : g.all || g.people);
  return { groups: out, total: countOf(out.flatMap(g => g.parts ? g.parts.flatMap(p => p.people) : g.all || g.people)) };
}
