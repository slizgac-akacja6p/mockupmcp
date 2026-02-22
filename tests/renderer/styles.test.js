import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadStyle, getAvailableStyles } from '../../src/renderer/styles/index.js';

describe('style registry', () => {
  it('getAvailableStyles returns all 6 styles', () => {
    const styles = getAvailableStyles();
    assert.ok(styles.includes('wireframe'));
    assert.ok(styles.includes('material'));
    assert.ok(styles.includes('ios'));
    assert.ok(styles.includes('blueprint'));
    assert.ok(styles.includes('flat'));
    assert.ok(styles.includes('hand-drawn'));
    assert.equal(styles.length, 6);
  });

  for (const name of ['wireframe', 'material', 'ios', 'blueprint', 'flat', 'hand-drawn']) {
    it(`loadStyle returns non-empty CSS string for ${name}`, () => {
      const css = loadStyle(name);
      assert.equal(typeof css, 'string');
      assert.ok(css.length > 0);
      assert.ok(css.includes('.mockup-button'));
    });
  }

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
