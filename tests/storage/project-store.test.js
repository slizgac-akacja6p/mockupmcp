import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProjectStore } from '../../src/storage/project-store.js';

describe('ProjectStore', () => {
  let store;
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mockupmcp-test-'));
    store = new ProjectStore(tmpDir);
    await store.init();
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('Project CRUD', () => {
    it('creates and retrieves a project', async () => {
      const project = await store.createProject('Test App', 'A test project', {
        width: 393,
        height: 852,
        preset: 'mobile',
      });

      assert.ok(project.id.startsWith('proj_'), `ID should start with proj_, got: ${project.id}`);
      assert.equal(project.name, 'Test App');
      assert.equal(project.description, 'A test project');
      assert.deepEqual(project.viewport, { width: 393, height: 852, preset: 'mobile' });
      assert.ok(project.created_at);
      assert.ok(project.updated_at);
      assert.deepEqual(project.screens, []);

      const retrieved = await store.getProject(project.id);
      assert.equal(retrieved.id, project.id);
      assert.equal(retrieved.name, 'Test App');
    });

    it('lists projects', async () => {
      // Create a second project to verify listing returns all.
      await store.createProject('Another App');

      const list = await store.listProjects();
      assert.ok(list.length >= 2, `Expected at least 2 projects, got ${list.length}`);

      const summary = list[0];
      assert.ok('id' in summary);
      assert.ok('name' in summary);
      assert.ok('screens' in summary);
      assert.ok('updated_at' in summary);
    });

    it('deletes a project and throws on subsequent get', async () => {
      const project = await store.createProject('To Delete');
      await store.deleteProject(project.id);

      await assert.rejects(
        () => store.getProject(project.id),
        /not found/i
      );
    });

    it('throws when getting a nonexistent project', async () => {
      await assert.rejects(
        () => store.getProject('proj_doesnotexist'),
        /not found/i
      );
    });
  });

  describe('ID validation (path traversal prevention)', () => {
    it('rejects IDs with path traversal sequences', async () => {
      await assert.rejects(
        () => store.getProject('../../etc/passwd'),
        /invalid id format/i
      );
    });

    it('rejects IDs with slashes', async () => {
      await assert.rejects(
        () => store.getProject('proj/evil'),
        /invalid id format/i
      );
    });

    it('rejects IDs without prefix separator', async () => {
      await assert.rejects(
        () => store.getProject('noprefixid'),
        /invalid id format/i
      );
    });
  });

  describe('Screen CRUD', () => {
    let projectId;

    before(async () => {
      const project = await store.createProject('Screen Test Project', '', {
        width: 1440,
        height: 900,
        preset: 'desktop',
      });
      projectId = project.id;
    });

    it('adds and lists screens', async () => {
      const screen = await store.addScreen(projectId, 'Home Screen', 1440, 900, '#F5F5F5');

      assert.ok(screen.id.startsWith('scr_'), `ID should start with scr_, got: ${screen.id}`);
      assert.equal(screen.name, 'Home Screen');
      assert.equal(screen.width, 1440);
      assert.equal(screen.height, 900);
      assert.equal(screen.background, '#F5F5F5');
      assert.deepEqual(screen.elements, []);

      const list = await store.listScreens(projectId);
      assert.equal(list.length, 1);
      assert.equal(list[0].id, screen.id);
      assert.equal(list[0].name, 'Home Screen');
    });

    it('defaults screen dimensions to project viewport', async () => {
      const screen = await store.addScreen(projectId, 'Auto Size Screen');

      assert.equal(screen.width, 1440);
      assert.equal(screen.height, 900);
    });

    it('deletes a screen', async () => {
      const screen = await store.addScreen(projectId, 'To Delete Screen');
      await store.deleteScreen(projectId, screen.id);

      const list = await store.listScreens(projectId);
      assert.ok(!list.find((s) => s.id === screen.id));
    });
  });

  describe('Element lifecycle', () => {
    let projectId;
    let screenId;

    before(async () => {
      const project = await store.createProject('Element Test Project');
      projectId = project.id;
      const screen = await store.addScreen(projectId, 'Element Test Screen');
      screenId = screen.id;
    });

    it('adds an element', async () => {
      const element = await store.addElement(
        projectId,
        screenId,
        'button',
        10, 20, 100, 40,
        { label: 'Click me', variant: 'primary' },
        1
      );

      assert.ok(element.id.startsWith('el_'), `ID should start with el_, got: ${element.id}`);
      assert.equal(element.type, 'button');
      assert.equal(element.x, 10);
      assert.equal(element.y, 20);
      assert.equal(element.width, 100);
      assert.equal(element.height, 40);
      assert.equal(element.z_index, 1);
      assert.deepEqual(element.properties, { label: 'Click me', variant: 'primary' });
    });

    it('updates element properties (partial merge)', async () => {
      const element = await store.addElement(
        projectId, screenId, 'text', 0, 0, 200, 30,
        { content: 'Hello', fontSize: 16 }
      );

      const updated = await store.updateElement(projectId, screenId, element.id, {
        fontSize: 24,
        color: '#333',
      });

      // Original property preserved, new properties merged.
      assert.equal(updated.properties.content, 'Hello');
      assert.equal(updated.properties.fontSize, 24);
      assert.equal(updated.properties.color, '#333');
    });

    it('moves an element (partial update)', async () => {
      const element = await store.addElement(
        projectId, screenId, 'rectangle', 0, 0, 50, 50, {}
      );

      const moved = await store.moveElement(projectId, screenId, element.id, 100, 200);

      assert.equal(moved.x, 100);
      assert.equal(moved.y, 200);
      // Width/height unchanged.
      assert.equal(moved.width, 50);
      assert.equal(moved.height, 50);
    });

    it('lists elements', async () => {
      const elements = await store.listElements(projectId, screenId);
      assert.ok(elements.length >= 3, `Expected at least 3 elements, got ${elements.length}`);
    });

    it('deletes an element', async () => {
      const element = await store.addElement(
        projectId, screenId, 'icon', 5, 5, 24, 24, { name: 'home' }
      );

      await store.deleteElement(projectId, screenId, element.id);

      const elements = await store.listElements(projectId, screenId);
      assert.ok(!elements.find((e) => e.id === element.id));
    });

    it('throws when updating a nonexistent element', async () => {
      await assert.rejects(
        () => store.updateElement(projectId, screenId, 'el_doesnotexist', {}),
        /not found/i
      );
    });
  });

  describe('Export', () => {
    it('saves a PNG buffer and returns the file path', async () => {
      const project = await store.createProject('Export Test');
      const screen = await store.addScreen(project.id, 'Export Screen');

      // Simulate a minimal PNG buffer (just needs to be a Buffer, not a real PNG for this test).
      const fakeBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      const filePath = await store.saveExport(project.id, screen.id, fakeBuffer);

      assert.ok(typeof filePath === 'string');
      assert.ok(filePath.includes(project.id));
      assert.ok(filePath.endsWith(`${screen.id}.png`));
    });
  });
});
