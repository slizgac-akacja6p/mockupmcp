import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UndoStack } from '../../../src/preview/editor/sync-state.js';

describe('UndoStack', () => {
  it('pushes and undoes', () => {
    const stack = new UndoStack();
    stack.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 100 } });
    const action = stack.undo();
    assert.equal(action.type, 'move');
    assert.deepEqual(action.before, { x: 0 });
  });

  it('redo after undo', () => {
    const stack = new UndoStack();
    stack.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 100 } });
    stack.undo();
    const action = stack.redo();
    assert.deepEqual(action.after, { x: 100 });
  });

  it('clears redo on new push', () => {
    const stack = new UndoStack();
    stack.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 100 } });
    stack.undo();
    stack.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 50 } });
    assert.equal(stack.redo(), null);
  });

  it('limits to maxSize', () => {
    const stack = new UndoStack(3);
    for (let i = 0; i < 5; i++) {
      stack.push({ type: 'move', i, before: {}, after: {} });
    }
    assert.equal(stack.size, 3);
  });

  it('returns null on empty undo', () => {
    const stack = new UndoStack();
    assert.equal(stack.undo(), null);
  });
});
