import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProjectStore } from '../../src/storage/project-store.js';
import { registerCommentTools } from '../../src/mcp/tools/comment-tools.js';

class MockMcpServer {
  constructor() {
    this.tools = new Map();
  }

  tool(name, description, schema, handler) {
    this.tools.set(name, { description, schema, handler });
  }

  async callTool(name, params) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return await tool.handler(params);
  }
}

describe('comment tools MCP integration', () => {
  let server, store, tmpDir, projectId, screenId, elementId;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'commenttools-'));
    store = new ProjectStore(tmpDir);
    await store.init();
    server = new MockMcpServer();

    // Register the comment tools.
    registerCommentTools(server, store);

    // Create test data.
    const project = await store.createProject('Comment Tools Test');
    projectId = project.id;
    const screen = await store.addScreen(projectId, 'Test Screen');
    screenId = screen.id;
    const element = await store.addElement(projectId, screenId, 'button', 0, 0, 100, 40);
    elementId = element.id;
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('tool registration', () => {
    it('registers mockup_add_comment tool', async () => {
      assert.ok(server.tools.has('mockup_add_comment'));
    });

    it('registers mockup_list_comments tool', async () => {
      assert.ok(server.tools.has('mockup_list_comments'));
    });

    it('registers mockup_resolve_comment tool', async () => {
      assert.ok(server.tools.has('mockup_resolve_comment'));
    });
  });

  describe('mockup_add_comment', () => {
    it('adds comment via tool', async () => {
      const result = await server.callTool('mockup_add_comment', {
        project_id: projectId,
        screen_id: screenId,
        text: 'This should be blue',
        author: 'user',
      });

      assert.ok(result.content);
      assert.equal(result.content.length, 1);
      const comment = JSON.parse(result.content[0].text);
      assert.ok(comment.id.startsWith('cmt_'));
      assert.equal(comment.text, 'This should be blue');
    });

    it('adds element-level comment', async () => {
      const result = await server.callTool('mockup_add_comment', {
        project_id: projectId,
        screen_id: screenId,
        element_id: elementId,
        text: 'Element feedback',
        author: 'ai',
      });

      const comment = JSON.parse(result.content[0].text);
      assert.equal(comment.element_id, elementId);
      assert.equal(comment.author, 'ai');
    });

    it('returns error for missing text', async () => {
      // Tool validation should catch this, but we test store error handling.
      // Since the schema requires text, MCP SDK will reject before calling handler.
      // For testing, we can manually trigger an error by passing invalid params.
      // For now, skip this as schema validation happens at SDK level.
    });
  });

  describe('mockup_list_comments', () => {
    it('lists unresolved comments by default', async () => {
      // Add two comments
      await store.addComment(projectId, screenId, { text: 'Active 1', author: 'user' });
      await store.addComment(projectId, screenId, { text: 'Active 2', author: 'user' });

      const result = await server.callTool('mockup_list_comments', {
        project_id: projectId,
        screen_id: screenId,
        include_resolved: false,
      });

      const comments = JSON.parse(result.content[0].text);
      assert.ok(comments.length >= 2);
      assert.ok(comments.every(c => !c.resolved));
    });

    it('includes resolved comments when specified', async () => {
      const screen = await store.addScreen(projectId, 'List Resolved Test');
      const c1 = await store.addComment(projectId, screen.id, { text: 'Active', author: 'user' });
      const c2 = await store.addComment(projectId, screen.id, { text: 'Resolved', author: 'user' });
      await store.resolveComment(projectId, screen.id, c2.id);

      const result = await server.callTool('mockup_list_comments', {
        project_id: projectId,
        screen_id: screen.id,
        include_resolved: true,
      });

      const comments = JSON.parse(result.content[0].text);
      assert.equal(comments.length, 2);
    });
  });

  describe('mockup_resolve_comment', () => {
    it('resolves comment via tool', async () => {
      const comment = await store.addComment(projectId, screenId, {
        text: 'To resolve',
        author: 'user',
      });

      const result = await server.callTool('mockup_resolve_comment', {
        project_id: projectId,
        screen_id: screenId,
        comment_id: comment.id,
      });

      const resolved = JSON.parse(result.content[0].text);
      assert.equal(resolved.resolved, true);
      assert.equal(resolved.id, comment.id);
    });

    it('returns error for nonexistent comment', async () => {
      const result = await server.callTool('mockup_resolve_comment', {
        project_id: projectId,
        screen_id: screenId,
        comment_id: 'cmt_nonexistent',
      });

      assert.ok(result.isError);
      assert.ok(result.content[0].text.includes('not found'));
    });
  });
});
