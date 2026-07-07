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

test('dock toggle recovers windows from the all-hidden state', () => {
  const dockJs = readFileSync(new URL('../src/js/dock.js', import.meta.url), 'utf8');
  // toggleWindow は axpc_window_hidden（全体非表示）からの復帰経路を持つ
  const toggle = dockJs.match(/toggleWindow\(windowId\) \{(?<body>[\s\S]*?)\n {4}\}/);
  assert.ok(toggle);
  assert.match(toggle.groups.body, /axpc_window_hidden/);
  assert.match(toggle.groups.body, /axpc_launcher_allButton/);
  // クイックバーの色スウォッチも hidden 状態から復帰できる
  const swatchHandler = dockJs.match(/swatch\.addEventListener\('click',(?<body>[\s\S]*?)\}\);/);
  assert.ok(swatchHandler);
  assert.match(swatchHandler.groups.body, /axpc_window_hidden/);
});

test('shared window frame keeps line-height at or above font size', () => {
  const componentsCss = readFileSync(new URL('../src/css/components.css', import.meta.url), 'utf8');
  const frame = componentsCss.match(/\.axp-window\s*\{(?<body>[\s\S]*?)\n\}/);
  assert.ok(frame);
  // 15pxフォントに対して行間が潰れないよう、相対値(>=1)を要求
  const lineHeight = frame.groups.body.match(/line-height:\s*([\d.]+)\s*;/);
  assert.ok(lineHeight, 'line-height must be a unitless relative value');
  assert.ok(Number(lineHeight[1]) >= 1);
});

test('config tab uses the case-C dark theme with accent-highlighted navigation', () => {
  const configCss = readFileSync(new URL('../src/css/config.css', import.meta.url), 'utf8');
  assert.match(configCss, /#axp_config_div_content\s*\{[\s\S]*?background:\s*#1a1a1a/);
  assert.match(configCss, /#axp_config_div_nav button\.axpc_ACTIVE\s*\{[\s\S]*?rgba\(238,\s*172,\s*96/);
  // モバイル用セクションジャンプはデフォルト非表示、599px以下でのみ表示
  assert.match(configCss, /#axp_config_select_mobileNav\s*\{\s*\n?\s*display:\s*none/);
  assert.match(configCss, /@media \(max-width: 599px\)[\s\S]*?#axp_config_select_mobileNav\s*\{[\s\S]*?display:\s*block/);
});

test('config tab generates the mobile section-jump select', () => {
  const configJs = readFileSync(new URL('../src/js/config.js', import.meta.url), 'utf8');
  assert.match(configJs, /axp_config_select_mobileNav/);
  assert.match(configJs, /insertAdjacentElement\('afterbegin', select\)/);
});

test('subwindows and saveload share the case-C dark frame treatment', () => {
  const commonCss = readFileSync(new URL('../src/css/common.css', import.meta.url), 'utf8');
  const saveloadCss = readFileSync(new URL('../src/css/saveload.css', import.meta.url), 'utf8');
  const penCss = readFileSync(new URL('../src/css/window_pen.css', import.meta.url), 'utf8');
  assert.match(commonCss, /\.axpc_subwindow>div\s*\{[\s\S]*?rgba\(20,\s*20,\s*20,\s*0\.94\)[\s\S]*?border-radius:\s*12px/);
  assert.match(saveloadCss, /#axp_saveload>div\s*\{[\s\S]*?rgba\(20,\s*20,\s*20,\s*0\.94\)/);
  assert.match(saveloadCss, /\.axpc_saveload_saveSlot:hover\s*\{[\s\S]*?var\(--axp-accent/);
  assert.match(penCss, /#axp_penmode>div\s*\{[\s\S]*?rgba\(20,\s*20,\s*20,\s*0\.94\)/);
});
