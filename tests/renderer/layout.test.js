import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { autoLayout } from '../../src/renderer/layout.js';

// Helper to create element stubs
function el(id, x, y, width, height, zIndex = 0) {
  return { id, type: 'rectangle', x, y, width, height, z_index: zIndex, properties: {} };
}

describe('autoLayout', () => {
  describe('vertical direction', () => {
    it('stacks elements top-to-bottom with default spacing and padding', () => {
      const elements = [
        el('el_1', 50, 50, 100, 40),
        el('el_2', 70, 200, 80, 60),
        el('el_3', 30, 300, 120, 30),
      ];

      const result = autoLayout(elements, 393, 852, { direction: 'vertical' });

      assert.equal(result.length, 3);
      assert.equal(result[0].y, 16);
      assert.equal(result[0].x, 16);
      assert.equal(result[1].y, 16 + 40 + 16);
      assert.equal(result[2].y, 16 + 40 + 16 + 60 + 16);
    });

    it('stretch alignment sets width to available width', () => {
      const elements = [el('el_1', 50, 50, 100, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical', align: 'stretch', padding: 24 });

      assert.equal(result[0].width, 393 - 24 - 24);
      assert.equal(result[0].x, 24);
    });

    it('center alignment centers elements horizontally', () => {
      const elements = [el('el_1', 0, 0, 100, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical', align: 'center', padding: 16 });

      const available = 393 - 16 - 16;
      const expectedX = 16 + Math.round((available - 100) / 2);
      assert.equal(result[0].x, expectedX);
      assert.equal(result[0].width, 100);
    });

    it('start alignment left-aligns elements', () => {
      const elements = [el('el_1', 100, 100, 80, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical', align: 'start', padding: 16 });

      assert.equal(result[0].x, 16);
      assert.equal(result[0].width, 80);
    });

    it('respects custom spacing', () => {
      const elements = [
        el('el_1', 0, 0, 100, 40),
        el('el_2', 0, 0, 100, 40),
      ];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical', spacing: 32, padding: 0 });

      assert.equal(result[0].y, 0);
      assert.equal(result[1].y, 40 + 32);
    });

    it('respects start_y offset', () => {
      const elements = [el('el_1', 0, 0, 100, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical', start_y: 56 });

      assert.equal(result[0].y, 56 + 16);
    });
  });

  describe('horizontal direction', () => {
    it('arranges elements left-to-right', () => {
      const elements = [
        el('el_1', 0, 0, 80, 40),
        el('el_2', 0, 0, 100, 60),
        el('el_3', 0, 0, 60, 30),
      ];

      const result = autoLayout(elements, 393, 852, { direction: 'horizontal', padding: 16 });

      assert.equal(result[0].x, 16);
      assert.equal(result[1].x, 16 + 80 + 16);
      assert.equal(result[2].x, 16 + 80 + 16 + 100 + 16);
    });

    it('stretch alignment sets height to available height', () => {
      const elements = [el('el_1', 0, 0, 80, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'horizontal', align: 'stretch', padding: 16 });

      assert.equal(result[0].height, 852 - 16 - 16);
      assert.equal(result[0].y, 16);
    });

    it('center alignment centers elements vertically', () => {
      const elements = [el('el_1', 0, 0, 80, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'horizontal', align: 'center', padding: 16 });

      const available = 852 - 16 - 16;
      const expectedY = 16 + Math.round((available - 40) / 2);
      assert.equal(result[0].y, expectedY);
      assert.equal(result[0].height, 40);
    });

    it('start alignment top-aligns elements', () => {
      const elements = [el('el_1', 0, 0, 80, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'horizontal', align: 'start', padding: 16 });

      assert.equal(result[0].y, 16);
      assert.equal(result[0].height, 40);
    });
  });

  describe('grid direction', () => {
    it('arranges elements in 2-column grid by default', () => {
      const elements = [
        el('el_1', 0, 0, 100, 80),
        el('el_2', 0, 0, 100, 80),
        el('el_3', 0, 0, 100, 80),
        el('el_4', 0, 0, 100, 80),
      ];

      const result = autoLayout(elements, 393, 852, { direction: 'grid', padding: 16, spacing: 16 });

      const cellW = Math.round((393 - 16 - 16 - 16) / 2);

      assert.equal(result[0].x, 16);
      assert.equal(result[0].y, 16);
      assert.equal(result[0].width, cellW);
      assert.equal(result[1].x, 16 + cellW + 16);
      assert.equal(result[1].y, 16);
      assert.equal(result[1].width, cellW);

      assert.equal(result[2].x, 16);
      assert.equal(result[2].y, 16 + 80 + 16);
      assert.equal(result[3].x, 16 + cellW + 16);
      assert.equal(result[3].y, 16 + 80 + 16);
    });

    it('respects custom column count', () => {
      const elements = [
        el('el_1', 0, 0, 100, 60),
        el('el_2', 0, 0, 100, 60),
        el('el_3', 0, 0, 100, 60),
      ];

      const result = autoLayout(elements, 393, 852, { direction: 'grid', columns: 3, padding: 16, spacing: 8 });

      const cellW = Math.round((393 - 16 - 16 - 8 * 2) / 3);

      assert.equal(result[0].x, 16);
      assert.equal(result[1].x, 16 + cellW + 8);
      assert.equal(result[2].x, 16 + (cellW + 8) * 2);
      assert.equal(result[0].y, result[1].y);
      assert.equal(result[1].y, result[2].y);
    });
  });

  describe('z_index pinning', () => {
    it('excludes elements with z_index >= 10 from layout', () => {
      const elements = [
        el('el_nav', 0, 0, 393, 56, 10),
        el('el_1', 50, 100, 100, 40, 0),
        el('el_2', 50, 200, 100, 40, 0),
      ];

      const result = autoLayout(elements, 393, 852, { direction: 'vertical' });

      const nav = result.find(e => e.id === 'el_nav');
      assert.equal(nav.x, 0);
      assert.equal(nav.y, 0);
      assert.equal(nav.width, 393);

      const el1 = result.find(e => e.id === 'el_1');
      const el2 = result.find(e => e.id === 'el_2');
      assert.equal(el1.y, 16);
      assert.equal(el2.y, 16 + 40 + 16);
    });
  });

  describe('element_ids filter', () => {
    it('only layouts specified element IDs', () => {
      const elements = [
        el('el_1', 10, 10, 100, 40),
        el('el_2', 20, 20, 100, 40),
        el('el_3', 30, 30, 100, 40),
      ];

      const result = autoLayout(elements, 393, 852, {
        direction: 'vertical',
        element_ids: ['el_1', 'el_3'],
      });

      const r1 = result.find(e => e.id === 'el_1');
      const r3 = result.find(e => e.id === 'el_3');
      assert.equal(r1.y, 16);
      assert.equal(r3.y, 16 + 40 + 16);

      const r2 = result.find(e => e.id === 'el_2');
      assert.equal(r2.x, 20);
      assert.equal(r2.y, 20);
    });

    it('ignores nonexistent element IDs silently', () => {
      const elements = [el('el_1', 10, 10, 100, 40)];

      const result = autoLayout(elements, 393, 852, {
        direction: 'vertical',
        element_ids: ['el_1', 'el_nonexistent'],
      });

      assert.equal(result.length, 1);
      assert.equal(result[0].y, 16);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = autoLayout([], 393, 852, { direction: 'vertical' });
      assert.deepEqual(result, []);
    });

    it('handles single element', () => {
      const elements = [el('el_1', 50, 50, 100, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical' });
      assert.equal(result.length, 1);
      assert.equal(result[0].y, 16);
    });

    it('handles all elements pinned (z_index >= 10)', () => {
      const elements = [
        el('el_1', 0, 0, 393, 56, 10),
        el('el_2', 0, 800, 393, 52, 10),
      ];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical' });
      assert.equal(result[0].x, 0);
      assert.equal(result[0].y, 0);
      assert.equal(result[1].y, 800);
    });

    it('does not mutate input array', () => {
      const original = [el('el_1', 50, 50, 100, 40)];
      const originalY = original[0].y;
      autoLayout(original, 393, 852, { direction: 'vertical' });
      assert.equal(original[0].y, originalY, 'Input should not be mutated');
    });
  });
});
