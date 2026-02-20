import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProjectStore } from '../../src/storage/project-store.js';

describe('mockup_generate_screen integration', () => {
  let store;
  let tmpDir;
  let projectId;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gen-screen-'));
    store = new ProjectStore(tmpDir);
    await store.init();
    const project = await store.createProject('Test Project', '', undefined, 'wireframe');
    projectId = project.id;
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('generates screen with elements from "login screen with email and password"', async () => {
    const { generateScreen } = await import('../../src/mcp/screen-generator.js');
    const project = await store.getProject(projectId);
    const { elements, matchInfo, nameHint } = generateScreen(
      'login screen with email and password',
      project.viewport.width, project.viewport.height, project.style
    );

    const screen = await store.addScreen(projectId, nameHint);
    const populated = await store.applyTemplate(projectId, screen.id, elements, true);

    assert.ok(populated.elements.length >= 5);
    assert.ok(populated.elements.every(el => el.id.startsWith('el_')));
    assert.equal(matchInfo.template, 'login');
    assert.equal(matchInfo.confidence, 'high');
  });

  it('generates fallback screen for unrecognized description', async () => {
    const { generateScreen } = await import('../../src/mcp/screen-generator.js');
    const project = await store.getProject(projectId);
    const { elements, matchInfo } = generateScreen(
      'alien spaceship cockpit',
      project.viewport.width, project.viewport.height, project.style
    );

    const screen = await store.addScreen(projectId, 'Test');
    const populated = await store.applyTemplate(projectId, screen.id, elements, true);

    assert.ok(populated.elements.length >= 2);
    assert.equal(matchInfo.confidence, 'low');
    assert.ok(matchInfo.suggestions.includes('login'));
  });

  it('generates all 7 template-matched screens without errors', async () => {
    const { generateScreen } = await import('../../src/mcp/screen-generator.js');
    const descriptions = [
      'login page', 'dashboard overview', 'app settings',
      'product list', 'contact form', 'user profile', 'welcome onboarding'
    ];
    for (const desc of descriptions) {
      const { elements, matchInfo } = generateScreen(desc, 393, 852, 'wireframe');
      assert.ok(elements.length >= 2, `Too few elements for "${desc}"`);
      assert.notEqual(matchInfo.confidence, 'low', `Should match a template for "${desc}"`);
    }
  });
});
