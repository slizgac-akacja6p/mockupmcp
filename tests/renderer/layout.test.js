import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { autoLayout, resolveOverlaps } from '../../src/renderer/layout.js';

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

describe('resolveOverlaps', () => {
  describe('basic overlap resolution', () => {
    it('shifts overlapping element below the conflicting one', () => {
      const elements = [
        el('el_card', 20, 180, 350, 90),   // card ends at y=270
        el('el_bar', 20, 246, 350, 8),      // starts inside card (y=246 < 270)
      ];

      const result = resolveOverlaps(elements, 393);

      assert.equal(result[0].y, 180, 'First element unchanged');
      assert.equal(result[1].y, 180 + 90 + 8, 'Second element shifted below card + gap');
    });

    it('resolves chain of overlapping elements', () => {
      const elements = [
        el('el_1', 20, 0, 200, 80),
        el('el_2', 20, 50, 200, 80),   // overlaps el_1
        el('el_3', 20, 100, 200, 80),  // overlaps el_2 (after fix)
      ];

      const result = resolveOverlaps(elements, 393);

      assert.ok(result[1].y >= result[0].y + result[0].height, 'el_2 below el_1');
      assert.ok(result[2].y >= result[1].y + result[1].height, 'el_3 below el_2');
    });

    it('does not move non-overlapping elements', () => {
      const elements = [
        el('el_1', 20, 0, 200, 40),
        el('el_2', 20, 60, 200, 40),   // no overlap (gap of 20px)
        el('el_3', 20, 120, 200, 40),  // no overlap
      ];

      const result = resolveOverlaps(elements, 393);

      assert.equal(result[0].y, 0);
      assert.equal(result[1].y, 60);
      assert.equal(result[2].y, 120);
    });

    it('handles side-by-side elements without shifting', () => {
      const elements = [
        el('el_left', 20, 100, 163, 100),
        el('el_right', 207, 100, 163, 100),
      ];

      const result = resolveOverlaps(elements, 393);

      assert.equal(result[0].y, 100);
      assert.equal(result[1].y, 100);
    });
  });

  describe('intentional overlap preservation', () => {
    it('preserves text contained inside a rectangle (child pattern)', () => {
      const elements = [
        el('el_bg', 0, 0, 390, 88),
        el('el_text', 20, 20, 180, 28),   // contained inside bg
      ];

      const result = resolveOverlaps(elements, 393);

      assert.equal(result[1].y, 20, 'Contained text should not be moved');
    });

    it('preserves same-origin overlay (progress fill on track)', () => {
      const elements = [
        el('el_track', 20, 246, 350, 8),
        el('el_fill', 20, 246, 228, 8),  // same x,y = intentional overlay
      ];

      const result = resolveOverlaps(elements, 393);

      assert.equal(result[0].y, 246);
      assert.equal(result[1].y, 246, 'Same-origin elements should not be moved');
    });

    it('preserves full-width background element overlaps', () => {
      const elements = [
        el('el_fullbg', 0, 0, 390, 844),   // full-width backdrop
        el('el_content', 20, 100, 350, 80), // content on top
      ];

      const result = resolveOverlaps(elements, 393);

      assert.equal(result[1].y, 100, 'Content on full-width bg should not be moved');
    });
  });

  describe('z_index layer isolation', () => {
    it('only resolves overlaps within the same z_index layer', () => {
      const elements = [
        el('el_nav', 0, 0, 393, 56, 10),   // pinned nav (z=10)
        el('el_content', 0, 0, 393, 100, 0), // content at z=0
      ];

      const result = resolveOverlaps(elements, 393);

      assert.equal(result[0].y, 0, 'Pinned nav unchanged');
      assert.equal(result[1].y, 0, 'Different z_index = no overlap check');
    });

    it('does not move pinned elements (z_index >= 10)', () => {
      const elements = [
        el('el_nav', 0, 0, 393, 56, 10),
        el('el_tab', 0, 0, 393, 56, 10),  // overlaps nav at same pinned layer
      ];

      const result = resolveOverlaps(elements, 393);

      assert.equal(result[0].y, 0);
      assert.equal(result[1].y, 0, 'Pinned elements are never moved');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = resolveOverlaps([], 393);
      assert.deepEqual(result, []);
    });

    it('returns single element unchanged', () => {
      const elements = [el('el_1', 20, 100, 200, 40)];
      const result = resolveOverlaps(elements, 393);
      assert.equal(result[0].y, 100);
    });

    it('does not mutate input array', () => {
      const original = [
        el('el_1', 20, 0, 200, 80),
        el('el_2', 20, 50, 200, 80),
      ];
      const origY = original[1].y;
      resolveOverlaps(original, 393);
      assert.equal(original[1].y, origY, 'Input should not be mutated');
    });

    it('handles the real FitTrack overlap case (card vs progress bar)', () => {
      // Real data from FitTrack Pro benchmark project.
      // Track (350x8) overlaps card (350x90) — same width = sibling, not child.
      // Fill (228x8) is narrower, so it's treated as a child of the card.
      const elements = [
        el('el_bg', 0, 0, 390, 844),
        el('el_hdr', 0, 0, 390, 88),
        el('el_title', 20, 48, 180, 28),
        el('el_avatar', 330, 40, 40, 40),
        el('el_sub', 20, 108, 200, 20),
        el('el_steps', 20, 130, 300, 32),
        el('el_card', 20, 180, 350, 90),        // ends at 270
        el('el_track', 20, 246, 350, 8),         // same width as card = sibling, gets pushed
        el('el_fill', 20, 246, 228, 8),          // narrower = child of card (stays)
        el('el_label', 20, 272, 160, 24),
        el('el_card_tl', 20, 304, 163, 100),
        el('el_card_tr', 207, 304, 163, 100),
      ];

      const result = resolveOverlaps(elements, 393);

      const card = result.find(e => e.id === 'el_card');
      const track = result.find(e => e.id === 'el_track');
      const label = result.find(e => e.id === 'el_label');

      // Track (full-width sibling) should be pushed below the card
      assert.ok(track.y >= card.y + card.height,
        `Progress track (y=${track.y}) should be below card bottom (${card.y + card.height})`);
      // Label should not overlap the track
      assert.ok(label.y >= track.y + track.height,
        `Label (y=${label.y}) should be below track (${track.y + track.height})`);
    });
  });
});
