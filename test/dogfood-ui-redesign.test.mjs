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
  assert.match(penCss, /#axp_pen_div_liquifyMode\s*\{[\s\S]*?border:\s*1px solid var\(--axp-border-soft\)/);

  assert.match(toolHtml, /id="axp_tool_div_content" class="axpc_tool_shell"/);
  assert.match(toolHtml, /id="axp_tool_div_rightSide" class="axpc_tool_actionGrid"/);
  assert.match(toolCss, /\.axpc_tool_shell\s*\{[\s\S]*?gap:/);
  assert.match(toolCss, /\.axpc_tool_actionGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});
