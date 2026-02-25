import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../../../src/storage/project-store.js';
import { startPreviewServer } from '../../../src/preview/server.js';
import { config } from '../../../src/config.js';

function request(port, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port, path, method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data, json: () => JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

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

describe('POST /api/projects/:pid/screens/:sid/approve', () => {
  let tmpDir, server, port, origDataDir, projectId, screenId;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'approval-api-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;

    const store = new ProjectStore(tmpDir);
    await store.init();
    const proj = await store.createProject('Test Project');
    projectId = proj.id;
    const scr = await store.addScreen(projectId, 'Main');
    screenId = scr.id;
    await store.addElement(projectId, screenId, 'button', 10, 20, 120, 44, { label: 'OK' });

    port = 3100 + Math.floor(Math.random() * 1000);
    server = startPreviewServer(port);
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('action=accept sets screen status to approved', async () => {
    const res = await request(
      port, 'POST',
      `/api/projects/${projectId}/screens/${screenId}/approve`,
      { action: 'accept' }
    );
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.status, 'accepted');
    assert.equal(data.approved, true);

    // Verify persistence: screen.status should be 'approved' in the store
    const store = new ProjectStore(tmpDir);
    await store.init();
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === screenId);
    assert.equal(screen.status, 'approved');
  });

  it('action=accept_with_comments keeps status draft and returns comments', async () => {
    // Add comments to the screen via store first
    const store = new ProjectStore(tmpDir);
    await store.init();
    await store.updateScreen(projectId, screenId, {
      comments: [
        { id: 'cmt_1', text: 'Fix alignment', resolved: false },
        { id: 'cmt_2', text: 'Already fixed', resolved: true },
      ],
    });

    const res = await request(
      port, 'POST',
      `/api/projects/${projectId}/screens/${screenId}/approve`,
      { action: 'accept_with_comments' }
    );
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.status, 'accepted_with_comments');
    assert.ok(Array.isArray(data.comments));
    // Only unresolved comments returned
    assert.equal(data.comments.length, 1);
    assert.equal(data.comments[0].id, 'cmt_1');

    // Verify persistence: status stays 'draft'
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === screenId);
    assert.equal(screen.status, 'draft');
  });

  it('action=reject sets status to rejected and returns reason', async () => {
    const res = await request(
      port, 'POST',
      `/api/projects/${projectId}/screens/${screenId}/approve`,
      { action: 'reject', reason: 'Needs more contrast' }
    );
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.status, 'rejected');
    assert.equal(data.reason, 'Needs more contrast');

    // Verify persistence: screen.status should be 'rejected'
    const store = new ProjectStore(tmpDir);
    await store.init();
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === screenId);
    assert.equal(screen.status, 'rejected');
  });

  it('invalid action returns 400', async () => {
    const res = await request(
      port, 'POST',
      `/api/projects/${projectId}/screens/${screenId}/approve`,
      { action: 'invalid_action' }
    );
    assert.equal(res.status, 400);
    const data = res.json();
    assert.ok(data.error.includes('Invalid action'));
  });

  it('nonexistent screen returns 404', async () => {
    const res = await request(
      port, 'POST',
      `/api/projects/${projectId}/screens/scr_nonexistent/approve`,
      { action: 'accept' }
    );
    assert.equal(res.status, 404);
  });
});
