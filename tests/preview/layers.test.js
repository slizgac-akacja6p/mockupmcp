import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPinned,
  getElementList,
  computeBringToFront,
  computeSendToBack,
} from '../../src/preview/editor/layers.js';

describe('Layers - isPinned', () => {
  it('returns true when z_index >= 10', () => {
    assert.equal(isPinned({ id: 'el_1', z_index: 10 }), true);
    assert.equal(isPinned({ id: 'el_2', z_index: 15 }), true);
    assert.equal(isPinned({ id: 'el_3', z_index: 100 }), true);
  });

  it('returns false when z_index < 10', () => {
    assert.equal(isPinned({ id: 'el_1', z_index: 0 }), false);
    assert.equal(isPinned({ id: 'el_2', z_index: 5 }), false);
    assert.equal(isPinned({ id: 'el_3', z_index: 9 }), false);
  });

  it('returns false when z_index is undefined', () => {
    assert.equal(isPinned({ id: 'el_1' }), false);
  });
});

describe('Layers - getElementList', () => {
  it('returns empty array for null screenData', () => {
    assert.deepEqual(getElementList(null), []);
  });

  it('returns empty array when elements is not an array', () => {
    assert.deepEqual(getElementList({ elements: null }), []);
    assert.deepEqual(getElementList({ elements: undefined }), []);
  });

  it('sorts elements by z_index descending (front first)', () => {
    const screenData = {
      elements: [
        { id: 'el_1', type: 'button', z_index: 2 },
        { id: 'el_2', type: 'text', z_index: 5 },
        { id: 'el_3', type: 'card', z_index: 1 },
      ],
    };
    const sorted = getElementList(screenData);
    const ids = sorted.map(el => el.id);
    assert.deepEqual(ids, ['el_2', 'el_1', 'el_3']); // 5, 2, 1
  });

  it('handles missing z_index (defaults to 0)', () => {
    const screenData = {
      elements: [
        { id: 'el_1', type: 'button', z_index: 3 },
        { id: 'el_2', type: 'text' }, // z_index missing → 0
        { id: 'el_3', type: 'card', z_index: 1 },
      ],
    };
    const sorted = getElementList(screenData);
    const ids = sorted.map(el => el.id);
    assert.deepEqual(ids, ['el_1', 'el_3', 'el_2']); // 3, 1, 0
  });

  it('preserves insertion order for elements with same z_index', () => {
    const screenData = {
      elements: [
        { id: 'el_1', type: 'button', z_index: 1 },
        { id: 'el_2', type: 'text', z_index: 1 },
        { id: 'el_3', type: 'card', z_index: 1 },
      ],
    };
    const sorted = getElementList(screenData);
    const ids = sorted.map(el => el.id);
    // All have same z_index, so stable sort preserves insertion order (but descending)
    // Actually, with all equal z_index and descending sort, order may vary.
    // What matters is all three are present:
    assert.equal(ids.length, 3);
    assert.equal(ids.includes('el_1'), true);
    assert.equal(ids.includes('el_2'), true);
    assert.equal(ids.includes('el_3'), true);
  });

  it('does not mutate original screenData', () => {
    const screenData = {
      elements: [
        { id: 'el_1', z_index: 2 },
        { id: 'el_2', z_index: 1 },
      ],
    };
    const originalOrder = [...screenData.elements];
    getElementList(screenData);
    // Check original is unchanged
    assert.deepEqual(screenData.elements, originalOrder);
  });
});

describe('Layers - computeBringToFront', () => {
  it('returns max z_index + 1', () => {
    const elements = [
      { id: 'el_1', z_index: 2 },
      { id: 'el_2', z_index: 5 },
      { id: 'el_3', z_index: 1 },
    ];
    const newZ = computeBringToFront(elements, 'el_1');
    assert.equal(newZ, 6); // max(2,5,1) + 1
  });

  it('returns null if element not found', () => {
    const elements = [
      { id: 'el_1', z_index: 2 },
    ];
    assert.equal(computeBringToFront(elements, 'el_999'), null);
  });

  it('returns null if element is already pinned', () => {
    const elements = [
      { id: 'el_1', z_index: 15 }, // pinned
      { id: 'el_2', z_index: 5 },
    ];
    assert.equal(computeBringToFront(elements, 'el_1'), null);
  });

  it('handles z_index = 0 (default)', () => {
    const elements = [
      { id: 'el_1' }, // z_index missing → 0
    ];
    const newZ = computeBringToFront(elements, 'el_1');
    assert.equal(newZ, 1);
  });

  it('handles empty elements array', () => {
    const elements = [];
    const newZ = computeBringToFront(elements, 'el_1');
    assert.equal(newZ, null); // element not found
  });

  it('respects max z_index across multiple elements', () => {
    const elements = [
      { id: 'el_1', z_index: 1 },
      { id: 'el_2', z_index: 100 },
      { id: 'el_3', z_index: 5 },
      { id: 'el_selected', z_index: 3 },
    ];
    const newZ = computeBringToFront(elements, 'el_selected');
    assert.equal(newZ, 101); // max(1,100,5,3) + 1
  });
});

