import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore } from '../../src/storage/project-store.js';
import { getGenerator, getAvailableFrameworks } from '../../src/codegen/index.js';
import { generateMermaid } from '../../src/codegen/flow.js';
import { buildScreenHtml } from '../../src/renderer/html-builder.js';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('M3a integration — full workflow', () => {
  let store, projectId, loginScreenId, dashScreenId, btnId;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'm3a-'));
    store = new ProjectStore(dir);
    await store.init();

    // Create project with 2 screens
    const project = await store.createProject('Integration Test App');
    projectId = project.id;

    const login = await store.addScreen(projectId, 'Login');
    const dash = await store.addScreen(projectId, 'Dashboard');
    loginScreenId = login.id;
    dashScreenId = dash.id;

    // Add elements to login screen
    const btn = await store.addElement(projectId, loginScreenId, 'button', 20, 200, 353, 48, { label: 'Sign In', variant: 'primary' });
    btnId = btn.id;
    await store.addElement(projectId, loginScreenId, 'text', 20, 40, 353, 50, { content: 'Welcome Back', fontSize: 28 });
    await store.addElement(projectId, loginScreenId, 'input', 20, 120, 353, 44, { placeholder: 'Email', type: 'email' });

    // Add elements to dashboard
    await store.addElement(projectId, dashScreenId, 'navbar', 0, 0, 393, 56, { title: 'Dashboard' });
    await store.addElement(projectId, dashScreenId, 'card', 20, 80, 353, 120, { title: 'Stats', subtitle: 'Today' });
  });

  it('navigation: add link from button to dashboard', async () => {
    const linked = await store.addLink(projectId, loginScreenId, btnId, dashScreenId, 'push');
    assert.ok(linked.properties.link_to);
    assert.equal(linked.properties.link_to.screen_id, dashScreenId);
    assert.equal(linked.properties.link_to.transition, 'push');
  });

  it('navigation: getLinksForProject returns all links', async () => {
    await store.addLink(projectId, loginScreenId, btnId, dashScreenId, 'push');
    const links = await store.getLinksForProject(projectId);
    assert.equal(links.length, 1);
    assert.equal(links[0].from_screen_name, 'Login');
    assert.equal(links[0].to_screen_name, 'Dashboard');
  });

  it('grouping: group elements on login screen', async () => {
    const els = await store.listElements(projectId, loginScreenId);
    const group = await store.groupElements(projectId, loginScreenId, [els[0].id, els[1].id], 'Header');
    assert.ok(group.id.startsWith('grp_'));
    assert.equal(group.element_ids.length, 2);
  });

  it('grouping: moveGroup shifts elements by delta', async () => {
    const els = await store.listElements(projectId, loginScreenId);
    const group = await store.groupElements(projectId, loginScreenId, [els[0].id, els[1].id]);
    const origX = els[0].x;
    await store.moveGroup(projectId, loginScreenId, group.id, 10, 20);
    const updated = await store.listElements(projectId, loginScreenId);
    assert.equal(updated.find(e => e.id === els[0].id).x, origX + 10);
  });

  it('opacity: html-builder renders opacity for elements with opacity property', async () => {
    await store.updateElement(projectId, loginScreenId, btnId, { opacity: 0.5 });
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === loginScreenId);
    const html = buildScreenHtml(screen);
    assert.ok(html.includes('opacity:0.5'));
  });

  it('link attributes: html-builder adds data-link-to when link_to exists', async () => {
    await store.addLink(projectId, loginScreenId, btnId, dashScreenId, 'fade');
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === loginScreenId);
    const html = buildScreenHtml(screen);
    assert.ok(html.includes(`data-link-to="${dashScreenId}"`));
    assert.ok(html.includes('data-transition="fade"'));
    assert.ok(html.includes('cursor:pointer'));
  });

  it('codegen: all 4 frameworks registered', () => {
    const frameworks = getAvailableFrameworks();
    assert.equal(frameworks.length, 4);
    assert.ok(frameworks.includes('html'));
    assert.ok(frameworks.includes('react'));
    assert.ok(frameworks.includes('flutter'));
    assert.ok(frameworks.includes('swiftui'));
  });

  it('codegen: all 4 frameworks generate valid code for login screen', async () => {
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === loginScreenId);

    for (const fw of getAvailableFrameworks()) {
      const gen = getGenerator(fw);
      const code = gen.generate(screen);
      assert.ok(code.length > 50, `${fw} code should be substantial`);
      assert.ok(code.includes('Sign In'), `${fw} code should include button label`);
    }
  });

  it('flow: mermaid diagram includes screens and links', async () => {
    await store.addLink(projectId, loginScreenId, btnId, dashScreenId, 'push');
    const project = await store.getProject(projectId);
    const mermaid = generateMermaid(project);

    assert.ok(mermaid.startsWith('graph LR'));
    assert.ok(mermaid.includes('[Login]'));
    assert.ok(mermaid.includes('[Dashboard]'));
    assert.ok(mermaid.includes('-->'));
    assert.ok(mermaid.includes('button: Sign In'));
  });

  it('end-to-end: create → link → group → codegen → flow', async () => {
    // Link button to dashboard
    await store.addLink(projectId, loginScreenId, btnId, dashScreenId, 'push');

    // Group text + input on login screen
    const els = await store.listElements(projectId, loginScreenId);
    const textEl = els.find(e => e.type === 'text');
    const inputEl = els.find(e => e.type === 'input');
    const group = await store.groupElements(projectId, loginScreenId, [textEl.id, inputEl.id], 'FormHeader');
    assert.ok(group.id.startsWith('grp_'));

    // Set opacity on button
    await store.updateElement(projectId, loginScreenId, btnId, { opacity: 0.9 });

    // Generate code for all frameworks
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === loginScreenId);
    for (const fw of getAvailableFrameworks()) {
      const code = getGenerator(fw).generate(screen);
      assert.ok(code.length > 50);
    }

    // Generate flow diagram
    const mermaid = generateMermaid(project);
    assert.ok(mermaid.includes('-->'));

    // Render HTML with opacity + link attributes
    const html = buildScreenHtml(screen);
    assert.ok(html.includes('opacity:0.9'));
    assert.ok(html.includes('data-link-to'));
  });
});
