import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../../src/storage/project-store.js';
import { registerApprovalTools } from '../../src/mcp/tools/approval-tools.js';
import { editSessions } from '../../src/preview/routes/approval-api.js';
import { z } from 'zod';

// Lightweight mock server that captures tool registrations
class MockServer {
  constructor() { this.tools = new Map(); }
  tool(name, desc, schema, handler) {
    this.tools.set(name, { desc, schema, handler });
  }
  async callTool(name, params) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    const parsed = z.object(tool.schema).parse(params);
    return tool.handler(parsed);
  }
}

describe('mockup_await_approval', () => {
  let tmpDir, store, server, projectId, screenId;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'approval-tool-'));
    store = new ProjectStore(tmpDir);
    await store.init();
    server = new MockServer();
    registerApprovalTools(server, store);
    const proj = await store.createProject('Test');
    projectId = proj.id;
    const scr = await store.addScreen(projectId, 'Main');
    screenId = scr.id;
    await store.addElement(projectId, screenId, 'button', 10, 20, 120, 44, { label: 'OK' });
  });

  after(async () => {
    editSessions.clear();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns immediately when already approved', async () => {
    const key = `${projectId}/${screenId}`;
    editSessions.set(key, {
      approved: true,
      approvedAt: new Date().toISOString(),
      summary: 'no changes',
      snapshot: [],
    });
    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId,
      screen_id: screenId,
      timeout_seconds: 1,
    });
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.approved, true);
    assert.equal(data.summary, 'no changes');
    assert.equal(data.elementCount, 1);
    assert.ok(Array.isArray(data.elements));
    editSessions.clear();
  });

  it('times out when not approved', async () => {
    editSessions.clear();
    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId,
      screen_id: screenId,
      timeout_seconds: 1,
    });
    assert.equal(res.isError, true);
    assert.ok(res.content[0].text.includes('timeout'));
  });

  it('tool is registered with correct name', () => {
    assert.ok(server.tools.has('mockup_await_approval'));
  });
});
