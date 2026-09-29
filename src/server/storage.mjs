import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { HttpError, rateLimit } from './auth.mjs';
import { submittedBishop } from '../registration/model.mjs';
export async function prepareImage(bytes, contentType) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType) || bytes.length > 5 * 1024 * 1024 || !bytes.length)
    throw new HttpError(400, 'Choose a JPG, PNG or WebP image smaller than 5 MB.');
  try {
    const source = sharp(bytes, { limitInputPixels: 40000000, failOn: 'error' });
    const metadata = await source.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) !== 1) throw Error('Invalid image');
    // Decode on the server and strip EXIF/location metadata before storing the image.
    return await source.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
  } catch { throw new HttpError(400, 'This image could not be opened. Choose a valid, still photo.'); }
}
export function canReadMedia(state, actor, media) {
  if (media.owner_id === actor.id || actor.office) return true;
  // A supervising bishop may see submitted portraits, but never someone else's receipt.
  if (media.kind !== 'portrait') return false;
  // Portraits of people confirmed on the roll are part of the directory every member sees.
  if (state.registrations.some(r => r.status === 'confirmed' && r.data.photo === media.object_key)) return true;
  const profile = state.profiles.find(p => p.id === actor.id && p.role === 'bishop' && (p.bishopApproved || submittedBishop(state, p)));
  return Boolean(profile && state.registrations.some(r => r.status !== 'draft' && r.data.role === 'pastor' &&
    r.data.photo === media.object_key && r.data.bishopId === (profile.referenceId || profile.id)));
}
export async function assertOwnedMedia(conn, actor, path, kind) {
  if (typeof path !== 'string' || path.length > 512) throw new HttpError(400, 'Invalid image reference.');
  const [[media]] = await conn.execute('SELECT owner_id,kind FROM dr_media WHERE object_key=?', [path]);
  if (!media || media.owner_id !== actor.id || media.kind !== kind) throw new HttpError(400, 'Upload your own image before continuing.');
}
export function createStorage({ config, pool, client, logger = console }) {
  // Built per call so settings saved in /admin/ take effect without a restart.
  const s3 = () => client || new S3Client({ region: 'auto', endpoint: `https://${config.r2.account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey, ...(config.r2.sessionToken ? { sessionToken: config.r2.sessionToken } : {}) },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  return {
    async upload(actor, bytes, contentType, kind) {
      if (!['portrait', 'receipt'].includes(kind)) throw new HttpError(400, 'Invalid upload type.');
      await rateLimit(pool, config, `upload:${actor.id}`, 30, 3600000);
      let body = await prepareImage(bytes, contentType);
      let Key = `${actor.id}/${kind}/${randomUUID()}.webp`;
      try {
        await s3().send(new PutObjectCommand({ Bucket: config.r2.bucket, Key, Body: body, ContentType: 'image/webp', CacheControl: 'private, max-age=300' }));
      } catch (error) {
        // ponytail: when object storage rejects us (wrong credentials, missing
        // bucket, outage) the image goes into MySQL instead, smaller, so a
        // member is never stopped by a configuration problem. Move these rows
        // to R2 with a one-off script once the credentials are fixed.
        logger.error('Object storage unavailable; storing image in the database', { type: error.name });
        body = await sharp(body).resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        Key = `db/${actor.id}/${kind}/${randomUUID()}.webp`;
        await pool.execute('INSERT INTO dr_media_blobs (object_key,data) VALUES (?,?)', [Key, body]);
      }
      // A failed metadata insert leaves an unreferenced object; nothing here ever deletes it.
      await pool.execute('INSERT INTO dr_media (object_key,owner_id,kind,content_type,size_bytes,created_at) VALUES (?,?,?,?,?,?)', [Key, actor.id, kind, 'image/webp', body.length, Date.now()]);
      return Key;
    },
    url(key) {
      if (key.startsWith('db/')) return `/api/registration/media/blob?path=${encodeURIComponent(key)}`;
      return getSignedUrl(s3(), new GetObjectCommand({ Bucket: config.r2.bucket, Key: key }), { expiresIn: 3600 });
    },
    async blob(key) {
      const [[row]] = await pool.execute('SELECT data FROM dr_media_blobs WHERE object_key=?', [key]);
      return row?.data || null;
    },
  };
}
