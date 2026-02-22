# Interactive Design Editor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Browser-based visual editor in preview with drag-drop canvas, component palette, property inspector, and approval flow for Claude round-trip.

**Architecture:** Layered vanilla JS modules (canvas, palette, inspector, sync, toolbar) loaded in preview HTML. REST API for element CRUD + approval. MCP resource + tool for Claude integration.

**Tech Stack:** Express (existing), vanilla JS (client-side), Node.js built-in test runner, existing ProjectStore.

**Design doc:** `docs/plans/2026-02-22-interactive-editor-design.md`

---

## Milestone M12 — Editor Backend (REST API + Approval + MCP)

### Task 1: Elements REST API

**Files:**
- Create: `src/preview/routes/elements-api.js`
- Test: `tests/preview/routes/elements-api.test.js`

**Step 1: Write failing tests for GET /api/screens/:projectId/:screenId/elements**

```js
// tests/preview/routes/elements-api.test.js
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../../../src/storage/project-store.js';
import { startPreviewServer } from '../../../src/preview/server.js';
import config from '../../../src/config.js';

function request(port, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port, path, method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, json: () => JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Elements REST API', () => {
  let tmpDir, server, port, origDataDir, projectId, screenId;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'editor-api-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;
    const store = new ProjectStore(tmpDir);
    await store.init();
    const proj = await store.createProject('Test Project');
    projectId = proj.id;
    const scr = await store.addScreen(projectId, 'Main');
    screenId = scr.id;
    await store.addElement(projectId, screenId, 'button', 10, 20, 120, 44, { label: 'Click' });
    port = 3100 + Math.floor(Math.random() * 1000);
    server = startPreviewServer(port);
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET returns elements array', async () => {
    const res = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/elements`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 1);
    assert.equal(data[0].type, 'button');
  });

  it('POST adds a new element', async () => {
    const res = await request(port, 'POST', `/api/screens/${projectId}/${screenId}/elements`, {
      type: 'text', x: 50, y: 60, width: 200, height: 30, properties: { content: 'Hello' },
    });
    assert.equal(res.status, 201);
    const el = res.json();
    assert.ok(el.id.startsWith('el_'));
    assert.equal(el.type, 'text');
  });

  it('PATCH updates element position and properties', async () => {
    const getRes = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/elements`);
    const elId = getRes.json()[0].id;
    const res = await request(port, 'PATCH', `/api/screens/${projectId}/${screenId}/elements/${elId}`, {
      x: 100, y: 200, properties: { label: 'Updated' },
    });
    assert.equal(res.status, 200);
    const el = res.json();
    assert.equal(el.x, 100);
    assert.equal(el.properties.label, 'Updated');
  });

  it('DELETE removes element', async () => {
    const getRes = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/elements`);
    const elId = getRes.json()[0].id;
    const res = await request(port, 'DELETE', `/api/screens/${projectId}/${screenId}/elements/${elId}`);
    assert.equal(res.status, 204);
    const listRes = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/elements`);
    assert.equal(listRes.json().length, 0);
  });

  it('GET returns 404 for invalid project', async () => {
    const res = await request(port, 'GET', `/api/screens/invalid/invalid/elements`);
    assert.equal(res.status, 404);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/preview/routes/elements-api.test.js`
Expected: FAIL — routes don't exist yet

**Step 3: Implement elements-api.js**

```js
// src/preview/routes/elements-api.js
import { ProjectStore } from '../../storage/project-store.js';
import config from '../../config.js';

export function registerElementsApi(app) {
  // Body parser for JSON
  app.use('/api/screens', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') return next();
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { req.body = JSON.parse(body); } catch { req.body = {}; }
      next();
    });
  });

  async function getStore() {
    const store = new ProjectStore(config.dataDir);
    await store.init();
    return store;
  }

  // GET elements
  app.get('/api/screens/:projectId/:screenId/elements', async (req, res) => {
    try {
      const store = await getStore();
      const elements = await store.listElements(req.params.projectId, req.params.screenId);
      res.json(elements);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // POST add element
  app.post('/api/screens/:projectId/:screenId/elements', async (req, res) => {
    try {
      const store = await getStore();
      const { type, x, y, width, height, properties = {}, z_index = 0 } = req.body;
      const el = await store.addElement(
        req.params.projectId, req.params.screenId,
        type, x, y, width, height, properties, z_index
      );
      res.status(201).json(el);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // PATCH update element
  app.patch('/api/screens/:projectId/:screenId/elements/:elementId', async (req, res) => {
    try {
      const store = await getStore();
      const { projectId, screenId, elementId } = req.params;
      const { x, y, width, height, z_index, properties } = req.body;
      // Move geometry if provided
      if (x !== undefined || y !== undefined || width !== undefined || height !== undefined || z_index !== undefined) {
        await store.moveElement(projectId, screenId, elementId, x, y, width, height, z_index);
      }
      // Update properties if provided
      let el;
      if (properties) {
        el = await store.updateElement(projectId, screenId, elementId, properties);
      } else {
        const elements = await store.listElements(projectId, screenId);
        el = elements.find(e => e.id === elementId);
      }
      res.json(el);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // DELETE element
  app.delete('/api/screens/:projectId/:screenId/elements/:elementId', async (req, res) => {
    try {
      const store = await getStore();
      await store.deleteElement(req.params.projectId, req.params.screenId, req.params.elementId);
      res.status(204).end();
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });
}
```

**Step 4: Wire into preview server**

In `src/preview/server.js`, add import and call before `app.listen()`:
```js
import { registerElementsApi } from './routes/elements-api.js';
// ... inside startPreviewServer(), before app.listen():
registerElementsApi(app);
```

**Step 5: Run tests to verify they pass**

Run: `node --test tests/preview/routes/elements-api.test.js`
Expected: PASS (5 tests)

**Step 6: Run full suite to verify no regressions**

Run: `npm test`
Expected: all pass + 5 new

**Step 7: Commit**

```bash
git add src/preview/routes/elements-api.js tests/preview/routes/elements-api.test.js src/preview/server.js
git commit -m "feat: elements REST API — GET/POST/PATCH/DELETE for editor"
```

---

### Task 2: Approval API

**Files:**
- Create: `src/preview/routes/approval-api.js`
- Test: `tests/preview/routes/approval-api.test.js`

**Step 1: Write failing tests**

```js
// tests/preview/routes/approval-api.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../../../src/storage/project-store.js';
import { startPreviewServer } from '../../../src/preview/server.js';
import config from '../../../src/config.js';

function request(port, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port, path, method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, json: () => JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Approval REST API', () => {
  let tmpDir, server, port, origDataDir, projectId, screenId;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'approval-api-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;
    const store = new ProjectStore(tmpDir);
    await store.init();
    const proj = await store.createProject('Test');
    projectId = proj.id;
    const scr = await store.addScreen(projectId, 'Main');
    screenId = scr.id;
    await store.addElement(projectId, screenId, 'button', 10, 20, 120, 44, { label: 'OK' });
    port = 3100 + Math.floor(Math.random() * 1000);
    server = startPreviewServer(port);
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('POST /api/screens/:pid/:sid/edit starts edit mode and snapshots elements', async () => {
    const res = await request(port, 'POST', `/api/screens/${projectId}/${screenId}/edit`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.editing, true);
    assert.equal(data.snapshotCount, 1);
  });

  it('GET /api/screens/:pid/:sid/approval returns not-approved by default', async () => {
    const res = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/approval`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.approved, false);
  });

  it('POST /api/screens/:pid/:sid/approve sets approved with summary', async () => {
    // Start edit mode (snapshot)
    await request(port, 'POST', `/api/screens/${projectId}/${screenId}/edit`);
    // Approve
    const res = await request(port, 'POST', `/api/screens/${projectId}/${screenId}/approve`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.approved, true);
    assert.ok(data.approvedAt);
    assert.ok(typeof data.summary === 'string');
  });

  it('approval resets when new edit starts', async () => {
    await request(port, 'POST', `/api/screens/${projectId}/${screenId}/edit`);
    await request(port, 'POST', `/api/screens/${projectId}/${screenId}/approve`);
    // Start new edit
    await request(port, 'POST', `/api/screens/${projectId}/${screenId}/edit`);
    const res = await request(port, 'GET', `/api/screens/${projectId}/${screenId}/approval`);
    assert.equal(res.json().approved, false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/preview/routes/approval-api.test.js`
Expected: FAIL

**Step 3: Implement approval-api.js**

```js
// src/preview/routes/approval-api.js
import { ProjectStore } from '../../storage/project-store.js';
import config from '../../config.js';

// In-memory state per screen (resets on server restart — acceptable for local dev)
const editSessions = new Map(); // key: `${projectId}/${screenId}`

function sessionKey(pid, sid) { return `${pid}/${sid}`; }

export function registerApprovalApi(app) {
  async function getStore() {
    const store = new ProjectStore(config.dataDir);
    await store.init();
    return store;
  }

  // POST start edit mode — snapshot current elements
  app.post('/api/screens/:projectId/:screenId/edit', async (req, res) => {
    try {
      const { projectId, screenId } = req.params;
      const store = await getStore();
      const elements = await store.listElements(projectId, screenId);
      const key = sessionKey(projectId, screenId);
      editSessions.set(key, {
        snapshot: JSON.parse(JSON.stringify(elements)),
        approved: false,
        approvedAt: null,
        summary: null,
      });
      res.json({ editing: true, snapshotCount: elements.length });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // GET approval status
  app.get('/api/screens/:projectId/:screenId/approval', async (req, res) => {
    const key = sessionKey(req.params.projectId, req.params.screenId);
    const session = editSessions.get(key);
    if (!session) {
      return res.json({ approved: false, approvedAt: null, summary: null, elementCount: 0 });
    }
    try {
      const store = await getStore();
      const elements = await store.listElements(req.params.projectId, req.params.screenId);
      res.json({
        approved: session.approved,
        approvedAt: session.approvedAt,
        summary: session.summary,
        elementCount: elements.length,
      });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // POST approve
  app.post('/api/screens/:projectId/:screenId/approve', async (req, res) => {
    try {
      const { projectId, screenId } = req.params;
      const key = sessionKey(projectId, screenId);
      const session = editSessions.get(key);
      const store = await getStore();
      const current = await store.listElements(projectId, screenId);
      const snapshot = session ? session.snapshot : [];
      const summary = buildSummary(snapshot, current);
      const approvedAt = new Date().toISOString();
      editSessions.set(key, { snapshot, approved: true, approvedAt, summary });
      res.json({ approved: true, approvedAt, summary, elementCount: current.length });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });
}

function buildSummary(snapshot, current) {
  const oldIds = new Set(snapshot.map(e => e.id));
  const newIds = new Set(current.map(e => e.id));
  const added = current.filter(e => !oldIds.has(e.id)).length;
  const deleted = snapshot.filter(e => !newIds.has(e.id)).length;
  let moved = 0;
  for (const el of current) {
    const old = snapshot.find(e => e.id === el.id);
    if (old && (old.x !== el.x || old.y !== el.y || old.width !== el.width || old.height !== el.height)) {
      moved++;
    }
  }
  const parts = [];
  if (added) parts.push(`${added} added`);
  if (deleted) parts.push(`${deleted} deleted`);
  if (moved) parts.push(`${moved} moved`);
  return parts.length ? parts.join(', ') : 'no changes';
}

// Exported for testing
export { editSessions, buildSummary };
```

**Step 4: Wire into preview server**

In `src/preview/server.js`:
```js
import { registerApprovalApi } from './routes/approval-api.js';
// inside startPreviewServer(), before app.listen():
registerApprovalApi(app);
```

**Step 5: Run tests**

Run: `node --test tests/preview/routes/approval-api.test.js`
Expected: PASS (4 tests)

**Step 6: Full suite**

Run: `npm test`
Expected: all pass

**Step 7: Commit**

```bash
git add src/preview/routes/approval-api.js tests/preview/routes/approval-api.test.js src/preview/server.js
git commit -m "feat: approval REST API — edit/approve/status with change tracking"
```

---

### Task 3: MCP Approval Resource

**Files:**
- Modify: `src/mcp/resources.js`
- Test: `tests/mcp/resources.test.js` (add to existing)

**Step 1: Write failing test**

Add to existing `tests/mcp/resources.test.js` a new describe block:

```js
describe('approval resource', () => {
  it('returns approval status for screen', async () => {
    // Create project + screen via store
    const proj = await store.createProject('Test');
    const scr = await store.addScreen(proj.id, 'Main');
    const result = await client.readResource({
      uri: `mockup://projects/${proj.id}/screens/${scr.id}/approval`,
    });
    const data = JSON.parse(result.contents[0].text);
    assert.equal(data.approved, false);
    assert.ok('elementCount' in data);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/mcp/resources.test.js`
Expected: FAIL — resource not registered

**Step 3: Add approval resource to resources.js**

In `src/mcp/resources.js`, inside `registerResources()`, add after existing resources:

```js
// Approval status resource
const approvalTpl = new ResourceTemplate(
  'mockup://projects/{projectId}/screens/{screenId}/approval',
  { list: undefined }
);
server.resource('screen-approval', approvalTpl, { description: 'Screen approval status — approved flag, timestamp, change summary' },
  async (uri, { projectId, screenId }) => {
    const elements = await store.listElements(projectId, screenId);
    // Import editSessions from approval-api (lazy to avoid circular)
    let session = null;
    try {
      const { editSessions } = await import('../preview/routes/approval-api.js');
      session = editSessions.get(`${projectId}/${screenId}`);
    } catch { /* preview not running — return defaults */ }
    const data = {
      approved: session?.approved ?? false,
      approvedAt: session?.approvedAt ?? null,
      summary: session?.summary ?? null,
      elementCount: elements.length,
    };
    return {
      contents: [{ uri: uri.toString(), text: JSON.stringify(data, null, 2), mimeType: 'application/json' }],
    };
  }
);
```

**Step 4: Run test**

Run: `node --test tests/mcp/resources.test.js`
Expected: PASS

**Step 5: Full suite + commit**

```bash
npm test
git add src/mcp/resources.js tests/mcp/resources.test.js
git commit -m "feat: MCP approval resource — mockup://projects/{pid}/screens/{sid}/approval"
```

---

### Task 4: MCP await_approval Tool

**Files:**
- Create: `src/mcp/tools/approval-tools.js`
- Modify: `src/mcp/tools/index.js`
- Test: `tests/mcp/approval-tools.test.js`

**Step 1: Write failing test**

```js
// tests/mcp/approval-tools.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../../src/storage/project-store.js';
import { registerApprovalTools } from '../../src/mcp/tools/approval-tools.js';
import { editSessions } from '../../src/preview/routes/approval-api.js';

class MockServer {
  constructor() { this.tools = new Map(); }
  tool(name, desc, schema, handler) { this.tools.set(name, { desc, schema, handler }); }
  async callTool(name, params) {
    const tool = this.tools.get(name);
    const parsed = z.object(tool.schema).parse(params);
    return tool.handler(parsed);
  }
}

describe('mockup_await_approval', () => {
  let tmpDir, store, server, projectId, screenId;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'approval-tool-'));
    store = new ProjectStore(tmpDir);
    await store.init();
    server = new MockServer();
    registerApprovalTools(server, store);
    const proj = await store.createProject('Test');
    projectId = proj.id;
    const scr = await store.addScreen(projectId, 'Main');
    screenId = scr.id;
  });

  after(async () => {
    editSessions.clear();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns immediately when already approved', async () => {
    const key = `${projectId}/${screenId}`;
    editSessions.set(key, { approved: true, approvedAt: new Date().toISOString(), summary: 'no changes', snapshot: [] });
    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId, screen_id: screenId, timeout_seconds: 1,
    });
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.approved, true);
  });

  it('times out when not approved', async () => {
    editSessions.clear();
    const res = await server.callTool('mockup_await_approval', {
      project_id: projectId, screen_id: screenId, timeout_seconds: 1,
    });
    assert.equal(res.isError, true);
    assert.ok(res.content[0].text.includes('timeout'));
  });
});
```

**Step 2: Run test to verify failure**

Run: `node --test tests/mcp/approval-tools.test.js`
Expected: FAIL

**Step 3: Implement approval-tools.js**

```js
// src/mcp/tools/approval-tools.js
import { z } from 'zod';
import { editSessions } from '../../preview/routes/approval-api.js';

export function registerApprovalTools(server, store) {
  server.tool(
    'mockup_await_approval',
    'Wait for user to approve screen edits in browser editor. Polls every 2s until approved or timeout.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      timeout_seconds: z.number().optional().default(120).describe('Max wait time in seconds (default 120)'),
    },
    async ({ project_id, screen_id, timeout_seconds }) => {
      const key = `${project_id}/${screen_id}`;
      const deadline = Date.now() + timeout_seconds * 1000;

      while (Date.now() < deadline) {
        const session = editSessions.get(key);
        if (session?.approved) {
          try {
            const elements = await store.listElements(project_id, screen_id);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  approved: true,
                  approvedAt: session.approvedAt,
                  summary: session.summary,
                  elementCount: elements.length,
                  elements,
                }, null, 2),
              }],
            };
          } catch (err) {
            return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
          }
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      return {
        content: [{ type: 'text', text: `Error: approval timeout after ${timeout_seconds}s — user did not approve screen ${screen_id}` }],
        isError: true,
      };
    }
  );
}
```

**Step 4: Wire into tools/index.js**

```js
import { registerApprovalTools } from './approval-tools.js';
// Inside registerAllTools():
registerApprovalTools(server, store);
```

**Step 5: Run tests**

Run: `node --test tests/mcp/approval-tools.test.js`
Expected: PASS (2 tests)

**Step 6: Full suite + commit**

```bash
npm test
git add src/mcp/tools/approval-tools.js src/mcp/tools/index.js tests/mcp/approval-tools.test.js
git commit -m "feat: mockup_await_approval MCP tool — polls for user approval"
```

---

## Milestone M13 — Editor Frontend (Canvas + Palette + Inspector + Sync)

### Task 5: Editor Orchestrator + Toolbar + CSS

**Files:**
- Create: `src/preview/editor/editor.js` (client-side JS, served as string in preview)
- Create: `src/preview/editor/toolbar.js`
- Create: `src/preview/editor/editor-css.js` (CSS string export)
- Modify: `src/preview/server.js` (inject editor assets)
- Test: `tests/preview/editor/toolbar.test.js`

**Step 1: Write test for toolbar state logic**

```js
// tests/preview/editor/toolbar.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test pure state logic extracted from toolbar — no DOM
// We'll test the ToolbarState class separately
import { ToolbarState } from '../../../src/preview/editor/toolbar-state.js';

describe('ToolbarState', () => {
  it('starts in view mode', () => {
    const state = new ToolbarState();
    assert.equal(state.mode, 'view');
    assert.equal(state.snapToGrid, true);
  });

  it('toggles to edit mode', () => {
    const state = new ToolbarState();
    state.setMode('edit');
    assert.equal(state.mode, 'edit');
  });

  it('toggles snap to grid', () => {
    const state = new ToolbarState();
    state.toggleSnap();
    assert.equal(state.snapToGrid, false);
  });

  it('emits mode change events', () => {
    const state = new ToolbarState();
    let received = null;
    state.on('modeChange', (mode) => { received = mode; });
    state.setMode('edit');
    assert.equal(received, 'edit');
  });
});
```

**Step 2: Implement toolbar-state.js (testable pure logic)**

```js
// src/preview/editor/toolbar-state.js
export class ToolbarState {
  constructor() {
    this.mode = 'view';
    this.snapToGrid = true;
    this._listeners = {};
  }

  on(event, fn) {
    (this._listeners[event] ??= []).push(fn);
  }

  _emit(event, ...args) {
    (this._listeners[event] ?? []).forEach(fn => fn(...args));
  }

  setMode(mode) {
    this.mode = mode;
    this._emit('modeChange', mode);
  }

  toggleSnap() {
    this.snapToGrid = !this.snapToGrid;
    this._emit('snapChange', this.snapToGrid);
  }
}
```

**Step 3: Run test**

Run: `node --test tests/preview/editor/toolbar.test.js`
Expected: PASS

**Step 4: Create editor CSS, toolbar DOM, and editor orchestrator as string exports**

These are client-side JS modules served inline in preview HTML (same pattern as SIDEBAR_JS, SIDEBAR_CSS). Create them as template literal exports:

- `src/preview/editor/editor-css.js` — exports `EDITOR_CSS` string (styles for palette, inspector, toolbar, canvas overlay)
- `src/preview/editor/toolbar.js` — exports `TOOLBAR_HTML` and `TOOLBAR_JS` strings
- `src/preview/editor/editor.js` — exports `EDITOR_JS` string (orchestrator that initializes canvas, palette, inspector, sync on "Edit" click)

**Step 5: Inject into preview server**

In `src/preview/server.js`, modify `injectPreviewAssets()`:
```js
import { EDITOR_CSS } from './editor/editor-css.js';
import { TOOLBAR_HTML, TOOLBAR_JS } from './editor/toolbar.js';
import { EDITOR_JS } from './editor/editor.js';

function injectPreviewAssets(html, projectId, screenId, updatedAt) {
  html = html.replace('</head>', PREVIEW_STYLE + SIDEBAR_CSS + TRANSITION_CSS + EDITOR_CSS + '\n</head>');
  html = html.replace('</body>',
    SIDEBAR_HTML + TOOLBAR_HTML + BACK_BUTTON + LINK_SCRIPT + SIDEBAR_JS +
    TOOLBAR_JS + EDITOR_JS +
    buildReloadScript(projectId, updatedAt) + '\n</body>'
  );
  return html;
}
```

Note: `injectPreviewAssets` needs `screenId` param now — update call site at route handler.

**Step 6: Run full suite + commit**

```bash
npm test
git add src/preview/editor/ tests/preview/editor/ src/preview/server.js
git commit -m "feat: editor orchestrator, toolbar, CSS shell — view/edit mode toggle"
```

---

### Task 6: Canvas Engine — Selection + Drag

**Files:**
- Create: `src/preview/editor/canvas.js` (client-side JS string export)
- Create: `src/preview/editor/canvas-state.js` (testable pure logic)
- Test: `tests/preview/editor/canvas.test.js`

**Step 1: Write tests for canvas state (pure logic, no DOM)**

```js
// tests/preview/editor/canvas.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CanvasState } from '../../../src/preview/editor/canvas-state.js';

describe('CanvasState', () => {
  it('selects element by id', () => {
    const state = new CanvasState();
    state.selectElement('el_1');
    assert.equal(state.selectedId, 'el_1');
  });

  it('deselects on null', () => {
    const state = new CanvasState();
    state.selectElement('el_1');
    state.selectElement(null);
    assert.equal(state.selectedId, null);
  });

  it('calculates drag delta with snap', () => {
    const state = new CanvasState();
    state.snapSize = 8;
    const result = state.snapPosition(13, 27);
    assert.equal(result.x, 16);  // nearest 8
    assert.equal(result.y, 24);
  });

  it('calculates drag delta without snap', () => {
    const state = new CanvasState();
    state.snapSize = 0;
    const result = state.snapPosition(13, 27);
    assert.equal(result.x, 13);
    assert.equal(result.y, 27);
  });

  it('tracks drag start and computes delta', () => {
    const state = new CanvasState();
    state.startDrag(100, 200, { x: 50, y: 60 });
    const delta = state.computeDrag(110, 215);
    assert.equal(delta.x, 60);   // 50 + (110 - 100)
    assert.equal(delta.y, 75);   // 60 + (215 - 200)
  });

  it('emits select event', () => {
    const state = new CanvasState();
    let received = null;
    state.on('select', (id) => { received = id; });
    state.selectElement('el_1');
    assert.equal(received, 'el_1');
  });

  it('handles multi-select with shift', () => {
    const state = new CanvasState();
    state.selectElement('el_1');
    state.selectElement('el_2', true);  // shift=true
    assert.deepEqual([...state.selectedIds], ['el_1', 'el_2']);
  });
});
```

**Step 2: Implement canvas-state.js**

```js
// src/preview/editor/canvas-state.js
export class CanvasState {
  constructor() {
    this.selectedId = null;
    this.selectedIds = new Set();
    this.snapSize = 8;
    this._dragStart = null;
    this._listeners = {};
  }

  on(event, fn) { (this._listeners[event] ??= []).push(fn); }
  _emit(event, ...args) { (this._listeners[event] ?? []).forEach(fn => fn(...args)); }

  selectElement(id, shift = false) {
    if (shift && id) {
      if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
      } else {
        this.selectedIds.add(id);
      }
      this.selectedId = id;
    } else {
      this.selectedIds.clear();
      if (id) this.selectedIds.add(id);
      this.selectedId = id;
    }
    this._emit('select', id);
  }

  snapPosition(x, y) {
    if (!this.snapSize) return { x, y };
    return {
      x: Math.round(x / this.snapSize) * this.snapSize,
      y: Math.round(y / this.snapSize) * this.snapSize,
    };
  }

  startDrag(mouseX, mouseY, elementPos) {
    this._dragStart = { mouseX, mouseY, elX: elementPos.x, elY: elementPos.y };
  }

  computeDrag(mouseX, mouseY) {
    if (!this._dragStart) return null;
    const dx = mouseX - this._dragStart.mouseX;
    const dy = mouseY - this._dragStart.mouseY;
    return this.snapPosition(this._dragStart.elX + dx, this._dragStart.elY + dy);
  }

  endDrag() {
    this._dragStart = null;
  }
}
```

**Step 3: Run tests**

Run: `node --test tests/preview/editor/canvas.test.js`
Expected: PASS (7 tests)

**Step 4: Create canvas.js client-side module**

`src/preview/editor/canvas.js` exports `CANVAS_JS` — client-side script string that:
- Creates overlay div over screen body
- On mousedown on element → select + start drag
- On mousemove → update element position (CSS transform)
- On mouseup → end drag, emit `element:moved` with new x,y
- Resize handles (8 points) around selected element
- On mousedown on handle → resize mode
- Custom events dispatched to `document` for other modules to listen

**Step 5: Wire CANVAS_JS into editor.js orchestrator**

**Step 6: Run full suite + commit**

```bash
npm test
git add src/preview/editor/canvas-state.js src/preview/editor/canvas.js tests/preview/editor/canvas.test.js
git commit -m "feat: canvas engine — selection, drag, resize, snap-to-grid"
```

---

### Task 7: Sync Module — REST Client + Undo/Redo

**Files:**
- Create: `src/preview/editor/sync-state.js` (testable)
- Create: `src/preview/editor/sync.js` (client-side JS)
- Test: `tests/preview/editor/sync.test.js`

**Step 1: Write tests for undo/redo history**

```js
// tests/preview/editor/sync.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UndoStack } from '../../../src/preview/editor/sync-state.js';

describe('UndoStack', () => {
  it('pushes and undoes', () => {
    const stack = new UndoStack();
    stack.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 100 } });
    const action = stack.undo();
    assert.equal(action.type, 'move');
    assert.deepEqual(action.before, { x: 0 });
  });

  it('redo after undo', () => {
    const stack = new UndoStack();
    stack.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 100 } });
    stack.undo();
    const action = stack.redo();
    assert.deepEqual(action.after, { x: 100 });
  });

  it('clears redo on new push', () => {
    const stack = new UndoStack();
    stack.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 100 } });
    stack.undo();
    stack.push({ type: 'move', elementId: 'el_1', before: { x: 0 }, after: { x: 50 } });
    assert.equal(stack.redo(), null);
  });

  it('limits to maxSize', () => {
    const stack = new UndoStack(3);
    for (let i = 0; i < 5; i++) {
      stack.push({ type: 'move', i, before: {}, after: {} });
    }
    assert.equal(stack.size, 3);
  });

  it('returns null on empty undo', () => {
    const stack = new UndoStack();
    assert.equal(stack.undo(), null);
  });
});
```

**Step 2: Implement sync-state.js**

```js
// src/preview/editor/sync-state.js
export class UndoStack {
  constructor(maxSize = 50) {
    this._stack = [];
    this._redoStack = [];
    this._maxSize = maxSize;
  }

