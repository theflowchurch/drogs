// A free, on-device check that an uploaded portrait is a single person in the
// expected attire colour. Face detection runs in the browser with MediaPipe's
// BlazeFace model (about 230 KB, fetched once); the colour of the area below the
// face is then compared with the rule for the person's role, gender and
// organization. It judges colour, not cut, so it is a first filter: the sign-up
// warns and the office sees the result, nobody is blocked by it.
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
export function expectedAttire({ role, gender, organization } = {}) {
  if (role === "bishop") return { colour: "red", words: "the official red jacket" };
  if (gender === "female") return organization === "United Denominations" ? { colour: "yellow", words: "the official yellow attire" } : { colour: "red", words: "the official red attire" };
  return { colour: "dark", words: "a dark jacket or suit with a clerical collar" };
}
const hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
// Shares of red / yellow / dark pixels in a region of the canvas.
export function colourShares(ctx, x, y, w, h) {
  const { data } = ctx.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, w), Math.max(1, h));
  let red = 0, yellow = 0, dark = 0, n = 0;
  for (let i = 0; i < data.length; i += 16) { // every 4th pixel is plenty
    const [hue, s, l] = hsl(data[i], data[i + 1], data[i + 2]); n++;
    if (l < 0.22) dark++;
    else if (s > 0.35 && l > 0.18 && l < 0.75 && (hue >= 335 || hue <= 18)) red++;
    else if (s > 0.4 && l > 0.3 && hue >= 38 && hue <= 68) yellow++;
  }
  return n ? { red: red / n, yellow: yellow / n, dark: dark / n } : { red: 0, yellow: 0, dark: 0 };
}
export function judge(shares, colour) {
  const share = shares[colour] || 0;
  const need = colour === "dark" ? 0.3 : 0.22;
  return share >= need;
}
const load = (file) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = URL.createObjectURL(file); });
// Returns { verdict: "ok" | "no-face" | "many-faces" | "colour" | "skipped", note }.
export async function checkAttire(file, person, { timeoutMs = 15000 } = {}) {
  const expected = expectedAttire(person);
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
    if (!judge(shares, expected.colour)) return { verdict: "colour", note: `We could not see ${expected.words} in this photo.`, shares };
    return { verdict: "ok", note: "", shares };
  } catch (error) {
    return { verdict: "skipped", note: "" }; // no network for the model, or an unreadable image: never block on it
  }
}
