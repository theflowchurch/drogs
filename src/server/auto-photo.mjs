// Automatic portrait editing (office, 19 Nov). A new bishop or pastor we have no
// photo for gets their upload edited by Gemini into the official look of their
// group (src/registration/uniforms.mjs), using two of our edited portraits as
// examples. A second Gemini call checks the edit is still the same person; if it
// is not, or Gemini fails three times, their own upload is shown instead. The
// office does nothing, but can switch back to the original at any time.
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { uniformGroup, uniformPrompt, UNIFORMS } from '../registration/uniforms.mjs';
import { titleFor, overlayReferences } from '../registration/model.mjs';
import { transaction, readState, persistState } from './database.mjs';

// Gemini's API: the key goes in the x-goog-api-key header.
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
export const EDIT_MODEL = 'gemini-3.1-flash-image', CHECK_MODEL = 'gemini-2.5-flash';
export const MAX_TRIES = 3;
const examplesFile = new URL('../registration/uniform-examples.json', import.meta.url);
const root = new URL('../../', import.meta.url);
const jpeg = (bytes, size = 1024) => sharp(bytes).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
const picture = async (bytes, size) => ({ inline_data: { mime_type: 'image/jpeg', data: (await jpeg(bytes, size)).toString('base64') } });
async function gemini(fetcher, key, model, parts, generationConfig) {
  const res = await fetcher(`${API}/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }), signal: AbortSignal.timeout(150000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw Error(`Gemini ${res.status}: ${data?.error?.message || 'request failed'}`);
  return data.candidates?.[0]?.content?.parts || [];
}
const answer = async (...args) => { const text = (await gemini(...args)).map((p) => p.text || '').join(''); try { return JSON.parse(text); } catch { return { text }; } };

// The photo edited into the group's official look; returns image bytes.
// The examples go first; the person's own photo is the last image.
export async function editPortrait({ fetcher = fetch, key, photo, group, model = EDIT_MODEL }) {
  const examples = JSON.parse(await readFile(examplesFile, 'utf8'))[group] || [];
  // Only the clothes of the examples (head cut off), so there is no other face to copy.
  const clothes = async (f) => { const img = sharp(await readFile(new URL(f, root))); const { width, height } = await img.metadata(); const top = Math.round(height * 0.5); return picture(await img.extract({ left: 0, top, width, height: height - top }).toBuffer(), 640); };
  const exampleParts = await Promise.all(examples.map(clothes));
  const parts = await gemini(fetcher, key, model, [
    { text: 'PHOTO OF THE PERSON (keep this exact face and person):' }, await picture(photo, 1024),
    { text: 'UNIFORM EXAMPLES (clothing only, from other people; copy only the clothes):' }, ...exampleParts,
    { text: uniformPrompt(group) },
  ], { responseModalities: ['IMAGE'] });
  const image = parts.find((p) => p.inlineData || p.inline_data);
  const b64 = image?.inlineData?.data || image?.inline_data?.data;
  if (!b64) throw Error('Gemini returned no image');
  return Buffer.from(b64, 'base64');
}
// Whether the edited portrait still shows the same person as the upload.
export async function samePerson({ fetcher = fetch, key, original, edited }) {
  const out = await answer(fetcher, key, CHECK_MODEL, [
    { text: 'Photo 1 is an original photo of a person. Photo 2 is an edited portrait (new clothes and background are expected). Is Photo 2 clearly the same person as Photo 1, with the same face? Answer only with JSON: {"same": true} or {"same": false}.' },
    await picture(original, 768), await picture(edited, 768),
  ], { responseMimeType: 'application/json', temperature: 0 });
  return out.same === true || /"same"\s*:\s*true/.test(out.text || '');
}

// What the photo shows (one cheap Gemini call): man or woman, and whether the
// person already wears the group's uniform on a plain white background.
export async function inspectPhoto({ fetcher = fetch, key, photo, group }) {
  const out = await answer(fetcher, key, CHECK_MODEL, [
    { text: `Look at this portrait. 1) Is the person a man or a woman? 2) Are they wearing ${UNIFORMS[group]}, against a plain white background? Answer only with JSON: {"gender": "male" or "female", "uniform": true or false}.` },
    await picture(photo, 768),
  ], { responseMimeType: 'application/json', temperature: 0 });
  const text = out.text || '';
  const gender = out.gender || (/"gender"\s*:\s*"female"/.test(text) ? 'female' : /"gender"\s*:\s*"male"/.test(text) ? 'male' : '');
  return { gender: ['male', 'female'].includes(gender) ? gender : '', uniform: out.uniform === true || /"uniform"\s*:\s*true/.test(text) };
}

// The photo the person would be shown with, and whether it is one of ours.
// A photo the office uploaded or chose is the office's decision: never touched.
function sourceFor(r, refs) {
  const ref = r.data?.referenceId ? refs.get(r.data.referenceId) : null;
  if (ref?.photo && ref.photo !== r.data.photo) return null;
  if (r.photoByOffice) return null;
  if (ref?.image) return { source: `asset:${ref.image}`, ours: true };
  return r.data?.photo ? { source: r.data.photo, ours: false } : null;
}
const groupOf = (r) => uniformGroup({ ...r.data, title: titleFor(r.data) });
// Who needs a look (office, 19 Nov): everyone who registers. A new person with no
// photo of ours has their upload edited. Someone we already have a photo for is
// checked against the details they filled in, and edited only when the uniform
// does not match. Done once per photo and group; changing either looks again.
export function needsAutoPhoto(r, refs = new Map()) {
  if (r?.status === 'draft' || r?.status === 'denied' || !r?.data) return false;
  const src = sourceFor(r, refs), group = groupOf(r);
  if (!src || !group) return false;
  const same = r.autoPhotoSource === src.source && r.autoPhotoGroup === group;
  if (same && (r.autoPhoto || r.autoPhotoFailed || r.autoPhotoOk || r.autoPhotoNote)) return false;
  return (same ? Number(r.autoPhotoTries || 0) : 0) < MAX_TRIES;
}

export function createAutoPhoto({ pool, config, storage, references = [], fetcher = fetch, logger = console }) {
  let refs = new Map(references.map((p) => [p.id, p]));
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
    const src = sourceFor(r, refs), group = groupOf(r);
    if (!src || !group) return 'skipped';
    running.add(r.userId);
    const { source, ours } = src, key = config.geminiKey;
    const tries = (r.autoPhotoSource === source && r.autoPhotoGroup === group ? Number(r.autoPhotoTries || 0) : 0) + 1;
    // Only while the person's photo and details are still the ones looked at.
    const still = (x) => (sourceFor(x, refs)?.source === source && groupOf(x) === group);
    const done = (patch) => save(r.userId, r.year, (x) => (still(x) ? { autoPhotoSource: source, autoPhotoGroup: group, autoPhotoTries: tries, autoPhotoAt: new Date().toISOString(), autoPhoto: '', autoPhotoOk: false, autoPhotoFailed: false, autoPhotoNote: '', ...patch } : {}));
    try {
      const original = ours ? await readFile(new URL(source.slice(6), root)) : await storage.bytes(source);
      if (!original) throw Error('the photo could not be read');
      const seen = await inspectPhoto({ fetcher, key, photo: original, group });
      // A man who says he is a woman (or the reverse) is not put in the other uniform.
      const gender = r.data.gender;
      if (seen.gender && ['male', 'female'].includes(gender) && seen.gender !== gender) {
        await done({ autoPhotoNote: `The photo looks like a ${seen.gender === 'male' ? 'man' : 'woman'}, but the details say ${gender}. The photo was not edited.` });
        return 'noted';
      }
      if (ours && seen.uniform) { await done({ autoPhotoOk: true }); return 'matches'; }
      const edited = await editPortrait({ fetcher, key, photo: original, group });
      if (!(await samePerson({ fetcher, key, original, edited }))) throw Error('the edit did not look like the same person');
      const saved = await storage.upload({ id: r.userId }, edited, 'image/png', 'portrait');
      await done({ autoPhoto: saved });
      return 'edited';
    } catch (error) {
      logger.error('Automatic photo edit failed:', error?.message || error);
      // After the last try the person keeps the photo they had; nobody is asked to act.
      await done({ autoPhotoFailed: tries >= MAX_TRIES }).catch(() => {});
      return tries >= MAX_TRIES ? 'gave-up' : 'retry';
    } finally { running.delete(r.userId); }
  }
  // Everyone waiting for a look, one at a time (also retries earlier failures).
  async function sweep() {
    if (!config.geminiKey) return { done: 0 };
    const state = await transaction(pool, (conn) => readState(conn, true));
    refs = new Map(overlayReferences(references, state).map((p) => [p.id, p])); // with the office's own edits and photos
    const due = state.registrations.filter((r) => r.year === state.year && needsAutoPhoto(r, refs));
    const results = [];
    for (const r of due) results.push(await process(r));
    if (due.length) console.log(`Automatic photos: ${results.join(', ')}`);
    return { due: due.length, results };
  }
  let timer = null;
  return { process, sweep, queue: () => { clearTimeout(timer); timer = setTimeout(() => sweep().catch((e) => logger.error('Automatic photos failed:', e?.message || e)), 1500); } };
}
