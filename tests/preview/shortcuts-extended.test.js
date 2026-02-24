import { test } from 'node:test';
import assert from 'node:assert';
import { matchShortcut, isInputFocused, SHORTCUT_MAP } from '../../src/preview/editor/shortcuts.js';

test('matchShortcut: addButton (B without meta)', () => {
  const event = { key: 'b', metaKey: false, ctrlKey: false, shiftKey: false };
  assert.strictEqual(matchShortcut(event), 'addButton');
});

test('matchShortcut: addInput (I without meta)', () => {
  const event = { key: 'i', metaKey: false, ctrlKey: false, shiftKey: false };
  assert.strictEqual(matchShortcut(event), 'addInput');
});

test('matchShortcut: addCard (C without meta)', () => {
  const event = { key: 'c', metaKey: false, ctrlKey: false, shiftKey: false };
  assert.strictEqual(matchShortcut(event), 'addCard');
});

test('matchShortcut: addText (T without meta)', () => {
  const event = { key: 't', metaKey: false, ctrlKey: false, shiftKey: false };
  assert.strictEqual(matchShortcut(event), 'addText');
});

test('matchShortcut: addRect (R without meta)', () => {
  const event = { key: 'r', metaKey: false, ctrlKey: false, shiftKey: false };
  assert.strictEqual(matchShortcut(event), 'addRect');
});

test('matchShortcut: copy (Cmd+C)', () => {
  const event = { key: 'c', metaKey: true, ctrlKey: false, shiftKey: false };
  assert.strictEqual(matchShortcut(event), 'copy');
});

test('matchShortcut: paste (Cmd+V)', () => {
  const event = { key: 'v', metaKey: true, ctrlKey: false, shiftKey: false };
  assert.strictEqual(matchShortcut(event), 'paste');
});

test('matchShortcut: copy takes precedence over addCard (Cmd+C not plain C)', () => {
  // Cmd+C should match 'copy' (which appears earlier in SHORTCUT_MAP),
  // not 'addCard' (plain C without meta)
  const event = { key: 'c', metaKey: true, ctrlKey: false, shiftKey: false };
  const action = matchShortcut(event);
  assert.strictEqual(action, 'copy');
  assert.notStrictEqual(action, 'addCard');
});

test('matchShortcut: no match for B with Cmd modifier', () => {
  const event = { key: 'b', metaKey: true, ctrlKey: false, shiftKey: false };
  assert.strictEqual(matchShortcut(event), null);
});

test('SHORTCUT_MAP includes all new component add shortcuts', () => {
  const addActions = ['addButton', 'addInput', 'addCard', 'addText', 'addRect', 'copy', 'paste'];
  const mapActions = SHORTCUT_MAP.map(sc => sc.action);
  for (const action of addActions) {
    assert(mapActions.includes(action), `${action} not found in SHORTCUT_MAP`);
  }
});

test('isInputFocused: function is exported', () => {
  assert.strictEqual(typeof isInputFocused, 'function');
});
