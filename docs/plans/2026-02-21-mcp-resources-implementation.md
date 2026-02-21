# MCP Resources Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 5 MCP resources exposing project data, screen previews, template catalog, and component catalog via `mockup://` URI scheme.

**Architecture:** New `src/mcp/resources.js` module with `registerResources(server, store)` called alongside `registerAllTools`. Static resources for catalogs, `ResourceTemplate` for dynamic project/screen lookups. Preview uses lazy PNG rendering with in-memory content-hash cache.

**Tech Stack:** Node.js ESM, `@modelcontextprotocol/sdk` ResourceTemplate, `crypto` for hashing, existing `screenshot.js` + `html-builder.js` for preview rendering.

---

### Task 1: Static resources — projects, templates, components

**Files:**
- Create: `src/mcp/resources.js`
- Create: `tests/mcp/resources.test.js`

**Step 1: Write the failing tests**

In `tests/mcp/resources.test.js`:

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProjectStore } from '../../src/storage/project-store.js';
import { registerResources } from '../../src/mcp/resources.js';

describe('MCP Resources — static', () => {
  let server;
  let store;
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mcp-res-'));
    store = new ProjectStore(tmpDir);
    await store.init();
    server = new McpServer({ name: 'test', version: '0.0.1' });
    await registerResources(server, store);
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('registers resources without errors', () => {
    // If we got here, registerResources didn't throw
    assert.ok(true);
  });

  it('projects resource returns empty list initially', async () => {
    const result = await server.resource('mockup://projects');
    const data = JSON.parse(result.contents[0].text);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 0);
  });

  it('projects resource returns created project', async () => {
    await store.createProject('Test App', 'desc', undefined, 'wireframe');
    const result = await server.resource('mockup://projects');
    const data = JSON.parse(result.contents[0].text);
    assert.equal(data.length, 1);
    assert.equal(data[0].name, 'Test App');
  });

  it('templates resource returns 7 templates', async () => {
    const result = await server.resource('mockup://templates');
    const data = JSON.parse(result.contents[0].text);
    assert.equal(data.length, 7);
    assert.ok(data.some(t => t.name === 'login'));
    assert.ok(data.every(t => t.description));
  });

  it('components resource returns 35 component types', async () => {
    const result = await server.resource('mockup://components');
    const data = JSON.parse(result.contents[0].text);
    assert.equal(data.length, 35);
    assert.ok(data.some(c => c.type === 'button'));
    assert.ok(data.every(c => c.defaults));
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/mcp/resources.test.js`
Expected: FAIL — module not found

**Step 3: Write implementation**

In `src/mcp/resources.js`:

```javascript
// MCP Resource registration — exposes project data and catalogs via mockup:// URIs.

import { getAvailableTemplates, getTemplate } from '../renderer/templates/index.js';
import { getAvailableTypes, getComponent } from '../renderer/components/index.js';

/**
 * Register all MCP resources on the given server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('../storage/project-store.js').ProjectStore} store
 */
export async function registerResources(server, store) {
  // --- Static: project list ---
  server.resource(
    'projects-list',
    'mockup://projects',
    { description: 'List of all mockup projects (summary)' },
    async (uri) => ({
      contents: [{
        uri: uri.toString(),
        text: JSON.stringify(await store.listProjects()),
        mimeType: 'application/json',
      }],
    })
  );

  // --- Static: template catalog ---
  server.resource(
    'templates-catalog',
    'mockup://templates',
    { description: 'Available screen templates with descriptions' },
    async (uri) => {
      const names = getAvailableTemplates();
      const catalog = names.map(name => {
        const tpl = getTemplate(name);
        return { name, description: tpl.description || '' };
      });
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(catalog),
          mimeType: 'application/json',
        }],
      };
    }
  );

  // --- Static: component catalog ---
  server.resource(
    'components-catalog',
    'mockup://components',
    { description: 'Available UI component types with default properties' },
    async (uri) => {
      const types = getAvailableTypes();
      const catalog = types.map(type => {
        const comp = getComponent(type);
        return { type, defaults: comp.defaults ? comp.defaults() : {} };
      });
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(catalog),
          mimeType: 'application/json',
        }],
      };
    }
  );

  console.error('[MockupMCP] 3 static resources registered');
}
```

**Step 4: Run tests to verify they pass**

Run: `node --test tests/mcp/resources.test.js`
Expected: 5 PASS

**NOTE:** The `server.resource()` API may need adjustment — the SDK's `McpServer.resource()` might not support direct invocation for testing. If tests fail because `server.resource()` is a registration method (not a read method), we need to test differently. In that case:
- Use `server._registeredResources` or check the SDK for a `readResource` method
- Alternatively, test by creating a client transport pair

If the direct `server.resource(uri)` call doesn't work for reading, adjust the test to use the lower-level `server.server.request()` or create an in-memory transport. The agent implementing this should check the SDK API and adapt the test accordingly.

**Step 5: Commit**

```bash
git add src/mcp/resources.js tests/mcp/resources.test.js
git commit -m "feat: MCP resources — projects, templates, components catalogs"
```

---

### Task 2: Dynamic resource — project detail

**Files:**
- Modify: `src/mcp/resources.js`
- Modify: `tests/mcp/resources.test.js`

**Step 1: Write the failing tests**

APPEND to `tests/mcp/resources.test.js` a new describe block:

```javascript
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('MCP Resources — project detail', () => {
  let server;
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
    server = new McpServer({ name: 'test', version: '0.0.1' });
    await registerResources(server, store);
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns full project with screens', async () => {
    const uri = `mockup://projects/${projectId}`;
    const result = await server.resource(uri);
    const data = JSON.parse(result.contents[0].text);
    assert.equal(data.id, projectId);
    assert.equal(data.name, 'Detail Test');
    assert.ok(Array.isArray(data.screens));
    assert.equal(data.screens.length, 1);
    assert.equal(data.screens[0].name, 'Home');
  });

  it('returns error for nonexistent project', async () => {
    const uri = 'mockup://projects/proj_nonexistent';
    try {
      await server.resource(uri);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('not found') || err.message.includes('Not found'));
    }
  });
});
```

**Step 2: Run tests to verify the new ones fail**

Run: `node --test tests/mcp/resources.test.js`

**Step 3: Add ResourceTemplate to resources.js**

APPEND inside `registerResources()`, after the static resources:

```javascript
  // --- Dynamic: project detail ---
  const { ResourceTemplate } = await import('@modelcontextprotocol/sdk/server/mcp.js');

  const projectTemplate = new ResourceTemplate('mockup://projects/{projectId}', {
    list: async () => {
      const projects = await store.listProjects();
      return {
        resources: projects.map(p => ({
          uri: `mockup://projects/${p.id}`,
          name: p.name,
        })),
      };
    },
  });

  server.resource(
    'project-detail',
    projectTemplate,
    { description: 'Full project definition with all screens and elements' },
    async (uri, variables) => {
      const project = await store.getProject(variables.projectId);
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(project),
          mimeType: 'application/json',
        }],
      };
    }
  );
