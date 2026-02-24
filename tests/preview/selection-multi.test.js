import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findElementId,
  findElementInScreen,
  createSelectionState,
  initSelection,
  initBoxSelect,
} from '../../src/preview/editor/selection.js';

describe('Selection - createSelectionState', () => {
  it('select() replaces entire selection', () => {
    const state = createSelectionState();
    state.select('el_1');
    state.select('el_2');
    assert.deepEqual([...state.getSelectedIds()], ['el_2']);
  });

  it('addToSelection() adds to existing selection', () => {
    const state = createSelectionState();
    state.select('el_1');
    state.addToSelection('el_2');
    const ids = [...state.getSelectedIds()].sort();
    assert.deepEqual(ids, ['el_1', 'el_2']);
  });

  it('removeFromSelection() removes from selection', () => {
    const state = createSelectionState();
    state.selectAll(['el_1', 'el_2', 'el_3']);
    state.removeFromSelection('el_2');
    const ids = [...state.getSelectedIds()].sort();
    assert.deepEqual(ids, ['el_1', 'el_3']);
  });

  it('isSelected() returns correct value', () => {
    const state = createSelectionState();
    state.select('el_1');
    assert.equal(state.isSelected('el_1'), true);
    assert.equal(state.isSelected('el_2'), false);
  });

  it('count() returns correct number of selected items', () => {
    const state = createSelectionState();
    state.selectAll(['el_1', 'el_2', 'el_3']);
    assert.equal(state.count(), 3);
  });

  it('deselect() clears all selections', () => {
    const state = createSelectionState();
    state.selectAll(['el_1', 'el_2']);
    state.deselect();
    assert.equal(state.count(), 0);
  });

  it('getSelectedId() returns first or null (backward compat)', () => {
    const state = createSelectionState();
    assert.equal(state.getSelectedId(), null);

    state.select('el_1');
    const first = state.getSelectedId();
    assert.equal(first, 'el_1');

    state.addToSelection('el_2');
    // First should still be el_1 (Set iteration order = insertion order)
    assert.equal(state.getSelectedId(), 'el_1');
  });

  it('selectAll() sets multiple IDs', () => {
    const state = createSelectionState();
    state.selectAll(['el_1', 'el_2', 'el_3']);
    assert.equal(state.count(), 3);
    assert.equal(state.isSelected('el_1'), true);
    assert.equal(state.isSelected('el_2'), true);
    assert.equal(state.isSelected('el_3'), true);
  });

  it('getSelectedIds() returns a copy', () => {
    const state = createSelectionState();
    state.selectAll(['el_1', 'el_2']);
    const ids1 = state.getSelectedIds();
    const ids2 = state.getSelectedIds();
    assert.notEqual(ids1, ids2); // Different Set objects
    assert.deepEqual([...ids1], [...ids2]); // Same content
  });

  it('removes element and adds to selection independently', () => {
    const state = createSelectionState();
    state.selectAll(['el_1', 'el_2', 'el_3']);
    state.removeFromSelection('el_2');
    state.addToSelection('el_4');
    const ids = [...state.getSelectedIds()].sort();
    assert.deepEqual(ids, ['el_1', 'el_3', 'el_4']);
  });
});

describe('Selection - findElementInScreen', () => {
  it('finds element by ID in screen', () => {
    const screen = {
      elements: [
        { id: 'el_1', type: 'button' },
        { id: 'el_2', type: 'text' },
      ],
    };
    const result = findElementInScreen(screen, 'el_1');
    assert.deepEqual(result, { id: 'el_1', type: 'button' });
  });

  it('returns null when element not found', () => {
    const screen = {
      elements: [{ id: 'el_1', type: 'button' }],
    };
    const result = findElementInScreen(screen, 'el_999');
    assert.equal(result, null);
  });
});
