// A slow read started before a save must never undo the newer saved snapshot.
export function snapshotSync(load, publish) {
  let generation = 0;
  return {
    invalidate() { generation++; },
    async refresh(actor) {
      const request = ++generation;
      const data = await load(actor);
      if (request === generation) publish(data);
      return data;
    },
  };
}
export const changedFields = (before, after) => Object.fromEntries(Object.entries(after || {})
  .filter(([key, value]) => String(before?.[key] ?? '') !== String(value ?? '')));
