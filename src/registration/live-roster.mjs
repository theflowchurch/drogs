// A page can stay open across deployments. Its bundled roster is only a
// fallback for previews; connected pages follow the server's current sheets.
export const rosterFrom = (snapshot, fallback = []) =>
  Array.isArray(snapshot?.referencePeople) ? snapshot.referencePeople : fallback;
export const publicRosterFrom = (snapshot, fallback = []) =>
  rosterFrom(snapshot, fallback).filter(p => !p.unclaimed);

// Download the public roster once per revision, rather than every 30-second
// snapshot. Share in-flight requests between public and signed-in views.
export function createRosterLoader(fetchRoster) {
  let cached, pending;
  return async snapshot => {
    const version = snapshot.rosterVersion;
    if (!version) return snapshot; // offline previews / older server
    if (cached?.rosterVersion !== version) {
      if (!pending) {
        pending = Promise.resolve().then(fetchRoster).then(result => {
          if (!Array.isArray(result.referencePeople) || !result.rosterVersion)
            throw Error('The current directory could not be loaded. Please try again shortly.');
          cached = result;
        }).finally(() => { pending = null; });
      }
      await pending;
    }
    if (cached.rosterVersion !== version)
      throw Error('The directory is being updated. Please try again shortly.');
    return { ...snapshot, referencePeople: cached.referencePeople };
  };
}
