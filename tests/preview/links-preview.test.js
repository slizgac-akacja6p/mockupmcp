import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildScreenHtml } from '../../src/renderer/html-builder.js';

// Test that the preview injection works correctly by testing the building blocks.
// We can't easily test the Express server in unit tests, but we can verify:
// 1. html-builder adds data-link-to attributes (already tested in Sprint 1)
// 2. The link script and back button strings are valid HTML/JS

describe('preview link support', () => {
  it('html-builder adds data-link-to for linked elements', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0,
          properties: { label: 'Go', link_to: { screen_id: 'scr_abc', transition: 'push' } } },
      ],
    };
    const html = buildScreenHtml(screen);
    assert.ok(html.includes('data-link-to="scr_abc"'));
    assert.ok(html.includes('data-transition="push"'));
  });

  it('linked elements have cursor:pointer style', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0,
          properties: { label: 'Go', link_to: { screen_id: 'scr_abc', transition: 'push' } } },
      ],
    };
    const html = buildScreenHtml(screen);
    assert.ok(html.includes('cursor:pointer'));
  });

  it('non-linked elements do not have link attributes', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0,
          properties: { label: 'Stay' } },
      ],
    };
    const html = buildScreenHtml(screen);
    assert.ok(!html.includes('data-link-to'));
    assert.ok(!html.includes('cursor:pointer'));
  });
});
