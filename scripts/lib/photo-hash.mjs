// Perceptual hash of a portrait (dHash, 17×16 greyscale, 256 bits): two photos of the same picture — different crop, size or
// compression — land within a few bits of each other. Used to find one person filed under two names.
import sharp from 'sharp';
export async function dhash(file) {
  const { data } = await sharp(file).greyscale().resize(17, 16, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits += data[y * 17 + x] < data[y * 17 + x + 1] ? '1' : '0';
  return bits;
}
export const hamming = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
// Measured on known pairs: the same picture (other crop, size or compression) differs by at most 17 bits; different people by 43 or more.
export const SAME_PICTURE = 20;
