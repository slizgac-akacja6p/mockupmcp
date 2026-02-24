import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadStyle, getAvailableStyles } from '../../src/renderer/styles/index.js';

describe('style registry', () => {
  it('getAvailableStyles returns all 18 styles', () => {
    const styles = getAvailableStyles();
    // Original 6
    assert.ok(styles.includes('wireframe'));
    assert.ok(styles.includes('material'));
    assert.ok(styles.includes('ios'));
    assert.ok(styles.includes('blueprint'));
    assert.ok(styles.includes('flat'));
    assert.ok(styles.includes('hand-drawn'));
    // M18: 12 new design system styles
    assert.ok(styles.includes('material3'));
    assert.ok(styles.includes('hig'));
    assert.ok(styles.includes('fluent2'));
    assert.ok(styles.includes('antd'));
    assert.ok(styles.includes('carbon'));
    assert.ok(styles.includes('neubrutalism'));
    assert.ok(styles.includes('glassmorphism'));
    assert.ok(styles.includes('neumorphic'));
    assert.ok(styles.includes('claymorphism'));
    assert.ok(styles.includes('dark-minimal'));
    assert.ok(styles.includes('aurora'));
    assert.ok(styles.includes('skeuomorphic'));
    assert.equal(styles.length, 18);
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

  it('loadStyle falls back to wireframe for new styles without CSS files', () => {
    const wireframe = loadStyle('wireframe');
    // New M18 styles that don't have CSS files yet should fall back gracefully
    for (const name of ['material3', 'hig', 'fluent2', 'antd', 'carbon', 'neubrutalism', 'glassmorphism', 'neumorphic', 'claymorphism', 'dark-minimal', 'aurora', 'skeuomorphic']) {
      const css = loadStyle(name);
      assert.equal(typeof css, 'string');
      assert.ok(css.length > 0, `${name} should return non-empty CSS`);
    }
  });

  it('caches loaded CSS (same reference on second call)', () => {
    const a = loadStyle('wireframe');
    const b = loadStyle('wireframe');
    assert.equal(a, b);
  });
});
