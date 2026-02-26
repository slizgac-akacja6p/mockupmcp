import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, invertOperation } from '../../../src/preview/editor/history.js';
import { buildUpdatePayload } from '../../../src/preview/editor/property-panel.js';

describe('createHistory', () => {
  it('canUndo is false on empty stack', () => {
    const h = createHistory();
    assert.equal(h.canUndo(), false);
  });

  it('canRedo is false on empty stack', () => {
    const h = createHistory();
    assert.equal(h.canRedo(), false);
  });

  it('canUndo is true after push', () => {
    const h = createHistory();
    h.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 10 } });
    assert.equal(h.canUndo(), true);
  });

  it('canRedo is false after push (no undo yet)', () => {
    const h = createHistory();
    h.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 10 } });
    assert.equal(h.canRedo(), false);
  });

  it('canRedo is true after undo', () => {
    const h = createHistory();
    h.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 10 } });
    h.undo();
    assert.equal(h.canRedo(), true);
    assert.equal(h.canUndo(), false);
  });

  it('redo after undo restores canUndo=true', () => {
    const h = createHistory();
    h.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 10 } });
    h.undo();
    h.redo();
    assert.equal(h.canUndo(), true);
    assert.equal(h.canRedo(), false);
  });

  it('push after undo clears redo stack', () => {
    const h = createHistory();
    h.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 10 } });
    h.undo();
    h.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 5 } });
    assert.equal(h.canRedo(), false);
  });

  it('evicts oldest entries when maxSize is exceeded', () => {
    const h = createHistory(3);
    for (let i = 0; i < 5; i++) {
      h.push({ type: 'move', elementId: 'el_1', before: { x: i }, after: { x: i + 1 } });
    }
    assert.equal(h.size().undo, 3);
  });

  it('update operation is pushed and can be undone', () => {
    const h = createHistory();
    h.push({ type: 'update', elementId: 'el_1', before: { label: 'Old' }, after: { label: 'New' } });
    assert.equal(h.canUndo(), true);
    const op = h.undo();
    assert.equal(op.type, 'update');
    assert.deepEqual(op.before, { label: 'Old' });
    assert.deepEqual(op.after, { label: 'New' });
  });
});

describe('invertOperation', () => {
  it('inverts move by swapping before/after', () => {
    const op = { type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 10 } };
    const inv = invertOperation(op);
    assert.equal(inv.type, 'move');
    assert.deepEqual(inv.before, { x: 10 });
    assert.deepEqual(inv.after, { x: 0 });
  });

  it('inverts update by swapping before/after', () => {
    const op = { type: 'update', elementId: 'el_1', before: { label: 'Old' }, after: { label: 'New' } };
    const inv = invertOperation(op);
    assert.equal(inv.type, 'update');
    // Undo should apply op.after = 'Old' (the inverse's "after" is the before snapshot)
    assert.deepEqual(inv.after, { label: 'Old' });
    assert.deepEqual(inv.before, { label: 'New' });
  });

  it('inverts add to delete', () => {
    const op = { type: 'add', elementId: 'el_1', before: null, after: { type: 'button', x: 0 } };
    const inv = invertOperation(op);
    assert.equal(inv.type, 'delete');
    assert.equal(inv.after, null);
  });

  it('inverts delete to add', () => {
    const op = { type: 'delete', elementId: 'el_1', before: { type: 'button', x: 0 }, after: null };
    const inv = invertOperation(op);
    assert.equal(inv.type, 'add');
    assert.deepEqual(inv.after, { type: 'button', x: 0 });
  });
});

describe('buildUpdatePayload with update snapshots', () => {
  it('wraps non-position fields into properties', () => {
    const changes = { label: 'New text', color: '#ff0000' };
    const payload = buildUpdatePayload(changes);
    assert.deepEqual(payload, { properties: { label: 'New text', color: '#ff0000' } });
  });

  it('keeps position fields at top level', () => {
    const changes = { x: 10, y: 20, width: 100, height: 50 };
    const payload = buildUpdatePayload(changes);
    assert.equal(payload.x, 10);
    assert.equal(payload.y, 20);
    assert.equal(payload.width, 100);
    assert.equal(payload.height, 50);
    assert.equal(payload.properties, undefined);
  });

  it('splits mixed position and property fields', () => {
    const changes = { x: 5, label: 'Hello' };
    const payload = buildUpdatePayload(changes);
    assert.equal(payload.x, 5);
    assert.deepEqual(payload.properties, { label: 'Hello' });
  });

  // Verifies the undo path: invertOperation swaps before/after, then
  // applyOperation calls buildUpdatePayload(op.after) with the before snapshot.
  it('inverse update payload restores original property values', () => {
    const before = { label: 'Old' };
    const after  = { label: 'New' };
    const op = { type: 'update', elementId: 'el_1', before, after };
    const inv = invertOperation(op);

    // applyOperation calls buildUpdatePayload(inv.after) = buildUpdatePayload(before)
    const payload = buildUpdatePayload(inv.after);
    assert.deepEqual(payload, { properties: { label: 'Old' } });
  });
});
