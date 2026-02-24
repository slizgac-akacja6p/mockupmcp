import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { z } from 'zod';
import { ProjectStore } from '../../src/storage/project-store.js';
import { registerLayoutTools } from '../../src/mcp/tools/layout-tools.js';

// Captures tool registrations so we can call handlers directly without MCP transport.
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

describe('Layout Tools', () => {
  let server;
  let store;
  let tmpDir;
  let projectId;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mockupmcp-layout-tools-test-'));
    store = new ProjectStore(tmpDir);
    await store.init();

    server = new MockServer();
    registerLayoutTools(server, store);

    // Create test project
    const project = await store.createProject('Layout Test', 'mobile');
    projectId = project.id;
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('mockup_create_screen_layout', () => {
    it('tool is registered', () => {
      const tool = server.tools.get('mockup_create_screen_layout');
      assert.ok(tool, 'Tool not registered');
      assert.ok(tool.handler, 'Tool handler missing');
    });

    it('creates screen with navbar and hero sections', async () => {
      const res = await server.callTool('mockup_create_screen_layout', {
        project_id: projectId,
        name: 'Landing Page',
        sections: [
          { type: 'navbar', props: { title: 'MyApp', links: ['Home', 'About'] } },
          { type: 'hero_with_cta', props: { heading: 'Welcome!', subheading: 'Get started', cta_text: 'Click me' } },
        ],
        width: 1280,
        height: 900,
      });

      const result = parseResult(res);
      assert.ok(result.screen_id);
      assert.equal(result.name, 'Landing Page');
      assert.equal(result.sections_applied, 2);
      assert.ok(result.element_count > 0, 'No elements created');
    });

    it('composes multiple sections into single screen', async () => {
      const res = await server.callTool('mockup_create_screen_layout', {
        project_id: projectId,
        name: 'Full Landing',
        sections: [
          { type: 'navbar' },
          { type: 'hero_with_cta' },
          { type: 'card_grid_3' },
          { type: 'footer' },
        ],
        width: 1280,
      });

      const result = parseResult(res);
      assert.equal(result.sections_applied, 4);
      // Total height should be sum of section heights: 60 + 300 + 280 + 80 = 720
      assert.ok(result.height >= 720, `Height ${result.height} should be >= 720`);
    });

    it('creates elements with correct structure', async () => {
      const res = await server.callTool('mockup_create_screen_layout', {
        project_id: projectId,
        name: 'Elements Check',
        sections: [{ type: 'navbar', props: { title: 'Test' } }],
      });

      const result = parseResult(res);
      const screen_id = result.screen_id;

      // Fetch the screen and verify elements
      const project = await store.getProject(projectId);
      const screen = project.screens.find(s => s.id === screen_id);
      assert.ok(screen, 'Screen not found');
      assert.ok(screen.elements.length > 0, 'No elements in screen');

      for (const el of screen.elements) {
        assert.ok(el.type, `Element missing type: ${JSON.stringify(el)}`);
        assert.ok(typeof el.x === 'number', 'Element missing x');
        assert.ok(typeof el.y === 'number', 'Element missing y');
        assert.ok(typeof el.width === 'number', 'Element missing width');
        assert.ok(typeof el.height === 'number', 'Element missing height');
        assert.ok(el.properties, 'Element missing properties');
      }
    });

    it('uses custom section props', async () => {
      const res = await server.callTool('mockup_create_screen_layout', {
        project_id: projectId,
        name: 'Custom Props',
        sections: [
          {
            type: 'card_grid_3',
            props: {
              cards: [
                { title: 'Feature A', body: 'Description A' },
                { title: 'Feature B', body: 'Description B' },
                { title: 'Feature C', body: 'Description C' },
              ],
            },
          },
        ],
      });

      const result = parseResult(res);
      const screen_id = result.screen_id;

      const project = await store.getProject(projectId);
      const screen = project.screens.find(s => s.id === screen_id);

      // Check that custom card titles are in elements
      assert.ok(screen.elements.some(e => e.properties.content === 'Feature A'));
      assert.ok(screen.elements.some(e => e.properties.content === 'Feature B'));
      assert.ok(screen.elements.some(e => e.properties.content === 'Feature C'));
    });

    it('returns error for unknown section type', async () => {
      const res = await server.callTool('mockup_create_screen_layout', {
        project_id: projectId,
        name: 'Bad Sections',
        sections: [{ type: 'nonexistent_section' }],
      });

      assert.ok(res.isError);
      const text = res.content[0].text;
      assert.ok(text.includes('Unknown section type'));
    });

    it('defaults to 1280px width if not specified', async () => {
      const res = await server.callTool('mockup_create_screen_layout', {
        project_id: projectId,
        name: 'Default Width',
        sections: [{ type: 'navbar' }],
      });

      const result = parseResult(res);
      assert.equal(result.width, 1280);
    });

    it('applies style override', async () => {
      const res = await server.callTool('mockup_create_screen_layout', {
        project_id: projectId,
        name: 'Styled Screen',
        sections: [{ type: 'navbar' }],
        style: 'flat',
      });

      const result = parseResult(res);
      const screen_id = result.screen_id;

      const project = await store.getProject(projectId);
      const screen = project.screens.find(s => s.id === screen_id);
      assert.equal(screen.style, 'flat');
    });

    it('calculates height from sections when less than default', async () => {
      const res = await server.callTool('mockup_create_screen_layout', {
        project_id: projectId,
        name: 'Tall Sections',
        sections: [
          { type: 'navbar' }, // 60px
          { type: 'hero_with_cta' }, // 300px
          { type: 'card_grid_3' }, // 280px
          { type: 'footer' }, // 80px
        ],
        height: 500,
      });

      const result = parseResult(res);
      // Total sections = 720px, which is > 500px, so height should be 720px
      assert.ok(result.height >= 720, `Height ${result.height} should be >= 720`);
    });

    it('handles all 10 section types', async () => {
      const sectionTypes = [
        'navbar',
        'hero_with_cta',
        'login_form',
        'card_grid_3',
        'card_grid_2',
        'settings_panel',
        'profile_header',
        'search_bar',
        'feature_list',
        'footer',
      ];

      for (const type of sectionTypes) {
        const res = await server.callTool('mockup_create_screen_layout', {
          project_id: projectId,
          name: `Test ${type}`,
          sections: [{ type }],
        });

        const result = parseResult(res);
        assert.ok(result.screen_id, `Failed to create screen with section: ${type}`);
        assert.ok(result.element_count > 0, `No elements for section: ${type}`);
      }
    });
  });
});