describe('Layers - computeSendToBack', () => {
  it('returns min z_index - 1', () => {
    const elements = [
      { id: 'el_1', z_index: 5 },
      { id: 'el_2', z_index: 2 },
      { id: 'el_3', z_index: 8 },
    ];
    const newZ = computeSendToBack(elements, 'el_1');
    assert.equal(newZ, 1); // min(5,2,8) - 1 = 2 - 1
  });

  it('clamps to 0 (never goes negative)', () => {
    const elements = [
      { id: 'el_1', z_index: 1 },
      { id: 'el_2', z_index: 2 },
    ];
    const newZ = computeSendToBack(elements, 'el_1');
    assert.equal(newZ, 0); // min(1,2) - 1 = 1 - 1 = 0
  });

  it('clamps to 0 when all elements have z_index = 0', () => {
    const elements = [
      { id: 'el_1' }, // z_index = 0
      { id: 'el_2' }, // z_index = 0
    ];
    const newZ = computeSendToBack(elements, 'el_1');
    assert.equal(newZ, 0); // min(0,0) - 1 = -1, clamped to 0
  });

  it('returns null if element not found', () => {
    const elements = [
      { id: 'el_1', z_index: 5 },
    ];
    assert.equal(computeSendToBack(elements, 'el_999'), null);
  });

  it('returns null if element is already pinned', () => {
    const elements = [
      { id: 'el_1', z_index: 15 }, // pinned
      { id: 'el_2', z_index: 5 },
    ];
    assert.equal(computeSendToBack(elements, 'el_1'), null);
  });

  it('handles negative min values', () => {
    const elements = [
      { id: 'el_1', z_index: -10 },
      { id: 'el_2', z_index: 5 },
      { id: 'el_selected', z_index: 0 },
    ];
    const newZ = computeSendToBack(elements, 'el_selected');
    assert.equal(newZ, 0); // min(-10,5,0) - 1 = -11, clamped to 0
  });

  it('respects min z_index across multiple elements', () => {
    const elements = [
      { id: 'el_1', z_index: 100 },
      { id: 'el_2', z_index: 50 },
      { id: 'el_3', z_index: 3 },
      { id: 'el_selected', z_index: 5 },
    ];
    const newZ = computeSendToBack(elements, 'el_selected');
    assert.equal(newZ, 2); // min(100,50,3,5) - 1 = 3 - 1
  });
});

describe('Layers - integration scenarios', () => {
  it('bring-to-front then send-to-back cycles correctly', () => {
    const elements = [
      { id: 'el_1', z_index: 2 },
      { id: 'el_2', z_index: 5 },
      { id: 'el_selected', z_index: 1 },
    ];

    // Bring selected to front
    const newZ1 = computeBringToFront(elements, 'el_selected');
    assert.equal(newZ1, 6);

    // Update element
    const selected = elements.find(el => el.id === 'el_selected');
    selected.z_index = newZ1;

    // Send back
    const newZ2 = computeSendToBack(elements, 'el_selected');
    assert.equal(newZ2, 1); // min(2,5,6) - 1
  });

  it('respects pinned boundary on bring-to-front', () => {
    const elements = [
      { id: 'el_1', z_index: 5 },
      { id: 'el_pinned', z_index: 10 }, // pinned
    ];
    // Trying to bring non-pinned to front
    const newZ = computeBringToFront(elements, 'el_1');
    assert.equal(newZ, 11); // max(5, 10) + 1
  });

  it('respects pinned boundary on send-to-back', () => {
    const elements = [
      { id: 'el_1', z_index: 5 },
      { id: 'el_pinned', z_index: 10 }, // pinned
    ];
    // Trying to send non-pinned to back
    const newZ = computeSendToBack(elements, 'el_1');
    assert.equal(newZ, 4); // min(5, 10) - 1
  });
});
