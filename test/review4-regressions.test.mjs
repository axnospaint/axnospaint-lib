import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { collectUnsupportedBlendLayers } from '../src/js/psdcodec.js';
import { ReferenceImageSystem } from '../src/js/referenceimage.js';
import { SaveSystem } from '../src/js/saveload.js';

test('reference overlay frame keeps canvas coordinates because the host owns zoom transform', () => {
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

test('unsupported PSD blend fallback names use original layer positions', () => {
  assert.deepEqual(collectUnsupportedBlendLayers([
    { name: 'supported', mode: 'source-over' },
    { mode: 'custom-blend' },
  ]), ['Layer 2']);
});

test('liquify persisted config keys are accepted during restore', () => {
  const source = readFileSync(new URL('../src/js/config.js', import.meta.url), 'utf8');

  assert.match(source, /case 'P-LQM':/);
  assert.match(source, /case 'P-LQS':/);
  assert.match(source, /case 'P-LQH':/);
});

test('layer style commits mark autosave dirty after registering undo', () => {
  const source = readFileSync(new URL('../src/js/window_layer.js', import.meta.url), 'utf8');
  const match = source.match(
    /const commitEdit = \(\) => \{(?<body>[\s\S]*?)\n\s+\};\n\s+for \(const el of Object\.values\(els\)\)/
  );

  assert.ok(match);
  assert.match(match.groups.body, /type: 'layer-style'/);
  assert.match(match.groups.body, /this\.axpObj\.msg\('@INF1012'\);[\s\S]*?saveSystem\.autoSave\(\)/);
});

test('auxiliary size preset classes use the component prefix', () => {
  const html = readFileSync(new URL('../src/html/window_tool.txt', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/css/window_tool.css', import.meta.url), 'utf8');

  assert.doesNotMatch(html, /axp_tool_sizePreset/);
  assert.doesNotMatch(css, /\.axp_tool_sizePreset/);
  assert.match(html, /axpc_tool_sizePreset/);
  assert.match(css, /\.axpc_tool_sizePreset/);
});

test('background color toggle label uses translated text and data label content', () => {
  const html = readFileSync(new URL('../src/html/window_tool.txt', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/css/window_tool.css', import.meta.url), 'utf8');
  const messages = JSON.parse(readFileSync(new URL('../src/text/ja.json', import.meta.url), 'utf8'));

  assert.match(html, /\$\{_\(("@MISC\.BG_COLOR_LABEL"|'@MISC\.BG_COLOR_LABEL')\)\}/);
  assert.match(css, /#axp_tool_toggle_bgColor::after\s*\{[\s\S]*?content:\s*attr\(data-label\)/);
  assert.equal(messages['@MISC.BG_SKIN_SHORT'], '肌');
  assert.equal(messages['@MISC.BG_WHITE_SHORT'], '白');
});

test('resetCanvas clears liquify in-progress state', () => {
  const source = readFileSync(new URL('../src/js/axpobj.js', import.meta.url), 'utf8');
  const match = source.match(/resetCanvas\(\) \{(?<body>[\s\S]*?)\n\s+this\.CANVAS\.main\.style\.width/);

  assert.ok(match);
  assert.match(match.groups.body, /axp_penmode_liquify'\]\?\.forceIdle\(\)/);
});

test('liquify session finalization guards mirror nagenawa finalization calls', () => {
  const guardedFiles = [
    '../src/js/undo.js',
    '../src/js/window_layer.js',
    '../src/js/window_tool.js',
    '../src/js/window_filter.js',
    '../src/js/config.js',
    '../src/js/saveload.js',
    '../src/js/interop.js',
    '../src/js/axpobj.js',
  ];

  for (const file of guardedFiles) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const lines = source.split('\n');
    let matchedGuards = 0;
    lines.forEach((line, index) => {
      if (!line.includes('finalizeNagenawaSelection') || !line.includes('();')) return;
      matchedGuards += 1;
      const guardWindow = lines.slice(index, index + 4).join('\n');
      assert.match(guardWindow, /finalizeLiquifySession(?:\?\.)?\(\);/, `${file}:${index + 1}`);
    });
    assert.ok(matchedGuards > 0, `${file}: expected at least one nagenawa finalization guard`);
  }
});

test('emergency autosave finalizes transient canvas tools before saving', () => {
  const source = readFileSync(new URL('../src/js/axpobj.js', import.meta.url), 'utf8');

  assert.match(
    source,
    /document\.visibilityState === 'hidden'[\s\S]*?const finalizedNagenawa = this\.finalizeNagenawaSelection\(\{ autoSave: false \}\);[\s\S]*?const finalizedLiquify = this\.finalizeLiquifySession\(\{ autoSave: false \}\);[\s\S]*?this\.saveSystem\.autoSave\(true, \{ forceWrite: finalizedNagenawa \|\| finalizedLiquify \}\);/,
  );
  assert.match(
    source,
    /window\.addEventListener\('pagehide', \(\) => \{[\s\S]*?const finalizedNagenawa = this\.finalizeNagenawaSelection\(\{ autoSave: false \}\);[\s\S]*?const finalizedLiquify = this\.finalizeLiquifySession\(\{ autoSave: false \}\);[\s\S]*?this\.saveSystem\.autoSave\(true, \{ forceWrite: finalizedNagenawa \|\| finalizedLiquify \}\);/,
  );
});

test('forced autosave writes only when dirty or explicitly requested', async () => {
  const writes = [];
  const saveSystem = new SaveSystem({
    x_size: 1,
    y_size: 1,
    layerSystem: {
      layer_counter: 1,
      layerObj: [],
    },
    assistToolSystem: {
      CANVAS: { thumbnail: { toDataURL: () => 'data:image/png;base64,' } },
      getIsTransparent: () => false,
    },
  });
  saveSystem.isDBAvailable = true;
  saveSystem.dbSystem = {
    autosaveToDB: async (data, storeName) => {
      writes.push({ data, storeName });
    },
  };

  await saveSystem.autoSave(true);
  assert.equal(writes.length, 0);

  await saveSystem.autoSave(true, { forceWrite: true });
  assert.equal(writes.length, 1);
});

test('liquify overlay buttons support keyboard click activation', () => {
  const source = readFileSync(new URL('../src/js/pendefine/liquify.js', import.meta.url), 'utf8');
  const match = source.match(/setupOverlayEvents\(\) \{(?<body>[\s\S]*?)\n {2}\}\n\n {2}showOverlay/);

  assert.ok(match);
  assert.match(match.groups.body, /finishBtn\.addEventListener\('pointerdown', stopPointer\)/);
  assert.match(match.groups.body, /finishBtn\.addEventListener\('click', finishSession\)/);
  assert.match(match.groups.body, /cancelBtn\.addEventListener\('pointerdown', stopPointer\)/);
  assert.match(match.groups.body, /cancelBtn\.addEventListener\('click', cancelSession\)/);
});

test('canvas overlay buttons are keyboard focusable with visible focus styling', () => {
  const main = readFileSync(new URL('../src/html/main.txt', import.meta.url), 'utf8');
  const commonCss = readFileSync(new URL('../src/css/common.css', import.meta.url), 'utf8');

  assert.doesNotMatch(main, /<div id="axp_canvas_div_(?:rotateLeft|rotateRight|nagenawaFlip|nagenawaDuplicate|nagenawaFinish|polygonCancel|polygonFinish)" class="[^"]*\baxpc_overlay_btn\b/);
  assert.match(commonCss, /\.axpc_overlay_btn:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--axp-border-focus/);
});

test('Japanese fill sample labels use full-width layer wording', () => {
  const msg = readFileSync(new URL('../src/text/msg.txt', import.meta.url), 'utf8');
  const ja = readFileSync(new URL('../src/text/ja.json', import.meta.url), 'utf8');

  assert.doesNotMatch(msg, /全ﾚｲﾔｰ/);
  assert.doesNotMatch(ja, /全ﾚｲﾔｰ/);
});
