import assert from 'node:assert/strict';
import test from 'node:test';

import { cmyk2rgb, lab2rgb, rgb2cmyk, rgb2lab } from '../src/js/colorconvert.js';

function assertRgbClose(actual, expected, tolerance) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i += 1) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) <= tolerance,
      `channel ${i}: expected ${actual[i]} to be within ${tolerance} of ${expected[i]}`,
    );
  }
}

test('CMYK conversion round-trips RGB values within rounding tolerance', () => {
  for (const rgb of [[0, 0, 0], [255, 255, 255], [32, 128, 220], [240, 60, 20]]) {
    assertRgbClose(cmyk2rgb(rgb2cmyk(rgb)), rgb, 1);
  }
});

test('Lab conversion round-trips RGB values within rounding tolerance', () => {
  for (const rgb of [[0, 0, 0], [255, 255, 255], [32, 128, 220], [240, 60, 20]]) {
    assertRgbClose(lab2rgb(rgb2lab(rgb)), rgb, 2);
  }
});
