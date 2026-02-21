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
