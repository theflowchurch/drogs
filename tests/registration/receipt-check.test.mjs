import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import sharp from "sharp";
import {
  receiptScore,
  assessReceipt,
  SAMPLE_WIDTH,
} from "../../src/registration/receipt-check.mjs";
// Synthetic pixels cannot stand in for a photograph, so the check is measured
// against the real portrait library and rendered transfer confirmations.
async function verdict(input) {
  const { data, info } = await sharp(input)
    .resize(SAMPLE_WIDTH)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return assessReceipt(
    receiptScore(new Uint8ClampedArray(data), info.width),
  );
}
const confirmation = (background, ink) =>
  Buffer.from(
    `<svg width="420" height="820" xmlns="http://www.w3.org/2000/svg"><rect width="420" height="820" fill="${background}"/>` +
      `<text x="30" y="90" font-family="Helvetica" font-size="26" fill="${ink}">Transfer successful</text>` +
      Array.from(
        { length: 14 },
        (_, i) =>
          `<text x="30" y="${160 + i * 36}" font-family="Helvetica" font-size="17" fill="${ink}">Reference 8832${i}  GHS 1,150.00</text>`,
      ).join("") +
      `</svg>`,
  );
test("transfer confirmations pass and camera-roll photos are rejected", async () => {
  for (const [background, ink] of [
    ["#ffffff", "#12161a"],
    ["#f4f6f8", "#12161a"],
    ["#0f1115", "#e8eaed"],
    ["#e8f5e9", "#0b3d2e"],
  ])
    assert.equal(
      (await verdict(await sharp(confirmation(background, ink)).png().toBuffer()))
        .verdict,
      "receipt",
      `${background} confirmation should be accepted`,
    );

  const files = (await readdir("assets/pastors")).slice(0, 120);
  const counts = { receipt: 0, photograph: 0, unclear: 0, unknown: 0 };
  for (const file of files)
    counts[(await verdict(`assets/pastors/${file}`)).verdict]++;
  assert.equal(counts.receipt, 0, "no portrait may be accepted as a receipt");
  assert.ok(
    counts.photograph > files.length * 0.5,
    `most portraits should be rejected outright, got ${counts.photograph}/${files.length}`,
  );

  // An image that cannot be read must never stop a genuine upload.
  assert.deepEqual(assessReceipt(null), { verdict: "unknown", reason: "" });
});