  get size() { return this._stack.length; }

  push(action) {
    this._stack.push(action);
    this._redoStack = [];
    if (this._stack.length > this._maxSize) this._stack.shift();
  }

  undo() {
    const action = this._stack.pop();
    if (!action) return null;
    this._redoStack.push(action);
    return action;
  }

  redo() {
    const action = this._redoStack.pop();
    if (!action) return null;
    this._stack.push(action);
    return action;
  }

  clear() {
    this._stack = [];
    this._redoStack = [];
  }
}
```

**Step 3: Run test**

Run: `node --test tests/preview/editor/sync.test.js`
Expected: PASS (5 tests)

**Step 4: Create sync.js client-side module**

`src/preview/editor/sync.js` exports `SYNC_JS` — client-side script that:
- Listens to `element:moved`, `element:resized`, `element:added`, `element:deleted`, `element:updated` events
- Debounces 300ms, then calls REST API (PATCH/POST/DELETE)
- Pushes each action to UndoStack with before/after state
- Ctrl+Z → undo (reverse REST call), Ctrl+Shift+Z → redo
- `approve()` function → POST /api/screens/:pid/:sid/approve

**Step 5: Full suite + commit**

```bash
npm test
git add src/preview/editor/sync-state.js src/preview/editor/sync.js tests/preview/editor/sync.test.js
git commit -m "feat: sync module — REST client + undo/redo history stack"
```

---

### Task 8: Component Palette

**Files:**
- Create: `src/preview/editor/palette.js` (client-side JS)
- Create: `src/preview/editor/palette-data.js` (component catalog, testable)
- Test: `tests/preview/editor/palette.test.js`

**Step 1: Write test for palette data**

```js
// tests/preview/editor/palette.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPaletteCategories, getComponentDefaults } from '../../../src/preview/editor/palette-data.js';

