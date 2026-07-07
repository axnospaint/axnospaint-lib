import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { colorToAlpha } from '../src/js/filters.js';

const OriginalImageData = globalThis.ImageData;

class TestImageData {
  constructor(dataOrWidth, width, height) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth;
      this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrWidth;
      this.width = width;
      this.height = height;
    }
  }
}

globalThis.ImageData = TestImageData;

test.after(() => {
  if (OriginalImageData === undefined) {
    delete globalThis.ImageData;
  } else {
    globalThis.ImageData = OriginalImageData;
  }
});

function imageData(pixels) {
  return new ImageData(new Uint8ClampedArray(pixels), pixels.length / 4, 1);
}

test('colorToAlpha keeps the white unmix mode as the default call behavior', () => {
  const result = colorToAlpha(imageData([128, 128, 128, 255]));

  assert.deepEqual([...result.data], [0, 0, 0, 127]);
});

test('colorToAlpha can derive alpha from luminance while replacing visible color', () => {
  const result = colorToAlpha(
    imageData([64, 64, 64, 128, 0, 0, 0, 0]),
    {
      mode: 'luminance',
      replacementColor: { r: 10, g: 20, b: 30 },
    },
  );

  assert.deepEqual([...result.data], [10, 20, 30, 32, 0, 0, 0, 0]);
});

test('colorToAlpha can derive alpha from inverted luminance', () => {
  const result = colorToAlpha(
    imageData([200, 200, 200, 128]),
    {
      mode: 'inverted-luminance',
      replacementColor: { r: 40, g: 50, b: 60 },
    },
  );

  assert.deepEqual([...result.data], [40, 50, 60, 28]);
});

test('filter window exposes Color to Alpha mode and replacement color controls', () => {
  const html = readFileSync(new URL('../src/html/window_filter.txt', import.meta.url), 'utf8');
  const dictionary = JSON.parse(readFileSync(new URL('../src/text/ja.json', import.meta.url), 'utf8'));

  assert.ok(html.includes('${_("@FILTER.COLOR_TO_ALPHA")}'));
  assert.ok(html.includes('${_("@FILTER.COLOR_TO_ALPHA_MODE")}'));
  assert.match(html, /id="axp_filter_select_colorToAlphaMode"/);
  assert.ok(html.includes('<option value="unmix" selected>${_("@FILTER.COLOR_TO_ALPHA_MODE_UNMIX")}</option>'));
  assert.ok(html.includes('<option value="luminance">${_("@FILTER.COLOR_TO_ALPHA_MODE_LUMINANCE")}</option>'));
  assert.ok(html.includes('<option value="inverted-luminance">${_("@FILTER.COLOR_TO_ALPHA_MODE_INVERTED_LUMINANCE")}</option>'));
  assert.match(html, /id="axp_filter_color_colorToAlphaReplacement"/);
  assert.ok(html.includes('${_("@FILTER.COLOR_TO_ALPHA_REPLACEMENT")}'));
  assert.equal(dictionary['@FILTER.COLOR_TO_ALPHA'], '透明度変換');
  assert.equal(dictionary['@FILTER.COLOR_TO_ALPHA_MODE_UNMIX'], '白を透明化');
});

test('FilterSystem passes the selected Color to Alpha options to the filter', () => {
  const source = readFileSync(new URL('../src/js/window_filter.js', import.meta.url), 'utf8');

  assert.match(source, /getColorToAlphaOptions\(\) \{/);
  assert.match(source, /colorToAlpha\(img, this\.getColorToAlphaOptions\(\)\)/);
});
