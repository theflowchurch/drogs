// A free, on-device check that an uploaded portrait is a single person in the
// expected attire colour in front of a plain white background. Face detection
// runs in the browser with MediaPipe's BlazeFace model (about 230 KB, fetched
// once); the colour of the area below the face is compared with the rule for the
// person's role, gender and organization, and the strips either side of the face
// must be plain and light. It judges colour, not cut: a photo that fails is
// refused with the reason (attire, background, or both) and the office sees the
// result on the record.
const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
let detectorPromise = null;
async function detector() {
  if (!detectorPromise)
    detectorPromise = (async () => {
      const vision = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${VISION}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
      return vision.FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL }, runningMode: "IMAGE" });
    })().catch((e) => { detectorPromise = null; throw e; });
  return detectorPromise;
}
// What colour the garment should be.
export function expectedAttire({ role, gender, organization, title } = {}) {
  if (role === "bishop" && gender === "female") return { colour: "red", words: "the official attire for Episcopal Sisters/Mothers" };
  if (role === "bishop") return { colour: "red", words: "the official attire for Bishops" };
  if (gender === "female") return organization === "United Denominations" ? { colour: "yellow", words: "the official yellow attire" } : { colour: "red", words: "the official red attire" };
  return { colour: "dark", words: title === "Rev." ? "a dark jacket or suit with a clerical collar" : "a dark suit and tie" };
}
const hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
// Shares of red / yellow / magenta / dark pixels in a region of the canvas. "Dark" is a
// suit as it photographs: black, charcoal or navy come out as low-saturation greys
// around 30–40 % lightness, so the cut is well above pure black. Magenta is the
// clerical shirt worn under a dark jacket.
export function colourShares(ctx, x, y, w, h) {
  const { data } = ctx.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, w), Math.max(1, h));
  let red = 0, yellow = 0, magenta = 0, blue = 0, dark = 0, n = 0;
  for (let i = 0; i < data.length; i += 16) { // every 4th pixel is plenty
    const [hue, s, l] = hsl(data[i], data[i + 1], data[i + 2]); n++;
    if ((l < 0.42 && s < 0.4) || (l < 0.56 && s < 0.2)) dark++; // black, charcoal, navy or grey suit
    else if (s > 0.35 && l > 0.18 && l < 0.75 && (hue >= 335 || hue <= 18)) red++;
    else if (s > 0.3 && l > 0.2 && l < 0.8 && hue >= 285 && hue < 335) magenta++;
    else if (s > 0.3 && l > 0.12 && l < 0.65 && hue >= 200 && hue < 260) blue++; // a blue suit or blue dress is official too (Joshua, 6 Oct 2026)
    else if (s > 0.4 && l > 0.3 && hue >= 35 && hue <= 85) yellow++; // yellow through yellow-green dresses
  }
  return n ? { red: red / n, yellow: yellow / n, magenta: magenta / n, blue: blue / n, dark: dark / n } : { red: 0, yellow: 0, magenta: 0, blue: 0, dark: 0 };
}
// A photo passes when any official look is there: the red jacket or red/yellow/blue attire,
// a dark or blue suit, or the magenta clerical shirt. Only clearly casual colours fail
// (Joshua, 5 Oct 2026: "collar and all that is fine; casual clothes are what we root out").
export const NEED = { red: 0.22, yellow: 0.22, blue: 0.22, dark: 0.3, magenta: 0.05 };
// Either one official colour fills its share, or the official colours together fill
// the torso (a grey suit with a red tie: neither alone, both together). A floral
// print or a bright casual shirt reaches neither.
export const TOGETHER = 0.38;
export function judge(shares = {}, role = "pastor") {
  // Bishops are photographed in the red jacket, nothing else (Joshua, 6 Oct 2026): a collar and suit is not it.
  if (role === "bishop") return (shares.red || 0) >= NEED.red;
  return Object.entries(NEED).some(([c, need]) => (shares[c] || 0) >= need) || Object.keys(NEED).reduce((sum, c) => sum + (shares[c] || 0), 0) >= TOGETHER;
}
// Share of plain, light pixels (white or pale grey wall) in a region: bright,
// with little colour between the channels (HSL saturation misleads near white).
export function plainShare(ctx, x, y, w, h) {
  if (w < 4 || h < 4) return null; // the face fills the frame to that side: nothing to judge
  const { data } = ctx.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, w), Math.max(1, h));
  let plain = 0, n = 0;
  for (let i = 0; i < data.length; i += 16) {
    const max = Math.max(data[i], data[i + 1], data[i + 2]), min = Math.min(data[i], data[i + 1], data[i + 2]); n++;
    if ((max + min) / 510 > 0.68 && max - min < 36) plain++;
  }
  return n ? plain / n : null;
}
// The background is judged on the strips left and right of the face, from the
// top of the head to the chin; a strip that falls outside the picture is skipped.
export function backgroundShare(ctx, box, width) {
  const left = plainShare(ctx, Math.max(0, box.originX - box.width * 1.3), box.originY, Math.min(box.width * 0.8, box.originX - box.width * 0.5), box.height);
  const rx = box.originX + box.width * 1.5, right = plainShare(ctx, rx, box.originY, Math.min(box.width * 0.8, width - rx), box.height);
  const seen = [left, right].filter((v) => v !== null);
  return seen.length ? Math.max(...seen) : null; // one clear side is enough: a shadow on the other is not a cluttered room
}
// ponytail: half the strip beside the face must be plain wall; hair and hats eat into the strips, a room or garden scores near zero.
export const PLAIN_NEED = 0.5;
const load = (file) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = URL.createObjectURL(file); });
// Returns { verdict: "ok" | "no-face" | "many-faces" | "colour" | "background" | "skipped", note }.
// `colour` also covers a photo that fails on both attire and background: the note names both.
export async function checkAttire(file, person, { timeoutMs = 15000 } = {}) {
  const expected = expectedAttire(person), role = person?.role;
  try {
    const img = await load(file);
    const scale = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(img.src);
    const det = await Promise.race([detector(), new Promise((_, reject) => setTimeout(() => reject(Error("timeout")), timeoutMs))]);
    const faces = det.detect(canvas).detections || [];
    if (!faces.length) return { verdict: "no-face", note: "We could not see a face. Use a clear photo of yourself facing the camera." };
    if (faces.length > 1) return { verdict: "many-faces", note: "More than one person is in this photo. Use a photo of yourself alone." };
    const box = faces[0].boundingBox;
    // The torso: just below the face, a little wider than it.
    const x = box.originX - box.width * 0.4, y = box.originY + box.height * 1.15, w = box.width * 1.8, h = Math.min(canvas.height - y, box.height * 1.3);
    const shares = colourShares(ctx, x, y, w, h);
    const background = backgroundShare(ctx, box, canvas.width);
    const reasons = [];
    // A head-and-shoulders crop leaves too little below the face to judge the clothes: pass rather than guess.
    const tooTight = h < box.height * 0.45;
    if (!tooTight && !judge(shares, role)) reasons.push(["colour", `Attire: we could not see ${expected.words}.`]);
    if (background !== null && background < PLAIN_NEED) reasons.push(["background", "Background: it should be a plain white wall with nothing else behind you."]);
    if (reasons.length) return { verdict: reasons[0][0], note: reasons.map((r) => r[1]).join(" "), shares, background, tooTight };
    return { verdict: "ok", note: "", shares, background, tooTight };
  } catch (error) {
    return { verdict: "skipped", note: "" }; // no network for the model, or an unreadable image: never block on it
  }
}
