// Spelling-tolerant name comparison shared by the duplicate tooling: "Kwaku Aseidu Badu" ~ "Kwaku Asiedu-Badu",
// "Isaac N K Kwarteng" ~ "Isaac Nana Kwabena Kwarteng". First and last words must be close; middle words may be initials or absent.
import { normalName } from '../../src/registration/model.mjs';
export const words = (n) => normalName(String(n).replace(/[’'`]/g, '')).split(' ').filter(Boolean);
const osa = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); } return d[a.length][b.length]; };
export const close = (a, b) => a === b || (a.length <= 2 && b.startsWith(a)) || (b.length <= 2 && a.startsWith(b)) || (Math.min(a.length, b.length) >= 3 && osa(a, b) <= (Math.max(a.length, b.length) >= 5 ? 2 : 1));
export const sameSoul = (a, b) => { const A = words(a), B = words(b); if (A.length < 2 || B.length < 2) return false; if (!close(A[0], B[0]) || !close(A.at(-1), B.at(-1))) return false; const [s, l] = A.length <= B.length ? [A.slice(1, -1), B.slice(1, -1)] : [B.slice(1, -1), A.slice(1, -1)]; const pool = [...l]; return s.every((w) => { const i = pool.findIndex((v) => close(w, v)); if (i < 0) return false; pool.splice(i, 1); return true; }); };
