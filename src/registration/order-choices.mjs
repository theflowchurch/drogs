// Office, 19 Nov: bishops choose their own groups on the Order of Bishops pages
// (several if they belong to several, each with an optional role), at sign-up
// and from their account. The pages then place them where they chose, with no
// work for the office. Pastors are never asked: they keep their own details.
const slugOk = (s) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(String(s || ''));

// Every group a bishop can choose, by section, from the Order structure in use
// (the office's saved one, or the published one).
export function orderGroupOptions(structure) {
  const sections = [];
  for (const g of structure?.groups || []) for (const o of g.organisations || []) {
    const options = (o.directoryGroups || []).filter((x) => x.slug && x.name).map((x) => ({ slug: x.slug, name: x.name.replace(/^The /, '') }));
    if (options.length) sections.push({ name: o.name.replace(/^The /, '').trim(), options });
  }
  return sections;
}

// The groups (and roles) a listed bishop is in today, to start their choice from.
export function orderGroupsOf(structure, rosterId) {
  if (!rosterId) return [];
  const out = [];
  for (const g of structure?.groups || []) for (const o of g.organisations || []) for (const x of o.directoryGroups || [])
    for (const p of x.people || []) if (p.rosterId === rosterId && !out.some((c) => c.slug === x.slug)) out.push({ slug: x.slug, role: p.role || '' });
  return out;
}

// The member's choice, checked: known-looking slugs, short roles, no repeats.
export function cleanOrderGroups(value) {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set();
  return value.slice(0, 40).map((c) => ({ slug: String(c?.slug || '').trim(), role: String(c?.role || '').trim().slice(0, 80) }))
    .filter((c) => slugOk(c.slug) && !seen.has(c.slug) && seen.add(c.slug));
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Place each bishop who chose groups exactly where they chose (live pages).
// groups: the patched page groups; choices: { personId: [{ slug, role }] };
// cardFor(personId) builds a card for someone not yet on the page.
// A card into a group: a group shown by country or by church takes it on the
// bishop's own country or church line (made if new), like everyone listed there.
export function putInGroup(g, card) {
  if (g.parts) {
    const key = g.large ? norm(card.country) : norm(card.church);
    let part = g.parts.find((p) => p.slug === `${g.slug}-${key}`) || (key && g.parts.find((p) => norm(p.name).endsWith(key)));
    if (!part) { part = { slug: `${g.slug}-${key || 'other'}`, name: `The Bishops of ${g.large ? card.country || 'Other' : card.church || 'Other'}`, people: [], colour: g.parts[0]?.colour }; g.parts.push(part); }
    part.people.push(card); if (g.all) g.all.push(card);
    return;
  }
  (g.all || g.people).push(card);
}
export function applyOrderChoices(groups, choices, cardFor) {
  if (!choices || !Object.keys(choices).length) return groups;
  const lists = (g) => [g.people || [], ...(g.all ? [g.all] : []), ...(g.parts || []).map((p) => p.people)];
  for (const [id, chosen] of Object.entries(choices)) {
    const existing = [];
    for (const g of groups) for (const list of lists(g)) for (let i = list.length - 1; i >= 0; i--)
      if (list[i].rosterId === id) { existing.push({ group: g.slug, card: list[i] }); list.splice(i, 1); }
    const base = existing[0]?.card || cardFor(id);
    if (!base) continue;
    for (const { slug, role } of chosen) {
      // A whole group (UD Ghana West), or one part of a group (a First Love church, a council).
      const g = groups.find((x) => x.slug === slug) || groups.find((x) => (x.parts || []).some((p) => p.slug === slug));
      if (!g) continue;
      const before = existing.find((e) => e.group === g.slug)?.card;
      const peers = g.parts?.find((p) => p.slug === slug)?.people || g.people || [];
      // A council's cards name the council; a church group's name the church.
      const label = peers.find((p) => p.councilLabel);
      const card = { ...(before || base), role: role || '', ...(label ? { church: label.church, councilLabel: true } : before ? {} : { councilLabel: false }) };
      if (g.parts && g.slug !== slug) { g.parts.find((p) => p.slug === slug).people.push(card); if (g.all) g.all.push(card); continue; }
      putInGroup(g, card);
    }
  }
  const key = (p) => p.rosterId || p.name;
  for (const g of groups) {
    g.parts = g.parts?.filter((p) => p.people.length);
    g.count = new Set((g.parts ? g.parts.flatMap((p) => p.people) : g.all || g.people).map(key)).size;
  }
  return groups;
}
