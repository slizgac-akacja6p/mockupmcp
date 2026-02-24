import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPaletteCategories, getComponentDefaults } from '../../../src/preview/editor/palette-data.js';

describe('PaletteData', () => {
  it('returns 6 categories', () => {
    const cats = getPaletteCategories();
    assert.equal(cats.length, 6);
    assert.ok(cats.find(c => c.name === 'Basic'));
    assert.ok(cats.find(c => c.name === 'Form'));
  });

  it('all 35 components have defaults', () => {
    const cats = getPaletteCategories();
    const total = cats.reduce((sum, c) => sum + c.components.length, 0);
    assert.equal(total, 35);
  });

  it('getComponentDefaults returns width/height + properties', () => {
    const def = getComponentDefaults('button');
    assert.ok(def.width > 0);
    assert.ok(def.height > 0);
    assert.ok(def.properties.label);
  });
});
