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

// Same as get() but does NOT follow redirects (http.request vs http.get)
function getRaw(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
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

describe('sidebar injection', () => {
  let tmpDir, server, port, origDataDir;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'preview-sidebar-inj-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;

    const store = new ProjectStore(tmpDir);
    await store.init();

    const project = await store.createProject('Test Project', 'desc', { width: 393, height: 852, preset: 'mobile' });
    await store.addScreen(project.id, 'Screen A', 393, 852, '#fff');

    port = 3200 + Math.floor(Math.random() * 1000);
    server = startPreviewServer(port);
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('preview page contains sidebar HTML', async () => {
    const res = await get(port, '/api/projects');
    const projects = JSON.parse(res.body);
    const screenId = projects[0].screens[0].id;
    const previewRes = await get(port, `/preview/${projects[0].id}/${screenId}`);
    assert.equal(previewRes.status, 200);
    assert.ok(previewRes.body.includes('mockup-sidebar'), 'should contain sidebar element');
    assert.ok(previewRes.body.includes('mockup-sidebar-toggle'), 'should contain toggle button');
  });

  it('sidebar JS fetches project list', async () => {
    const res = await get(port, '/api/projects');
    const projects = JSON.parse(res.body);
    const screenId = projects[0].screens[0].id;
    const previewRes = await get(port, `/preview/${projects[0].id}/${screenId}`);
    assert.ok(previewRes.body.includes('/api/projects'), 'sidebar JS fetches project list');
  });
});

describe('landing page', () => {
  let tmpDir, server, port, origDataDir;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'preview-landing-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;

    const store = new ProjectStore(tmpDir);
    await store.init();
    await store.createProject('Test Project', 'desc', { width: 393, height: 852, preset: 'mobile' });

    port = 3300 + Math.floor(Math.random() * 1000);
    server = startPreviewServer(port);
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /preview returns landing page with sidebar', async () => {
    const res = await get(port, '/preview');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('mockup-sidebar'));
    assert.ok(res.body.includes('Select a screen'));
  });

  it('GET / redirects to /preview', async () => {
    const res = await getRaw(port, '/');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/preview');
  });
});