describe('PaletteData', () => {
  it('returns 6 categories', () => {
    const cats = getPaletteCategories();
    assert.equal(cats.length, 6);
    assert.ok(cats.find(c => c.name === 'Basic'));
    assert.ok(cats.find(c => c.name === 'Form'));
  });

  it('all 35 components have defaults', () => {
    const cats = getPaletteCategories();
    const total = cats.reduce((sum, c) => sum + c.components.length, 0);
    assert.equal(total, 35);
  });

  it('getComponentDefaults returns width/height + properties', () => {
    const def = getComponentDefaults('button');
    assert.ok(def.width > 0);
    assert.ok(def.height > 0);
    assert.ok(def.properties.label);
  });
});
```

**Step 2: Implement palette-data.js**

Import all 35 component defaults() from `src/renderer/components/`. Map each type to default width/height/properties. Group into 6 categories.

**Step 3: Run test + full suite + commit**

```bash
node --test tests/preview/editor/palette.test.js
npm test
git add src/preview/editor/palette-data.js src/preview/editor/palette.js tests/preview/editor/palette.test.js
git commit -m "feat: component palette — 35 components in 6 categories with defaults"
```

---

### Task 9: Property Inspector

**Files:**
- Create: `src/preview/editor/inspector.js` (client-side JS)
- Create: `src/preview/editor/inspector-schema.js` (prop schemas, testable)
- Test: `tests/preview/editor/inspector.test.js`

**Step 1: Write test for inspector schemas**

```js
// tests/preview/editor/inspector.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getEditableProps } from '../../../src/preview/editor/inspector-schema.js';

