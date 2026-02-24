import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProjectStore } from '../../src/storage/project-store.js';

describe('ProjectStore bulk creation methods', () => {
  let store;
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mockupmcp-bulk-test-'));
    store = new ProjectStore(tmpDir);
    await store.init();
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('createScreenFull', () => {
    let projectId;

    before(async () => {
      const project = await store.createProject('Screen Full Test');
      projectId = project.id;
    });

    it('creates screen with multiple elements and builds refMap', async () => {
      const screenDef = {
        name: 'Dashboard',
        width: 400,
        height: 800,
        background: '#F0F0F0',
        elements: [
          { type: 'navbar', x: 0, y: 0, width: 400, height: 56, ref: 'nav', z_index: 10 },
          { type: 'text', x: 20, y: 100, width: 360, height: 30, ref: 'title', properties: { content: 'Welcome' } },
          { type: 'button', x: 20, y: 150, width: 360, height: 48, ref: 'cta', properties: { label: 'Get Started' } },
        ],
      };

      const result = await store.createScreenFull(projectId, screenDef);

      assert.ok(result.screen);
      assert.ok(result.screen.id.startsWith('scr_'));
      assert.equal(result.screen.name, 'Dashboard');
      assert.equal(result.screen.width, 400);
      assert.equal(result.screen.height, 800);
      assert.equal(result.screen.elements.length, 3);
      assert.equal(result.screen.elements[0].type, 'navbar');

      // Verify refMap.
      assert.ok(result.refMap.nav);
      assert.ok(result.refMap.title);
      assert.ok(result.refMap.cta);
      assert.equal(result.refMap.nav, result.screen.elements[0].id);
    });

    it('applies links using refMap', async () => {
      const screenDef = {
        name: 'Navigation Screen',
        elements: [
          { type: 'button', x: 0, y: 0, width: 100, height: 50, ref: 'btn' },
          { type: 'text', x: 0, y: 60, width: 200, height: 30, ref: 'txt' },
        ],
        links: [
          { ref: 'btn', target_screen_id: projectId, transition: 'push' },
        ],
      };

      const result = await store.createScreenFull(projectId, screenDef);

      const btnElement = result.screen.elements.find((e) => e.type === 'button');
      assert.ok(btnElement.properties.link_to);
      assert.equal(btnElement.properties.link_to.screen_id, projectId);
      assert.equal(btnElement.properties.link_to.transition, 'push');
    });

    it('uses default dimensions from project viewport', async () => {
      const screenDef = {
        name: 'Default Size',
        elements: [
          { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 },
        ],
      };

      const result = await store.createScreenFull(projectId, screenDef);

      const project = await store.getProject(projectId);
      assert.equal(result.screen.width, project.viewport.width);
      assert.equal(result.screen.height, project.viewport.height);
    });

    it('rejects link with nonexistent ref', async () => {
      const screenDef = {
        name: 'Bad Link Screen',
        elements: [
          { type: 'button', x: 0, y: 0, width: 100, height: 50, ref: 'btn' },
        ],
        links: [
          { ref: 'nonexistent_ref', target_screen_id: projectId },
        ],
      };

      await assert.rejects(
        () => store.createScreenFull(projectId, screenDef),
        /does not exist in elements/
      );
    });

    it('rejects element missing type', async () => {
      const screenDef = {
        name: 'Bad Element',
        elements: [
          { x: 0, y: 0, width: 100, height: 50 }, // no type
        ],
      };

      await assert.rejects(
        () => store.createScreenFull(projectId, screenDef),
        /missing type/
      );
    });

    it('atomicity: fails without mutation on validation error', async () => {
      const project = await store.getProject(projectId);
      const initialScreenCount = project.screens.length;

      const screenDef = {
        name: 'Should Fail',
        elements: [
          { type: 'button', ref: 'btn' },
        ],
        links: [
          { ref: 'bad_ref', target_screen_id: projectId }, // Invalid ref
        ],
      };

      await assert.rejects(
        () => store.createScreenFull(projectId, screenDef),
        /does not exist/
      );

      // Verify project unchanged.
      const projectAfter = await store.getProject(projectId);
      assert.equal(projectAfter.screens.length, initialScreenCount);
    });

    it('rejects nonexistent project', async () => {
      const screenDef = { name: 'Test', elements: [] };

      await assert.rejects(
        () => store.createScreenFull('proj_nonexistent', screenDef),
        /not found/
      );
    });

    it('defaults element dimensions when not provided', async () => {
      const screenDef = {
        name: 'Default Dims',
        elements: [
          { type: 'button', x: 10, y: 20 }, // No width/height
        ],
      };

      const result = await store.createScreenFull(projectId, screenDef);
      const el = result.screen.elements[0];

      assert.equal(el.x, 10);
      assert.equal(el.y, 20);
      assert.equal(el.width, 100);
      assert.equal(el.height, 40);
    });
  });

  describe('createProjectFull', () => {
    it('creates project with multiple screens and elements', async () => {
      const projectDef = {
        name: 'Full Project',
        description: 'A complete project',
        screens: [
          {
            ref: 'login',
            name: 'Login',
            width: 393,
            height: 852,
            elements: [
              { type: 'input', x: 20, y: 100, width: 353, height: 56, ref: 'email', properties: { label: 'Email' } },
              { type: 'input', x: 20, y: 170, width: 353, height: 56, ref: 'password', properties: { label: 'Password' } },
              { type: 'button', x: 20, y: 260, width: 353, height: 56, ref: 'submit', properties: { label: 'Sign In' } },
            ],
          },
          {
            ref: 'home',
            name: 'Home',
            width: 393,
            height: 852,
            elements: [
              { type: 'navbar', x: 0, y: 0, width: 393, height: 56, ref: 'nav', z_index: 10 },
              { type: 'text', x: 20, y: 100, width: 353, height: 40, ref: 'greeting', properties: { content: 'Welcome!' } },
            ],
          },
        ],
      };

      const result = await store.createProjectFull(projectDef);

      assert.ok(result.project.id.startsWith('proj_'));
      assert.equal(result.project.name, 'Full Project');
      assert.equal(result.project.screens.length, 2);

      // Verify screenRefMap.
      assert.ok(result.screenRefMap.login);
      assert.ok(result.screenRefMap.home);

      // Verify elementRefMap.
      assert.ok(result.elementRefMap['login.email']);
      assert.ok(result.elementRefMap['login.password']);
      assert.ok(result.elementRefMap['home.greeting']);
    });

    it('applies cross-screen links via refs', async () => {
      const projectDef = {
        name: 'Linked Project',
        screens: [
          {
            ref: 'screen1',
            name: 'Screen 1',
            elements: [
              { type: 'button', x: 0, y: 0, width: 100, height: 50, ref: 'btn1' },
            ],
          },
          {
            ref: 'screen2',
            name: 'Screen 2',
            elements: [
              { type: 'button', x: 0, y: 0, width: 100, height: 50, ref: 'btn2' },
            ],
          },
        ],
        links: [
          { screen_ref: 'screen1', element_ref: 'btn1', target_screen_ref: 'screen2', transition: 'modal' },
        ],
      };

      const result = await store.createProjectFull(projectDef);

      const screen1 = result.project.screens.find((s) => s.name === 'Screen 1');
      const btn1 = screen1.elements[0];

      assert.ok(btn1.properties.link_to);
      assert.equal(btn1.properties.link_to.screen_id, result.screenRefMap.screen2);
      assert.equal(btn1.properties.link_to.transition, 'modal');
    });

    it('rejects duplicate screen refs', async () => {
      const projectDef = {
        name: 'Duplicate Screens',
        screens: [
          { ref: 'dup', name: 'Screen 1', elements: [] },
          { ref: 'dup', name: 'Screen 2', elements: [] },
        ],
      };

      await assert.rejects(
        () => store.createProjectFull(projectDef),
        /duplicate screen ref/i
      );
    });

    it('rejects link with nonexistent screen_ref', async () => {
      const projectDef = {
        name: 'Bad Screen Ref',
        screens: [
          { ref: 'screen1', name: 'Screen 1', elements: [] },
        ],
        links: [
          { screen_ref: 'nonexistent', element_ref: 'btn', target_screen_ref: 'screen1' },
        ],
      };

      await assert.rejects(
        () => store.createProjectFull(projectDef),
        /screen_ref.*does not exist/i
      );
    });

    it('rejects link with nonexistent target_screen_ref', async () => {
      const projectDef = {
        name: 'Bad Target Ref',
        screens: [
          { ref: 'screen1', name: 'Screen 1', elements: [] },
        ],
        links: [
          { screen_ref: 'screen1', element_ref: 'btn', target_screen_ref: 'nonexistent' },
        ],
      };

      await assert.rejects(
        () => store.createProjectFull(projectDef),
        /target_screen_ref.*does not exist/i
      );
    });

    it('atomicity: fails without mutation on element validation error', async () => {
      const initialList = await store.listProjects();
      const initialCount = initialList.length;

      const projectDef = {
        name: 'Should Fail',
        screens: [
          { ref: 'screen1', name: 'Screen 1', elements: [{ x: 0, y: 0, width: 100, height: 50 }] }, // No type
        ],
      };

      await assert.rejects(
        () => store.createProjectFull(projectDef),
        /missing type/
      );

      const listAfter = await store.listProjects();
      assert.equal(listAfter.length, initialCount);
    });

    it('uses defaults for missing project fields', async () => {
      const projectDef = {
        name: 'Minimal Project',
        screens: [
          { name: 'Screen', elements: [] },
        ],
      };

      const result = await store.createProjectFull(projectDef);

      assert.equal(result.project.style, 'wireframe');
      assert.deepEqual(result.project.viewport, { width: 393, height: 852, preset: 'mobile' });
    });

    it('uses project viewport for screen dimensions when not provided', async () => {
      const projectDef = {
        name: 'Viewport Inherit Test',
        viewport: { width: 1440, height: 900, preset: 'desktop' },
        screens: [
          { name: 'Screen', elements: [] }, // No width/height
        ],
      };

      const result = await store.createProjectFull(projectDef);
      const screen = result.project.screens[0];

      assert.equal(screen.width, 1440);
      assert.equal(screen.height, 900);
    });

    it('applies link when no element_ref specified (targets first element)', async () => {
      const projectDef = {
        name: 'Link No Element Ref',
        screens: [
          {
            ref: 'screen1',
            name: 'Screen 1',
            elements: [
              { type: 'button', x: 0, y: 0, width: 100, height: 50 },
              { type: 'text', x: 0, y: 60, width: 200, height: 30 },
            ],
          },
          { ref: 'screen2', name: 'Screen 2', elements: [] },
        ],
        links: [
          { screen_ref: 'screen1', target_screen_ref: 'screen2' }, // No element_ref
        ],
      };

      const result = await store.createProjectFull(projectDef);
      const screen1 = result.project.screens[0];
      const firstEl = screen1.elements[0];

      assert.ok(firstEl.properties.link_to);
      assert.equal(firstEl.properties.link_to.screen_id, result.screenRefMap.screen2);
    });

    it('rejects missing name field', async () => {
      const projectDef = {
        screens: [], // No name
      };

      await assert.rejects(
        () => store.createProjectFull(projectDef),
        /missing name/
      );
    });

    it('rejects missing or invalid screens array', async () => {
      await assert.rejects(
        () => store.createProjectFull({ name: 'Test' }), // No screens
        /missing or invalid screens/
      );

      await assert.rejects(
        () => store.createProjectFull({ name: 'Test', screens: 'not-array' }),
        /missing or invalid screens/
      );
    });
  });

  describe('importProject', () => {
    it('creates new project with imported screens and elements', async () => {
      // Create a source project.
      const source = await store.createProject('Source Project');
      const screen1 = await store.addScreen(source.id, 'Screen 1', 400, 800);
      await store.addElement(source.id, screen1.id, 'button', 10, 20, 100, 50, { label: 'Click' });

      const sourceJson = await store.getProject(source.id);

      // Import it.
      const result = await store.importProject(sourceJson);

      assert.ok(result.project.id.startsWith('proj_'));
      assert.notEqual(result.project.id, source.id);
      assert.equal(result.project.name, 'Source Project');
      assert.equal(result.project.screens.length, 1);
      assert.equal(result.project.screens[0].elements.length, 1);

      // Verify new IDs.
      assert.notEqual(result.project.screens[0].id, screen1.id);
      assert.notEqual(result.project.screens[0].elements[0].id, sourceJson.screens[0].elements[0].id);

      // Verify data preserved.
      assert.equal(result.project.screens[0].name, 'Screen 1');
      assert.equal(result.project.screens[0].elements[0].type, 'button');
      assert.deepEqual(result.project.screens[0].elements[0].properties, { label: 'Click' });
    });

    it('uses nameOverride when provided', async () => {
      const source = await store.createProject('Original Name');
      const sourceJson = await store.getProject(source.id);

      const result = await store.importProject(sourceJson, 'New Name');

      assert.equal(result.project.name, 'New Name');
    });

    it('places imported project in folder when provided', async () => {
      const source = await store.createProject('Source');
      const sourceJson = await store.getProject(source.id);

      const result = await store.importProject(sourceJson, null, 'Imports');

      const list = await store.listProjects();
      const imported = list.find((p) => p.id === result.project.id);

      assert.equal(imported.folder, 'Imports');
    });

    it('rewrites link_to references with new screen IDs', async () => {
      // Create source with link.
      const source = await store.createProject('Source with Link');
      const screen1 = await store.addScreen(source.id, 'Screen 1');
      const screen2 = await store.addScreen(source.id, 'Screen 2');
      const el = await store.addElement(source.id, screen1.id, 'button', 0, 0, 100, 50, {});
      await store.addLink(source.id, screen1.id, el.id, screen2.id);

      const sourceJson = await store.getProject(source.id);

      // Import it.
      const result = await store.importProject(sourceJson);

      const importedScreen1 = result.project.screens[0];
      const importedEl = importedScreen1.elements[0];
      const importedScreen2Id = result.project.screens[1].id;

      assert.ok(importedEl.properties.link_to);
      assert.equal(importedEl.properties.link_to.screen_id, importedScreen2Id);
    });

    it('rejects missing name field', async () => {
      const badJson = { screens: [] };

      await assert.rejects(
        () => store.importProject(badJson),
        /missing name/
      );
    });

    it('rejects missing screens array', async () => {
      const badJson = { name: 'Test' };

      await assert.rejects(
        () => store.importProject(badJson),
        /missing or invalid screens/
      );
    });

    it('preserves all screen properties during import', async () => {
      const source = await store.createProject('Test', '', { width: 1920, height: 1080 }, 'material');
      const screen = await store.addScreen(source.id, 'Styled Screen', 1920, 1080, '#0A0A0A', 'ios');
      const sourceJson = await store.getProject(source.id);

      const result = await store.importProject(sourceJson);

      const importedScreen = result.project.screens[0];
      assert.equal(importedScreen.name, 'Styled Screen');
      assert.equal(importedScreen.width, 1920);
      assert.equal(importedScreen.height, 1080);
      assert.equal(importedScreen.background, '#0A0A0A');
      assert.equal(importedScreen.style, 'ios');
    });

    it('handles empty project (no screens)', async () => {
      const source = await store.createProject('Empty');
      const sourceJson = await store.getProject(source.id);

      const result = await store.importProject(sourceJson, 'Imported Empty');

      assert.equal(result.project.name, 'Imported Empty');
      assert.deepEqual(result.project.screens, []);
    });

    it('deeply clones element properties to avoid mutations', async () => {
      const source = await store.createProject('Deep Clone Test');
      const screen = await store.addScreen(source.id, 'Screen');
      await store.addElement(
        source.id,
        screen.id,
        'text',
        0,
        0,
        100,
        50,
        { nested: { value: 'original' } }
      );

      const sourceJson = await store.getProject(source.id);
      const result = await store.importProject(sourceJson);

      // Verify clone independence.
      const importedProps = result.project.screens[0].elements[0].properties;
      importedProps.nested.value = 'modified';

      const sourceProps = sourceJson.screens[0].elements[0].properties;
      assert.equal(sourceProps.nested.value, 'original');
    });
  });
});
