import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProjectStore } from '../../src/storage/project-store.js';

describe('Screen Versioning', () => {
  let store;
  let tmpDir;
  let projectId;
  let screenId;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mockupmcp-versioning-test-'));
    store = new ProjectStore(tmpDir);
    await store.init();

    // Create a test project and screen.
    const project = await store.createProject('Versioning Test');
    projectId = project.id;

    const screen = await store.addScreen(projectId, 'Original Screen', 400, 600, '#FFFFFF');
    screenId = screen.id;
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('New screens have versioning fields', () => {
    it('addScreen sets version=1, status=draft, parent_screen_id=null', async () => {
      const screen = await store.addScreen(projectId, 'Fresh Screen', 300, 500);

      assert.equal(screen.version, 1);
      assert.equal(screen.status, 'draft');
      assert.equal(screen.parent_screen_id, null);
    });
  });

  describe('Migration fallback for old screens', () => {
    it('getProject fills missing versioning fields with defaults', async () => {
      const project = await store.getProject(projectId);
      // The original screen created in before() should have version/status/parent_screen_id set.
      const originalScreen = project.screens.find(s => s.id === screenId);

      assert.ok(originalScreen);
      assert.equal(originalScreen.version, 1);
      assert.equal(originalScreen.status, 'draft');
      assert.equal(originalScreen.parent_screen_id, null);
    });
  });

  describe('createScreenVersion', () => {
    it('returns new screen with bumped version and parent_screen_id set', async () => {
      const source = await store.getProject(projectId).then(p => p.screens.find(s => s.id === screenId));

      const v2 = await store.createScreenVersion(projectId, screenId);

      assert.ok(v2.id.startsWith('scr_'));
      assert.notEqual(v2.id, screenId);
      assert.equal(v2.version, 2);
      assert.equal(v2.parent_screen_id, screenId);
      assert.equal(v2.status, 'draft');
      assert.equal(v2.name, `${source.name} v2`);
    });

    it('original screen remains unchanged after createScreenVersion', async () => {
      const projectBefore = await store.getProject(projectId);
      const originalBefore = projectBefore.screens.find(s => s.id === screenId);

      await store.createScreenVersion(projectId, screenId);

      const projectAfter = await store.getProject(projectId);
      const originalAfter = projectAfter.screens.find(s => s.id === screenId);

      assert.equal(originalAfter.version, originalBefore.version);
      assert.equal(originalAfter.status, originalBefore.status);
      assert.equal(originalAfter.parent_screen_id, originalBefore.parent_screen_id);
    });

    it('new version has cloned elements with regenerated IDs', async () => {
      const project1 = await store.getProject(projectId);
      const source = project1.screens.find(s => s.id === screenId);

      // Add an element to the source screen.
      const element = await store.addElement(projectId, screenId, 'button', 10, 20, 100, 40, { label: 'Test' });

      // Create version.
      const v2 = await store.createScreenVersion(projectId, screenId);

      // Verify elements were cloned.
      assert.equal(v2.elements.length, source.elements.length + 1);
      // Verify IDs are different (regenerated).
      const v2ElementIds = new Set(v2.elements.map(e => e.id));
      const sourceElementIds = new Set(source.elements.map(e => e.id));
      assert.ok(!v2ElementIds.has(element.id), 'Version should have new element IDs');
    });

    it('throws when source screen does not exist', async () => {
      await assert.rejects(
        () => store.createScreenVersion(projectId, 'scr_nonexistent'),
        /not found/i
      );
    });

    it('supports chaining versions (v1 -> v2 -> v3)', async () => {
      // Get the latest version (should be v2 from previous test).
      let project = await store.getProject(projectId);
      const v2 = project.screens.find(s => s.parent_screen_id === screenId);

      // Create v3 from v2.
      const v3 = await store.createScreenVersion(projectId, v2.id);

      assert.equal(v3.version, 3);
      assert.equal(v3.parent_screen_id, v2.id);
      // Name is derived by appending vN to the parent's name.
      assert.equal(v3.name, `${v2.name} v3`);
    });
  });

  describe('createScreenVersion — comment migration', () => {
    it('copies unresolved comments with new IDs', async () => {
      // Set up comments on the source screen
      const comments = [
        { id: 'cmt_open1', element_id: 'el_abc', text: 'Fix this', resolved: false, pin_number: 1 },
        { id: 'cmt_open2', element_id: null, text: 'Needs work', resolved: false, pin_number: 2 },
        { id: 'cmt_done', element_id: 'el_xyz', text: 'Already fixed', resolved: true },
      ];
      await store.updateScreen(projectId, screenId, { comments });

      const newVersion = await store.createScreenVersion(projectId, screenId);

      // Only unresolved comments should be copied
      assert.equal(newVersion.comments.length, 2);
      // IDs should be regenerated (not identical to source)
      for (const comment of newVersion.comments) {
        assert.ok(comment.id.startsWith('cmt_'), `Comment ID should have cmt_ prefix, got: ${comment.id}`);
        assert.notEqual(comment.id, 'cmt_open1');
        assert.notEqual(comment.id, 'cmt_open2');
      }
      // Content should be preserved
      const texts = newVersion.comments.map(c => c.text);
      assert.ok(texts.includes('Fix this'));
      assert.ok(texts.includes('Needs work'));
      assert.ok(!texts.includes('Already fixed'), 'Resolved comment should NOT be copied');
    });

    it('does NOT copy resolved comments', async () => {
      // Set up only resolved comments
      const comments = [
        { id: 'cmt_r1', element_id: null, text: 'Done', resolved: true },
        { id: 'cmt_r2', element_id: null, text: 'Also done', resolved: true },
      ];
      await store.updateScreen(projectId, screenId, { comments });

      const newVersion = await store.createScreenVersion(projectId, screenId);

      assert.equal(newVersion.comments.length, 0);
    });

    it('handles screen with no comments', async () => {
      // Clear comments on source
      await store.updateScreen(projectId, screenId, { comments: undefined });

      const newVersion = await store.createScreenVersion(projectId, screenId);

      assert.ok(Array.isArray(newVersion.comments));
      assert.equal(newVersion.comments.length, 0);
    });
  });

  describe('updateScreen with status', () => {
    it('sets status to approved', async () => {
      const updated = await store.updateScreen(projectId, screenId, { status: 'approved' });

      assert.equal(updated.status, 'approved');

      // Verify persistence.
      const project = await store.getProject(projectId);
      const screen = project.screens.find(s => s.id === screenId);
      assert.equal(screen.status, 'approved');
    });

    it('sets status to rejected', async () => {
      const updated = await store.updateScreen(projectId, screenId, { status: 'rejected' });

      assert.equal(updated.status, 'rejected');

      // Verify persistence.
      const project = await store.getProject(projectId);
      const screen = project.screens.find(s => s.id === screenId);
      assert.equal(screen.status, 'rejected');
    });

    it('reverts status back to draft', async () => {
      const updated = await store.updateScreen(projectId, screenId, { status: 'draft' });

      assert.equal(updated.status, 'draft');

      // Verify persistence.
      const project = await store.getProject(projectId);
      const screen = project.screens.find(s => s.id === screenId);
      assert.equal(screen.status, 'draft');
    });

    it('allows partial updates (status only)', async () => {
      const before = await store.getProject(projectId).then(p => p.screens.find(s => s.id === screenId));

      const updated = await store.updateScreen(projectId, screenId, { status: 'approved' });

      // Other fields should remain unchanged.
      assert.equal(updated.name, before.name);
      assert.equal(updated.version, before.version);
      assert.equal(updated.width, before.width);
      assert.equal(updated.status, 'approved');
    });

    it('allows partial updates (multiple fields)', async () => {
      const updated = await store.updateScreen(projectId, screenId, {
        name: 'Renamed Screen',
        status: 'approved',
        background: '#000000',
      });

      assert.equal(updated.name, 'Renamed Screen');
      assert.equal(updated.status, 'approved');
      assert.equal(updated.background, '#000000');
      assert.equal(updated.version, 1); // Unchanged.
    });

    it('throws when screen does not exist', async () => {
      await assert.rejects(
        () => store.updateScreen(projectId, 'scr_nonexistent', { status: 'approved' }),
        /not found/i
      );
    });
  });

  describe('Versioning with bulk creation', () => {
    it('createScreenFull initializes versioning fields', async () => {
      const project = await store.getProject(projectId);

      const { screen } = await store.createScreenFull(projectId, {
        name: 'Bulk Created Screen',
        width: 400,
        height: 600,
        background: '#FFFFFF',
        elements: [
          { type: 'button', x: 10, y: 10, width: 100, height: 40, properties: { label: 'Test' } },
        ],
      });

      assert.equal(screen.version, 1);
      assert.equal(screen.status, 'draft');
      assert.equal(screen.parent_screen_id, null);
    });

    it('createProjectFull initializes versioning fields for all screens', async () => {
      const { project } = await store.createProjectFull({
        name: 'Full Project Test',
        screens: [
          {
            ref: 'screen1',
            name: 'Screen 1',
            elements: [{ type: 'button', ref: 'btn1' }],
          },
          {
            ref: 'screen2',
            name: 'Screen 2',
            elements: [],
          },
        ],
      });

      for (const screen of project.screens) {
        assert.equal(screen.version, 1);
        assert.equal(screen.status, 'draft');
        assert.equal(screen.parent_screen_id, null);
      }
    });
  });

  describe('Version tree structure', () => {
    it('supports parent-child version relationships', async () => {
      // Create a new test screen.
      const screen = await store.addScreen(projectId, 'Version Tree Test', 300, 500);
      const screenId = screen.id;

      // Create v2.
      const v2 = await store.createScreenVersion(projectId, screenId);
      assert.equal(v2.parent_screen_id, screenId);

      // Create v3 from v2.
      const v3 = await store.createScreenVersion(projectId, v2.id);
      assert.equal(v3.parent_screen_id, v2.id);

      // Verify all are in the project.
      const project = await store.getProject(projectId);
      const versions = project.screens.filter(s =>
        s.id === screenId || s.parent_screen_id === screenId || s.parent_screen_id === v2.id
      );
      assert.equal(versions.length, 3);
    });
  });
});
