import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ToolbarState } from '../../../src/preview/editor/toolbar-state.js';

describe('ToolbarState', () => {
  it('starts in view mode', () => {
    const state = new ToolbarState();
    assert.equal(state.mode, 'view');
    assert.equal(state.snapToGrid, true);
  });

  it('toggles to edit mode', () => {
    const state = new ToolbarState();
    state.setMode('edit');
    assert.equal(state.mode, 'edit');
  });

  it('toggles snap to grid', () => {
    const state = new ToolbarState();
    state.toggleSnap();
    assert.equal(state.snapToGrid, false);
  });

  it('emits mode change events', () => {
    const state = new ToolbarState();
    let received = null;
    state.on('modeChange', (mode) => { received = mode; });
    state.setMode('edit');
    assert.equal(received, 'edit');
  });
});
