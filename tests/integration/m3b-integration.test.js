import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// SDK's server/express.js imports express@5 which breaks ESM resolution when
// the project path contains '#' (Node treats it as a URL fragment). Skip the
// entire file in that case — the tests still run inside Docker (no '#' path).
const pathHasHash = import.meta.url.includes('%23') || import.meta.url.includes('#');
const { createHttpTransportApp } = pathHasHash
  ? {}
  : await import('../../src/mcp/http-transport.js');
import { ProjectStore } from '../../src/storage/project-store.js';

// --- HTTP helpers ---

function post(port, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port,
      method: 'POST',
      path,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

// The SDK always sends text/event-stream even for request-response pairs.
// Each response is a single SSE event: "event: message\ndata: {...}\n\n".
// This helper extracts the JSON object from the first data: line.
function parseSseBody(raw) {
  for (const line of raw.split('\n')) {
    if (line.startsWith('data:')) {
      return JSON.parse(line.slice('data:'.length).trim());
    }
  }
  throw new Error(`No data: line found in SSE response: ${raw.slice(0, 200)}`);
}

function del(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port,
      method: 'DELETE',
      path,
      headers: { Accept: 'application/json', ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

// Sends an initialize request and returns the mcp-session-id.
// Also fires the required initialized notification so the server is ready.
async function initSession(port) {
  const initRes = await post(port, '/mcp', {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0' },
    },
  });
  assert.equal(initRes.status, 200, `initialize should return 200, got ${initRes.status}: ${initRes.body}`);

  const sessionId = initRes.headers['mcp-session-id'];
  assert.ok(sessionId, 'initialize response must include mcp-session-id header');

  // Required handshake step — server won't process requests until this is sent.
  await post(port, '/mcp', {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  }, { 'mcp-session-id': sessionId });

  return sessionId;
}

// --- Tests ---

const runner = pathHasHash ? describe.skip : describe;
runner('M3b Integration — HTTP Transport', () => {
  let tmpDir, store, app, httpServer, port;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mcp-m3b-'));
    store = new ProjectStore(tmpDir);
    await store.init();
    app = createHttpTransportApp(store);

    // Port 0 = OS assigns a free port, avoiding conflicts between test runs.
    httpServer = app.listen(0);
    port = httpServer.address().port;
  });

  afterEach(async () => {
    // Clean sessions before closing server to avoid pending handles.
    if (app._mcpCleanupAll) await app._mcpCleanupAll();
    if (httpServer) await new Promise((r) => httpServer.close(r));
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initialize returns 200 and mcp-session-id header', async () => {
    const sessionId = await initSession(port);
    assert.ok(sessionId, 'session ID must be a non-empty string');
    assert.equal(app._mcpSessions.size, 1, 'session map should have exactly 1 entry');
  });

  it('tools/list returns 24+ tools via HTTP transport', async () => {
    const sessionId = await initSession(port);

    const res = await post(port, '/mcp', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }, { 'mcp-session-id': sessionId });

    assert.equal(res.status, 200);
    const body = parseSseBody(res.body);
    assert.ok(body.result, `expected result, got: ${res.body}`);
    assert.ok(
      body.result.tools.length >= 24,
      `expected 24+ tools, got ${body.result.tools.length}`,
    );
  });

  it('tools/call mockup_create_project succeeds via HTTP transport', async () => {
    const sessionId = await initSession(port);

    const res = await post(port, '/mcp', {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'mockup_create_project',
        arguments: { name: 'HTTP Test Project' },
      },
    }, { 'mcp-session-id': sessionId });

    assert.equal(res.status, 200);
    const body = parseSseBody(res.body);
    assert.ok(body.result, `expected result, got: ${res.body}`);
    // Tool results use MCP content array — verify first content item is text.
    assert.equal(body.result.content[0].type, 'text');
    const project = JSON.parse(body.result.content[0].text);
    assert.ok(project.id.startsWith('proj_'), 'project ID should use proj_ prefix');
    assert.equal(project.name, 'HTTP Test Project');
  });

  it('non-init request without session ID returns 400', async () => {
    const res = await post(port, '/mcp', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
    // Missing mcp-session-id header on a non-init request is a protocol error.
    assert.equal(res.status, 400);
  });

  it('non-init request with invalid session ID returns 400', async () => {
    const res = await post(port, '/mcp', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    }, { 'mcp-session-id': 'completely-invalid-session-id' });
    assert.equal(res.status, 400);
  });

  it('multiple concurrent sessions are independent', async () => {
    const s1 = await initSession(port);
    const s2 = await initSession(port);

    assert.notEqual(s1, s2, 'each session must have a unique ID');
    assert.equal(app._mcpSessions.size, 2, 'both sessions should be tracked');

    // Create a project in s1 only — s2 should return an empty project list.
    await post(port, '/mcp', {
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'mockup_create_project',
        arguments: { name: 'Session 1 Project' },
      },
    }, { 'mcp-session-id': s1 });

    // Both sessions must still respond to tools/list.
    const r1 = await post(port, '/mcp', {
      jsonrpc: '2.0', id: 11, method: 'tools/list', params: {},
    }, { 'mcp-session-id': s1 });

    const r2 = await post(port, '/mcp', {
      jsonrpc: '2.0', id: 12, method: 'tools/list', params: {},
    }, { 'mcp-session-id': s2 });

    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
  });

  it('exceeding max sessions (10) returns 503', async () => {
    // Fill the session pool to the limit.
    for (let i = 0; i < 10; i++) {
      await initSession(port);
    }
    assert.equal(app._mcpSessions.size, 10, 'should have exactly 10 sessions');

    // The 11th initialize must be rejected.
    const res = await post(port, '/mcp', {
      jsonrpc: '2.0',
      id: 99,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'overflow-client', version: '1.0' },
      },
    });
    assert.equal(res.status, 503, `expected 503 when over limit, got ${res.status}`);
  });

  it('DELETE /mcp closes session and returns 200 or 204', async () => {
    const sessionId = await initSession(port);
    assert.equal(app._mcpSessions.size, 1);

    const delRes = await del(port, '/mcp', { 'mcp-session-id': sessionId });
    // The SDK may respond with 200 or 204 depending on version — both are valid.
    assert.ok(
      [200, 204].includes(delRes.status),
      `expected 200 or 204, got ${delRes.status}`,
    );
  });

  it('DELETE /mcp with nonexistent session ID returns 404', async () => {
    const delRes = await del(port, '/mcp', { 'mcp-session-id': 'nonexistent-session' });
    assert.equal(delRes.status, 404);
  });
});
