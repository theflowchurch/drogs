// FLOW currently routes pastor registration to Mother Nina Masuku. Her
// directory identity is selectable before she completes her own renewal;
// choosing her does not create an account or approve either registration.
export function signupBishopChoices(bishops, references, organization) {
  if (organization === 'FLOW') {
    const nina = references.find(p => p.id === 'B334' && p.role === 'bishop' && p.organization === 'FLOW');
    if (!nina) return [];
    const registered = bishops.find(b => b.id === nina.id);
    return [{ ...nina, ...registered, id: nina.id, name: nina.name, label: `Mother ${nina.name}`, photo: registered?.photo || '' }];
  }
  // Every bishop on our list (17 Nov), registered or not, plus approved bishops
  // who registered without being on it. The pastor searches by name.
  const byId = new Map(bishops.map(b => [b.id, b]));
  const listed = references.filter(p => p.role === 'bishop').map(p => {
    const registered = byId.get(p.id);
    return { id: p.id, name: p.name, organization: p.organization || '', denomination: p.denomination || '', image: p.image || '', photo: registered?.photo || '', title: p.title || 'Bishop', registered: Boolean(registered) };
  });
  const seen = new Set(listed.map(b => b.id));
  const extra = bishops.filter(b => b.approved && !seen.has(b.id)).map(b => ({ ...b, registered: true }));
  return [...listed, ...extra].sort((a, b) => a.name.localeCompare(b.name));
}
