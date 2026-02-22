// Unit tests for MCP Prompts — screenshot module is replaced via ESM loader hook
// so Puppeteer is not required. The loader must be registered before prompts.js
// is imported so the module cache never sees the real screenshot implementation.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// Register the loader hook using the percent-encoded path (required because the
// project directory contains `###` characters which are URI-reserved).
const LOADER_URL =
  'file:///Users/maciejgajda/Documents/%23%23%23%20MACIEK%20%23%23%23/002%20WORK/MGGS/MGGS%20MockupMCP/tests/mcp/_screenshot-loader.mjs';
register(LOADER_URL, pathToFileURL('./'));

// Dynamic import so the module resolution runs AFTER the loader is registered.
const { registerPrompts } = await import('../../src/mcp/prompts.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class MockServer {
  constructor() {
    this.prompts = new Map();
  }

  prompt(name, config, handler) {
    this.prompts.set(name, { config, handler });
  }

  async callPrompt(name, args) {
    const entry = this.prompts.get(name);
    if (!entry) throw new Error(`Prompt "${name}" not registered`);
    return entry.handler(args);
  }
}

function createMockStore() {
  const project = {
    id: 'proj_test',
    name: 'Test Project',
    style: 'wireframe',
    screens: [
      {
        id: 'scr_a',
        name: 'Screen A',
        width: 393,
        height: 852,
        style: 'wireframe',
        elements: [
          { id: 'el_1', type: 'navbar', x: 0, y: 0, width: 393, height: 56, properties: { title: 'Home' } },
          { id: 'el_2', type: 'button', x: 96, y: 400, width: 200, height: 48, properties: { label: 'Click', variant: 'primary', size: 'md' } },
        ],
      },
      {
        id: 'scr_b',
        name: 'Screen B',
        width: 393,
        height: 852,
        style: 'wireframe',
        elements: [
          { id: 'el_3', type: 'navbar', x: 0, y: 0, width: 393, height: 56, properties: { title: 'Settings' } },
          { id: 'el_4', type: 'input', x: 16, y: 80, width: 361, height: 44, properties: { placeholder: 'Search', label: 'Search' } },
        ],
      },
    ],
  };

  return {
    getProject: async (id) => {
      if (id !== 'proj_test') throw new Error(`Project ${id} not found`);
      return project;
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture — shared across all describe blocks
// ---------------------------------------------------------------------------

let server;

before(() => {
  server = new MockServer();
  registerPrompts(server, createMockStore());
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP Prompts', () => {
  describe('registration', () => {
    it('registers 3 prompts', () => {
      assert.equal(server.prompts.size, 3);
    });

    it('registers mockup_design_review', () => {
      assert.ok(server.prompts.has('mockup_design_review'));
    });

    it('registers mockup_accessibility_check', () => {
      assert.ok(server.prompts.has('mockup_accessibility_check'));
    });

    it('registers mockup_compare_screens', () => {
      assert.ok(server.prompts.has('mockup_compare_screens'));
    });
  });

  describe('mockup_design_review', () => {
    it('returns messages with text and image content', async () => {
      const result = await server.callPrompt('mockup_design_review', {
        project_id: 'proj_test',
        screen_id: 'scr_a',
      });

      assert.ok(Array.isArray(result.messages));
      assert.equal(result.messages.length, 1);

      const msg = result.messages[0];
      assert.equal(msg.role, 'user');

      const content = msg.content;
      assert.ok(Array.isArray(content));
      assert.equal(content.length, 2);
      assert.equal(content[0].type, 'text');
      assert.equal(content[1].type, 'image');
    });

    it('includes screen name in text', async () => {
      const result = await server.callPrompt('mockup_design_review', {
        project_id: 'proj_test',
        screen_id: 'scr_a',
      });

      const text = result.messages[0].content[0].text;
      assert.ok(text.includes('Screen A'));
    });

    it('includes element data in text', async () => {
      const result = await server.callPrompt('mockup_design_review', {
        project_id: 'proj_test',
        screen_id: 'scr_a',
      });

      const text = result.messages[0].content[0].text;
      // Element type names appear in the serialised elements JSON block.
      assert.ok(text.includes('navbar'));
      assert.ok(text.includes('button'));
    });

    it('image block carries base64 data and PNG mime type', async () => {
      const result = await server.callPrompt('mockup_design_review', {
        project_id: 'proj_test',
        screen_id: 'scr_a',
      });

      const image = result.messages[0].content[1];
      assert.ok(image.data && image.data.length > 0);
      assert.equal(image.mimeType, 'image/png');
    });

    it('returns error message for nonexistent screen', async () => {
      const result = await server.callPrompt('mockup_design_review', {
        project_id: 'proj_test',
        screen_id: 'scr_nonexistent',
      });

      const msg = result.messages[0];
      // Error path uses a single content object, success path uses an array.
      const text = Array.isArray(msg.content) ? msg.content[0].text : msg.content.text;
      assert.ok(text.includes('Error'));
    });
  });

  describe('mockup_accessibility_check', () => {
    it('returns messages with text and image content', async () => {
      const result = await server.callPrompt('mockup_accessibility_check', {
        project_id: 'proj_test',
        screen_id: 'scr_a',
      });

      assert.ok(Array.isArray(result.messages));
      const msg = result.messages[0];
      assert.equal(msg.role, 'user');

      const content = msg.content;
      assert.ok(Array.isArray(content));
      assert.equal(content.length, 2);
      assert.equal(content[0].type, 'text');
      assert.equal(content[1].type, 'image');
    });

    it('includes accessibility criteria in text', async () => {
      const result = await server.callPrompt('mockup_accessibility_check', {
        project_id: 'proj_test',
        screen_id: 'scr_a',
      });

      const text = result.messages[0].content[0].text;
      // The prompt explicitly mentions touch targets and the 44px minimum.
      const mentionsCriteria =
        text.includes('touch target') || text.includes('contrast') || text.includes('44');
      assert.ok(mentionsCriteria);
    });

    it('returns error message for nonexistent project', async () => {
      const result = await server.callPrompt('mockup_accessibility_check', {
        project_id: 'proj_nonexistent',
        screen_id: 'scr_a',
      });

      const msg = result.messages[0];
      const text = Array.isArray(msg.content) ? msg.content[0].text : msg.content.text;
      assert.ok(text.includes('Error'));
    });
  });

  describe('mockup_compare_screens', () => {
    it('returns messages with text and two images', async () => {
      const result = await server.callPrompt('mockup_compare_screens', {
        project_id: 'proj_test',
        screen_id_a: 'scr_a',
        screen_id_b: 'scr_b',
      });

      assert.ok(Array.isArray(result.messages));
      const msg = result.messages[0];
      assert.equal(msg.role, 'user');

      const content = msg.content;
      assert.ok(Array.isArray(content));
      // text + image for screen A + image for screen B
      assert.equal(content.length, 3);
      assert.equal(content[0].type, 'text');
      assert.equal(content[1].type, 'image');
      assert.equal(content[2].type, 'image');
    });

    it('includes both screen names in text', async () => {
      const result = await server.callPrompt('mockup_compare_screens', {
        project_id: 'proj_test',
        screen_id_a: 'scr_a',
        screen_id_b: 'scr_b',
      });

      const text = result.messages[0].content[0].text;
      assert.ok(text.includes('Screen A'));
      assert.ok(text.includes('Screen B'));
    });

    it('includes both screens element data in text', async () => {
      const result = await server.callPrompt('mockup_compare_screens', {
        project_id: 'proj_test',
        screen_id_a: 'scr_a',
        screen_id_b: 'scr_b',
      });

      const text = result.messages[0].content[0].text;
      // Both screens share a navbar; scr_a has a button, scr_b has an input.
      assert.ok(text.includes('navbar'));
      assert.ok(text.includes('button'));
      assert.ok(text.includes('input'));
    });

    it('both image blocks carry base64 data and PNG mime type', async () => {
      const result = await server.callPrompt('mockup_compare_screens', {
        project_id: 'proj_test',
        screen_id_a: 'scr_a',
        screen_id_b: 'scr_b',
      });

      const content = result.messages[0].content;
      assert.ok(content[1].data && content[1].data.length > 0);
      assert.ok(content[2].data && content[2].data.length > 0);
      assert.equal(content[1].mimeType, 'image/png');
      assert.equal(content[2].mimeType, 'image/png');
    });

    it('returns error for nonexistent screen', async () => {
      const result = await server.callPrompt('mockup_compare_screens', {
        project_id: 'proj_test',
        screen_id_a: 'scr_a',
        screen_id_b: 'scr_nonexistent',
      });

      const msg = result.messages[0];
      const text = Array.isArray(msg.content) ? msg.content[0].text : msg.content.text;
      assert.ok(text.includes('Error'));
    });
  });
});
