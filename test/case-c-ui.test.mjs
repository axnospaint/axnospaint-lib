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

test('dock pen buttons mirror the pen tool menu subtype', () => {
  const dockJs = readFileSync(new URL('../src/js/dock.js', import.meta.url), 'utf8');

  assert.match(mainHtml, /data-dock-source-button="axp_pen_button_penBase"/);
  assert.match(mainHtml, /data-dock-source-button="axp_pen_button_eraserBase"/);
  assert.match(mainHtml, /data-dock-source-button="axp_pen_button_fillBase"/);
  assert.match(mainHtml, /data-dock-source-button="axp_pen_button_handBase"/);
  assert.match(dockJs, /syncDockPenButton\(button,\s*sourceButton,\s*penSystem\)/);
  assert.match(dockJs, /const mode = sourceButton\.dataset\.set/);
  assert.match(dockJs, /button\.dataset\.penmode = mode/);
  assert.match(dockJs, /button\.dataset\.function = sourceModeButton\.dataset\.function/);
  assert.match(dockJs, /this\.axpObj\.configSystem\.getShortcutFunction\(button\.dataset\.function\)/);
  assert.match(dockJs, /button\.classList\.add\(penSystem\.getClassIcon\(mode\)\)/);
  assert.match(dockJs, /button\.setAttribute\('aria-label',\s*penSystem\.penObj\[mode\]\?\.name/);
  assert.match(dockJs, /MutationObserver\(syncSelection\)\.observe\(sourceButton/);
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

test('first launch starts tool windows minimized without hiding the launcher controls', () => {
  assert.match(axpobjJs, /applyFirstLaunchWindowMinimize\(\)/);
  assert.match(axpobjJs, /if\s*\(this\.ENV\.isFirstLaunch\)\s*\{[\s\S]*?this\.applyFirstLaunchWindowMinimize\(\);[\s\S]*?\}/);
  assert.match(axpobjJs, /this\.dragWindow\.minimize\(item\.id\)/);
  assert.match(axpobjJs, /this\.launcher\.minimizeButton\(item\.id\)/);
  assert.match(axpobjJs, /this\.configSystem\.saveConfig\('WDMIN_'\s*\+\s*item\.id,\s*true\)/);
  assert.doesNotMatch(axpobjJs, /saveConfig\('WDMIN_'\s*\+\s*'axp_all'/);
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

test('mobile sheet tab recovers windows from the all-hidden state', () => {
  const mobileJs = readFileSync(new URL('../src/js/mobile.js', import.meta.url), 'utf8');
  // dock.js の toggleWindow と同じ復帰経路（ランチャー一括ボタン経由）が
  // 共通ヘルパーとして存在し、openSheetTab から呼ばれる
  const helper = mobileJs.match(/restoreFromAllHidden\(windowElement\) \{(?<body>[\s\S]*?)\n {4}\}/);
  assert.ok(helper);
  assert.match(helper.groups.body, /axpc_window_hidden/);
  assert.match(helper.groups.body, /axpc_launcher_allButton/);
  const open = mobileJs.match(/openSheetTab\(windowId\) \{(?<body>[\s\S]*?)\n {4}\}/);
  assert.ok(open);
  assert.match(open.groups.body, /this\.restoreFromAllHidden\(windowElement\)/);
  // アクティブタブの再タップ時も、hidden中はcloseSheetではなく復帰経路に入る
  const tabHandler = mobileJs.match(/tab\.addEventListener\('click',(?<body>[\s\S]*?)\}\);/);
  assert.ok(tabHandler);
  assert.match(tabHandler.groups.body, /axpc_window_hidden/);
  assert.match(tabHandler.groups.body, /=== windowId && !isHidden/);
});

test('quickbar zoom readout rounds the scale like the loupe reset button', () => {
  const dockJs = readFileSync(new URL('../src/js/dock.js', import.meta.url), 'utf8');
  // axpobj.js の refreshCanvas と同じく Math.round した倍率を表示する
  assert.match(dockJs, /Math\.round\(this\.axpObj\.scale\)/);
});

test('canvas chrome controls do not bubble pointer input into canvas drawing handlers', () => {
  assert.match(axpobjJs, /this\._guardCanvasChromePointerEvents\(\);/);
  assert.match(axpobjJs, /_guardCanvasChromePointerEvents\(\)\s*\{/);
  assert.match(axpobjJs, /#axp_canvas_div_touchBar/);
  assert.match(axpobjJs, /#axp_dock_left/);
  assert.match(axpobjJs, /#axp_dock_right/);
  assert.match(axpobjJs, /#axp_quickbar/);
  assert.match(axpobjJs, /#axp_mobile_topbar/);
  assert.match(axpobjJs, /#axp_mobile_sheet/);
  assert.match(axpobjJs, /'pointerdown',\s*stopCanvasPointer/);
  assert.match(axpobjJs, /'pointermove',\s*stopCanvasPointer/);
  assert.match(axpobjJs, /'pointerup',\s*stopCanvasPointer/);
  assert.match(axpobjJs, /'pointercancel',\s*stopCanvasPointer/);
});

test('middle mouse button pans by drag or wheel before running click assignments', () => {
  assert.match(axpobjJs, /isMouseWheelPanActive\s*=\s*false/);
  assert.match(axpobjJs, /beginMouseWheelPan\(e\)/);
  assert.match(axpobjJs, /e\.button\s*===\s*1/);
  assert.match(axpobjJs, /this\.beginMouseWheelPan\(e\)/);
  assert.match(axpobjJs, /moveMouseWheelPan\(e\)/);
  assert.match(axpobjJs, /endMouseWheelPan\(e,\s*\{\s*runClickTask:\s*true\s*\}\)/);
  assert.match(axpobjJs, /this\.isMouseWheelPanActive\s*&&\s*\(e\.buttons\s*&\s*4\)/);
  assert.match(axpobjJs, /this\.scrollMouseWheelPan\(deltaX,\s*deltaY\)/);
  assert.match(axpobjJs, /runMouseButtonTask\(this\.config\('axp_config_form_mouseWheelButton'\),\s*e,\s*\{\s*allowTransDraw:\s*false\s*\}\)/);
});

test('config mobile select stays in sync with the active nav section', () => {
  const configJs = readFileSync(new URL('../src/js/config.js', import.meta.url), 'utf8');
  // IntersectionObserver→activateButton 経由でセレクト値が更新される
  const activate = configJs.match(/const activateButton = \(element\) => \{(?<body>[\s\S]*?)\n {8}\}/);
  assert.ok(activate);
  assert.match(activate.groups.body, /axp_config_select_mobileNav/);
  assert.match(activate.groups.body, /mobileSelect\.value = String\(idx\)/);
  // セレクトにはアクセシブルネームを付与する
  assert.match(configJs, /select\.setAttribute\('aria-label',/);
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
