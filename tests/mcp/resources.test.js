import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ProjectStore } from '../../src/storage/project-store.js';
import { registerResources } from '../../src/mcp/resources.js';

async function createTestPair(store) {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  await registerResources(server, store);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  await client.connect(clientTransport);
  return { server, client };
}

describe('MCP Resources — static', () => {
  let client;
  let store;
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mcp-res-'));
    store = new ProjectStore(tmpDir);
    await store.init();
    const pair = await createTestPair(store);
    client = pair.client;
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('projects resource returns empty list initially', async () => {
    const result = await client.readResource({ uri: 'mockup://projects' });
    const data = JSON.parse(result.contents[0].text);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 0);
  });

  it('projects resource returns created project', async () => {
    await store.createProject('Test App', 'desc', undefined, 'wireframe');
    const result = await client.readResource({ uri: 'mockup://projects' });
    const data = JSON.parse(result.contents[0].text);
    assert.equal(data.length, 1);
    assert.equal(data[0].name, 'Test App');
  });

  it('templates resource returns 7 templates', async () => {
    const result = await client.readResource({ uri: 'mockup://templates' });
    const data = JSON.parse(result.contents[0].text);
    assert.equal(data.length, 7);
    assert.ok(data.some(t => t.name === 'login'));
    assert.ok(data.every(t => t.description));
  });

  it('components resource returns 35 component types', async () => {
    const result = await client.readResource({ uri: 'mockup://components' });
    const data = JSON.parse(result.contents[0].text);
    assert.equal(data.length, 35);
    assert.ok(data.some(c => c.type === 'button'));
    assert.ok(data.every(c => c.defaults));
  });
});

describe('MCP Resources — project detail', () => {
  let client;
  let store;
  let tmpDir;
  let projectId;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mcp-res-proj-'));
    store = new ProjectStore(tmpDir);
    await store.init();
    const project = await store.createProject('Detail Test', '', undefined, 'wireframe');
    projectId = project.id;
    await store.addScreen(projectId, 'Home');
    const pair = await createTestPair(store);
    client = pair.client;
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns full project with screens', async () => {
    const result = await client.readResource({ uri: `mockup://projects/${projectId}` });
    const data = JSON.parse(result.contents[0].text);
    assert.equal(data.id, projectId);
    assert.equal(data.name, 'Detail Test');
    assert.ok(Array.isArray(data.screens));
    assert.equal(data.screens.length, 1);
    assert.equal(data.screens[0].name, 'Home');
  });

  it('lists available projects in template list callback', async () => {
    const result = await client.listResources();
    // Should include the project in the resource list
    const projectResources = result.resources.filter(r => r.uri.includes(projectId));
    assert.ok(projectResources.length >= 1);
  });
});

describe('MCP Resources — approval', () => {
  let client;
  let store;
  let tmpDir;
  let projectId;
  let screenId;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mcp-res-approval-'));
    store = new ProjectStore(tmpDir);
    await store.init();
    const proj = await store.createProject('Test');
    projectId = proj.id;
    const scr = await store.addScreen(projectId, 'Main');
    screenId = scr.id;
    await store.addElement(projectId, screenId, 'button', 10, 20, 120, 44, { label: 'OK' });
    const pair = await createTestPair(store);
    client = pair.client;
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns not-approved by default', async () => {
    const result = await client.readResource({
      uri: `mockup://projects/${projectId}/screens/${screenId}/approval`,
    });
    const data = JSON.parse(result.contents[0].text);
    // New M23 resource reads status from store — default is 'draft', approved is false
    assert.equal(data.approved, false);
    assert.equal(data.status, 'draft');
    assert.equal(data.version, 1);
    assert.equal(data.parent_screen_id, null);
    assert.ok(Array.isArray(data.unresolved_comments));
  });

  it('returns approved after store update', async () => {
    // New M23 flow: set screen status via store instead of editSessions Map
    await store.updateScreen(projectId, screenId, { status: 'approved' });

    const result = await client.readResource({
      uri: `mockup://projects/${projectId}/screens/${screenId}/approval`,
    });
    const data = JSON.parse(result.contents[0].text);
    assert.equal(data.approved, true);
    assert.equal(data.status, 'approved');
    assert.equal(data.screen_id, screenId);

    // Reset
    await store.updateScreen(projectId, screenId, { status: 'draft' });
  });
});
