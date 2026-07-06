import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  REFERENCE_LIMITS,
  ReferenceImageSystem,
  parseReferenceImageHeader,
  validateReferenceMetadata,
} from '../src/js/referenceimage.js';

test('reference metadata accepts the exact file and image limits', () => {
  assert.deepEqual(validateReferenceMetadata({
    size: REFERENCE_LIMITS.MAX_FILE_BYTES,
    width: 4096,
    height: 4096,
  }), { ok: true, code: null });
});

test('reference metadata rejects a file larger than 64 MiB', () => {
  assert.deepEqual(validateReferenceMetadata({
    size: REFERENCE_LIMITS.MAX_FILE_BYTES + 1,
    width: 1,
    height: 1,
  }), { ok: false, code: 'file-too-large' });
});

test('reference metadata rejects an edge larger than 8192 pixels', () => {
  assert.deepEqual(validateReferenceMetadata({
    size: 1,
    width: REFERENCE_LIMITS.MAX_EDGE_PIXELS + 1,
    height: 1,
  }), { ok: false, code: 'edge-too-large' });
});

test('reference metadata rejects more than 16777216 pixels', () => {
  assert.deepEqual(validateReferenceMetadata({
    size: 1,
    width: 4097,
    height: 4096,
  }), { ok: false, code: 'pixel-count-too-large' });
});

test('reference metadata rejects invalid dimensions', () => {
  assert.deepEqual(validateReferenceMetadata({ size: 1, width: 0, height: 10 }), {
    ok: false,
    code: 'invalid-dimensions',
  });
});

test('reference bitmap loading accepts decoded image natural dimensions', () => {
  const system = new ReferenceImageSystem({ x_size: 100, y_size: 80, scale: 100 });
  const drawCalls = [];
  system.host = { hidden: false, style: {} };
  system.frame = { dataset: {}, style: {} };
  system.canvas = {};
  system.context = {
    clearRect: (...args) => drawCalls.push(['clearRect', ...args]),
    drawImage: (...args) => drawCalls.push(['drawImage', ...args]),
  };

  system.loadBitmap({ width: 0, height: 0, naturalWidth: 40, naturalHeight: 20 }, 0);

  assert.equal(system.width, 40);
  assert.equal(system.height, 20);
  assert.equal(system.canvas.width, 40);
  assert.equal(system.canvas.height, 20);
  assert.deepEqual(drawCalls[0], ['clearRect', 0, 0, 40, 20]);
});

test('reference overlay frame stays in canvas coordinates because the host owns zoom transform', () => {
  const system = new ReferenceImageSystem({ x_size: 100, y_size: 80, scale: 200 });
  system.host = { hidden: false, style: {} };
  system.frame = { dataset: {}, style: {} };
  system.canvas = {};
  system.hasImage = true;
  system.isVisible = true;
  system.isEditing = false;
  system.x = 10;
  system.y = 20;
  system.width = 30;
  system.height = 40;
  system.scale = 1.5;

  system.updateView();

  assert.equal(system.frame.style.left, '10px');
  assert.equal(system.frame.style.top, '20px');
  assert.equal(system.frame.style.width, '45px');
  assert.equal(system.frame.style.height, '60px');
});

function pngHeader(width, height) {
  const buffer = new ArrayBuffer(33);
  const bytes = new Uint8Array(buffer);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return buffer;
}

test('reference image loader rejects oversized PNG dimensions before decoding', async () => {
  const system = new ReferenceImageSystem({ x_size: 100, y_size: 80, scale: 100 });
  const previousCreateImageBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => {
    throw new Error('decode-called');
  };
  const file = {
    size: 100,
    type: 'image/png',
    slice: () => ({ arrayBuffer: async () => pngHeader(REFERENCE_LIMITS.MAX_EDGE_PIXELS + 1, 1) }),
  };

  try {
    await assert.rejects(() => system.loadFile(file), /edge-too-large/);
  } finally {
    globalThis.createImageBitmap = previousCreateImageBitmap;
  }
});

test('reference image header parser extracts PNG dimensions', () => {
  assert.deepEqual(parseReferenceImageHeader(pngHeader(320, 240), 'image/png'), {
    width: 320,
    height: 240,
  });
});

test('legacy startup draft image path loads as a reference overlay, not artwork pixels', () => {
  const source = readFileSync(new URL('../src/js/axpobj.js', import.meta.url), 'utf8');
  const match = source.match(/\/\/ 下書き読込\s+if \(isDraftLoaded\) \{(?<body>[\s\S]*?)\n\s+\}\n\n\s+\/\/ キャンバス更新/);

  assert.ok(match, 'startup draft-load block should be identifiable');
  assert.match(match.groups.body, /referenceImageSystem\.loadBitmap/);
  assert.doesNotMatch(match.groups.body, /layerSystem\.write/);
});

test('interop and liquify provisional controls expose the accessibility hooks needed for dogfooding', () => {
  const toolHtml = readFileSync(new URL('../src/html/window_tool.txt', import.meta.url), 'utf8');
  const penHtml = readFileSync(new URL('../src/html/window_pen.txt', import.meta.url), 'utf8');

  assert.match(
    toolHtml,
    /id="axp_tool_button_interopToggle"[\s\S]*aria-controls="axp_tool_div_interopControls"/,
  );
  assert.match(toolHtml, /id="axp_tool_div_referenceDetails"/);
  assert.match(penHtml, /id="axp_pen_range_liquifyStrength"[\s\S]*aria-label="\$\{_\(("@LIQUIFY\.STRENGTH"|'@LIQUIFY\.STRENGTH')\)\}"/);
  assert.match(penHtml, /id="axp_pen_range_liquifyHardness"[\s\S]*aria-label="\$\{_\(("@LIQUIFY\.HARDNESS"|'@LIQUIFY\.HARDNESS')\)\}"/);
});

test('interop panel starts truly collapsed and groups reference controls for compact dogfooding UI', () => {
  const toolHtml = readFileSync(new URL('../src/html/window_tool.txt', import.meta.url), 'utf8');

  assert.match(toolHtml, /id="axp_tool_div_interopControls"[^>]*hidden/);
  assert.match(toolHtml, /id="axp_tool_div_referenceToggles"/);
  assert.match(toolHtml, /id="axp_tool_div_referencePosition"/);
});

test('reference sliders are explicitly compacted inside the auxiliary tool panel', () => {
  const css = readFileSync(new URL('../src/css/window_tool.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /#axp_tool_div_referenceDetails \.axpc_range input\[type="range"\]\s*\{[\s\S]*?width:\s*72px;/,
  );
  assert.match(
    css,
    /#axp_tool_div_referenceDetails \.axpc_range input\[type="range"\]::-webkit-slider-thumb\s*\{[\s\S]*?width:\s*18px;/,
  );
});

test('liquify mode copy and select styling fit the narrow pen settings column', () => {
  const css = readFileSync(new URL('../src/css/window_pen.css', import.meta.url), 'utf8');
  const messages = JSON.parse(readFileSync(new URL('../src/text/ja.json', import.meta.url), 'utf8'));

  assert.equal(messages['@LIQUIFY.PUSH'], '押す');
  assert.equal(messages['@LIQUIFY.PUSH_LEFT'], '左へ押す');
  assert.equal(messages['@LIQUIFY.PUSH_RIGHT'], '右へ押す');
  assert.match(css, /#axp_pen_select_liquifyMode\s*\{[\s\S]*?box-sizing:\s*border-box;/);
  assert.match(css, /#axp_pen_select_liquifyMode\s*\{[\s\S]*?font-size:\s*10px;/);
});
