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
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

describe('screen fragment endpoint', () => {
  let tmpDir, server, port, projectId, screenId;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'preview-trans-'));

    // Override config.dataDir so startPreviewServer picks up the isolated temp
    // directory instead of the real Docker volume.
    const origDataDir = config.dataDir;
    config.dataDir = tmpDir;

    const store = new ProjectStore(tmpDir);
    await store.init();

    const project = await store.createProject(
      'Test',
      '',
      { width: 393, height: 852, preset: 'mobile' },
    );
    projectId = project.id;

    const screen = await store.addScreen(project.id, 'Home', 393, 852, '#FFFFFF');
    screenId = screen.id;

    await store.addElement(project.id, screen.id, 'text', 0, 0, 200, 40, { content: 'Hello' });

    server = startPreviewServer(0);
    port = server.address().port;

    // Restore original after server is created (server captured tmpDir via config at creation time).
    config.dataDir = origDataDir;
  });

  afterEach(async () => {
    if (server) await new Promise(r => server.close(r));
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /api/screen-fragment returns HTML fragment without doctype', async () => {
    const res = await get(port, `/api/screen-fragment/${projectId}/${screenId}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('class="screen"'), 'should have .screen div');
    assert.ok(!res.body.includes('<!DOCTYPE'), 'should NOT be full HTML document');
    assert.ok(!res.body.includes('<html'), 'should NOT have html tag');
  });

  it('fragment endpoint returns 404 for unknown screen', async () => {
    const res = await get(port, `/api/screen-fragment/${projectId}/scr_nonexistent`);
    assert.equal(res.status, 404);
  });

  it('fragment contains rendered element content', async () => {
    const res = await get(port, `/api/screen-fragment/${projectId}/${screenId}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('Hello'), 'should contain element text');
  });
});

describe('preview page transition support', () => {
  let tmpDir, server, port, projectId, screenId;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'preview-trans2-'));
    const origDataDir = config.dataDir;
    config.dataDir = tmpDir;

    const store = new ProjectStore(tmpDir);
    await store.init();

    const project = await store.createProject(
      'NavTest',
      '',
      { width: 393, height: 852, preset: 'mobile' },
    );
    projectId = project.id;

    const s1 = await store.addScreen(project.id, 'Home', 393, 852, '#FFFFFF');
    screenId = s1.id;

    const s2 = await store.addScreen(project.id, 'Detail', 393, 852, '#FFFFFF');

    await store.addElement(project.id, s1.id, 'button', 0, 0, 100, 40, {
      label: 'Go',
    });
    // Add link to the button element
    const updatedProject = await store.getProject(project.id);
    const btn = updatedProject.screens[0].elements[0];
    if (btn && store.addLink) {
      try { await store.addLink(project.id, s1.id, btn.id, s2.id, 'push'); } catch (_) {}
    }

    server = startPreviewServer(0);
    port = server.address().port;
    config.dataDir = origDataDir;
  });

  afterEach(async () => {
    if (server) await new Promise(r => server.close(r));
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('preview HTML contains transition CSS classes', async () => {
    const res = await get(port, `/preview/${projectId}/${screenId}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('transition-container'), 'should have transition container CSS');
  });

  it('preview HTML uses fetch for navigation instead of redirect', async () => {
    const res = await get(port, `/preview/${projectId}/${screenId}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('fetch('), 'should use fetch for navigation');
    assert.ok(!res.body.includes("window.location.href = '/preview/'"), 'should NOT use redirect');
  });

  it('preview HTML contains history.pushState for URL management', async () => {
    const res = await get(port, `/preview/${projectId}/${screenId}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('history.pushState'), 'should manage browser history');
  });

  it('preview HTML has CSS for all transition types', async () => {
    const res = await get(port, `/preview/${projectId}/${screenId}`);
    const body = res.body;
    assert.ok(body.includes('trans-push'), 'should have push transition CSS');
    assert.ok(body.includes('trans-fade'), 'should have fade transition CSS');
    assert.ok(body.includes('trans-slide-up'), 'should have slide-up transition CSS');
  });
});