describe('InspectorSchema', () => {
  it('returns editable props for button', () => {
    const props = getEditableProps('button');
    assert.ok(props.find(p => p.key === 'label'));
    assert.ok(props.find(p => p.key === 'variant'));
    assert.ok(props.find(p => p.key === 'size'));
  });

  it('includes position fields for all types', () => {
    const props = getEditableProps('text');
    assert.ok(props.find(p => p.key === 'x'));
    assert.ok(props.find(p => p.key === 'y'));
  });

  it('returns empty for unknown type', () => {
    const props = getEditableProps('nonexistent');
    // Should still have position fields
    assert.ok(props.find(p => p.key === 'x'));
  });
});
```

**Step 2: Implement inspector-schema.js**

Map each component type → array of `{ key, type: 'string'|'number'|'select'|'boolean', options?, label }`. Position fields (x, y, width, height, z_index, opacity) are always included.

**Step 3: Create inspector.js client-side module**

Exports `INSPECTOR_JS` — renders property panel for selected element, emits `element:updated` on change.

**Step 4: Run tests + commit**

```bash
node --test tests/preview/editor/inspector.test.js
npm test
git add src/preview/editor/inspector-schema.js src/preview/editor/inspector.js tests/preview/editor/inspector.test.js
git commit -m "feat: property inspector — dynamic prop editing per component type"
```

---

### Task 10: Integration + Polish

**Files:**
- Modify: `src/preview/editor/editor.js` (wire all modules together)
- Modify: `src/preview/editor/editor-css.js` (final styles)
- Create: `tests/preview/editor/integration.test.js`
- Modify: `CLAUDE.md` (update tool count, test count, structure)
- Modify: `PM/milestones.md` (add M12, M13)

**Step 1: Write integration test**

Test that preview page in edit mode contains expected elements:

```js
// tests/preview/editor/integration.test.js
describe('Editor integration', () => {
  it('preview page contains editor toolbar', async () => {
    const res = await get(port, `/preview/${projectId}/${screenId}`);
    assert.ok(res.body.includes('editor-toolbar'));
    assert.ok(res.body.includes('Edit'));
  });

  it('editor CSS is injected', async () => {
    const res = await get(port, `/preview/${projectId}/${screenId}`);
    assert.ok(res.body.includes('.editor-palette'));
    assert.ok(res.body.includes('.editor-inspector'));
  });
});
```

**Step 2: Wire all modules in editor.js orchestrator**

Ensure EDITOR_JS initializes: canvas, palette, inspector, sync, toolbar — connected via custom events.

**Step 3: Update editor-css.js with final layout styles**

Three-column layout (palette | canvas | inspector), toolbar at top, approve button styling.

**Step 4: Update docs**

- `CLAUDE.md`: update structure (add `editor/`), tool count (25 → 26), resource count (5 → 6)
- `PM/milestones.md`: add M12 + M13 entries

**Step 5: Full suite + commit**

```bash
npm test
git add -A
git commit -m "feat: editor integration — full visual editing loop with approval flow"
```

---

## Summary

| Milestone | Tasks | New Files | Tests |
|-----------|-------|-----------|-------|
| M12 (Backend) | 1-4 | 4 source + 4 test | ~15 |
| M13 (Frontend) | 5-10 | 8 source + 6 test | ~25 |
| **Total** | **10** | **12 source + 10 test** | **~40** |

Sprint implementacyjny: 2 sesje CC (M12 + M13), branch `feature/m12-editor-backend` i `feature/m13-editor-frontend`.
