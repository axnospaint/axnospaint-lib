import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('coarse pointer UI uses the bottom touch bar instead of duplicate header undo and redo', () => {
  const html = readFileSync(new URL('../src/html/main.txt', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/css/axnospaint.css', import.meta.url), 'utf8');

  assert.match(html, /id="axp_main_button_undo"[\s\S]*id="axp_main_button_redo"/);
  assert.match(html, /id="axp_canvas_button_touchUndo"[\s\S]*id="axp_canvas_button_touchRedo"/);
  assert.match(
    css,
    /@media \(pointer: coarse\) \{[\s\S]*?\.axpc_main_headerButton\s*\{[\s\S]*?display:\s*none;/,
  );
});

test('mobile sheet exposes the extension tab in the same order as sheet windows', () => {
  const html = readFileSync(new URL('../src/html/main.txt', import.meta.url), 'utf8');
  const mobileJs = readFileSync(new URL('../src/js/mobile.js', import.meta.url), 'utf8');

  const sheetTabIds = [...html.matchAll(/class="axpm-sheet__tab" data-sheettab="([^"]+)"/g)].map((match) => match[1]);
  const sheetWindowMatch = mobileJs.match(/const SHEET_WINDOW_IDS = \[([^\]]+)\];/);
  assert.ok(sheetWindowMatch);
  const sheetWindowIds = [...sheetWindowMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);

  assert.deepEqual(sheetTabIds, ['axp_pen', 'axp_makecolor', 'axp_layer', 'axp_tool', 'axp_filter']);
  assert.deepEqual(sheetWindowIds, sheetTabIds);
  assert.equal(sheetTabIds.length, 5);
});
