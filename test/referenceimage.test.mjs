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

function jpegHeader(width, height) {
  const bytes = new Uint8Array(32);
  bytes.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00], 0);
  bytes.set([0xff, 0xc0, 0x00, 0x11, 0x08], 8);
  bytes[13] = (height >> 8) & 0xff;
  bytes[14] = height & 0xff;
  bytes[15] = (width >> 8) & 0xff;
  bytes[16] = width & 0xff;
  return bytes.buffer;
}

function webpHeader(format, width, height) {
  const bytes = new Uint8Array(32);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([...format].map((c) => c.charCodeAt(0)), 12);
  if (format === 'VP8X') {
    const w = width - 1;
    const h = height - 1;
    bytes[24] = w & 0xff;
    bytes[25] = (w >> 8) & 0xff;
    bytes[26] = (w >> 16) & 0xff;
    bytes[27] = h & 0xff;
    bytes[28] = (h >> 8) & 0xff;
    bytes[29] = (h >> 16) & 0xff;
  } else if (format === 'VP8 ') {
    bytes.set([0x9d, 0x01, 0x2a], 23);
    bytes[26] = width & 0xff;
    bytes[27] = (width >> 8) & 0xff;
    bytes[28] = height & 0xff;
    bytes[29] = (height >> 8) & 0xff;
  } else if (format === 'VP8L') {
    const w = width - 1;
    const h = height - 1;
    bytes[20] = 0x2f;
    bytes[21] = w & 0xff;
    bytes[22] = ((w >> 8) & 0x3f) | ((h & 0x03) << 6);
    bytes[23] = (h >> 2) & 0xff;
    bytes[24] = (h >> 10) & 0x0f;
  }
  return bytes.buffer;
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

test('reference image header parser extracts JPEG dimensions', () => {
  assert.deepEqual(parseReferenceImageHeader(jpegHeader(320, 240), 'image/jpeg'), {
    width: 320,
    height: 240,
  });
});

test('reference image header parser extracts WebP dimensions', () => {
  for (const format of ['VP8X', 'VP8 ', 'VP8L']) {
    assert.deepEqual(parseReferenceImageHeader(webpHeader(format, 321, 241), 'image/webp'), {
      width: 321,
      height: 241,
    });
  }
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
  const mainHtml = readFileSync(new URL('../src/html/main.txt', import.meta.url), 'utf8');
  const msg = readFileSync(new URL('../src/text/msg.txt', import.meta.url), 'utf8');

  assert.match(
    toolHtml,
    /id="axp_tool_button_interopToggle"[\s\S]*aria-controls="axp_tool_div_interopControls"/,
  );
  assert.match(toolHtml, /id="axp_tool_div_referenceDetails"/);
  assert.match(penHtml, /id="axp_pen_range_liquifyStrength"[\s\S]*aria-label="\$\{_\(("@LIQUIFY\.STRENGTH"|'@LIQUIFY\.STRENGTH')\)\}"/);
  assert.match(penHtml, /id="axp_pen_range_liquifyHardness"[\s\S]*aria-label="\$\{_\(("@LIQUIFY\.HARDNESS"|'@LIQUIFY\.HARDNESS')\)\}"/);
  assert.match(mainHtml, /id="axp_canvas_div_liquifyGroup"[\s\S]*id="axp_canvas_button_liquifyCancel"[\s\S]*id="axp_canvas_button_liquifyFinish"/);
  assert.match(msg, /@LQF0001,/);
  assert.match(msg, /@LQF0002,/);
});

test('interop and reference panels start collapsed as independent disclosures', () => {
  const toolHtml = readFileSync(new URL('../src/html/window_tool.txt', import.meta.url), 'utf8');

  assert.match(toolHtml, /id="axp_tool_button_interopToggle"[^>]*aria-expanded="false"/);
  assert.match(toolHtml, /id="axp_tool_div_interopControls"[^>]*hidden/);
  assert.match(
    toolHtml,
    /id="axp_tool_button_referenceToggle"[^>]*aria-expanded="false"[\s\S]*?aria-controls="axp_tool_div_referenceControls"/,
  );
  assert.match(toolHtml, /id="axp_tool_div_referenceControls"[^>]*hidden/);
  assert.match(toolHtml, /id="axp_tool_div_referenceToggles"/);
  assert.match(toolHtml, /id="axp_tool_div_referencePosition"/);
});

test('reference image controls are outside the export and share disclosure', () => {
  const toolHtml = readFileSync(new URL('../src/html/window_tool.txt', import.meta.url), 'utf8');
  const interopControls = toolHtml.match(
    /id="axp_tool_div_interopControls"[^>]*>(?<body>[\s\S]*?)\n\s+<\/div>\n\s+<\/div>/,
  );
  const referenceControls = toolHtml.match(
    /id="axp_tool_div_referenceControls"[^>]*>(?<body>[\s\S]*?)\n\s+<\/div>\n\s+<\/div>/,
  );

  assert.ok(interopControls);
  assert.ok(referenceControls);
  assert.doesNotMatch(interopControls.groups.body, /axp_tool_button_referenceLoad/);
  assert.match(referenceControls.groups.body, /axp_tool_button_referenceLoad/);
});

test('auxiliary disclosures use a chevron heading and indented panel treatment', () => {
  const css = readFileSync(new URL('../src/css/window_tool.css', import.meta.url), 'utf8');

  assert.match(css, /\.axp_tool_disclosureToggle::before\s*\{[\s\S]*?content:\s*"▸"/);
  assert.match(css, /\.axp_tool_disclosureToggle\[aria-expanded="true"\]::before\s*\{[\s\S]*?transform:\s*rotate\(90deg\)/);
  assert.match(css, /\.axp_tool_disclosurePanel\s*\{[\s\S]*?border-left:/);
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
