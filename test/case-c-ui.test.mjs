import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mainHtml = readFileSync(new URL('../src/html/main.txt', import.meta.url), 'utf8');
const dockCss = readFileSync(new URL('../src/css/dock.css', import.meta.url), 'utf8');
const mobileCss = readFileSync(new URL('../src/css/mobile.css', import.meta.url), 'utf8');
const axpobjJs = readFileSync(new URL('../src/js/axpobj.js', import.meta.url), 'utf8');

test('PC dock markup exposes pen shortcuts wired to existing TASK functions', () => {
  assert.match(mainHtml, /id="axp_dock_left"[\s\S]*data-function="func_switch_axp_penmode_round"/);
  assert.match(mainHtml, /data-function="func_switch_spuit" data-penmode="axp_penmode_spuit"/);
  assert.match(mainHtml, /id="axp_dock_right"[\s\S]*id="axp_dock_button_layer"/);
  assert.match(mainHtml, /id="axp_quickbar"[\s\S]*id="axp_quickbar_range_penSize"/);
});

test('dock and quickbar hide on mobile widths and quickbar yields to the touch bar', () => {
  assert.match(dockCss, /@media \(max-width: 599px\)[\s\S]*?\.axp-dock[\s\S]*?display:\s*none/);
  assert.match(dockCss, /@media \(pointer: coarse\)[\s\S]*?\.axp-quickbar[\s\S]*?display:\s*none/);
});

test('mobile topbar and bottom sheet are gated behind the mobile media query', () => {
  assert.match(mainHtml, /id="axp_mobile_topbar" class="axpm-topbar"/);
  assert.match(mainHtml, /id="axp_mobile_sheet" class="axpm-sheet"[\s\S]*data-sheettab="axp_pen"/);
  // デフォルト非表示 + 599px以下でのみ表示（PC副作用ゼロ）
  assert.match(mobileCss, /\.axpm-topbar\s*\{\s*\n?\s*display:\s*none/);
  assert.match(mobileCss, /@media \(max-width: 599px\)[\s\S]*?\.axpm-topbar\s*\{[\s\S]*?display:\s*flex/);
});

test('dock and mobile systems start after the interop system', () => {
  assert.match(axpobjJs, /this\.interopSystem\.startEvent\(\);\s*\n\s*this\.dockSystem\.startEvent\(\);\s*\n\s*this\.mobileSystem\.startEvent\(\);/);
});
