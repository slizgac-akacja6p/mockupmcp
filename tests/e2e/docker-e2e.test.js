// Docker E2E tests — requires Docker running on host.
// Tests: HTTP transport (port 3200), preview server (port 3100).
// Run: RUN_E2E=1 node --test tests/e2e/docker-e2e.test.js
// Skipped unless RUN_E2E=1 env var is set AND Docker is available.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// E2E tests only run when explicitly requested (slow: builds Docker image)
const runE2e = process.env.RUN_E2E === '1';

// Check Docker availability
let dockerAvailable = false;
if (runE2e) {
  try {
    execFileSync('docker', ['info'], { stdio: 'pipe', timeout: 5000 });
    dockerAvailable = true;
  } catch (_) {}
}

const IMAGE = 'mockupmcp:e2e-test';
const CONTAINER = 'mockupmcp-e2e';
const MCP_PORT = 3210;
const PREVIEW_PORT = 3110;

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf-8', timeout: 120_000 }).trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function mcpRequest(method, params = {}, sessionId = null) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params });
  const res = await fetch(`http://localhost:${MCP_PORT}/mcp`, { method: 'POST', headers, body });

  const text = await res.text();
  const sessionHeader = res.headers.get('mcp-session-id');

  // SDK returns text/event-stream (SSE) — parse data: lines
  const lines = text.split('\n').filter(l => l.startsWith('data: '));
  if (lines.length === 0) return { sessionId: sessionHeader, data: JSON.parse(text) };
  const lastData = lines[lines.length - 1].replace('data: ', '');
  return { sessionId: sessionHeader, data: JSON.parse(lastData) };
}

describe('Docker E2E', { skip: !dockerAvailable && 'RUN_E2E=1 not set or Docker unavailable', timeout: 180_000 }, () => {

  before(async () => {
    // Build image
    console.error('[E2E] Building Docker image...');
    execFileSync('docker', ['build', '-t', IMAGE, '.'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      timeout: 300_000,
    });

    // Stop/remove leftover container if exists
    try { docker('stop', CONTAINER); } catch (_) {}
    try { docker('rm', CONTAINER); } catch (_) {}

    // Start container
    console.error('[E2E] Starting container...');
    docker('run', '-d', '--name', CONTAINER,
      '-p', `${PREVIEW_PORT}:3100`,
      '-p', `${MCP_PORT}:3200`,
      '-e', 'MCP_TRANSPORT=both',
      IMAGE);

    // Wait for server readiness
    console.error('[E2E] Waiting for server...');
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://localhost:${PREVIEW_PORT}/`);
        if (res.ok || res.status === 404) break;
      } catch (_) {}
      await sleep(1000);
    }
    console.error('[E2E] Server ready');
  });

  after(() => {
    try { docker('stop', CONTAINER); } catch (_) {}
    try { docker('rm', CONTAINER); } catch (_) {}
  });

  describe('HTTP transport', () => {
    let sessionId;
    let projectId;
    let screenId;

    it('initializes MCP session', async () => {
      const { sessionId: sid, data } = await mcpRequest('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'e2e-test', version: '1.0.0' },
      });
      sessionId = sid;
      assert.ok(sessionId, 'Should return session ID');
      assert.equal(data.result.serverInfo.name, 'mockupmcp');
    });

    it('lists tools', async () => {
      const { data } = await mcpRequest('tools/list', {}, sessionId);
      // Use minimum threshold so test stays valid when new tools are added
      assert.ok(data.result.tools.length >= 34, `Expected at least 34 tools, got ${data.result.tools.length}`);
    });

    it('lists resources', async () => {
      const { data } = await mcpRequest('resources/list', {}, sessionId);
      const uris = data.result.resources.map(r => r.uri);
      assert.ok(uris.includes('mockup://projects'));
      assert.ok(uris.includes('mockup://templates'));
      assert.ok(uris.includes('mockup://components'));
    });

    it('creates a project via tool call', async () => {
      const { data } = await mcpRequest('tools/call', {
        name: 'mockup_create_project',
        arguments: { name: 'E2E Test App', description: 'Testing' },
      }, sessionId);
      const result = JSON.parse(data.result.content[0].text);
      projectId = result.id;
      assert.ok(projectId.startsWith('proj_'));
    });

    it('generates a screen from description', async () => {
      const { data } = await mcpRequest('tools/call', {
        name: 'mockup_generate_screen',
        arguments: { project_id: projectId, description: 'login screen with email and password' },
      }, sessionId);
      const result = JSON.parse(data.result.content[0].text);
      screenId = result.screen.id;
      assert.ok(screenId.startsWith('scr_'));
      assert.ok(result.screen.elements >= 5);
      assert.equal(result.match_info.template, 'login');
    });

    it('reads project resource', async () => {
      const { data } = await mcpRequest('resources/read', {
        uri: `mockup://projects/${projectId}`,
      }, sessionId);
      const project = JSON.parse(data.result.contents[0].text);
      assert.equal(project.name, 'E2E Test App');
      assert.equal(project.screens.length, 1);
    });

    it('exports screen as PNG', async () => {
      const { data } = await mcpRequest('tools/call', {
        name: 'mockup_export',
        arguments: { project_id: projectId, screen_id: screenId, format: 'png' },
      }, sessionId);
      // content[0] is a text confirmation, content[1] is the image with base64 data
      const textContent = data.result.content[0];
      assert.equal(textContent.type, 'text', 'First content item should be text');
      assert.ok(textContent.text.startsWith('Exported'), 'Text should be export confirmation');

      const imageContent = data.result.content[1];
      assert.equal(imageContent.type, 'image', 'Second content item should be image');
      assert.equal(imageContent.mimeType, 'image/png', 'Should be PNG mime type');
      assert.ok(imageContent.data.length > 100, 'Base64 image data should not be empty');
    });
  });

  describe('Preview server', () => {
    it('serves preview page', async () => {
      const res = await fetch(`http://localhost:${PREVIEW_PORT}/`);
      assert.equal(res.status, 200);
    });
  });
});
