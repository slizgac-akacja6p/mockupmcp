import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getEditableProps } from '../../../src/preview/editor/inspector-schema.js';

describe('InspectorSchema', () => {
  it('returns editable props for button', () => {
    const props = getEditableProps('button');
    assert.ok(props.find(p => p.key === 'label'));
    assert.ok(props.find(p => p.key === 'variant'));
    assert.ok(props.find(p => p.key === 'size'));
  });

  it('includes position fields for all types', () => {
    const props = getEditableProps('text');
    assert.ok(props.find(p => p.key === 'x'));
    assert.ok(props.find(p => p.key === 'y'));
  });

  it('returns position fields for unknown type', () => {
    const props = getEditableProps('nonexistent');
    assert.ok(props.find(p => p.key === 'x'));
  });
});
