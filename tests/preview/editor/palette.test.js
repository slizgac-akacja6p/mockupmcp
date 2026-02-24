import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getPaletteCategories, getComponentDefaults } from '../../../src/preview/editor/palette-data.js';
import { loadRecent, pushRecent, filterComponents } from '../../../src/preview/editor/palette.js';

// ---------------------------------------------------------------------------
// palette-data.js tests (pre-existing, preserved)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// palette.js — pure logic tests
// ---------------------------------------------------------------------------

// Minimal localStorage stub so tests run in Node.js without a browser.
let _store = {};
const localStorageMock = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem(k, v) { _store[k] = v; },
  removeItem(k) { delete _store[k]; },
};

// Inject the stub before each test that touches localStorage.
beforeEach(() => {
  _store = {};
  // palette.js references localStorage at call-time, not module-load-time,
  // so patching global.localStorage here is sufficient.
  globalThis.localStorage = localStorageMock;
});

afterEach(() => {
  delete globalThis.localStorage;
});

describe('loadRecent', () => {
  it('returns empty array when nothing is stored', () => {
    const result = loadRecent();
    assert.deepEqual(result, []);
  });

  it('returns stored list', () => {
    localStorageMock.setItem('palette-recent', JSON.stringify(['button', 'input']));
    const result = loadRecent();
    assert.deepEqual(result, ['button', 'input']);
  });

  it('returns empty array on malformed JSON', () => {
    localStorageMock.setItem('palette-recent', '{{invalid}}');
    const result = loadRecent();
    assert.deepEqual(result, []);
  });
});

describe('pushRecent', () => {
  it('prepends type to empty list', () => {
    const result = pushRecent('button');
    assert.deepEqual(result, ['button']);
  });

  it('deduplicates existing type before prepend', () => {
    localStorageMock.setItem('palette-recent', JSON.stringify(['card', 'button', 'input']));
    const result = pushRecent('button');
    assert.deepEqual(result, ['button', 'card', 'input']);
  });

  it('limits list to 5 entries', () => {
    localStorageMock.setItem('palette-recent', JSON.stringify(['a', 'b', 'c', 'd', 'e']));
    const result = pushRecent('f');
    assert.equal(result.length, 5);
    assert.equal(result[0], 'f');
  });

  it('persists updated list to localStorage', () => {
    pushRecent('text');
    const stored = JSON.parse(localStorageMock.getItem('palette-recent'));
    assert.deepEqual(stored, ['text']);
  });
});

describe('filterComponents', () => {
  const COMPS = [
    { type: 'button',    label: 'Button' },
    { type: 'input',     label: 'Input' },
    { type: 'card',      label: 'Card' },
    { type: 'login_form', label: 'Login Form' },
  ];

  it('returns all when query is empty', () => {
    assert.equal(filterComponents(COMPS, '').length, 4);
  });

  it('returns all when query is whitespace', () => {
    assert.equal(filterComponents(COMPS, '   ').length, 4);
  });

  it('matches by label (case-insensitive)', () => {
    const result = filterComponents(COMPS, 'but');
    assert.equal(result.length, 1);
    assert.equal(result[0].type, 'button');
  });

  it('matches by type (case-insensitive)', () => {
    const result = filterComponents(COMPS, 'login');
    assert.equal(result.length, 1);
    assert.equal(result[0].type, 'login_form');
  });

  it('returns empty array for no match', () => {
    const result = filterComponents(COMPS, 'zzz');
    assert.equal(result.length, 0);
  });
});
