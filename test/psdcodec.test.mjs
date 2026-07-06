import assert from 'node:assert/strict';
import test from 'node:test';
import * as agPsd from 'ag-psd';

import {
  CANVAS_BLEND_MODES,
  axnosOpacityToPsd,
  buildPsdLayers,
  collectUnsupportedBlendLayers,
  decodePsdReference,
  exportPsd,
  mapBlendMode,
  parsePsdHeader,
  validatePsdReferenceFileHeader,
} from '../src/js/psdcodec.js';
import { REFERENCE_LIMITS } from '../src/js/referenceimage.js';

function imageData(width = 2, height = 2, fill = 0) {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(fill),
  };
}

function psdHeader(width, height, { channels = 4, depth = 8, colorMode = 3 } = {}) {
  const buffer = new ArrayBuffer(26);
  const bytes = new Uint8Array(buffer);
  bytes.set([0x38, 0x42, 0x50, 0x53], 0); // 8BPS
  const view = new DataView(buffer);
  view.setUint16(4, 1);
  view.setUint16(12, channels);
  view.setUint32(14, height);
  view.setUint32(18, width);
  view.setUint16(22, depth);
  view.setUint16(24, colorMode);
  return buffer;
}

test('maps every AXNOS canvas blend option explicitly', () => {
  for (const mode of CANVAS_BLEND_MODES) {
    const mapped = mapBlendMode(mode);
    assert.equal(typeof mapped.mode, 'string', mode);
    assert.equal(typeof mapped.supported, 'boolean', mode);
  }
  assert.deepEqual(mapBlendMode('source-over'), { mode: 'normal', supported: true });
  assert.deepEqual(mapBlendMode('color-dodge'), { mode: 'color dodge', supported: true });
  assert.deepEqual(mapBlendMode('source-atop'), { mode: 'normal', supported: true, clipping: true });
  assert.deepEqual(mapBlendMode('unknown-mode'), { mode: 'normal', supported: false });
});

test('collects only PSD blend modes that cannot be represented', () => {
  assert.deepEqual(collectUnsupportedBlendLayers([
    { name: 'clip', mode: 'source-atop' },
    { name: 'custom', mode: 'custom-blend' },
  ]), ['custom']);
  assert.deepEqual(collectUnsupportedBlendLayers([
    { name: 'supported', mode: 'source-over' },
    { mode: 'custom-blend' },
  ]), ['Layer 2']);
});

test('converts AXNOS opacity percent to the ag-psd opacity fraction', () => {
  assert.equal(axnosOpacityToPsd(0), 0);
  assert.equal(axnosOpacityToPsd(50), 0.5);
  assert.equal(axnosOpacityToPsd(100), 1);
  assert.equal(axnosOpacityToPsd(120), 1);
  assert.equal(axnosOpacityToPsd(-5), 0);
});

test('builds PSD layers in top-to-bottom AXNOS order', () => {
  const layers = buildPsdLayers([
    { name: 'top', alpha: 75, checked: true, mode: 'multiply', image: imageData(2, 2, 1) },
    { name: 'bottom', alpha: 25, checked: false, mode: 'screen', image: imageData(2, 2, 2) },
  ]);

  assert.equal(layers[0].name, 'top');
  assert.equal(layers[0].blendMode, 'multiply');
  assert.equal(layers[0].opacity, 0.75);
  assert.equal(layers[0].hidden, false);
  assert.equal(buildPsdLayers([
    { name: 'clip', alpha: 100, checked: true, mode: 'source-atop', image: imageData() },
  ])[0].clipping, true);
  assert.equal(layers[1].name, 'bottom');
  assert.equal(layers[1].hidden, true);
  assert.notEqual(layers[0].imageData.data, layers[1].imageData.data);
});

test('parses and validates the PSD header before decode', () => {
  assert.deepEqual(parsePsdHeader(psdHeader(640, 480)), {
    width: 640,
    height: 480,
    channels: 4,
    depth: 8,
    colorMode: 3,
  });
  assert.throws(() => parsePsdHeader(new ArrayBuffer(25)), /invalid-psd-header/);
  assert.throws(() => parsePsdHeader(psdHeader(8193, 1)), /edge-too-large/);
});

test('validates PSD reference file size with only the header slice available', () => {
  assert.deepEqual(validatePsdReferenceFileHeader(1234, psdHeader(320, 240)), {
    width: 320,
    height: 240,
    channels: 4,
    depth: 8,
    colorMode: 3,
  });
  assert.throws(
    () => validatePsdReferenceFileHeader(REFERENCE_LIMITS.MAX_FILE_BYTES + 1, psdHeader(1, 1)),
    /file-too-large/,
  );
});

test('decodes PSD reference through the composite only and discards layer structure', async () => {
  let observedOptions = null;
  const canvas = { width: 8, height: 8 };
  const result = await decodePsdReference(psdHeader(8, 8), {
    readPsd: (buffer, options) => {
      observedOptions = options;
      assert.ok(buffer instanceof ArrayBuffer);
      return { width: 8, height: 8, canvas, children: [{ name: 'must not escape' }] };
    },
    createBitmap: async (source) => ({ width: source.width, height: source.height, source }),
  });

  assert.deepEqual(observedOptions, { skipLayerImageData: true, skipThumbnail: true });
  assert.equal(result.width, 8);
  assert.equal(result.height, 8);
  assert.equal(result.bitmap.source, canvas);
  assert.equal('children' in result, false);
});

test('exports a PSD that ag-psd can read with AXNOS layer metadata intact', () => {
  const layerSystem = {
    axpObj: { x_size: 2, y_size: 2 },
    CANVAS: {
      backscreen_trans_ctx: {
        getImageData: () => imageData(2, 2, 9),
      },
    },
    layerObj: [
      { name: 'top', alpha: 75, checked: true, mode: 'multiply', image: imageData(2, 2, 1) },
      { name: 'bottom', alpha: 25, checked: false, mode: 'screen', image: imageData(2, 2, 2) },
    ],
  };

  const bytes = exportPsd(layerSystem);
  const psd = agPsd.readPsd(bytes, {
    skipLayerImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
  });

  assert.equal(psd.width, 2);
  assert.equal(psd.height, 2);
  assert.equal(psd.children.length, 2);
  assert.equal(psd.children[0].name, 'top');
  assert.equal(psd.children[0].blendMode, 'multiply');
  assert.ok(Math.abs(psd.children[0].opacity - 0.75) <= 1 / 255);
  assert.equal(psd.children[0].hidden, false);
  assert.equal(psd.children[1].name, 'bottom');
  assert.equal(psd.children[1].hidden, true);
});
