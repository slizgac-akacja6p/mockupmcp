import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore } from '../../src/storage/project-store.js';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('link tools integration', () => {
  let store, projectId, screenId1, screenId2, elementId;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'linktools-'));
    store = new ProjectStore(dir);
    await store.init();
    const project = await store.createProject('Link Tool Test');
    projectId = project.id;
    const s1 = await store.addScreen(projectId, 'Screen A');
    const s2 = await store.addScreen(projectId, 'Screen B');
    screenId1 = s1.id;
    screenId2 = s2.id;
    const el = await store.addElement(projectId, screenId1, 'button', 0, 0, 100, 40, { label: 'Nav' });
    elementId = el.id;
  });

  it('addLink + removeLink round-trip via store methods', async () => {
    // This tests the same path the MCP tools use
    const linked = await store.addLink(projectId, screenId1, elementId, screenId2, 'slide');
    assert.ok(linked.properties.link_to);
    assert.equal(linked.properties.link_to.screen_id, screenId2);
    assert.equal(linked.properties.link_to.transition, 'slide');

    const unlinked = await store.removeLink(projectId, screenId1, elementId);
    assert.equal(unlinked.properties.link_to, undefined);
  });

  it('getLinksForProject aggregates across screens', async () => {
    const el2 = await store.addElement(projectId, screenId2, 'button', 0, 0, 100, 40, { label: 'Back' });
    await store.addLink(projectId, screenId1, elementId, screenId2, 'push');
    await store.addLink(projectId, screenId2, el2.id, screenId1, 'fade');

    const links = await store.getLinksForProject(projectId);
    assert.equal(links.length, 2);
  });
});
