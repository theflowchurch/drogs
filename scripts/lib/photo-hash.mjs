// Perceptual hash of a portrait (dHash, 9×8 greyscale): two photos of the same picture — different crop, size or
// compression — land within a few bits of each other. Used to find one person filed under two names.
import sharp from 'sharp';
export async function dhash(file) {
  const { data } = await sharp(file).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] < data[y * 9 + x + 1] ? '1' : '0';
  return bits;
}
export const hamming = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
