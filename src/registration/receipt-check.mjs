// A first-pass guard against a picture from the camera roll being uploaded as a
// payment receipt. Receipts and transfer confirmations are documents: a handful
// of flat colours, a dominant background and rows that are entirely background.
// Photographs of people or scenery are the opposite. Only confident photographs
// are rejected; anything in between is allowed with a reminder to check the
// amount and reference, and the office still verifies every receipt.
//
// ponytail: pixel statistics, not reading. It cannot tell a genuine receipt from
// a screenshot of something else, and a well-lit photo of a paper receipt lands
// in "unclear". Upgrade path is server-side OCR on the stored image, checking
// for an amount, a date and a reference.
export const SAMPLE_WIDTH = 96;
export function receiptScore(pixels, width = SAMPLE_WIDTH) {
  const total = pixels.length / 4,
    height = Math.floor(total / width);
  if (!total || !height) return null;
  const luminance = new Float32Array(total),
    palette = new Map();
  let skin = 0,
    saturated = 0;
  for (let i = 0; i < total; i++) {
    const r = pixels[i * 4],
      g = pixels[i * 4 + 1],
      b = pixels[i * 4 + 2];
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      saturation = max ? (max - min) / max : 0;
    luminance[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    if (saturation > 0.3) saturated++;
    // Broad skin band: red dominant, warm, neither grey nor vivid.
    if (r > 70 && r > g && g > b && r - b > 14 && saturation > 0.12 && saturation < 0.68)
      skin++;
    const bin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    palette.set(bin, (palette.get(bin) || 0) + 1);
  }
  let flatRows = 0;
  for (let y = 0; y < height; y++) {
    let low = 255,
      high = 0;
    for (let x = 0; x < width; x++) {
      const value = luminance[y * width + x];
      if (value < low) low = value;
      if (value > high) high = value;
    }
    if (high - low < 24) flatRows++;
  }
  return {
    colours: palette.size,
    dominant: Math.max(...palette.values()) / total,
    flatRows: flatRows / height,
    skin: skin / total,
    saturated: saturated / total,
  };
}
export function assessReceipt(score) {
  if (!score) return { verdict: "unknown", reason: "" };
  const { colours, dominant, flatRows, skin, saturated } = score;
  if (colours <= 80 && (flatRows > 0.25 || dominant > 0.55))
    return { verdict: "receipt", reason: "" };
  if (colours > 120 && flatRows < 0.15 && (skin > 0.12 || saturated > 0.3))
    return {
      verdict: "photograph",
      reason:
        skin > 0.12
          ? "This looks like a photograph of a person, not a payment receipt. Upload the screenshot or photo of your transfer confirmation."
          : "This looks like an ordinary photo, not a payment receipt. Upload the screenshot or photo of your transfer confirmation.",
    };
  return {
    verdict: "unclear",
    reason:
      "We could not clearly read this as a receipt. Check that the amount, date and reference number are visible before you submit.",
  };
}
// Browser entry point: downscale, then score. Any failure returns "unknown", so
// a working upload is never blocked by this check.
export async function checkReceiptImage(file, createBitmap = createImageBitmap) {
  try {
    const bitmap = await createBitmap(file);
    const height = Math.max(
      1,
      Math.round((SAMPLE_WIDTH * bitmap.height) / bitmap.width),
    );
    const canvas = new OffscreenCanvas(SAMPLE_WIDTH, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, SAMPLE_WIDTH, height);
    bitmap.close?.();
    const { data } = context.getImageData(0, 0, SAMPLE_WIDTH, height);
    return assessReceipt(receiptScore(data, SAMPLE_WIDTH));
  } catch {
    return { verdict: "unknown", reason: "" };
  }
}
