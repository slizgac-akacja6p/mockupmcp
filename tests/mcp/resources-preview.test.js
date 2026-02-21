import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PreviewCache } from '../../src/mcp/resources.js';

describe('PreviewCache', () => {
  it('returns null on cache miss', () => {
    const cache = new PreviewCache();
    assert.equal(cache.get('proj_1', 'scr_1', []), null);
  });

  it('stores and retrieves cached PNG', () => {
    const cache = new PreviewCache();
    const elements = [{ type: 'button', x: 0, y: 0 }];
    const png = Buffer.from('fake-png');
    cache.set('proj_1', 'scr_1', elements, png);
    assert.deepEqual(cache.get('proj_1', 'scr_1', elements), png);
  });

  it('invalidates on element change', () => {
    const cache = new PreviewCache();
    const elements1 = [{ type: 'button', x: 0, y: 0 }];
    const elements2 = [{ type: 'button', x: 10, y: 0 }];
    cache.set('proj_1', 'scr_1', elements1, Buffer.from('png1'));
    assert.equal(cache.get('proj_1', 'scr_1', elements2), null);
  });

  it('handles different screens independently', () => {
    const cache = new PreviewCache();
    const elements = [{ type: 'text' }];
    cache.set('proj_1', 'scr_1', elements, Buffer.from('png-a'));
    cache.set('proj_1', 'scr_2', elements, Buffer.from('png-b'));
    assert.deepEqual(cache.get('proj_1', 'scr_1', elements), Buffer.from('png-a'));
    assert.deepEqual(cache.get('proj_1', 'scr_2', elements), Buffer.from('png-b'));
  });
});
