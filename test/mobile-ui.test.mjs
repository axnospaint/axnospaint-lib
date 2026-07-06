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
