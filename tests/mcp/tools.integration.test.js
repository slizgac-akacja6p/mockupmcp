import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { z } from 'zod';
import { ProjectStore } from '../../src/storage/project-store.js';
import { registerProjectTools } from '../../src/mcp/tools/project-tools.js';
import { registerScreenTools } from '../../src/mcp/tools/screen-tools.js';
import { registerElementTools } from '../../src/mcp/tools/element-tools.js';

// Captures tool registrations so we can call handlers directly without MCP transport.
// Applies zod schema parsing (with defaults) to mimic the real MCP SDK behavior.
class MockServer {
  constructor() {
    this.tools = new Map();
  }
  tool(name, desc, schema, handler) {
    this.tools.set(name, { desc, schema, handler });
  }
  async callTool(name, params) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" not registered`);
    // Parse through zod to apply defaults and validation, same as the real MCP SDK.
    const zodSchema = z.object(tool.schema);
    const parsed = zodSchema.parse(params);
    return tool.handler(parsed);
  }
}

// Helper to parse the JSON text from a standard tool response.
function parseResult(response) {
  return JSON.parse(response.content[0].text);
}

describe('MCP Tool Handlers (integration)', () => {
  let server;
  let store;
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mockupmcp-tools-test-'));
    store = new ProjectStore(tmpDir);
    await store.init();

    server = new MockServer();
    registerProjectTools(server, store);
    registerScreenTools(server, store);
    registerElementTools(server, store);
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -- Project tools --

  describe('mockup_create_project', () => {
    it('creates a project with default mobile viewport', async () => {
      const res = await server.callTool('mockup_create_project', {
        name: 'My App',
      });
      const project = parseResult(res);

      assert.ok(project.id.startsWith('proj_'));
      assert.equal(project.name, 'My App');
      assert.equal(project.viewport.preset, 'mobile');
      assert.equal(project.viewport.width, 393);
      assert.equal(project.viewport.height, 852);
      assert.deepEqual(project.screens, []);
    });

    it('creates a project with tablet viewport', async () => {
      const res = await server.callTool('mockup_create_project', {
        name: 'Tablet App',
        viewport: 'tablet',
      });
      const project = parseResult(res);

      assert.equal(project.viewport.preset, 'tablet');
      assert.equal(project.viewport.width, 834);
      assert.equal(project.viewport.height, 1194);
    });

    it('creates a project with description', async () => {
      const res = await server.callTool('mockup_create_project', {
        name: 'Described App',
        description: 'A project with a description',
      });
      const project = parseResult(res);

      assert.equal(project.description, 'A project with a description');
    });
  });

  describe('mockup_list_projects', () => {
    it('returns an array containing previously created projects', async () => {
      const res = await server.callTool('mockup_list_projects', {});
      const list = parseResult(res);

      assert.ok(Array.isArray(list));
      // At least the 3 projects from the create_project tests above
      assert.ok(list.length >= 1, `Expected at least 1 project, got ${list.length}`);
      assert.ok('id' in list[0]);
      assert.ok('name' in list[0]);
      assert.ok('screens' in list[0]);
      assert.ok('updated_at' in list[0]);
    });
  });

  // -- Screen tools --

  describe('mockup_add_screen', () => {
    let projectId;

    before(async () => {
      const res = await server.callTool('mockup_create_project', { name: 'Screen Test' });
      projectId = parseResult(res).id;
    });

    it('adds a screen with explicit dimensions', async () => {
      const res = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Login',
        width: 400,
        height: 800,
        background: '#F0F0F0',
      });
      const screen = parseResult(res);

      assert.ok(screen.id.startsWith('scr_'));
      assert.equal(screen.name, 'Login');
      assert.equal(screen.width, 400);
      assert.equal(screen.height, 800);
      assert.equal(screen.background, '#F0F0F0');
      assert.deepEqual(screen.elements, []);
    });

    it('adds a screen with default dimensions from project viewport', async () => {
      const res = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Home',
      });
      const screen = parseResult(res);

      // Project was created with default mobile viewport (393x852)
      assert.equal(screen.width, 393);
      assert.equal(screen.height, 852);
      assert.equal(screen.background, '#FFFFFF');
    });
  });

  describe('mockup_list_screens', () => {
    it('lists screens with element counts', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'List Screens Test' });
      const projectId = parseResult(projRes).id;

      await server.callTool('mockup_add_screen', { project_id: projectId, name: 'S1' });
      await server.callTool('mockup_add_screen', { project_id: projectId, name: 'S2' });

      const res = await server.callTool('mockup_list_screens', { project_id: projectId });
      const screens = parseResult(res);

      assert.equal(screens.length, 2);
      assert.equal(screens[0].name, 'S1');
      assert.equal(screens[1].name, 'S2');
      assert.equal(screens[0].elements, 0);
    });
  });

  // -- Element tools --

  describe('mockup_add_element', () => {
    let projectId;
    let screenId;

    before(async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Element Test' });
      projectId = parseResult(projRes).id;
      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Main',
      });
      screenId = parseResult(scrRes).id;
    });

    it('adds a button element', async () => {
      const res = await server.callTool('mockup_add_element', {
        project_id: projectId,
        screen_id: screenId,
        type: 'button',
        x: 10,
        y: 20,
        width: 120,
        height: 44,
        properties: { label: 'Submit', variant: 'primary' },
        z_index: 1,
      });
      const el = parseResult(res);

      assert.ok(el.id.startsWith('el_'));
      assert.equal(el.type, 'button');
      assert.equal(el.x, 10);
      assert.equal(el.y, 20);
      assert.equal(el.width, 120);
      assert.equal(el.height, 44);
      assert.equal(el.z_index, 1);
      assert.equal(el.properties.label, 'Submit');
      assert.equal(el.properties.variant, 'primary');
    });

    it('returns error for invalid element type with available types', async () => {
      const res = await server.callTool('mockup_add_element', {
        project_id: projectId,
        screen_id: screenId,
        type: 'nonexistent_widget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });

      assert.equal(res.isError, true);
      assert.ok(res.content[0].text.includes('Invalid element type'));
      assert.ok(res.content[0].text.includes('nonexistent_widget'));
      // Should list available types
      assert.ok(res.content[0].text.includes('button'));
      assert.ok(res.content[0].text.includes('text'));
      assert.ok(res.content[0].text.includes('rectangle'));
    });

    it('adds an element with default properties and z_index', async () => {
      const res = await server.callTool('mockup_add_element', {
        project_id: projectId,
        screen_id: screenId,
        type: 'text',
        x: 0,
        y: 0,
        width: 200,
        height: 30,
      });
      const el = parseResult(res);

      assert.equal(el.type, 'text');
      assert.equal(el.z_index, 0);
      assert.deepEqual(el.properties, {});
    });
  });

  describe('mockup_update_element', () => {
    let projectId;
    let screenId;
    let elementId;

    before(async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Update Test' });
      projectId = parseResult(projRes).id;
      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Main',
      });
      screenId = parseResult(scrRes).id;
      const elRes = await server.callTool('mockup_add_element', {
        project_id: projectId,
        screen_id: screenId,
        type: 'text',
        x: 0,
        y: 0,
        width: 200,
        height: 30,
        properties: { content: 'Hello', fontSize: 16 },
      });
      elementId = parseResult(elRes).id;
    });

    it('merges new properties with existing ones', async () => {
      const res = await server.callTool('mockup_update_element', {
        project_id: projectId,
        screen_id: screenId,
        element_id: elementId,
        properties: { fontSize: 24, color: '#333' },
      });
      const el = parseResult(res);

      assert.equal(el.properties.content, 'Hello');
      assert.equal(el.properties.fontSize, 24);
      assert.equal(el.properties.color, '#333');
    });
  });

  describe('mockup_move_element', () => {
    let projectId;
    let screenId;
    let elementId;

    before(async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Move Test' });
      projectId = parseResult(projRes).id;
      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Main',
      });
      screenId = parseResult(scrRes).id;
      const elRes = await server.callTool('mockup_add_element', {
        project_id: projectId,
        screen_id: screenId,
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 50,
        height: 50,
      });
      elementId = parseResult(elRes).id;
    });

    it('moves element position without changing size', async () => {
      const res = await server.callTool('mockup_move_element', {
        project_id: projectId,
        screen_id: screenId,
        element_id: elementId,
        x: 100,
        y: 200,
      });
      const el = parseResult(res);

      assert.equal(el.x, 100);
      assert.equal(el.y, 200);
      assert.equal(el.width, 50);
      assert.equal(el.height, 50);
    });

    it('resizes element without changing position', async () => {
      const res = await server.callTool('mockup_move_element', {
        project_id: projectId,
        screen_id: screenId,
        element_id: elementId,
        width: 300,
        height: 150,
      });
      const el = parseResult(res);

      assert.equal(el.x, 100);
      assert.equal(el.y, 200);
      assert.equal(el.width, 300);
      assert.equal(el.height, 150);
    });
  });

  describe('mockup_list_elements', () => {
    it('returns all elements on a screen', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'List Elements Test' });
      const projectId = parseResult(projRes).id;
      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Main',
      });
      const screenId = parseResult(scrRes).id;

      await server.callTool('mockup_add_element', {
        project_id: projectId,
        screen_id: screenId,
        type: 'button',
        x: 0,
        y: 0,
        width: 100,
        height: 40,
      });
      await server.callTool('mockup_add_element', {
        project_id: projectId,
        screen_id: screenId,
        type: 'text',
        x: 0,
        y: 50,
        width: 200,
        height: 30,
      });

      const res = await server.callTool('mockup_list_elements', {
        project_id: projectId,
        screen_id: screenId,
      });
      const elements = parseResult(res);

      assert.equal(elements.length, 2);
      assert.equal(elements[0].type, 'button');
      assert.equal(elements[1].type, 'text');
    });
  });

  // -- Delete operations (run last to verify cascading removals) --

  describe('mockup_delete_element', () => {
    it('removes element from screen', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Delete El Test' });
      const projectId = parseResult(projRes).id;
      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Main',
      });
      const screenId = parseResult(scrRes).id;
      const elRes = await server.callTool('mockup_add_element', {
        project_id: projectId,
        screen_id: screenId,
        type: 'icon',
        x: 0,
        y: 0,
        width: 24,
        height: 24,
        properties: { name: 'home' },
      });
      const elementId = parseResult(elRes).id;

      const delRes = await server.callTool('mockup_delete_element', {
        project_id: projectId,
        screen_id: screenId,
        element_id: elementId,
      });
      assert.ok(delRes.content[0].text.includes('deleted successfully'));

      // Verify element is gone
      const listRes = await server.callTool('mockup_list_elements', {
        project_id: projectId,
        screen_id: screenId,
      });
      const elements = parseResult(listRes);
      assert.equal(elements.length, 0);
    });
  });

  describe('mockup_delete_screen', () => {
    it('removes screen from project', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Delete Scr Test' });
      const projectId = parseResult(projRes).id;
      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Temp Screen',
      });
      const screenId = parseResult(scrRes).id;

      const delRes = await server.callTool('mockup_delete_screen', {
        project_id: projectId,
        screen_id: screenId,
      });
      assert.ok(delRes.content[0].text.includes('deleted successfully'));

      // Verify screen is gone
      const listRes = await server.callTool('mockup_list_screens', { project_id: projectId });
      const screens = parseResult(listRes);
      assert.equal(screens.length, 0);
    });
  });

  describe('mockup_delete_project', () => {
    it('removes project entirely', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Delete Proj Test' });
      const projectId = parseResult(projRes).id;

      const delRes = await server.callTool('mockup_delete_project', {
        project_id: projectId,
      });
      assert.ok(delRes.content[0].text.includes('deleted successfully'));

      // Verify project is gone — getProject should throw, which the tool catches as error.
      const listRes = await server.callTool('mockup_list_projects', {});
      const list = parseResult(listRes);
      assert.ok(!list.find((p) => p.id === projectId));
    });
  });

  // -- Preview URL --

  describe('mockup_get_preview_url', () => {
    it('is not registered in this test suite (requires export-tools)', () => {
      // Export tools are skipped because they depend on Puppeteer/Chromium.
      // This is a placeholder to document that the tool exists but isn't tested here.
      assert.ok(true);
    });
  });

  describe('mockup_bulk_add_elements', () => {
    it('adds multiple elements in one call', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Bulk Test' });
      const projectId = parseResult(projRes).id;
      const scrRes = await server.callTool('mockup_add_screen', { project_id: projectId, name: 'Main' });
      const screenId = parseResult(scrRes).id;

      const res = await server.callTool('mockup_bulk_add_elements', {
        project_id: projectId,
        screen_id: screenId,
        elements: [
          { type: 'rectangle', x: 0, y: 0, width: 100, height: 50, properties: { background: '#ff0000' } },
          { type: 'text', x: 10, y: 60, width: 200, height: 30, properties: { content: 'Hello' } },
          { type: 'button', x: 10, y: 100, width: 120, height: 44, properties: { label: 'Click' } },
        ],
      });
      const data = parseResult(res);

      assert.equal(data.added, 3);
      assert.equal(data.elements.length, 3);
      assert.ok(data.elements[0].id.startsWith('el_'));
    });

    it('returns error for invalid screen', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Bulk Test 2' });
      const projectId = parseResult(projRes).id;

      const res = await server.callTool('mockup_bulk_add_elements', {
        project_id: projectId,
        screen_id: 'scr_invalid',
        elements: [{ type: 'text', x: 0, y: 0, width: 100, height: 30 }],
      });

      assert.equal(res.isError, true);
      assert.ok(res.content[0].text.includes('Error'));
    });
  });

  // -- Error handling --

  describe('error handling', () => {
    it('returns isError for nonexistent project', async () => {
      const res = await server.callTool('mockup_list_screens', {
        project_id: 'proj_doesnotexist',
      });
      assert.equal(res.isError, true);
      assert.ok(res.content[0].text.includes('Error'));
    });

    it('returns isError for nonexistent screen', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Err Test' });
      const projectId = parseResult(projRes).id;

      const res = await server.callTool('mockup_list_elements', {
        project_id: projectId,
        screen_id: 'scr_doesnotexist',
      });
      assert.equal(res.isError, true);
      assert.ok(res.content[0].text.includes('Error'));
    });

    it('returns isError when deleting nonexistent project', async () => {
      const res = await server.callTool('mockup_delete_project', {
        project_id: 'proj_doesnotexist',
      });
      assert.equal(res.isError, true);
      assert.ok(res.content[0].text.includes('not found'));
    });
  });
});
