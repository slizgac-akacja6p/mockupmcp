import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startPreviewServer } from '../../src/preview/server.js';
import { ProjectStore } from '../../src/storage/project-store.js';
import { config } from '../../src/config.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

describe('projects API', () => {
  let tmpDir, server, port, origDataDir;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'preview-sidebar-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;

    const store = new ProjectStore(tmpDir);
    await store.init();

    const project = await store.createProject('Test Project', 'desc', { width: 393, height: 852, preset: 'mobile' });
    await store.addScreen(project.id, 'Screen A', 393, 852, '#fff');

    port = 3100 + Math.floor(Math.random() * 1000);
    server = startPreviewServer(port);
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /api/projects returns JSON array with project and screens', async () => {
    const res = await get(port, '/api/projects');
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 1);
    assert.equal(data[0].name, 'Test Project');
    assert.ok(Array.isArray(data[0].screens));
    assert.equal(data[0].screens.length, 1);
    assert.equal(data[0].screens[0].name, 'Screen A');
  });

  it('GET /api/projects returns empty array when no projects', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'preview-empty-'));
    config.dataDir = emptyDir;
    const emptyPort = port + 1;
    const emptyServer = startPreviewServer(emptyPort);
    await new Promise(r => setTimeout(r, 100));
    const res = await get(emptyPort, '/api/projects');
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), []);
    emptyServer.close();
    rmSync(emptyDir, { recursive: true, force: true });
  });
});
