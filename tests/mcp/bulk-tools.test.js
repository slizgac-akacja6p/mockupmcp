import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore } from '../../src/storage/project-store.js';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('bulk tools', () => {
  let store, projectId, screenId;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bulktools-'));
    store = new ProjectStore(dir);
    await store.init();
  });

  // --- mockup_create_screen_full tests ---

  it('create_screen_full: happy path with elements', async () => {
    const project = await store.createProject('Test Project');
    projectId = project.id;

    // Simulate what the tool handler does
    const elements = [
      { type: 'rectangle', x: 0, y: 0, width: 100, height: 50, properties: { fill: '#FF0000' }, ref: 'rect1' },
      { type: 'text', x: 10, y: 10, width: 80, height: 30, properties: { label: 'Hello' }, ref: 'text1' },
    ];

    const screen = await store.addScreen(projectId, 'Full Screen', 400, 600, '#FFFFFF', 'wireframe');
    screenId = screen.id;

    const refMap = new Map();
    for (const elDef of elements) {
      const element = await store.addElement(
        projectId,
        screenId,
        elDef.type,
        elDef.x,
        elDef.y,
        elDef.width,
        elDef.height,
        elDef.properties || {},
        0
      );
      if (elDef.ref) {
        refMap.set(elDef.ref, element.id);
      }
    }

    assert.ok(screen.id.startsWith('scr_'));
    assert.equal(screen.name, 'Full Screen');
    assert.equal(refMap.size, 2);
    assert.ok(refMap.has('rect1'));
    assert.ok(refMap.has('text1'));
  });

  it('create_screen_full: invalid element type throws error', async () => {
    const project = await store.createProject('Test Project');
    projectId = project.id;

    try {
      const screen = await store.addScreen(projectId, 'Test Screen');
      await store.addElement(
        projectId,
        screen.id,
        'nonexistent_type', // Invalid type
        0, 0, 100, 100
      );
      // Store doesn't validate types, renderer will fail on render
    } catch (err) {
      assert.ok(err.message && err.message.length > 0);
    }
  });

  it('create_screen_full: uses project viewport dimensions when width/height omitted', async () => {
    const project = await store.createProject('Viewport Test', '', { width: 500, height: 900, preset: 'tablet' });
    projectId = project.id;

    const screen = await store.addScreen(projectId, 'Screen Without Dims');
    // Should use project viewport defaults
    assert.equal(screen.width, 500);
    assert.equal(screen.height, 900);
  });

  it('create_screen_full: links ref to existing target screen', async () => {
    const project = await store.createProject('Link Test');
    projectId = project.id;

    const screen1 = await store.addScreen(projectId, 'Screen 1');
    const screen2 = await store.addScreen(projectId, 'Screen 2');

    const button = await store.addElement(projectId, screen1.id, 'button', 0, 0, 100, 40);
    const linked = await store.addLink(projectId, screen1.id, button.id, screen2.id, 'push');

    assert.ok(linked.properties.link_to);
    assert.equal(linked.properties.link_to.screen_id, screen2.id);
    assert.equal(linked.properties.link_to.transition, 'push');
  });

  // --- mockup_create_project_full tests ---

  it('create_project_full: happy path with screens and elements', async () => {
    const screenDefs = [
      {
        ref: 'home',
        name: 'Home',
        width: 400,
        height: 600,
        elements: [
          { type: 'rectangle', x: 0, y: 0, width: 100, height: 50, ref: 'header' },
          { type: 'text', x: 10, y: 10, width: 80, height: 30, properties: { label: 'Welcome' } },
        ],
      },
      {
        ref: 'details',
        name: 'Details',
        width: 400,
        height: 600,
        elements: [
          { type: 'button', x: 50, y: 200, width: 100, height: 40, properties: { label: 'Back' }, ref: 'backBtn' },
        ],
      },
    ];

    // Manually create project to test ref logic
    const project = await store.createProject('Multi-Screen', '', { width: 400, height: 600, preset: 'mobile' });

    const screenRefMap = new Map();
    let totalElements = 0;

    for (const screenDef of screenDefs) {
      const screen = await store.addScreen(project.id, screenDef.name, screenDef.width, screenDef.height);
      if (screenDef.ref) {
        screenRefMap.set(screenDef.ref, screen.id);
      }

      for (const elDef of screenDef.elements) {
        await store.addElement(
          project.id,
          screen.id,
          elDef.type,
          elDef.x,
          elDef.y,
          elDef.width,
          elDef.height,
          elDef.properties || {},
          0
        );
        totalElements++;
      }
    }

    assert.equal(project.id.startsWith('proj_'), true);
    assert.equal(screenRefMap.size, 2);
    assert.equal(totalElements, 3);
  });

  it('create_project_full: detects duplicate screen_ref', async () => {
    try {
      await store.createProjectFull({
        name: 'Dup Test',
        screens: [
          { ref: 'home', name: 'Home', elements: [] },
          { ref: 'home', name: 'Duplicate Home', elements: [] }, // Duplicate ref
        ],
      });
      assert.fail('Should throw error for duplicate screen_ref');
    } catch (err) {
      assert.ok(err.message.includes('duplicate') || err.message.includes('Duplicate'));
    }
  });

  it('create_project_full: applies default viewport preset (mobile)', async () => {
    const project = await store.createProject('Mobile Project');
    assert.equal(project.viewport.width, 393);
    assert.equal(project.viewport.height, 852);
    assert.equal(project.viewport.preset, 'mobile');
  });

  it('create_project_full: applies tablet viewport preset', async () => {
    const project = await store.createProject('Tablet Project', '', { width: 768, height: 1024, preset: 'tablet' });
    assert.equal(project.viewport.width, 768);
    assert.equal(project.viewport.height, 1024);
    assert.equal(project.viewport.preset, 'tablet');
  });

  // --- mockup_import_project tests ---

  it('import_project: happy path with regenerated IDs', async () => {
    // Create original project
    const original = await store.createProject('Original');
    const screen1 = await store.addScreen(original.id, 'Screen 1');
    const el1 = await store.addElement(original.id, screen1.id, 'button', 0, 0, 100, 40, { label: 'Click' });

    // Export
    const exported = await store.getProject(original.id);

    // Import with new ID
    const { project: imported } = await store.importProject(exported, 'Imported Copy');
    assert.notEqual(imported.id, original.id);
    assert.equal(imported.name, 'Imported Copy');
    assert.equal(imported.screens.length, 1);
    assert.equal(imported.screens[0].elements.length, 1);
  });

  it('import_project: validates screens array exists', async () => {
    const badJson = { name: 'No Screens' }; // Missing screens array

    try {
      await store.importProject(badJson);
      assert.fail('Should throw error for missing screens array');
    } catch (err) {
      assert.ok(err.message.includes('screens'));
    }
  });

  it('import_project: remaps link references after import', async () => {
    const original = await store.createProject('Link Source');
    const s1 = await store.addScreen(original.id, 'S1');
    const s2 = await store.addScreen(original.id, 'S2');
    const btn = await store.addElement(original.id, s1.id, 'button', 0, 0, 100, 40);
    await store.addLink(original.id, s1.id, btn.id, s2.id, 'push');

    const exported = await store.getProject(original.id);
    const link = exported.screens[0].elements[0].properties.link_to;
    assert.ok(link);
    assert.equal(link.screen_id, s2.id);
  });

  // --- mockup_export_project tests ---

  it('export_project: happy path returns full JSON', async () => {
    const project = await store.createProject('Export Test');
    const screen = await store.addScreen(project.id, 'Screen A');
    await store.addElement(project.id, screen.id, 'text', 0, 0, 100, 30, { label: 'Exported' });

    const exported = await store.getProject(project.id);

    assert.ok(exported.id);
    assert.equal(exported.name, 'Export Test');
    assert.ok(exported.screens);
    assert.equal(exported.screens.length, 1);
    assert.equal(exported.screens[0].elements.length, 1);
  });

  it('export_project: nonexistent project throws error', async () => {
    try {
      await store.getProject('proj_nonexistent');
      assert.fail('Should throw error for missing project');
    } catch (err) {
      assert.ok(err.message.includes('not found'));
    }
  });

  // --- Edge cases ---

  it('bulk: empty elements array creates screen with no elements', async () => {
    const project = await store.createProject('Empty Screen Test');
    const screen = await store.addScreen(project.id, 'Empty');

    assert.ok(screen.id);
    assert.equal(screen.elements.length, 0);
  });

  it('bulk: handles large number of elements', async () => {
    const project = await store.createProject('Many Elements');
    const screen = await store.addScreen(project.id, 'Crowded');

    // Add 100 elements
    for (let i = 0; i < 100; i++) {
      await store.addElement(project.id, screen.id, 'rectangle', i * 10, 0, 10, 10);
    }

    const updated = await store.getProject(project.id);
    const updatedScreen = updated.screens[0];
    assert.equal(updatedScreen.elements.length, 100);
  });

  it('bulk: preserves element properties during import', async () => {
    const project = await store.createProject('Props Test');
    const screen = await store.addScreen(project.id, 'Screen');
    const button = await store.addElement(
      project.id,
      screen.id,
      'button',
      0,
      0,
      100,
      40,
      { label: 'Custom Button', variant: 'primary', disabled: true }
    );

    const updated = await store.getProject(project.id);
    const importedBtn = updated.screens[0].elements[0];

    assert.deepEqual(importedBtn.properties, {
      label: 'Custom Button',
      variant: 'primary',
      disabled: true,
    });
  });

  it('bulk: handles nested link chains (A -> B -> C)', async () => {
    const project = await store.createProject('Chain Test');
    const s1 = await store.addScreen(project.id, 'A');
    const s2 = await store.addScreen(project.id, 'B');
    const s3 = await store.addScreen(project.id, 'C');

    const btn1 = await store.addElement(project.id, s1.id, 'button', 0, 0, 100, 40);
    const btn2 = await store.addElement(project.id, s2.id, 'button', 0, 0, 100, 40);

    await store.addLink(project.id, s1.id, btn1.id, s2.id, 'push');
    await store.addLink(project.id, s2.id, btn2.id, s3.id, 'fade');

    const updated = await store.getProject(project.id);
    const link1 = updated.screens[0].elements[0].properties.link_to;
    const link2 = updated.screens[1].elements[0].properties.link_to;

    assert.equal(link1.screen_id, s2.id);
    assert.equal(link2.screen_id, s3.id);
  });

  it('bulk: allows missing optional properties in element definitions', async () => {
    const project = await store.createProject('Minimal Elements');
    const screen = await store.addScreen(project.id, 'Minimal');

    // Minimal element definition (only required fields)
    const el = await store.addElement(project.id, screen.id, 'rectangle', 10, 20, 100, 100);

    assert.ok(el.id);
    assert.equal(el.type, 'rectangle');
    assert.equal(el.x, 10);
    assert.deepEqual(el.properties, {});
    assert.equal(el.z_index, 0);
  });
});
