import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore } from '../../src/storage/project-store.js';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('group storage', () => {
  let store, projectId, screenId, el1Id, el2Id, el3Id;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'groups-'));
    store = new ProjectStore(dir);
    await store.init();
    const p = await store.createProject('Group Test');
    projectId = p.id;
    const s = await store.addScreen(projectId, 'Main');
    screenId = s.id;
    const e1 = await store.addElement(projectId, screenId, 'text', 10, 10, 100, 30, { content: 'A' });
    const e2 = await store.addElement(projectId, screenId, 'text', 10, 50, 100, 30, { content: 'B' });
    const e3 = await store.addElement(projectId, screenId, 'button', 10, 90, 100, 40, { label: 'C' });
    el1Id = e1.id; el2Id = e2.id; el3Id = e3.id;
  });

  it('groupElements creates group with grp_ prefix ID', async () => {
    const group = await store.groupElements(projectId, screenId, [el1Id, el2Id], 'Header');
    assert.ok(group.id.startsWith('grp_'));
    assert.equal(group.name, 'Header');
    assert.deepStrictEqual(group.element_ids, [el1Id, el2Id]);
  });

  it('groupElements adds groups array to screen', async () => {
    await store.groupElements(projectId, screenId, [el1Id, el2Id]);
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === screenId);
    assert.equal(screen.groups.length, 1);
  });

  it('groupElements validates all element IDs exist', async () => {
    await assert.rejects(
      () => store.groupElements(projectId, screenId, [el1Id, 'el_fake12345']),
      /not found/
    );
  });

  it('groupElements requires at least 2 elements', async () => {
    await assert.rejects(
      () => store.groupElements(projectId, screenId, [el1Id]),
      /at least 2/
    );
  });

  it('ungroupElements removes group, keeps elements', async () => {
    const group = await store.groupElements(projectId, screenId, [el1Id, el2Id]);
    await store.ungroupElements(projectId, screenId, group.id);
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === screenId);
    assert.equal(screen.groups.length, 0);
    assert.equal(screen.elements.length, 3);
  });

  it('moveGroup shifts all elements by delta', async () => {
    const group = await store.groupElements(projectId, screenId, [el1Id, el2Id]);
    await store.moveGroup(projectId, screenId, group.id, 50, 100);
    const els = await store.listElements(projectId, screenId);
    const e1 = els.find(e => e.id === el1Id);
    const e2 = els.find(e => e.id === el2Id);
    const e3 = els.find(e => e.id === el3Id);
    assert.equal(e1.x, 60); assert.equal(e1.y, 110);
    assert.equal(e2.x, 60); assert.equal(e2.y, 150);
    assert.equal(e3.x, 10); assert.equal(e3.y, 90);
  });
});
