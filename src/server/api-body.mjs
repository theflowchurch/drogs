import { HttpError } from './auth.mjs';
export async function readBody(request, limit = 256 * 1024) {
  if (Number(request.headers.get('content-length')) > limit) throw new HttpError(413, 'The upload is too large.');
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, 'The upload is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function jsonBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Send JSON data.');
  try {
    const value = JSON.parse((await readBody(request)).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw Error();
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Invalid request data.');
  }
}
