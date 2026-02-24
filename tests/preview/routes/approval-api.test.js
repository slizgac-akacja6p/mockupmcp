import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('buildSummary helper', () => {
  // Unit-test the diff logic in isolation without spinning up a server.
  it('reports "no changes" when snapshot equals current', async () => {
    const { buildSummary } = await import('../../../src/preview/routes/approval-api.js');
    const els = [{ id: 'el_1', x: 0, y: 0, width: 100, height: 50 }];
    assert.equal(buildSummary(els, els), 'no changes');
  });

  it('counts added elements correctly', async () => {
    const { buildSummary } = await import('../../../src/preview/routes/approval-api.js');
    const before = [];
    const after = [{ id: 'el_1', x: 0, y: 0, width: 100, height: 50 }];
    assert.equal(buildSummary(before, after), '1 added');
  });

  it('counts deleted elements correctly', async () => {
    const { buildSummary } = await import('../../../src/preview/routes/approval-api.js');
    const before = [{ id: 'el_1', x: 0, y: 0, width: 100, height: 50 }];
    const after = [];
    assert.equal(buildSummary(before, after), '1 deleted');
  });

  it('counts moved/resized elements correctly', async () => {
    const { buildSummary } = await import('../../../src/preview/routes/approval-api.js');
    const before = [{ id: 'el_1', x: 0, y: 0, width: 100, height: 50 }];
    const after = [{ id: 'el_1', x: 10, y: 20, width: 100, height: 50 }];
    assert.equal(buildSummary(before, after), '1 moved');
  });

  it('combines multiple change types in summary', async () => {
    const { buildSummary } = await import('../../../src/preview/routes/approval-api.js');
    const before = [
      { id: 'el_1', x: 0, y: 0, width: 100, height: 50 },
      { id: 'el_2', x: 0, y: 0, width: 80, height: 40 },
    ];
    const after = [
      { id: 'el_1', x: 5, y: 5, width: 100, height: 50 }, // moved
      { id: 'el_3', x: 0, y: 0, width: 60, height: 30 },  // added
      // el_2 is deleted
    ];
    const summary = buildSummary(before, after);
    assert.ok(summary.includes('1 added'), `expected "1 added" in "${summary}"`);
    assert.ok(summary.includes('1 deleted'), `expected "1 deleted" in "${summary}"`);
    assert.ok(summary.includes('1 moved'), `expected "1 moved" in "${summary}"`);
  });
});
