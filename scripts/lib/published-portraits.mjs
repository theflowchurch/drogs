// Publish only photographs referenced by the current submitted roster. A
// filename can contain an old ID and still belong to a current person; use
// the audited image path, not filename guesses.
export function publishedPortraits(people) {
  const files = new Set();
  for (const person of people) {
    if (!person.image) continue;
    const path = person.image;
    if (!/^assets\/(bishops|pastors|portraits|outreach)\/[A-Za-z0-9_./-]+$/.test(path) || path.split('/').includes('..'))
      throw Error(`Invalid published portrait for ${person.id}`);
    files.add(path);
    if (path.startsWith('assets/portraits/')) files.add(path.replace('assets/portraits/', 'assets/portraits/thumbs/'));
  }
  return [...files].sort();
}
