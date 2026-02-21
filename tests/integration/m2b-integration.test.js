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
import { registerTemplateTools } from '../../src/mcp/tools/template-tools.js';
import { registerLayoutTools } from '../../src/mcp/tools/layout-tools.js';

// MockServer — same pattern as tools.integration.test.js
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
    const zodSchema = z.object(tool.schema);
    const parsed = zodSchema.parse(params);
    return tool.handler(parsed);
  }
}

function parseResult(response) {
  return JSON.parse(response.content[0].text);
}

describe('M2b Integration Tests', () => {
  let server;
  let store;
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mockupmcp-m2b-test-'));
    store = new ProjectStore(tmpDir);
    await store.init();

    server = new MockServer();
    registerProjectTools(server, store);
    registerScreenTools(server, store);
    registerElementTools(server, store);
    registerTemplateTools(server, store);
    registerLayoutTools(server, store);
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -- Template + Layout workflow --

  describe('apply template then auto-layout', () => {
    it('applies login template and then re-layouts vertically', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Template+Layout' });
      const projectId = parseResult(projRes).id;

      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Login',
      });
      const screenId = parseResult(scrRes).id;

      // Apply template
      const tmplRes = await server.callTool('mockup_apply_template', {
        project_id: projectId,
        screen_id: screenId,
        template: 'login',
      });
      const screen = parseResult(tmplRes);

      assert.ok(screen.elements.length >= 5, 'Login template should create at least 5 elements');
      assert.ok(screen.elements.every(e => e.id.startsWith('el_')));

      // Auto-layout the non-pinned elements
      const layoutRes = await server.callTool('mockup_auto_layout', {
        project_id: projectId,
        screen_id: screenId,
        direction: 'vertical',
        spacing: 16,
        padding: 24,
        start_y: 56, // skip navbar
      });
      const layoutScreen = parseResult(layoutRes);

      // Verify navbar stayed pinned (z_index >= 10)
      const navbar = layoutScreen.elements.find(e => e.type === 'navbar');
      assert.equal(navbar.y, 0, 'Navbar should remain at y=0 (pinned)');

      // Non-pinned elements should be stacked
      const nonPinned = layoutScreen.elements.filter(e => e.z_index < 10);
      for (let i = 1; i < nonPinned.length; i++) {
        assert.ok(
          nonPinned[i].y > nonPinned[i - 1].y,
          `Element ${i} should be below element ${i - 1}`
        );
      }
    });
  });

  describe('apply template then modify elements', () => {
    it('applies dashboard template and updates a card title', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Template+Edit' });
      const projectId = parseResult(projRes).id;

      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Dashboard',
      });
      const screenId = parseResult(scrRes).id;

      // Apply template
      const tmplRes = await server.callTool('mockup_apply_template', {
        project_id: projectId,
        screen_id: screenId,
        template: 'dashboard',
      });
      const screen = parseResult(tmplRes);

      // Find first card element
      const card = screen.elements.find(e => e.type === 'card');
      assert.ok(card, 'Dashboard should contain a card element');

      // Update the card title
      const updateRes = await server.callTool('mockup_update_element', {
        project_id: projectId,
        screen_id: screenId,
        element_id: card.id,
        properties: { title: 'Custom Title' },
      });
      const updatedCard = parseResult(updateRes);
      assert.equal(updatedCard.properties.title, 'Custom Title');
    });
  });

  describe('list templates tool', () => {
    it('returns all 7 templates with descriptions', async () => {
      const res = await server.callTool('mockup_list_templates', {});
      const templates = parseResult(res);

      assert.equal(templates.length, 7);
      for (const tmpl of templates) {
        assert.equal(typeof tmpl.name, 'string');
        assert.equal(typeof tmpl.description, 'string');
        assert.equal(typeof tmpl.elementCount, 'number');
        assert.ok(tmpl.elementCount >= 5);
      }
    });
  });

  describe('auto-layout with element_ids filter', () => {
    it('layouts only specified elements', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Layout Filter' });
      const projectId = parseResult(projRes).id;

      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Test',
      });
      const screenId = parseResult(scrRes).id;

      // Add 3 elements
      const el1Res = await server.callTool('mockup_add_element', {
        project_id: projectId, screen_id: screenId,
        type: 'text', x: 100, y: 100, width: 200, height: 30,
        properties: { content: 'A' },
      });
      const el1 = parseResult(el1Res);

      const el2Res = await server.callTool('mockup_add_element', {
        project_id: projectId, screen_id: screenId,
        type: 'text', x: 100, y: 200, width: 200, height: 30,
        properties: { content: 'B' },
      });
      const el2 = parseResult(el2Res);

      const el3Res = await server.callTool('mockup_add_element', {
        project_id: projectId, screen_id: screenId,
        type: 'text', x: 100, y: 300, width: 200, height: 30,
        properties: { content: 'C' },
      });
      const el3 = parseResult(el3Res);

      // Layout only el1 and el3
      const layoutRes = await server.callTool('mockup_auto_layout', {
        project_id: projectId,
        screen_id: screenId,
        direction: 'vertical',
        element_ids: [el1.id, el3.id],
      });
      const screen = parseResult(layoutRes);

      const updatedEl2 = screen.elements.find(e => e.id === el2.id);
      // el2 should remain at original position
      assert.equal(updatedEl2.x, 100);
      assert.equal(updatedEl2.y, 200);
    });
  });

  describe('auto-layout grid mode', () => {
    it('arranges elements in grid columns', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Grid Layout' });
      const projectId = parseResult(projRes).id;

      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Grid',
      });
      const screenId = parseResult(scrRes).id;

      // Add 4 cards
      const ids = [];
      for (let i = 0; i < 4; i++) {
        const elRes = await server.callTool('mockup_add_element', {
          project_id: projectId, screen_id: screenId,
          type: 'card', x: 0, y: 0, width: 100, height: 80,
          properties: { title: `Card ${i + 1}` },
        });
        ids.push(parseResult(elRes).id);
      }

      const layoutRes = await server.callTool('mockup_auto_layout', {
        project_id: projectId,
        screen_id: screenId,
        direction: 'grid',
        columns: 2,
        spacing: 16,
        padding: 16,
      });
      const screen = parseResult(layoutRes);

      // Row 0: elements 0, 1 at same y
      assert.equal(screen.elements[0].y, screen.elements[1].y);
      // Row 1: elements 2, 3 at same y, below row 0
      assert.equal(screen.elements[2].y, screen.elements[3].y);
      assert.ok(screen.elements[2].y > screen.elements[0].y);
      // Column check: element 1 is to the right of element 0
      assert.ok(screen.elements[1].x > screen.elements[0].x);
    });
  });

  describe('template clear=false preserves existing elements', () => {
    it('adds template elements after existing ones', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Clear False' });
      const projectId = parseResult(projRes).id;

      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Mixed',
      });
      const screenId = parseResult(scrRes).id;

      // Add a manual element
      await server.callTool('mockup_add_element', {
        project_id: projectId, screen_id: screenId,
        type: 'text', x: 0, y: 0, width: 100, height: 30,
        properties: { content: 'Manual' },
      });

      // Apply template without clearing
      const tmplRes = await server.callTool('mockup_apply_template', {
        project_id: projectId,
        screen_id: screenId,
        template: 'login',
        clear: false,
      });
      const screen = parseResult(tmplRes);

      // Should have manual element + all template elements
      const manualEl = screen.elements.find(e => e.properties.content === 'Manual');
      assert.ok(manualEl, 'Manual element should still exist');
      assert.ok(screen.elements.length >= 6, 'Should have manual + template elements');
    });
  });

  describe('error handling', () => {
    it('returns error for nonexistent template', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Err Template' });
      const projectId = parseResult(projRes).id;
      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId, name: 'X',
      });
      const screenId = parseResult(scrRes).id;

      // z.enum validation will throw before handler — test via zod
      await assert.rejects(
        () => server.callTool('mockup_apply_template', {
          project_id: projectId,
          screen_id: screenId,
          template: 'nonexistent',
        }),
        /Invalid enum/i,
      );
    });

    it('returns error for nonexistent screen in auto_layout', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Err Layout' });
      const projectId = parseResult(projRes).id;

      const res = await server.callTool('mockup_auto_layout', {
        project_id: projectId,
        screen_id: 'scr_nonexistent',
        direction: 'vertical',
      });
      assert.equal(res.isError, true);
      assert.ok(res.content[0].text.includes('Error'));
    });
  });
});
