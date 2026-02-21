import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore } from '../../src/storage/project-store.js';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('link storage', () => {
  let store, projectId, screenId1, screenId2, elementId;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'links-'));
    store = new ProjectStore(dir);
    await store.init();
    const project = await store.createProject('Nav Test');
    projectId = project.id;
    const s1 = await store.addScreen(projectId, 'Login');
    const s2 = await store.addScreen(projectId, 'Dashboard');
    screenId1 = s1.id;
    screenId2 = s2.id;
    const el = await store.addElement(projectId, screenId1, 'button', 10, 10, 100, 40, { label: 'Go' });
    elementId = el.id;
  });

  it('addLink sets link_to on element properties', async () => {
    await store.addLink(projectId, screenId1, elementId, screenId2, 'push');
    const els = await store.listElements(projectId, screenId1);
    const el = els.find(e => e.id === elementId);
    assert.deepStrictEqual(el.properties.link_to, { screen_id: screenId2, transition: 'push' });
  });

  it('addLink validates target screen exists', async () => {
    await assert.rejects(
      () => store.addLink(projectId, screenId1, elementId, 'scr_nonexistent', 'push'),
      /not found/
    );
  });

  it('addLink defaults transition to push', async () => {
    await store.addLink(projectId, screenId1, elementId, screenId2);
    const els = await store.listElements(projectId, screenId1);
    const el = els.find(e => e.id === elementId);
    assert.equal(el.properties.link_to.transition, 'push');
  });

  it('removeLink clears link_to from element', async () => {
    await store.addLink(projectId, screenId1, elementId, screenId2, 'push');
    await store.removeLink(projectId, screenId1, elementId);
    const els = await store.listElements(projectId, screenId1);
    const el = els.find(e => e.id === elementId);
    assert.equal(el.properties.link_to, undefined);
  });

  it('getLinksForProject returns all links across screens', async () => {
    await store.addLink(projectId, screenId1, elementId, screenId2, 'fade');
    const links = await store.getLinksForProject(projectId);
    assert.equal(links.length, 1);
    assert.equal(links[0].from_screen, screenId1);
    assert.equal(links[0].from_element, elementId);
    assert.equal(links[0].to_screen, screenId2);
    assert.equal(links[0].transition, 'fade');
  });
});
