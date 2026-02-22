import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../../../src/storage/project-store.js';
import { startPreviewServer } from '../../../src/preview/server.js';
import { config } from '../../../src/config.js';

// Thin HTTP helper used across all tests — returns status + lazily-parsed JSON.
function request(port, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data, json: () => JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Approval REST API', () => {
  let tmpDir, server, port, origDataDir, projectId, screenId;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'approval-api-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;

    const store = new ProjectStore(tmpDir);
    await store.init();
    const proj = await store.createProject('Test');
    projectId = proj.id;
    const scr = await store.addScreen(projectId, 'Main');
    screenId = scr.id;
    await store.addElement(projectId, screenId, 'button', 10, 20, 120, 44, { label: 'OK' });

    port = 3100 + Math.floor(Math.random() * 1000);
    server = startPreviewServer(port);
    // Give Express a moment to bind before sending requests.
    await new Promise((r) => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('POST /edit starts edit mode and snapshots elements', async () => {
    const res = await request(port, 'POST', `/api/screens/${projectId}/${screenId}/edit`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.editing, true);
    assert.equal(data.snapshotCount, 1);
  });

  it('GET /approval returns not-approved by default', async () => {
    const res = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/approval`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.approved, false);
    assert.equal(data.approvedAt, null);
  });

  it('POST /approve sets approved=true with non-empty approvedAt and summary', async () => {
    await request(port, 'POST', `/api/screens/${projectId}/${screenId}/edit`);
    const res = await request(port, 'POST', `/api/screens/${projectId}/${screenId}/approve`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.approved, true);
    assert.ok(data.approvedAt, 'approvedAt should be set');
    assert.equal(typeof data.summary, 'string', 'summary should be a string');
    assert.equal(data.elementCount, 1);
  });

  it('approval resets to false when a new edit session starts', async () => {
    await request(port, 'POST', `/api/screens/${projectId}/${screenId}/edit`);
    await request(port, 'POST', `/api/screens/${projectId}/${screenId}/approve`);
    // Starting a new edit must clear the approval flag.
    await request(port, 'POST', `/api/screens/${projectId}/${screenId}/edit`);
    const res = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/approval`);
    assert.equal(res.status, 200);
    assert.equal(res.json().approved, false);
  });
});

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
