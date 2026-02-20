import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore } from '../../src/storage/project-store.js';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('group tools integration', () => {
  let store, projectId, screenId, el1Id, el2Id;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'grptools-'));
    store = new ProjectStore(dir);
    await store.init();
    const p = await store.createProject('Group Tool Test');
    projectId = p.id;
    const s = await store.addScreen(projectId, 'Screen');
    screenId = s.id;
    const e1 = await store.addElement(projectId, screenId, 'text', 0, 0, 100, 30, { content: 'X' });
    const e2 = await store.addElement(projectId, screenId, 'text', 0, 40, 100, 30, { content: 'Y' });
    el1Id = e1.id; el2Id = e2.id;
  });

  it('group + ungroup round-trip', async () => {
    const group = await store.groupElements(projectId, screenId, [el1Id, el2Id], 'TestGroup');
    assert.ok(group.id.startsWith('grp_'));

    await store.ungroupElements(projectId, screenId, group.id);
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === screenId);
    assert.equal(screen.groups.length, 0);
    assert.equal(screen.elements.length, 2);
  });

  it('moveGroup offsets correct elements', async () => {
    const group = await store.groupElements(projectId, screenId, [el1Id, el2Id]);
    await store.moveGroup(projectId, screenId, group.id, 10, 20);
    const els = await store.listElements(projectId, screenId);
    assert.equal(els.find(e => e.id === el1Id).x, 10);
    assert.equal(els.find(e => e.id === el1Id).y, 20);
    assert.equal(els.find(e => e.id === el2Id).x, 10);
    assert.equal(els.find(e => e.id === el2Id).y, 60);
  });
});
