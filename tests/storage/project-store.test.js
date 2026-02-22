import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
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

  describe('Style support', () => {
    it('createProject stores style field', async () => {
      const project = await store.createProject('Styled', '', {
        width: 393, height: 852, preset: 'mobile',
      }, 'material');
      assert.equal(project.style, 'material');

      const retrieved = await store.getProject(project.id);
      assert.equal(retrieved.style, 'material');
    });

    it('createProject defaults style to wireframe', async () => {
      const project = await store.createProject('Default Style');
      assert.equal(project.style, 'wireframe');
    });

    it('addScreen stores style override', async () => {
      const project = await store.createProject('Screen Style Test');
      const screen = await store.addScreen(project.id, 'iOS Screen', null, null, '#FFFFFF', 'ios');
      assert.equal(screen.style, 'ios');
    });

    it('addScreen defaults style to null', async () => {
      const project = await store.createProject('Screen Null Style');
      const screen = await store.addScreen(project.id, 'Default Screen');
      assert.equal(screen.style, null);
    });
  });

  describe('duplicateScreen', () => {
    it('duplicates screen with new IDs', async () => {
      const project = await store.createProject('Dup Test');
      const screen = await store.addScreen(project.id, 'Original');
      await store.addElement(project.id, screen.id, 'button', 10, 20, 100, 40, { label: 'Click' });
      await store.addElement(project.id, screen.id, 'text', 10, 70, 200, 30, { content: 'Hello' });

      const copy = await store.duplicateScreen(project.id, screen.id, 'Copy');

      assert.notEqual(copy.id, screen.id);
      assert.equal(copy.name, 'Copy');
      assert.equal(copy.elements.length, 2);
      assert.notEqual(copy.elements[0].id, screen.elements?.[0]?.id);
      assert.equal(copy.elements[0].type, 'button');
      assert.deepEqual(copy.elements[0].properties, { label: 'Click' });
    });

    it('uses default name when new_name not provided', async () => {
      const project = await store.createProject('Dup Name Test');
      const screen = await store.addScreen(project.id, 'Main Screen');

      const copy = await store.duplicateScreen(project.id, screen.id);
      assert.equal(copy.name, 'Main Screen (copy)');
    });

    it('throws for nonexistent screen', async () => {
      const project = await store.createProject('Dup Error Test');
      await assert.rejects(
        () => store.duplicateScreen(project.id, 'scr_nonexistent'),
        /not found/i,
      );
    });
  });

  describe('bulkMoveElements', () => {
    it('updates positions of multiple elements', async () => {
      const project = await store.createProject('Bulk Move Test');
      const screen = await store.addScreen(project.id, 'Main');
      const el1 = await store.addElement(project.id, screen.id, 'text', 10, 20, 100, 30, {});
      const el2 = await store.addElement(project.id, screen.id, 'button', 50, 60, 120, 40, {});

      const updates = [
        { id: el1.id, x: 0, y: 0, width: 393, height: 30 },
        { id: el2.id, x: 0, y: 46, width: 393, height: 40 },
      ];

      const result = await store.bulkMoveElements(project.id, screen.id, updates);

      const updatedEl1 = result.elements.find((e) => e.id === el1.id);
      const updatedEl2 = result.elements.find((e) => e.id === el2.id);

      assert.equal(updatedEl1.x, 0);
      assert.equal(updatedEl1.y, 0);
      assert.equal(updatedEl1.width, 393);
      assert.equal(updatedEl2.x, 0);
      assert.equal(updatedEl2.y, 46);
    });

    it('skips nonexistent element IDs silently', async () => {
      const project = await store.createProject('Bulk Skip Test');
      const screen = await store.addScreen(project.id, 'Main');
      const el1 = await store.addElement(project.id, screen.id, 'text', 10, 20, 100, 30, {});

      const updates = [
        { id: el1.id, x: 0, y: 0 },
        { id: 'el_nonexistent', x: 50, y: 50 },
      ];

      const result = await store.bulkMoveElements(project.id, screen.id, updates);
      assert.equal(result.elements.length, 1);
      assert.equal(result.elements[0].x, 0);
    });

    it('only updates provided fields', async () => {
      const project = await store.createProject('Bulk Partial Test');
      const screen = await store.addScreen(project.id, 'Main');
      const el1 = await store.addElement(project.id, screen.id, 'text', 10, 20, 100, 30, {});

      const updates = [
        { id: el1.id, x: 50 }, // only x, keep y/width/height
      ];

      const result = await store.bulkMoveElements(project.id, screen.id, updates);
      const updated = result.elements.find((e) => e.id === el1.id);

      assert.equal(updated.x, 50);
      assert.equal(updated.y, 20);  // unchanged
      assert.equal(updated.width, 100);  // unchanged
      assert.equal(updated.height, 30);  // unchanged
    });

    it('throws for nonexistent screen', async () => {
      const project = await store.createProject('Bulk Error Test');
      await assert.rejects(
        () => store.bulkMoveElements(project.id, 'scr_nonexistent', []),
        /not found/i,
      );
    });
  });

  describe('applyTemplate', () => {
    it('adds elements to screen from template array', async () => {
      const project = await store.createProject('Template Test');
      const screen = await store.addScreen(project.id, 'Login');

      const elements = [
        { type: 'navbar', x: 0, y: 0, width: 393, height: 56, z_index: 10, properties: { title: 'Sign In' } },
        { type: 'input', x: 24, y: 120, width: 345, height: 56, z_index: 0, properties: { label: 'Email' } },
      ];

      const result = await store.applyTemplate(project.id, screen.id, elements, true);

      assert.equal(result.elements.length, 2);
      assert.ok(result.elements[0].id.startsWith('el_'));
      assert.ok(result.elements[1].id.startsWith('el_'));
      assert.equal(result.elements[0].type, 'navbar');
      assert.equal(result.elements[1].type, 'input');
      assert.deepEqual(result.elements[0].properties, { title: 'Sign In' });
    });

    it('clears existing elements when clear=true', async () => {
      const project = await store.createProject('Template Clear Test');
      const screen = await store.addScreen(project.id, 'Home');
      await store.addElement(project.id, screen.id, 'button', 10, 20, 100, 40, { label: 'Old' });

      const newElements = [
        { type: 'text', x: 0, y: 0, width: 200, height: 30, z_index: 0, properties: { content: 'New' } },
      ];

      const result = await store.applyTemplate(project.id, screen.id, newElements, true);
      assert.equal(result.elements.length, 1);
      assert.equal(result.elements[0].type, 'text');
    });

    it('preserves existing elements when clear=false', async () => {
      const project = await store.createProject('Template Append Test');
      const screen = await store.addScreen(project.id, 'Home');
      await store.addElement(project.id, screen.id, 'button', 10, 20, 100, 40, { label: 'Keep' });

      const newElements = [
        { type: 'text', x: 0, y: 0, width: 200, height: 30, z_index: 0, properties: { content: 'Added' } },
      ];

      const result = await store.applyTemplate(project.id, screen.id, newElements, false);
      assert.equal(result.elements.length, 2);
      assert.equal(result.elements[0].type, 'button');
      assert.equal(result.elements[1].type, 'text');
    });

    it('throws for nonexistent screen', async () => {
      const project = await store.createProject('Template Error Test');
      await assert.rejects(
        () => store.applyTemplate(project.id, 'scr_nonexistent', [], true),
        /not found/i,
      );
    });

    it('generates unique IDs for each element', async () => {
      const project = await store.createProject('Template IDs Test');
      const screen = await store.addScreen(project.id, 'Screen');

      const elements = [
        { type: 'text', x: 0, y: 0, width: 100, height: 30, z_index: 0, properties: {} },
        { type: 'text', x: 0, y: 40, width: 100, height: 30, z_index: 0, properties: {} },
        { type: 'text', x: 0, y: 80, width: 100, height: 30, z_index: 0, properties: {} },
      ];

      const result = await store.applyTemplate(project.id, screen.id, elements, true);
      const ids = result.elements.map((e) => e.id);
      const unique = new Set(ids);
      assert.equal(unique.size, ids.length, 'Element IDs must be unique');
    });
  });

  describe('folder path traversal prevention', () => {
    it('rejects folder with path traversal sequences', async () => {
      await assert.rejects(
        () => store.createProject('Evil', '', undefined, 'wireframe', '../../escape'),
        /invalid folder path/i,
      );
    });

    it('rejects folder that resolves outside dataDir', async () => {
      await assert.rejects(
        () => store.createProject('Evil', '', undefined, 'wireframe', '../outside'),
        /invalid folder path/i,
      );
    });

    it('allows valid subfolder paths', async () => {
      const project = await store.createProject('Safe', '', undefined, 'wireframe', 'ValidFolder/Sub');
      assert.ok(project.id.startsWith('proj_'));
    });
  });

  // --- Folder-based project discovery ---

  describe('Folder-aware createProject', () => {
    it('createProject with folder param creates file in subfolder', async () => {
      const folderStore = new ProjectStore(tmpDir);
      await folderStore.init();

      const project = await folderStore.createProject('Folder App', '', undefined, 'wireframe', 'MGGS/AudiobookMaker');

      assert.ok(project.id.startsWith('proj_'));
      assert.equal(project.name, 'Folder App');

      // Verify the file actually landed in the subfolder.
      const { stat } = await import('fs/promises');
      const expectedPath = join(tmpDir, 'MGGS', 'AudiobookMaker', `${project.id}.json`);
      const fileStat = await stat(expectedPath);
      assert.ok(fileStat.isFile(), `Expected file at ${expectedPath}`);
    });

    it('getProject finds project created in subfolder', async () => {
      const folderStore = new ProjectStore(tmpDir);
      await folderStore.init();

      const created = await folderStore.createProject('In Subfolder', '', undefined, 'wireframe', 'ClientA');
      const retrieved = await folderStore.getProject(created.id);

      assert.equal(retrieved.id, created.id);
      assert.equal(retrieved.name, 'In Subfolder');
    });

    it('listProjects includes folder field for subfolder projects', async () => {
      // Fresh isolated store to avoid cross-test pollution on folder field assertions.
      const { mkdtemp: mkd } = await import('fs/promises');
      const isolatedDir = await mkd(join(tmpdir(), 'mockupmcp-folder-list-'));
      try {
        const s = new ProjectStore(isolatedDir);
        await s.init();

        await s.createProject('Root Project');
        await s.createProject('Folder Project', '', undefined, 'wireframe', 'TeamA');

        const list = await s.listProjects();
        assert.equal(list.length, 2);

        const rootEntry = list.find((p) => p.name === 'Root Project');
        const folderEntry = list.find((p) => p.name === 'Folder Project');

        assert.ok(rootEntry, 'Root Project should appear in list');
        assert.equal(rootEntry.folder, null, 'Root-level project must have folder=null');

        assert.ok(folderEntry, 'Folder Project should appear in list');
        assert.equal(folderEntry.folder, 'TeamA', 'Subfolder project must expose folder name');
      } finally {
        await rm(isolatedDir, { recursive: true, force: true });
      }
    });
  });

  describe('listProjectsTree', () => {
    let treeDir;
    let treeStore;

    before(async () => {
      treeDir = await mkdtemp(join(tmpdir(), 'mockupmcp-tree-'));
      treeStore = new ProjectStore(treeDir);
      await treeStore.init();
    });

    after(async () => {
      await rm(treeDir, { recursive: true, force: true });
    });

    it('returns root-level projects under root.projects', async () => {
      await treeStore.createProject('Root App');

      const tree = await treeStore.listProjectsTree();

      assert.ok(Array.isArray(tree.projects));
      assert.ok(Array.isArray(tree.folders));
      const entry = tree.projects.find((p) => p.name === 'Root App');
      assert.ok(entry, 'Root App should appear in tree.projects');
      assert.ok('id' in entry);
      assert.ok('style' in entry);
      assert.ok(Array.isArray(entry.screens));
    });

    it('returns nested projects under correct folder node', async () => {
      await treeStore.createProject('Team App', '', undefined, 'wireframe', 'TeamB');

      const tree = await treeStore.listProjectsTree();

      const folder = tree.folders.find((f) => f.name === 'TeamB');
      assert.ok(folder, 'TeamB folder should appear in tree');
      assert.equal(folder.path, 'TeamB');
      const entry = folder.projects.find((p) => p.name === 'Team App');
      assert.ok(entry, 'Team App should appear inside TeamB folder');
    });

    it('handles deeply nested folders', async () => {
      await treeStore.createProject('Deep App', '', undefined, 'wireframe', 'Org/Division/Team');

      const tree = await treeStore.listProjectsTree();

      const orgFolder = tree.folders.find((f) => f.name === 'Org');
      assert.ok(orgFolder, 'Org folder must exist');
      assert.equal(orgFolder.path, 'Org');

      const divFolder = orgFolder.folders.find((f) => f.name === 'Division');
      assert.ok(divFolder, 'Division subfolder must exist');
      assert.equal(divFolder.path, 'Org/Division');

      const teamFolder = divFolder.folders.find((f) => f.name === 'Team');
      assert.ok(teamFolder, 'Team subfolder must exist');
      assert.equal(teamFolder.path, 'Org/Division/Team');

      const entry = teamFolder.projects.find((p) => p.name === 'Deep App');
      assert.ok(entry, 'Deep App must appear in innermost folder');
    });

    it('screens in tree are summarised as {id, name} pairs', async () => {
      const project = await treeStore.createProject('Screened App');
      await treeStore.addScreen(project.id, 'Home');
      await treeStore.addScreen(project.id, 'Settings');

      const tree = await treeStore.listProjectsTree();

      const entry = tree.projects.find((p) => p.id === project.id);
      assert.ok(entry, 'Project must appear in tree');
      assert.equal(entry.screens.length, 2);
      assert.ok('id' in entry.screens[0]);
      assert.ok('name' in entry.screens[0]);
      // Must NOT include full element arrays (would be too heavy for tree view).
      assert.ok(!('elements' in entry.screens[0]));
    });
  });

  describe('deleteProject in subfolder', () => {
    it('removes project file from subfolder and clears index', async () => {
      const delDir = await mkdtemp(join(tmpdir(), 'mockupmcp-del-'));
      try {
        const s = new ProjectStore(delDir);
        await s.init();

        const project = await s.createProject('Del Folder', '', undefined, 'wireframe', 'SubDir');
        await s.deleteProject(project.id);

        await assert.rejects(
          () => s.getProject(project.id),
          /not found/i,
          'Deleted project must not be retrievable',
        );

        // Index must also be cleared so listProjects does not surface it.
        const list = await s.listProjects();
        assert.ok(!list.find((p) => p.id === project.id), 'Deleted project must not appear in list');
      } finally {
        await rm(delDir, { recursive: true, force: true });
      }
    });
  });

  describe('getProject lazy index rebuild', () => {
    it('finds project written directly to disk without going through the store', async () => {
      const lazyDir = await mkdtemp(join(tmpdir(), 'mockupmcp-lazy-'));
      try {
        const s = new ProjectStore(lazyDir);
        await s.init();

        // Write a valid project file directly to the sub-directory, bypassing the store.
        const subDir = join(lazyDir, 'external');
        await mkdir(subDir, { recursive: true });
        const externalId = 'proj_externaltest';
        const projectData = {
          id: externalId,
          name: 'External',
          description: '',
          style: 'wireframe',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          viewport: { width: 393, height: 852, preset: 'mobile' },
          screens: [],
        };
        await writeFile(
          join(subDir, `${externalId}.json`),
          JSON.stringify(projectData, null, 2),
          'utf-8',
        );

        // The store has no index entry for this project — lazy rebuild must kick in.
        const retrieved = await s.getProject(externalId);
        assert.equal(retrieved.id, externalId);
        assert.equal(retrieved.name, 'External');
      } finally {
        await rm(lazyDir, { recursive: true, force: true });
      }
    });
  });

  describe('backward compatibility: projects/ subdirectory', () => {
    it('discovers projects that were stored in the legacy projects/ subdirectory', async () => {
      const legacyDir = await mkdtemp(join(tmpdir(), 'mockupmcp-legacy-'));
      try {
        // Simulate a pre-refactor layout: projects stored in projects/ subdir.
        const projectsSubDir = join(legacyDir, 'projects');
        await mkdir(projectsSubDir, { recursive: true });
        const legacyId = 'proj_legacycompat';
        const projectData = {
          id: legacyId,
          name: 'Legacy',
          description: '',
          style: 'wireframe',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          viewport: { width: 393, height: 852, preset: 'mobile' },
          screens: [],
        };
        await writeFile(
          join(projectsSubDir, `${legacyId}.json`),
          JSON.stringify(projectData, null, 2),
          'utf-8',
        );

        // New store initialised on the same dataDir must discover the legacy project.
        const s = new ProjectStore(legacyDir);
        await s.init();

        const retrieved = await s.getProject(legacyId);
        assert.equal(retrieved.id, legacyId);

        const list = await s.listProjects();
        const entry = list.find((p) => p.id === legacyId);
        assert.ok(entry, 'Legacy project must appear in list');
        // folder should reflect the projects/ subdirectory path.
        assert.equal(entry.folder, 'projects');
      } finally {
        await rm(legacyDir, { recursive: true, force: true });
      }
    });
  });
});
