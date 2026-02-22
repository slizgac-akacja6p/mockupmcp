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

describe('Elements REST API', () => {
  let tmpDir, server, port, origDataDir, projectId, screenId;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'editor-api-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;

    const store = new ProjectStore(tmpDir);
    await store.init();
    const proj = await store.createProject('Test Project');
    projectId = proj.id;
    const scr = await store.addScreen(projectId, 'Main');
    screenId = scr.id;
    await store.addElement(projectId, screenId, 'button', 10, 20, 120, 44, { label: 'Click' });

    port = 3100 + Math.floor(Math.random() * 1000);
    server = startPreviewServer(port);
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET returns elements array', async () => {
    const res = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/elements`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 1);
    assert.equal(data[0].type, 'button');
  });

  it('POST adds a new element', async () => {
    const res = await request(port, 'POST', `/api/screens/${projectId}/${screenId}/elements`, {
      type: 'text', x: 50, y: 60, width: 200, height: 30, properties: { content: 'Hello' },
    });
    assert.equal(res.status, 201);
    const el = res.json();
    assert.ok(el.id.startsWith('el_'));
    assert.equal(el.type, 'text');
  });

  it('PATCH updates element position and properties', async () => {
    const getRes = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/elements`);
    const elId = getRes.json()[0].id;
    const res = await request(port, 'PATCH', `/api/screens/${projectId}/${screenId}/elements/${elId}`, {
      x: 100, y: 200, properties: { label: 'Updated' },
    });
    assert.equal(res.status, 200);
    const el = res.json();
    assert.equal(el.x, 100);
    assert.equal(el.properties.label, 'Updated');
  });

  it('DELETE removes element', async () => {
    const getRes = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/elements`);
    const elId = getRes.json()[0].id;
    const res = await request(port, 'DELETE', `/api/screens/${projectId}/${screenId}/elements/${elId}`);
    assert.equal(res.status, 204);
    const listRes = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/elements`);
    assert.equal(listRes.json().length, 0);
  });

  it('GET returns 404 for invalid project', async () => {
    const res = await request(port, 'GET', `/api/screens/invalid/invalid/elements`);
    assert.equal(res.status, 404);
  });
});
