// FLOW currently routes pastor registration to Mother Nina Masuku. Her
// directory identity is selectable before she completes her own renewal;
// choosing her does not create an account or approve either registration.
export function signupBishopChoices(bishops, references, organization) {
  if (organization === 'FLOW') {
    const nina = references.find(p => p.id === 'B334' && p.role === 'bishop' && p.organization === 'FLOW');
    if (!nina) return [];
    const registered = bishops.find(b => b.id === nina.id);
    return [{ ...nina, ...registered, id: nina.id, name: nina.name, label: `Mother ${nina.name}`, photo: registered?.photo || nina.image || '' }];
  }
  return bishops.filter(b => b.approved && (!organization || b.organization === organization))
    .sort((a, b) => a.name.localeCompare(b.name));
}
