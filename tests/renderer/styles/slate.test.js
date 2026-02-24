import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getAvailableStyles, loadStyle } from '../../../src/renderer/styles/index.js';
import { buildScreenHtml } from '../../../src/renderer/html-builder.js';

test('M24 — Slate style', async () => {
  test('"slate" is in available styles', () => {
    const styles = getAvailableStyles();
    assert.ok(styles.includes('slate'), 'slate should be registered in available styles');
  });

  test('loadStyle returns non-empty CSS for slate', () => {
    const css = loadStyle('slate');
    assert.equal(typeof css, 'string');
    assert.ok(css.length > 0, 'CSS should not be empty');
    assert.ok(css.includes('.screen'), 'CSS should contain .screen selector');
  });

  test('slate.css covers common component types', () => {
    const css = loadStyle('slate');
    // Core components that must be covered
    const components = [
      'mockup-button', 'mockup-input', 'mockup-select', 'mockup-checkbox',
      'mockup-radio', 'mockup-toggle', 'mockup-slider', 'mockup-image-placeholder',
      'mockup-icon', 'mockup-badge', 'mockup-alert', 'mockup-avatar', 'mockup-card',
      'mockup-list', 'mockup-table', 'mockup-navbar', 'mockup-sidebar', 'mockup-modal',
      'mockup-tooltip', 'mockup-dropdown', 'mockup-tabbar',
      'mockup-progress', 'mockup-spinner', 'mockup-divider', 'mockup-breadcrumb', 'mockup-pagination',
      'mockup-calendar', 'mockup-map', 'mockup-chart', 'mockup-code', 'mockup-chip',
    ];
    for (const component of components) {
      assert.ok(css.includes(component), `CSS should include styles for ${component}`);
    }
  });

  test('slate.css has dark theme by default (no data-color-scheme)', () => {
    const css = loadStyle('slate');
    // Check for dark theme colors in base selector
    assert.ok(css.includes('--bg: #0f172a'), 'Should have dark background (slate-900)');
    assert.ok(css.includes('--text: #f1f5f9'), 'Should have light text (slate-100)');
    assert.ok(css.includes('--accent: #6366f1'), 'Should have indigo-500 accent');
  });

  test('slate.css has light theme for data-color-scheme="light"', () => {
    const css = loadStyle('slate');
    assert.ok(css.includes('[data-color-scheme="light"]'), 'Should have light variant with data-color-scheme attribute');
    assert.ok(css.includes('#f8fafc'), 'Should have light background (slate-50)');
    assert.ok(css.includes('#0f172a'), 'Should have dark text (slate-900)');
    assert.ok(css.includes('#4f46e5'), 'Should have indigo-600 for light mode accent');
  });

  test('buildScreenHtml adds data-color-scheme attribute when screen.color_scheme is set', () => {
    const screen = {
      id: 'scr_test',
      name: 'Test Screen',
      width: 400,
      height: 600,
      background: '#FFFFFF',
      color_scheme: 'light',
      elements: [],
    };
    const html = buildScreenHtml(screen, 'slate');
    assert.ok(html.includes('data-color-scheme="light"'), 'HTML should include data-color-scheme="light" attribute');
    assert.ok(html.includes('class="screen"'), 'HTML should include screen class on screen div');
  });

  test('buildScreenHtml omits data-color-scheme when color_scheme is null or undefined', () => {
    const screenWithoutColorScheme = {
      id: 'scr_test',
      name: 'Test Screen',
      width: 400,
      height: 600,
      background: '#FFFFFF',
      color_scheme: null,
      elements: [],
    };
    const html = buildScreenHtml(screenWithoutColorScheme, 'slate');
    // Extract the div line to check for attribute specifically (not in CSS)
    const divLine = html.split('\n').find(line => line.includes('<div class="screen'));
    assert.ok(!divLine.includes('data-color-scheme='), 'HTML div should not include data-color-scheme attribute when color_scheme is null');

    const screenUndefined = {
      id: 'scr_test',
      name: 'Test Screen',
      width: 400,
      height: 600,
      background: '#FFFFFF',
      elements: [],
    };
    const html2 = buildScreenHtml(screenUndefined, 'slate');
    const divLine2 = html2.split('\n').find(line => line.includes('<div class="screen'));
    assert.ok(!divLine2.includes('data-color-scheme='), 'HTML div should not include data-color-scheme attribute when color_scheme is undefined');
  });

  test('buildScreenHtml renders dark theme by default for slate', () => {
    const screen = {
      id: 'scr_test',
      name: 'Test Screen',
      width: 400,
      height: 600,
      background: '#FFFFFF',
      elements: [],
    };
    const html = buildScreenHtml(screen, 'slate');
    const css = loadStyle('slate');
    // Verify that dark theme is applied by default (no data-color-scheme attribute = dark)
    assert.ok(html.includes('class="screen"'), 'Screen should have screen class');
    assert.ok(css.includes('.screen {'), 'CSS should have base dark theme selector');
  });
});
