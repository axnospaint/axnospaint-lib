import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('design tokens are loaded before component styles', () => {
  const index = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const tokens = readFileSync(new URL('../src/css/tokens.css', import.meta.url), 'utf8');

  assert.match(index, /import '\.\/css\/tokens\.css';[\s\S]*import '\.\/css\/axnospaint\.css';/);
  assert.match(tokens, /--axp-surface-window:\s*rgba\(0,\s*0,\s*0,\s*0\.30\)/);
  assert.match(tokens, /--axp-accent:\s*#eeac60/);
  assert.match(tokens, /--axp-h-icon-btn:\s*44px/);
});

test('pen settings no longer expose the obsolete size preset buttons', () => {
  const html = readFileSync(new URL('../src/html/window_pen.txt', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/css/window_pen.css', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../src/js/window_pen.js', import.meta.url), 'utf8');

  assert.doesNotMatch(html, /axp_pen_div_quickSize|axpc_pen_quicksize/);
  assert.doesNotMatch(css, /quickSize|quicksize|axpc_qs_/);
  assert.doesNotMatch(js, /renderQuickSizeButton|updateQuickSizeButtons|QSIZE_|axpc_pen_quicksize/);
});

test('pen and auxiliary windows carry the compact dogfood layout hooks', () => {
  const penHtml = readFileSync(new URL('../src/html/window_pen.txt', import.meta.url), 'utf8');
  const penCss = readFileSync(new URL('../src/css/window_pen.css', import.meta.url), 'utf8');
  const toolHtml = readFileSync(new URL('../src/html/window_tool.txt', import.meta.url), 'utf8');
  const toolCss = readFileSync(new URL('../src/css/window_tool.css', import.meta.url), 'utf8');

  assert.match(penHtml, /id="axp_pen_div_slider" class="axpc_pen_settingsStack"/);
  assert.match(penHtml, /id="axp_pen_div_liquifyMode" class="axpc_text_border axpc_pen_modeCard axpc_NONE"/);
  assert.match(penHtml, /id="axp_pen_button_diffusionDetail" class="axpc_MSG axpc_pen_panelToggle"/);
  assert.match(penCss, /\.axpc_pen_settingsStack\s*\{[\s\S]*?gap:/);
  assert.match(penCss, /\.axpc_pen_modeCard\s*\{[\s\S]*?border:\s*1px solid var\(--axp-border-soft\)/);
  const liquifyModeRule = penCss.match(/#axp_pen_div_liquifyMode\s*\{(?<body>[\s\S]*?)\n\}/);
  assert.ok(liquifyModeRule);
  assert.doesNotMatch(liquifyModeRule.groups.body, /\b(?:border|border-radius|background):/);

  assert.match(toolHtml, /id="axp_tool_div_content" class="axpc_tool_shell"/);
  assert.match(toolHtml, /id="axp_tool_div_rightSide" class="axpc_tool_actionGrid"/);
  assert.match(toolCss, /\.axpc_tool_shell\s*\{[\s\S]*?gap:/);
  assert.match(toolCss, /\.axpc_tool_actionGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test('filter and auxiliary panels fit their controls inside the window frame', () => {
  const filterHtml = readFileSync(new URL('../src/html/window_filter.txt', import.meta.url), 'utf8');
  const filterCss = readFileSync(new URL('../src/css/window_filter.css', import.meta.url), 'utf8');
  const filterJs = readFileSync(new URL('../src/js/window_filter.js', import.meta.url), 'utf8');
  const toolHtml = readFileSync(new URL('../src/html/window_tool.txt', import.meta.url), 'utf8');
  const toolCss = readFileSync(new URL('../src/css/window_tool.css', import.meta.url), 'utf8');
  const toolJs = readFileSync(new URL('../src/js/window_tool.js', import.meta.url), 'utf8');

  assert.match(filterJs, /this\.window_width\s*=\s*460/);
  assert.match(filterCss, /#axp_filter\s*\{[\s\S]*?width:\s*460px/);
  assert.match(filterCss, /#axp_filter_div_content\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(filterCss, /\.axpc_filter_controlRow\s*\{[\s\S]*?grid-template-columns:\s*minmax\(58px,\s*max-content\)\s+minmax\(0,\s*1fr\)/);
  assert.match(filterCss, /\.axpc_filter_controlRow\s+\.axpc_range input\[type="range"\]\s*\{[\s\S]*?width:\s*100%/);
  assert.match(filterHtml, /axpc_filter_section_colorBalance/);
  assert.match(filterHtml, /axpc_filter_colorBalanceBand/);
  assert.match(filterCss, /\.axpc_filter_section_colorBalance\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
  assert.match(filterCss, /\.axpc_filter_colorBalanceBands\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(filterHtml, /@FILTER\.COLORBALANCE_CR/);
  assert.match(filterHtml, /@FILTER\.COLORBALANCE_MG/);
  assert.match(filterHtml, /@FILTER\.COLORBALANCE_YB/);

  assert.match(toolJs, /this\.window_width\s*=\s*360/);
  assert.match(toolCss, /#axp_tool\s*\{[\s\S]*?width:\s*360px/);
  assert.match(toolCss, /\.axpc_tool_shell\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+146px/);
  assert.match(toolHtml, /id="axp_tool_div_canvasSizePreset"[\s\S]*?id="axp_tool_div_leftSide"/);
  assert.match(toolCss, /#axp_tool_div_canvasSizePreset\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
  assert.match(toolCss, /#axp_tool_div_canvasSizePreset\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(toolCss, /\.axpc_tool_actionGrid\s*\{[\s\S]*?grid-column:\s*2/);
  assert.match(toolCss, /\.axpc_tool_actionGrid\s*\{[\s\S]*?margin-top:\s*8px/);
});
