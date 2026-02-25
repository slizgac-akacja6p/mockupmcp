import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../../src/storage/project-store.js';
import { registerApprovalTools } from '../../src/mcp/tools/approval-tools.js';
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
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns immediately when already approved', async () => {
    // Set screen status to 'approved' via the store (new M23 flow)
    await store.updateScreen(projectId, screenId, { status: 'approved' });

    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId,
      screen_id: screenId,
      timeout_seconds: 1,
    });
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.status, 'accepted');
    assert.equal(data.approved, true);
    assert.equal(data.screen_id, screenId);

    // Reset for subsequent tests
    await store.updateScreen(projectId, screenId, { status: 'draft' });
  });

  it('times out when not approved', async () => {
    // Screen status is 'draft' — no approval action taken, should timeout
    await store.updateScreen(projectId, screenId, { status: 'draft', _approval_action: null });

    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId,
      screen_id: screenId,
      timeout_seconds: 1,
    });
    // New API returns timeout as a normal (non-error) response
    assert.equal(res.isError, undefined);
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.status, 'timeout');
    assert.equal(data.screen_id, screenId);
  });

  it('tool is registered with correct name', () => {
    assert.ok(server.tools.has('mockup_await_approval'));
  });

  // --- T7 new tests ---

  it('returns { status: "accepted", approved: true } when screen.status = "approved"', async () => {
    await store.updateScreen(projectId, screenId, { status: 'approved' });

    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId,
      screen_id: screenId,
      timeout_seconds: 1,
    });
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.status, 'accepted');
    assert.equal(data.approved, true);
    assert.equal(data.screen_id, screenId);
    assert.equal(res.isError, undefined);

    await store.updateScreen(projectId, screenId, { status: 'draft' });
  });

  it('returns { status: "accepted_with_comments" } when _approval_action = "accept_with_comments"', async () => {
    // Pre-set comments on the screen; _approval_action will be set asynchronously
    // after the tool clears any stale value and starts polling.
    const comments = [
      { id: 'cmt_1', element_id: 'el_abc', text: 'Change color', resolved: false, pin_number: 1 },
      { id: 'cmt_2', element_id: null, text: 'Already done', resolved: true },
    ];
    await store.updateScreen(projectId, screenId, {
      status: 'draft',
      _approval_action: null,
      comments,
    });

    // Simulate reviewer action arriving after the tool starts polling.
    // The tool clears _approval_action at startup, so we set it after a delay
    // to arrive during the polling window (poll interval is 2s).
    setTimeout(async () => {
      await store.updateScreen(projectId, screenId, { _approval_action: 'accept_with_comments' });
    }, 500);

    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId,
      screen_id: screenId,
      timeout_seconds: 5,
    });
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.status, 'accepted_with_comments');
    assert.equal(data.screen_id, screenId);
    // Only unresolved comments should be returned
    assert.equal(data.comments.length, 1);
    assert.equal(data.comments[0].id, 'cmt_1');
    assert.equal(data.comments[0].text, 'Change color');
    assert.equal(data.comments[0].element_id, 'el_abc');
    assert.equal(data.comments[0].pin_number, 1);

    // Clean up
    await store.updateScreen(projectId, screenId, { _approval_action: null, comments: [] });
  });

  it('returns { status: "rejected", reason } when screen.status = "rejected"', async () => {
    await store.updateScreen(projectId, screenId, {
      status: 'rejected',
      reject_reason: 'Too many buttons',
    });

    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId,
      screen_id: screenId,
      timeout_seconds: 1,
    });
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.status, 'rejected');
    assert.equal(data.reason, 'Too many buttons');
    assert.equal(data.screen_id, screenId);
    assert.equal(res.isError, undefined);

    // Clean up
    await store.updateScreen(projectId, screenId, { status: 'draft', reject_reason: undefined });
  });

  it('returns { status: "timeout" } after timeout_seconds', async () => {
    await store.updateScreen(projectId, screenId, { status: 'draft', _approval_action: null });

    const start = Date.now();
    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId,
      screen_id: screenId,
      timeout_seconds: 1,
    });
    const elapsed = Date.now() - start;
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.status, 'timeout');
    // Should have waited at least ~1s (minus polling interval tolerance)
    assert.ok(elapsed >= 900, `Expected at least 900ms elapsed, got ${elapsed}ms`);
  });

  it('auto_version: true triggers createScreenVersion on reject', async () => {
    // Add an element so version has content to clone
    await store.updateScreen(projectId, screenId, {
      status: 'rejected',
      reject_reason: 'Needs iteration',
    });

    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId,
      screen_id: screenId,
      timeout_seconds: 1,
      auto_version: true,
    });
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.status, 'rejected');
    assert.equal(data.reason, 'Needs iteration');
    assert.ok(data.new_version_screen_id, 'Should have created a new version');
    assert.ok(data.new_version_screen_id.startsWith('scr_'));

    // Verify the new version exists in the store
    const project = await store.getProject(projectId);
    const newVersion = project.screens.find(s => s.id === data.new_version_screen_id);
    assert.ok(newVersion, 'New version screen should exist in project');
    assert.equal(newVersion.parent_screen_id, screenId);
    assert.equal(newVersion.status, 'draft');

    // Clean up
    await store.updateScreen(projectId, screenId, { status: 'draft', reject_reason: undefined });
  });

  it('auto_version: true triggers createScreenVersion on accept_with_comments', async () => {
    const comments = [
      { id: 'cmt_av1', element_id: null, text: 'Fix spacing', resolved: false },
    ];
    await store.updateScreen(projectId, screenId, {
      status: 'draft',
      _approval_action: null,
      comments,
    });

    // Set _approval_action asynchronously after the tool starts polling
    // (the tool clears stale _approval_action on startup)
    setTimeout(async () => {
      await store.updateScreen(projectId, screenId, { _approval_action: 'accept_with_comments' });
    }, 500);

    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId,
      screen_id: screenId,
      timeout_seconds: 5,
      auto_version: true,
    });
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.status, 'accepted_with_comments');
    assert.ok(data.new_version_screen_id, 'Should have created a new version');
    assert.ok(data.new_version_screen_id.startsWith('scr_'));

    // Clean up
    await store.updateScreen(projectId, screenId, { _approval_action: null, comments: [] });
  });

  it('returns error when screen does not exist', async () => {
    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId,
      screen_id: 'scr_nonexistent',
      timeout_seconds: 1,
    });
    assert.equal(res.isError, true);
    assert.ok(res.content[0].text.includes('not found'));
  });
});
