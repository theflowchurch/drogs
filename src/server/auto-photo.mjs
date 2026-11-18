// Automatic portrait editing (office, 19 Nov). A new bishop or pastor we have no
// photo for gets their upload edited by Gemini into the official look of their
// group (src/registration/uniforms.mjs), using two of our edited portraits as
// examples. A second Gemini call checks the edit is still the same person; if it
// is not, or Gemini fails three times, their own upload is shown instead. The
// office does nothing, but can switch back to the original at any time.
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { uniformGroup, uniformPrompt } from '../registration/uniforms.mjs';
import { titleFor } from '../registration/model.mjs';
import { transaction, readState, persistState } from './database.mjs';

// Gemini's OpenAI-compatible API: the key goes in Authorization: Bearer.
const API = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const EDIT_MODEL = 'gemini-2.5-flash-image', CHECK_MODEL = 'gemini-2.5-flash';
export const MAX_TRIES = 3;
const examplesFile = new URL('../registration/uniform-examples.json', import.meta.url);
const root = new URL('../../', import.meta.url);
const jpeg = (bytes, size = 1024) => sharp(bytes).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
async function call(fetcher, key, path, init) {
  const res = await fetcher(`${API}/${path}`, { method: 'POST', ...init, headers: { authorization: `Bearer ${key}`, ...(init.headers || {}) }, signal: AbortSignal.timeout(150000) });
  const data = await res.json().catch(() => ({}));
  const body = Array.isArray(data) ? data[0] : data;
  if (!res.ok || body?.error) throw Error(`Gemini ${res.status}: ${body?.error?.message || 'request failed'}`);
  return body;
}

// The photo edited into the group's official look; returns image bytes.
// The examples go first; the person's own photo is the last image.
export async function editPortrait({ fetcher = fetch, key, photo, group }) {
  const examples = JSON.parse(await readFile(examplesFile, 'utf8'))[group] || [];
  const form = new FormData();
  form.append('model', EDIT_MODEL);
  form.append('prompt', uniformPrompt(group));
  form.append('n', '1');
  form.append('response_format', 'b64_json');
  for (const [i, f] of examples.entries()) form.append('image[]', new Blob([await jpeg(await readFile(new URL(f, root)), 640)], { type: 'image/jpeg' }), `example-${i + 1}.jpg`);
  form.append('image[]', new Blob([await jpeg(photo)], { type: 'image/jpeg' }), 'person.jpg');
  const data = await call(fetcher, key, 'images/edits', { body: form });
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw Error('Gemini returned no image');
  return Buffer.from(b64, 'base64');
}
// Whether the edited portrait still shows the same person as the upload.
export async function samePerson({ fetcher = fetch, key, original, edited }) {
  const url = async (b) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${(await jpeg(b, 768)).toString('base64')}` } });
  const data = await call(fetcher, key, 'chat/completions', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    model: CHECK_MODEL, temperature: 0, response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'Photo 1 is an original photo of a person. Photo 2 is an edited portrait (new clothes and background are expected). Is Photo 2 clearly the same person as Photo 1, with the same face? Answer only with JSON: {"same": true} or {"same": false}.' },
      await url(original), await url(edited),
    ] }],
  }) });
  const text = String(data.choices?.[0]?.message?.content || '');
  try { return JSON.parse(text).same === true; } catch { return /"same"\s*:\s*true/.test(text); }
}

// Who needs an edit: submitted, has an upload, no photo of ours (not on our
// list, or on it without a photo), a group with an official look, and this
// upload not yet done or given up on.
export function needsAutoPhoto(r, refs = new Map()) {
  if (!r?.data?.photo || r.status === 'draft' || r.status === 'denied') return false;
  const ref = r.data.referenceId ? refs.get(r.data.referenceId) : null;
  if (ref && (ref.image || ref.photo)) return false;
  if (!uniformGroup({ ...r.data, title: titleFor(r.data) })) return false;
  if (r.autoPhotoSource === r.data.photo && (r.autoPhoto || r.autoPhotoFailed)) return false;
  return (r.autoPhotoSource === r.data.photo ? Number(r.autoPhotoTries || 0) : 0) < MAX_TRIES;
}

export function createAutoPhoto({ pool, config, storage, references = [], fetcher = fetch, logger = console }) {
  const refs = new Map(references.map((p) => [p.id, p]));
  const running = new Set();
  const save = (userId, year, patch) => transaction(pool, async (conn) => {
    const before = await readState(conn, true);
    const after = structuredClone(before);
    const r = after.registrations.find((x) => x.userId === userId && x.year === year);
    if (!r) return;
    Object.assign(r, patch(r));
    await persistState(conn, before, after);
  });
  async function process(r) {
    if (!config.geminiKey || running.has(r.userId)) return 'skipped';
    running.add(r.userId);
    const source = r.data.photo, group = uniformGroup({ ...r.data, title: titleFor(r.data) });
    const tries = (r.autoPhotoSource === source ? Number(r.autoPhotoTries || 0) : 0) + 1;
    try {
      const original = await storage.bytes(source);
      if (!original) throw Error('the upload could not be read');
      const edited = await editPortrait({ fetcher, key: config.geminiKey, photo: original, group });
      if (!(await samePerson({ fetcher, key: config.geminiKey, original, edited }))) throw Error('the edit did not look like the same person');
      const key = await storage.upload({ id: r.userId }, edited, 'image/png', 'portrait');
      await save(r.userId, r.year, (x) => (x.data.photo === source ? { autoPhoto: key, autoPhotoSource: source, autoPhotoGroup: group, autoPhotoAt: new Date().toISOString(), autoPhotoTries: tries, autoPhotoFailed: false } : {}));
      return 'edited';
    } catch (error) {
      logger.error('Automatic photo edit failed:', error?.message || error);
      // After the last try the member's own upload stays; nobody is asked to act.
      await save(r.userId, r.year, (x) => (x.data.photo === source ? { autoPhotoSource: source, autoPhotoTries: tries, autoPhotoFailed: tries >= MAX_TRIES, ...(x.autoPhotoSource !== source ? { autoPhoto: '' } : {}) } : {})).catch(() => {});
      return tries >= MAX_TRIES ? 'gave-up' : 'retry';
    } finally { running.delete(r.userId); }
  }
  // Everyone waiting for an edit, one at a time (also retries earlier failures).
  async function sweep() {
    if (!config.geminiKey) return { edited: 0 };
    const state = await transaction(pool, (conn) => readState(conn, true));
    const due = state.registrations.filter((r) => r.year === state.year && needsAutoPhoto(r, refs));
    const results = [];
    for (const r of due) results.push(await process(r));
    const edited = results.filter((x) => x === 'edited').length;
    if (due.length) console.log(`Automatic photos: ${edited} edited, ${results.length - edited} not yet`);
    return { edited, due: due.length };
  }
  return { process, sweep, queue: () => { setTimeout(() => sweep().catch((e) => logger.error('Automatic photos failed:', e?.message || e)), 1000); } };
}
