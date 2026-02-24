import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProjectStore } from '../../src/storage/project-store.js';

describe('Comments storage', () => {
  let store, tmpDir, projectId, screenId;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'comments-test-'));
    store = new ProjectStore(tmpDir);
    await store.init();

    // Create a project and screen for testing.
    const project = await store.createProject('Comments Test');
    projectId = project.id;
    const screen = await store.addScreen(projectId, 'Test Screen');
    screenId = screen.id;
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('addComment', () => {
    it('creates comment with correct fields', async () => {
      const comment = await store.addComment(projectId, screenId, {
        element_id: null,
        text: 'Test comment',
        author: 'user',
      });

      assert.ok(comment.id.startsWith('cmt_'), 'ID should start with cmt_');
      assert.equal(comment.text, 'Test comment');
      assert.equal(comment.author, 'user');
      assert.equal(comment.resolved, false);
      assert.equal(comment.pin_number, 1);
      assert.ok(comment.created_at, 'Should have created_at timestamp');
    });

    it('assigns sequential pin_number for unresolved comments', async () => {
      const screen = await store.addScreen(projectId, 'Sequential PIN Test');
      const comment1 = await store.addComment(projectId, screen.id, {
        element_id: null,
        text: 'First comment',
        author: 'user',
      });
      assert.equal(comment1.pin_number, 1);

      const comment2 = await store.addComment(projectId, screen.id, {
        element_id: null,
        text: 'Second comment',
        author: 'user',
      });
      assert.equal(comment2.pin_number, 2);

      const comment3 = await store.addComment(projectId, screen.id, {
        element_id: null,
        text: 'Third comment',
        author: 'ai',
      });
      assert.equal(comment3.pin_number, 3);
    });

    it('supports element_id for element-level comments', async () => {
      const element = await store.addElement(projectId, screenId, 'button', 0, 0, 100, 40);

      const comment = await store.addComment(projectId, screenId, {
        element_id: element.id,
        text: 'Element comment',
        author: 'user',
      });

      assert.equal(comment.element_id, element.id);
    });

    it('defaults author to "user" if omitted', async () => {
      const comment = await store.addComment(projectId, screenId, {
        text: 'Test',
      });
      assert.equal(comment.author, 'user');
    });
  });

  describe('listComments', () => {
    it('returns only unresolved comments by default', async () => {
      const screen = await store.addScreen(projectId, 'List Test Screen');
      const comment1 = await store.addComment(projectId, screen.id, {
        text: 'Active',
        author: 'user',
      });
      const comment2 = await store.addComment(projectId, screen.id, {
        text: 'Also active',
        author: 'user',
      });

      const comments = await store.listComments(projectId, screen.id);
      assert.equal(comments.length, 2);
      assert.deepEqual(
        comments.map(c => c.id),
        [comment1.id, comment2.id]
      );
    });

    it('includes resolved comments when include_resolved=true', async () => {
      const screen = await store.addScreen(projectId, 'Include Resolved Test');
      const comment1 = await store.addComment(projectId, screen.id, {
        text: 'Active',
        author: 'user',
      });
      const comment2 = await store.addComment(projectId, screen.id, {
        text: 'Will resolve',
        author: 'user',
      });

      await store.resolveComment(projectId, screen.id, comment2.id);

      const unresolvedOnly = await store.listComments(projectId, screen.id, { include_resolved: false });
      assert.equal(unresolvedOnly.length, 1);
      assert.equal(unresolvedOnly[0].id, comment1.id);

      const all = await store.listComments(projectId, screen.id, { include_resolved: true });
      assert.equal(all.length, 2);
    });
  });

  describe('resolveComment', () => {
    it('marks comment as resolved', async () => {
      const screen = await store.addScreen(projectId, 'Resolve Test Screen');
      const comment = await store.addComment(projectId, screen.id, {
        text: 'Test',
        author: 'user',
      });

      assert.equal(comment.resolved, false);

      const resolved = await store.resolveComment(projectId, screen.id, comment.id);
      assert.equal(resolved.resolved, true);
      assert.equal(resolved.id, comment.id);
    });

    it('throws if comment not found', async () => {
      const screen = await store.addScreen(projectId, 'Not Found Test Screen');

      await assert.rejects(
        () => store.resolveComment(projectId, screen.id, 'cmt_nonexistent'),
        /not found/i
      );
    });
  });

  describe('Migration fallback', () => {
    it('creates comments array on screens without it', async () => {
      const screen = await store.addScreen(projectId, 'Migration Test Screen');
      const retrieved = await store.getProject(projectId);
      const screenData = retrieved.screens.find(s => s.id === screen.id);

      assert.ok(Array.isArray(screenData.comments), 'Should have comments array');
      assert.equal(screenData.comments.length, 0);
    });
  });
});
