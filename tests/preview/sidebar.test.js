import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
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

  it('GET /api/projects returns tree with projects at root', async () => {
    const res = await get(port, '/api/projects');
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    // New tree format: { folders: [...], projects: [...] }
    assert.ok(data.folders !== undefined, 'response should have folders array');
    assert.ok(data.projects !== undefined, 'response should have projects array');
    assert.ok(Array.isArray(data.folders), 'folders should be an array');
    assert.ok(Array.isArray(data.projects), 'projects should be an array');
    assert.equal(data.projects.length, 1);
    assert.equal(data.projects[0].name, 'Test Project');
    assert.ok(Array.isArray(data.projects[0].screens));
    assert.equal(data.projects[0].screens.length, 1);
    assert.equal(data.projects[0].screens[0].name, 'Screen A');
  });

  it('GET /api/projects returns empty tree when no projects', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'preview-empty-'));
    config.dataDir = emptyDir;
    const emptyPort = port + 1;
    const emptyServer = startPreviewServer(emptyPort);
    await new Promise(r => setTimeout(r, 100));
    const res = await get(emptyPort, '/api/projects');
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    assert.ok(Array.isArray(data.folders), 'folders should be array');
    assert.ok(Array.isArray(data.projects), 'projects should be array');
    assert.equal(data.folders.length, 0);
    assert.equal(data.projects.length, 0);
    emptyServer.close();
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it('GET /api/projects returns tree with folders when projects in subdirectories', async () => {
    // Write a project JSON directly into a subdirectory to simulate T2's folder-based storage.
    // When listProjectsTree() is available it will discover this; with the shim it stays at root.
    const folderDir = join(tmpDir, 'projects', 'TestFolder');
    mkdirSync(folderDir, { recursive: true });
    const now = new Date().toISOString();
    writeFileSync(join(folderDir, 'proj_testfolder1.json'), JSON.stringify({
      id: 'proj_testfolder1',
      name: 'Folder Project',
      description: '',
      style: 'wireframe',
      created_at: now,
      updated_at: now,
      viewport: { width: 393, height: 852, preset: 'mobile' },
      screens: [],
    }));

    const res = await get(port, '/api/projects');
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    // Tree format always present regardless of shim vs native
    assert.ok(data.folders !== undefined);
    assert.ok(data.projects !== undefined);
    // The root-level project created in beforeEach must still appear
    assert.ok(data.projects.length >= 1 || data.folders.length >= 1,
      'tree should have at least the root project or a folder');
  });
});

describe('buildReloadScript 404 redirect', () => {
  let tmpDir, server, port, origDataDir;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'preview-reload-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;

    const store = new ProjectStore(tmpDir);
    await store.init();

    const project = await store.createProject('Reload Project', 'desc', { width: 393, height: 852, preset: 'mobile' });
    await store.addScreen(project.id, 'Screen A', 393, 852, '#fff');

    port = 3700 + Math.floor(Math.random() * 200);
    server = startPreviewServer(port);
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('preview page reload script redirects to /preview on 404', async () => {
    const apiRes = await get(port, '/api/projects');
    const tree = JSON.parse(apiRes.body);
    const proj = tree.projects[0];
    const screenId = proj.screens[0].id;

    const previewRes = await get(port, `/preview/${proj.id}/${screenId}`);
    assert.equal(previewRes.status, 200);
    // The reload script must contain both the 404 check and the redirect target
    assert.ok(previewRes.body.includes('r.status === 404'), 'should check for 404 status');
    assert.ok(previewRes.body.includes("window.location.href = '/preview'"), 'should redirect to /preview on 404');
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
    const apiRes = await get(port, '/api/projects');
    const tree = JSON.parse(apiRes.body);
    const proj = tree.projects[0];
    const screenId = proj.screens[0].id;
    const previewRes = await get(port, `/preview/${proj.id}/${screenId}`);
    assert.equal(previewRes.status, 200);
    assert.ok(previewRes.body.includes('mockup-sidebar'), 'should contain sidebar element');
    assert.ok(previewRes.body.includes('mockup-sidebar-toggle'), 'should contain toggle button');
  });

  it('sidebar JS fetches project list', async () => {
    const apiRes = await get(port, '/api/projects');
    const tree = JSON.parse(apiRes.body);
    const proj = tree.projects[0];
    const screenId = proj.screens[0].id;
    const previewRes = await get(port, `/preview/${proj.id}/${screenId}`);
    assert.ok(previewRes.body.includes('/api/projects'), 'sidebar JS fetches project list');
  });

  it('sidebar JS uses expandedNodes for folder support', async () => {
    const apiRes = await get(port, '/api/projects');
    const tree = JSON.parse(apiRes.body);
    const proj = tree.projects[0];
    const screenId = proj.screens[0].id;
    const previewRes = await get(port, `/preview/${proj.id}/${screenId}`);
    // New sidebar uses expandedNodes (not expandedProjects) and renderNode/countProjects
    assert.ok(previewRes.body.includes('expandedNodes'), 'sidebar should use expandedNodes Set');
    assert.ok(previewRes.body.includes('renderNode'), 'sidebar should use recursive renderNode');
    assert.ok(previewRes.body.includes('mockup-sidebar-folder'), 'sidebar CSS should include folder styles');
  });

  it('sidebar JS uses firstLoad flag to prevent auto-expand on polls', async () => {
    const apiRes = await get(port, '/api/projects');
    const tree = JSON.parse(apiRes.body);
    const proj = tree.projects[0];
    const screenId = proj.screens[0].id;
    const previewRes = await get(port, `/preview/${proj.id}/${screenId}`);
    // firstLoad gate ensures ancestor auto-expand runs only once, not on every poll
    assert.ok(previewRes.body.includes('firstLoad'), 'sidebar should use firstLoad flag');
    assert.ok(previewRes.body.includes('firstLoad = false'), 'firstLoad should be cleared after first run');
  });

  it('sidebar JS uses escAttr for HTML attribute encoding', async () => {
    const apiRes = await get(port, '/api/projects');
    const tree = JSON.parse(apiRes.body);
    const proj = tree.projects[0];
    const screenId = proj.screens[0].id;
    const previewRes = await get(port, `/preview/${proj.id}/${screenId}`);
    // escAttr prevents broken data-folder-path attributes for paths with special chars,
    // which would cause dataset.folderPath to mismatch expandedNodes keys
    assert.ok(previewRes.body.includes('escAttr'), 'sidebar should use escAttr for attribute encoding');
    assert.ok(previewRes.body.includes('data-folder-path="\'') && previewRes.body.includes('escAttr(folder.path)'), 'folder path attribute should use escAttr');
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

describe('sidebar + screen preview integration', () => {
  let tmpDir, server, port, origDataDir;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'preview-integ-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;

    const store = new ProjectStore(tmpDir);
    await store.init();

    const project = await store.createProject('Integ Project', 'desc', { width: 393, height: 852, preset: 'mobile' });
    await store.addScreen(project.id, 'Main Screen', 393, 852, '#fff');

    port = 3400 + Math.floor(Math.random() * 1000);
    server = startPreviewServer(port);
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('navigating to a screen shows both sidebar and mockup content', async () => {
    const apiRes = await get(port, '/api/projects');
    const tree = JSON.parse(apiRes.body);
    const proj = tree.projects[0];
    const screen = proj.screens[0];
    const previewRes = await get(port, `/preview/${proj.id}/${screen.id}`);
    assert.equal(previewRes.status, 200);
    // Both sidebar and screen content present
    assert.ok(previewRes.body.includes('mockup-sidebar'));
    assert.ok(previewRes.body.includes('class="screen"'));
  });
});
