import test from 'node:test';
import assert from 'node:assert/strict';
import { plainShare, backgroundShare, judge, PLAIN_NEED } from '../../src/registration/attire-check.mjs';

// A fake canvas context: every pixel in the region is the given colour.
const solid = (rgb) => ({ getImageData: (x, y, w, h) => ({ data: Uint8ClampedArray.from({ length: Math.max(1, Math.round(w)) * Math.max(1, Math.round(h)) * 4 }, (_, i) => (i % 4 === 3 ? 255 : rgb[i % 4])) }) });

test('white and pale grey-blue walls are plain; dark, coloured or busy backgrounds are not', () => {
  assert.equal(plainShare(solid([255, 255, 255]), 0, 0, 40, 40), 1);
  assert.equal(plainShare(solid([214, 222, 233]), 0, 0, 40, 40), 1); // the clerical-collar example's wall
  assert.equal(plainShare(solid([90, 90, 90]), 0, 0, 40, 40), 0); // mid grey
  assert.equal(plainShare(solid([200, 120, 120]), 0, 0, 40, 40), 0); // pink wall
  assert.equal(plainShare(solid([255, 255, 255]), 0, 0, 2, 40), null); // no room beside the face
});

test('one clear side is enough, and a face against the edge is not judged', () => {
  const box = { originX: 100, originY: 50, width: 100, height: 100 };
  assert.equal(backgroundShare(solid([250, 250, 250]), box, 400), 1);
  assert.ok(backgroundShare(solid([40, 40, 40]), box, 400) < PLAIN_NEED);
  assert.equal(backgroundShare(solid([250, 250, 250]), { originX: 40, originY: 0, width: 100, height: 100 }, 190), null);
});

test('any official look passes; only clearly casual colours fail', () => {
  assert.ok(judge({ red: 0.3 }));
  assert.ok(judge({ dark: 0.35 })); // a suit
  assert.ok(judge({ dark: 0.1, magenta: 0.08 })); // the magenta clerical shirt
  assert.ok(!judge({ red: 0.1, dark: 0.2, magenta: 0.02, yellow: 0.05 }));
});
