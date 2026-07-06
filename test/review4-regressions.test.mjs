import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { collectUnsupportedBlendLayers } from '../src/js/psdcodec.js';
import { ReferenceImageSystem } from '../src/js/referenceimage.js';

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
    /type: 'layer-style'[\s\S]*?this\.axpObj\.msg\('@INF1012'\);(?<tail>[\s\S]*?)\n\s+\};/
  );

  assert.ok(match);
  assert.match(match.groups.tail, /saveSystem\.autoSave\(\)/);
});

test('Japanese fill sample labels use full-width layer wording', () => {
  const msg = readFileSync(new URL('../src/text/msg.txt', import.meta.url), 'utf8');
  const ja = readFileSync(new URL('../src/text/ja.json', import.meta.url), 'utf8');

  assert.doesNotMatch(msg, /全ﾚｲﾔｰ/);
  assert.doesNotMatch(ja, /全ﾚｲﾔｰ/);
});
