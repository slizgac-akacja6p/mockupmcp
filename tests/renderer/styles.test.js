import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadStyle, getAvailableStyles } from '../../src/renderer/styles/index.js';

describe('style registry', () => {
  it('getAvailableStyles returns array with wireframe, material, ios', () => {
    const styles = getAvailableStyles();
    assert.ok(styles.includes('wireframe'));
    assert.ok(styles.includes('material'));
    assert.ok(styles.includes('ios'));
    assert.equal(styles.length, 3);
  });

  it('loadStyle returns non-empty CSS string for wireframe', () => {
    const css = loadStyle('wireframe');
    assert.equal(typeof css, 'string');
    assert.ok(css.length > 0);
    assert.ok(css.includes('.mockup-button'));
  });

  it('loadStyle returns non-empty CSS string for material', () => {
    const css = loadStyle('material');
    assert.equal(typeof css, 'string');
    assert.ok(css.length > 0);
  });

  it('loadStyle returns non-empty CSS string for ios', () => {
    const css = loadStyle('ios');
    assert.equal(typeof css, 'string');
    assert.ok(css.length > 0);
  });

  it('loadStyle falls back to wireframe for unknown style', () => {
    const css = loadStyle('unknown');
    const wireframe = loadStyle('wireframe');
    assert.equal(css, wireframe);
  });

  it('caches loaded CSS (same reference on second call)', () => {
    const a = loadStyle('wireframe');
    const b = loadStyle('wireframe');
    assert.equal(a, b);
  });
});
