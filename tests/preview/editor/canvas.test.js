import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CanvasState } from '../../../src/preview/editor/canvas-state.js';

describe('CanvasState', () => {
  it('selects element by id', () => {
    const state = new CanvasState();
    state.selectElement('el_1');
    assert.equal(state.selectedId, 'el_1');
  });

  it('deselects on null', () => {
    const state = new CanvasState();
    state.selectElement('el_1');
    state.selectElement(null);
    assert.equal(state.selectedId, null);
  });

  it('calculates snap position with snap enabled', () => {
    const state = new CanvasState();
    state.snapSize = 8;
    const result = state.snapPosition(13, 27);
    assert.equal(result.x, 16);
    assert.equal(result.y, 24);
  });

  it('returns raw position when snap disabled', () => {
    const state = new CanvasState();
    state.snapSize = 0;
    const result = state.snapPosition(13, 27);
    assert.equal(result.x, 13);
    assert.equal(result.y, 27);
  });

  it('tracks drag start and computes delta', () => {
    const state = new CanvasState();
    // Disable snap so we verify raw math: 50+(110-100)=60, 60+(215-200)=75
    state.snapSize = 0;
    state.startDrag(100, 200, { x: 50, y: 60 });
    const delta = state.computeDrag(110, 215);
    assert.equal(delta.x, 60);
    assert.equal(delta.y, 75);
  });

  it('emits select event', () => {
    const state = new CanvasState();
    let received = null;
    state.on('select', (id) => { received = id; });
    state.selectElement('el_1');
    assert.equal(received, 'el_1');
  });

  it('handles multi-select with shift', () => {
    const state = new CanvasState();
    state.selectElement('el_1');
    state.selectElement('el_2', true);
    assert.deepEqual([...state.selectedIds], ['el_1', 'el_2']);
  });
});
