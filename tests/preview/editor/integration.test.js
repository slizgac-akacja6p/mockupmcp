import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../../../src/storage/project-store.js';
import { startPreviewServer } from '../../../src/preview/server.js';
import { config } from '../../../src/config.js';

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

describe('Editor integration', () => {
  let tmpDir, server, port, origDataDir, projectId, screenId;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'editor-int-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;
    const store = new ProjectStore(tmpDir);
    await store.init();
    const proj = await store.createProject('Test Project');
    projectId = proj.id;
    const scr = await store.addScreen(projectId, 'Main');
    screenId = scr.id;
    port = 3100 + Math.floor(Math.random() * 900);
    server = startPreviewServer(port);
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('editor page contains editor toolbar', async () => {
    const res = await get(port, `/editor/${projectId}/${screenId}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('id="editor-toolbar"'));
    assert.ok(res.body.includes('Preview'));
  });

  it('editor canvas and property panel are injected', async () => {
    const res = await get(port, `/editor/${projectId}/${screenId}`);
    assert.ok(res.body.includes('id="editor-canvas"'));
    assert.ok(res.body.includes('id="editor-property-panel"'));
  });

  it('editor canvas data attributes for projectId and screenId are injected', async () => {
    const res = await get(port, `/editor/${projectId}/${screenId}`);
    assert.ok(res.body.includes(`data-project-id="${projectId}"`));
    assert.ok(res.body.includes(`data-screen-id="${screenId}"`));
  });

  it('undo and redo buttons are present in the editor toolbar HTML', async () => {
    const res = await get(port, `/editor/${projectId}/${screenId}`);
    // Verify both buttons have their IDs so getElementById('btn-undo/redo') succeeds
    // at runtime — the buttons must be in the static HTML before initEditor runs.
    assert.ok(res.body.includes('id="btn-undo"'), 'btn-undo missing from editor HTML');
    assert.ok(res.body.includes('id="btn-redo"'), 'btn-redo missing from editor HTML');
    // Verify the module script that calls initEditor comes after the toolbar HTML
    const undoPos   = res.body.indexOf('id="btn-undo"');
    const modulePos = res.body.indexOf('type="module"');
    assert.ok(undoPos < modulePos, 'btn-undo must appear before the module script in HTML');
  });
});