```

Update the log line to: `console.error('[MockupMCP] 3 static + 1 dynamic resources registered');`

**Step 4: Run tests**

Run: `node --test tests/mcp/resources.test.js`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/mcp/resources.js tests/mcp/resources.test.js
git commit -m "feat: MCP resource — project detail with ResourceTemplate"
```

---

### Task 3: Dynamic resource — screen preview with cache

**Files:**
- Modify: `src/mcp/resources.js`
- Create: `tests/mcp/resources-preview.test.js`

**Step 1: Write the failing tests**

In `tests/mcp/resources-preview.test.js`:

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { PreviewCache } from '../../src/mcp/resources.js';

describe('PreviewCache', () => {
  it('returns null on cache miss', () => {
    const cache = new PreviewCache();
    assert.equal(cache.get('proj_1', 'scr_1', []), null);
  });

  it('stores and retrieves cached PNG', () => {
    const cache = new PreviewCache();
    const elements = [{ type: 'button', x: 0, y: 0 }];
    const png = Buffer.from('fake-png');
    cache.set('proj_1', 'scr_1', elements, png);
    assert.deepEqual(cache.get('proj_1', 'scr_1', elements), png);
  });

  it('invalidates on element change', () => {
    const cache = new PreviewCache();
    const elements1 = [{ type: 'button', x: 0, y: 0 }];
    const elements2 = [{ type: 'button', x: 10, y: 0 }];
    cache.set('proj_1', 'scr_1', elements1, Buffer.from('png1'));
    assert.equal(cache.get('proj_1', 'scr_1', elements2), null);
  });

  it('handles different screens independently', () => {
    const cache = new PreviewCache();
    const elements = [{ type: 'text' }];
    cache.set('proj_1', 'scr_1', elements, Buffer.from('png-a'));
    cache.set('proj_1', 'scr_2', elements, Buffer.from('png-b'));
    assert.deepEqual(cache.get('proj_1', 'scr_1', elements), Buffer.from('png-a'));
    assert.deepEqual(cache.get('proj_1', 'scr_2', elements), Buffer.from('png-b'));
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/mcp/resources-preview.test.js`
Expected: FAIL — PreviewCache not exported

**Step 3: Add PreviewCache class and preview resource to resources.js**

Add at the TOP of `src/mcp/resources.js` (before registerResources):

```javascript
import { createHash } from 'node:crypto';

/**
 * In-memory cache for screen preview PNGs.
 * Keyed by projectId/screenId, invalidated by content hash of elements.
 */
export class PreviewCache {
  constructor() {
    /** @type {Map<string, {hash: string, png: Buffer}>} */
    this._cache = new Map();
  }

  _key(projectId, screenId) {
    return `${projectId}/${screenId}`;
  }

  _hash(elements) {
    return createHash('md5').update(JSON.stringify(elements)).digest('hex');
  }

  get(projectId, screenId, elements) {
    const entry = this._cache.get(this._key(projectId, screenId));
    if (!entry) return null;
    if (entry.hash !== this._hash(elements)) return null;
    return entry.png;
  }

  set(projectId, screenId, elements, png) {
    this._cache.set(this._key(projectId, screenId), {
      hash: this._hash(elements),
      png,
    });
  }
}
```

APPEND inside `registerResources()`, after project-detail:

```javascript
  // --- Dynamic: screen preview (PNG, lazy render + cache) ---
  const { buildScreenHtml } = await import('../renderer/html-builder.js');
  const { takeScreenshot } = await import('../renderer/screenshot.js');

  const previewCache = new PreviewCache();

  const previewTemplate = new ResourceTemplate(
    'mockup://projects/{projectId}/screens/{screenId}/preview',
    {
      list: async () => {
        const projects = await store.listProjects();
        const resources = [];
        for (const p of projects) {
          const fullProject = await store.getProject(p.id);
          for (const scr of fullProject.screens) {
            resources.push({
              uri: `mockup://projects/${p.id}/screens/${scr.id}/preview`,
              name: `${p.name} — ${scr.name} (preview)`,
            });
          }
        }
        return { resources };
      },
    }
  );

  server.resource(
    'screen-preview',
    previewTemplate,
    { description: 'PNG preview of a screen (base64-encoded)', mimeType: 'image/png' },
    async (uri, variables) => {
      const { projectId, screenId } = variables;
      const project = await store.getProject(projectId);
      const screen = project.screens.find(s => s.id === screenId);
      if (!screen) throw new Error(`Screen ${screenId} not found`);

      const style = screen.style || project.style || 'wireframe';

      // Check cache
      let png = previewCache.get(projectId, screenId, screen.elements);
      if (!png) {
        const html = buildScreenHtml(screen, style);
        png = await takeScreenshot(html, screen.width, screen.height);
        previewCache.set(projectId, screenId, screen.elements, png);
      }

      return {
        contents: [{
          uri: uri.toString(),
          blob: png.toString('base64'),
          mimeType: 'image/png',
        }],
      };
    }
  );
```

Update the log line to: `console.error('[MockupMCP] 3 static + 2 dynamic resources registered');`

**Step 4: Run cache tests**

Run: `node --test tests/mcp/resources-preview.test.js`
Expected: 4 PASS

**Step 5: Commit**

```bash
git add src/mcp/resources.js tests/mcp/resources-preview.test.js
git commit -m "feat: MCP resource — screen preview with lazy render cache"
```

---

### Task 4: Wire into server entry points

**Files:**
- Modify: `src/index.js`
- Modify: `src/mcp/http-transport.js`

**Step 1: Update src/index.js**

Add import at top:
```javascript
import { registerResources } from './mcp/resources.js';
```

After `await registerAllTools(mcpServer, store);` (line 41), add:
```javascript
    await registerResources(mcpServer, store);
```

**Step 2: Update src/mcp/http-transport.js**

Add import at top:
```javascript
import { registerResources } from './resources.js';
```

After `await registerAllTools(server, store);` (line 168), add:
```javascript
  await registerResources(server, store);
```

**Step 3: Run full test suite**

Run: `node --test tests/**/*.test.js tests/**/**/*.test.js`
Expected: 578+ existing tests PASS + new resource tests PASS, 0 FAIL

**Step 4: Commit**

```bash
git add src/index.js src/mcp/http-transport.js
git commit -m "feat: wire MCP resources into stdio + HTTP transports"
```

---

### Task 5: PM docs + regression

**Files:**
- Modify: `PM/milestones.md`

**Step 1: Run full test suite**

Run: `node --test tests/**/*.test.js tests/**/**/*.test.js`
Expected: all PASS, 0 FAIL

**Step 2: Update milestones.md**

Change M4 status from `IN PROGRESS` to `DONE` and add M5 section:

```markdown
## M4 — Screen Generation (Phase 4)
**Status:** DONE
...

## M5 — MCP Resources (Phase 5)
**Status:** DONE
**Branch:** `feature/m5-mcp-resources`
**Scope:** 5 MCP resources via mockup:// URI scheme
**DoD:**
- [x] mockup://projects — project list (static)
- [x] mockup://templates — template catalog (static)
- [x] mockup://components — component catalog with defaults (static)
- [x] mockup://projects/{id} — full project detail (dynamic)
- [x] mockup://projects/{id}/screens/{id}/preview — PNG preview with cache (dynamic)
- [x] Wired into both stdio and HTTP transports
- [x] All tests pass
```

**Step 3: Commit**

```bash
git add PM/milestones.md
git commit -m "docs: M5 milestone — MCP resources"
```
