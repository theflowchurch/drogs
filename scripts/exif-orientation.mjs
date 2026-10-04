// Reads the EXIF orientation (1..8) of a JPEG; 1 when absent or not a JPEG.
import { openSync, readSync, closeSync } from 'node:fs';
export function exifOrientation(path) {
  const fd = openSync(path, 'r'); const buf = Buffer.alloc(131072); const n = readSync(fd, buf, 0, buf.length, 0); closeSync(fd);
  if (n < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
  let off = 2;
  while (off + 4 < n) {
    if (buf[off] !== 0xff) return 1;
    const marker = buf[off + 1], len = buf.readUInt16BE(off + 2);
    if (marker === 0xe1 && buf.toString('ascii', off + 4, off + 8) === 'Exif') {
      const t = off + 10; const little = buf.toString('ascii', t, t + 2) === 'II';
      const u16 = (p) => little ? buf.readUInt16LE(p) : buf.readUInt16BE(p), u32 = (p) => little ? buf.readUInt32LE(p) : buf.readUInt32BE(p);
      const ifd = t + u32(t + 4); const count = u16(ifd);
      for (let i = 0; i < count; i++) { const e = ifd + 2 + i * 12; if (e + 12 > n) break; if (u16(e) === 0x0112) return u16(e + 8) || 1; }
      return 1;
    }
    if (marker === 0xda) return 1;
    off += 2 + len;
  }
  return 1;
}
