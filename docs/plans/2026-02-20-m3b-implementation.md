# M3b Implementation Plan — SSE Transport, Docker Hub, Animated Transitions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Streamable HTTP transport (port 3200), Docker Hub publish CI/CD, and CSS animated transitions to preview.

**Architecture:** Separate Express app on port 3200 for HTTP MCP transport (stateful sessions), GitHub Actions for multi-arch Docker builds, SPA-style fetch+swap for preview transitions with 4 CSS animation types.

**Tech Stack:** @modelcontextprotocol/sdk 1.26.0 (StreamableHTTPServerTransport, createMcpExpressApp), Express, GitHub Actions, docker/build-push-action, CSS transitions/animations.

---

## Sprint 1: HTTP Transport

### Task 1: Add MCP transport config vars

**Files:**
- Modify: `src/config.js`

**Step 1: Write the failing test**

Create `tests/mcp/http-transport.test.js`:

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('config - MCP transport settings', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach(k => {
      if (!(k in originalEnv)) delete process.env[k];
      else process.env[k] = originalEnv[k];
    });
  });

  it('defaults mcpTransport to "stdio"', async () => {
    delete process.env.MCP_TRANSPORT;
    // Force re-import to pick up env changes
    const { config } = await import('../../src/config.js?t=' + Date.now());
    assert.equal(config.mcpTransport, 'stdio');
  });

  it('defaults mcpPort to 3200', async () => {
    delete process.env.MCP_PORT;
    const { config } = await import('../../src/config.js?t=' + Date.now());
    assert.equal(config.mcpPort, 3200);
  });

  it('reads MCP_TRANSPORT from env', async () => {
    process.env.MCP_TRANSPORT = 'both';
    const { config } = await import('../../src/config.js?t=' + Date.now());
    assert.equal(config.mcpTransport, 'both');
  });

  it('reads MCP_PORT from env', async () => {
    process.env.MCP_PORT = '4200';
    const { config } = await import('../../src/config.js?t=' + Date.now());
    assert.equal(config.mcpPort, 4200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/mcp/http-transport.test.js`
Expected: FAIL — `config.mcpTransport` and `config.mcpPort` are undefined.

**Step 3: Write minimal implementation**

Edit `src/config.js` — add two new fields to the config object:

```javascript
export const config = {
  dataDir: process.env.DATA_DIR || './mockups',
  previewPort: parseInt(process.env.PREVIEW_PORT || '3100', 10),
  mcpPort: parseInt(process.env.MCP_PORT || '3200', 10),
  mcpTransport: process.env.MCP_TRANSPORT || 'stdio',
  chromiumPath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
  defaultStyle: process.env.DEFAULT_STYLE || 'wireframe',
  defaultViewport: { width: 393, height: 852, preset: 'mobile' },
  screenshotScale: 2,
  viewportPresets: {
    mobile: { width: 393, height: 852 },
    tablet: { width: 834, height: 1194 },
    desktop: { width: 1440, height: 900 },
  },
};
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/mcp/http-transport.test.js`
Expected: PASS

**NOTE:** The dynamic import with cache-busting (`?t=Date.now()`) may not work for ESM config. If tests fail due to module caching, refactor tests to test the config values directly without re-importing — just test default values once, and test env override by setting env BEFORE the first import. Alternatively, test a `parseConfig(env)` pure function.

**Step 5: Commit**

```bash
git add src/config.js tests/mcp/http-transport.test.js
git commit -m "feat: add mcpTransport and mcpPort config vars"
```

---

### Task 2: Refactor registerAllTools to accept external ProjectStore

Currently `registerAllTools` creates its own `ProjectStore` internally. For HTTP transport, multiple McpServer instances need to share the same store.

**Files:**
- Modify: `src/mcp/tools/index.js`
- Modify: `src/index.js`

**Step 1: Run existing tests as baseline**

Run: `node --test tests/**/*.test.js`
Expected: All 529 tests PASS.

**Step 2: Refactor registerAllTools**

Edit `src/mcp/tools/index.js` — accept optional `store` parameter:

```javascript
import { ProjectStore } from '../../storage/project-store.js';
import { config } from '../../config.js';
import { registerProjectTools } from './project-tools.js';
import { registerScreenTools } from './screen-tools.js';
import { registerElementTools } from './element-tools.js';
import { registerExportTools } from './export-tools.js';
import { registerTemplateTools } from './template-tools.js';
import { registerLayoutTools } from './layout-tools.js';
import { registerGroupTools } from './group-tools.js';

export function registerAllTools(server, store) {
  if (!store) store = new ProjectStore(config.dataDir);
  registerProjectTools(server, store);
  registerScreenTools(server, store);
  registerElementTools(server, store);
  registerExportTools(server, store);
  registerTemplateTools(server, store);
  registerLayoutTools(server, store);
  registerGroupTools(server, store);
  console.error('[MockupMCP] 24 tools registered');
}
```

**Step 3: Update index.js to create shared store**

Edit `src/index.js`:

```javascript
import { createMcpServer, startMcpServer } from './mcp/server.js';
import { registerAllTools } from './mcp/tools/index.js';
import { startPreviewServer } from './preview/server.js';
import { closeBrowser } from './renderer/screenshot.js';
import { ProjectStore } from './storage/project-store.js';
import { config } from './config.js';

console.log = (...args) => console.error(...args);

async function main() {
  console.error('[MockupMCP] Starting...');

  const store = new ProjectStore(config.dataDir);

  // Start preview HTTP server
  const httpServer = startPreviewServer(config.previewPort);

  // Create and configure MCP server (stdio)
  const mcpServer = createMcpServer();
  registerAllTools(mcpServer, store);

  // Graceful shutdown
  const shutdown = async () => {
    console.error('[MockupMCP] Shutting down...');
    httpServer.close();
    await closeBrowser();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start MCP server (blocks on stdio)
  console.error('[MockupMCP] MCP server ready (stdio)');
  await startMcpServer(mcpServer);
}

main().catch(err => {
  console.error('[MockupMCP] Fatal error:', err);
  process.exit(1);
});
```

**Step 4: Run all tests to verify no regression**

Run: `node --test tests/**/*.test.js`
Expected: All 529 tests PASS (no behavior change — store param is backward compatible).

**Step 5: Commit**

```bash
git add src/mcp/tools/index.js src/index.js
git commit -m "refactor: registerAllTools accepts external ProjectStore"
```

---

### Task 3: Create HTTP transport module

**Files:**
- Create: `src/mcp/http-transport.js`
- Test: `tests/mcp/http-transport.test.js` (append to existing from Task 1)

**Step 1: Write failing tests**

Append to `tests/mcp/http-transport.test.js`:

```javascript
import http from 'node:http';
import { createHttpTransportApp } from '../../src/mcp/http-transport.js';
import { ProjectStore } from '../../src/storage/project-store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeRequest(port, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port, method, path,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('HTTP transport', () => {
  let tmpDir, store, server, port;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mcp-http-'));
    store = new ProjectStore(tmpDir);
  });

  afterEach(async () => {
    if (server) await new Promise(r => server.close(r));
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('createHttpTransportApp returns an Express app', () => {
    const app = createHttpTransportApp(store);
    assert.ok(app);
    assert.equal(typeof app.listen, 'function');
  });

  it('POST /mcp with initialize request returns 200 with session id', async () => {
    const app = createHttpTransportApp(store);
    server = app.listen(0);
    port = server.address().port;

    const initReq = {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      },
    };
    const res = await makeRequest(port, 'POST', '/mcp', initReq);
    assert.equal(res.status, 200);
    assert.ok(res.headers['mcp-session-id'], 'should have session ID header');
  });

  it('POST /mcp without initialize returns 400', async () => {
    const app = createHttpTransportApp(store);
    server = app.listen(0);
    port = server.address().port;

    const res = await makeRequest(port, 'POST', '/mcp', {
      jsonrpc: '2.0', id: 1, method: 'tools/list', params: {},
    });
    // Should reject — no session, not an initialize request
    assert.ok([400, 404].includes(res.status));
  });

  it('DELETE /mcp with valid session returns 200', async () => {
    const app = createHttpTransportApp(store);
    server = app.listen(0);
    port = server.address().port;

    // First initialize
    const initReq = {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      },
    };
    const initRes = await makeRequest(port, 'POST', '/mcp', initReq);
    const sessionId = initRes.headers['mcp-session-id'];

    // Then delete session
    const delRes = await makeRequest(port, 'DELETE', '/mcp', null, {
      'mcp-session-id': sessionId,
    });
    assert.equal(delRes.status, 200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/mcp/http-transport.test.js`
Expected: FAIL — `createHttpTransportApp` not found.

**Step 3: Write implementation**

Create `src/mcp/http-transport.js`:

```javascript
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { registerAllTools } from './tools/index.js';

const MAX_SESSIONS = 10;
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 min

export function createHttpTransportApp(store) {
  // SDK Express factory adds JSON parsing + optional DNS rebinding protection.
  // host: '0.0.0.0' disables DNS rebinding (Docker, accessed externally).
  const app = createMcpExpressApp({ host: '0.0.0.0' });

  // sessionId -> { transport, server, timer }
  const sessions = new Map();

  function cleanupSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      clearTimeout(session.timer);
      session.transport.close();
      session.server.close();
      sessions.delete(sessionId);
      console.error(`[MockupMCP] HTTP session closed: ${sessionId}`);
    }
  }

  function resetIdleTimer(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      clearTimeout(session.timer);
      session.timer = setTimeout(() => cleanupSession(sessionId), SESSION_IDLE_TIMEOUT);
    }
  }

  // POST /mcp — handle JSON-RPC messages
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const body = req.body;

    if (isInitializeRequest(body)) {
      if (sessions.size >= MAX_SESSIONS) {
        res.status(503).json({ error: 'Max sessions reached' });
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const server = new McpServer({
        name: 'mockupmcp',
        version: '0.1.0',
      });
      registerAllTools(server, store);

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) cleanupSession(sid);
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, body);

      // Store session after handleRequest sets sessionId
      const sid = transport.sessionId;
      if (sid && !sessions.has(sid)) {
        sessions.set(sid, { transport, server, timer: null });
        resetIdleTimer(sid);
        console.error(`[MockupMCP] HTTP session created: ${sid} (${sessions.size}/${MAX_SESSIONS})`);
      }
    } else if (sessionId && sessions.has(sessionId)) {
      resetIdleTimer(sessionId);
      const session = sessions.get(sessionId);
      await session.transport.handleRequest(req, res, body);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session. Send initialize first.' },
        id: null,
      });
    }
  });

  // GET /mcp — SSE stream for server-to-client notifications
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing session ID' });
      return;
    }
    resetIdleTimer(sessionId);
    const session = sessions.get(sessionId);
    await session.transport.handleRequest(req, res);
  });

  // DELETE /mcp — close session
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    cleanupSession(sessionId);
    res.status(200).json({ message: 'Session closed' });
  });

  // Expose for testing / shutdown
  app._mcpSessions = sessions;
  app._mcpCleanupAll = () => {
    for (const sid of sessions.keys()) cleanupSession(sid);
  };

  return app;
}

export function startHttpTransport(store, port) {
  const app = createHttpTransportApp(store);
  const server = app.listen(port, '0.0.0.0', () => {
    console.error(`[MockupMCP] HTTP MCP transport: http://0.0.0.0:${port}/mcp`);
  });
  return server;
}
```

**IMPORTANT NOTE:** The session storage pattern (storing after `handleRequest`) depends on SDK setting `transport.sessionId` during request handling. If the SDK uses a callback pattern (like `onsessioninitialized`), adjust accordingly. Check the actual SDK source if tests fail.

**Step 4: Run test to verify it passes**

Run: `node --test tests/mcp/http-transport.test.js`
Expected: PASS. Adjust session storage if SDK API differs.

**Step 5: Commit**

```bash
git add src/mcp/http-transport.js tests/mcp/http-transport.test.js
git commit -m "feat: Streamable HTTP transport with session management"
```

---

### Task 4: Wire HTTP transport into index.js

**Files:**
- Modify: `src/index.js`

**Step 1: Write implementation**

Edit `src/index.js`:

```javascript
import { createMcpServer, startMcpServer } from './mcp/server.js';
import { registerAllTools } from './mcp/tools/index.js';
import { startHttpTransport } from './mcp/http-transport.js';
import { startPreviewServer } from './preview/server.js';
import { closeBrowser } from './renderer/screenshot.js';
import { ProjectStore } from './storage/project-store.js';
import { config } from './config.js';

console.log = (...args) => console.error(...args);

async function main() {
  console.error('[MockupMCP] Starting...');

  const store = new ProjectStore(config.dataDir);
  const transport = config.mcpTransport;

  // Start preview HTTP server
  const previewServer = startPreviewServer(config.previewPort);

  // Start HTTP MCP transport if configured
  let httpMcpServer = null;
  if (transport === 'http' || transport === 'both') {
    httpMcpServer = startHttpTransport(store, config.mcpPort);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.error('[MockupMCP] Shutting down...');
    previewServer.close();
    if (httpMcpServer) httpMcpServer.close();
    await closeBrowser();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start stdio MCP transport if configured (blocks on stdin)
  if (transport === 'stdio' || transport === 'both') {
    const mcpServer = createMcpServer();
    registerAllTools(mcpServer, store);
    console.error('[MockupMCP] MCP server ready (stdio)');
    await startMcpServer(mcpServer);
  } else {
    console.error('[MockupMCP] MCP server ready (http only, no stdio)');
    // Keep process alive when no stdio
    await new Promise(() => {});
  }
}

main().catch(err => {
  console.error('[MockupMCP] Fatal error:', err);
  process.exit(1);
});
```

**Step 2: Run all tests**

Run: `node --test tests/**/*.test.js`
Expected: All tests PASS.

**Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat: wire HTTP transport into index.js with transport selection"
```

---

### Task 5: Update Dockerfile and docker-compose

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`

**Step 1: Edit Dockerfile**

```dockerfile
FROM node:20-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV DATA_DIR=/data
ENV PREVIEW_PORT=3100
ENV MCP_PORT=3200
ENV MCP_TRANSPORT=stdio

EXPOSE 3100 3200

VOLUME ["/data"]

ENTRYPOINT ["node", "src/index.js"]
```

**Step 2: Edit docker-compose.yml**

```yaml
services:
  mockupmcp:
    build: .
    image: mggs/mockupmcp:latest
    container_name: mockupmcp
    ports:
      - "3100:3100"
      - "3200:3200"
    volumes:
      - ./mockups:/data
    environment:
      - MCP_TRANSPORT=both
      - PREVIEW_PORT=3100
      - MCP_PORT=3200
      - DEFAULT_STYLE=wireframe
    stdin_open: true
    tty: true
```

**Step 3: Build Docker image to verify**

Run: `docker build -t mockupmcp:test .`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: Dockerfile + docker-compose for HTTP transport on port 3200"
```

---

## Sprint 2: Docker Hub CI/CD + Animated Transitions

### Task 6: GitHub Actions CI/CD for Docker Hub

**Files:**
- Create: `.github/workflows/docker-publish.yml`

**Step 1: Create workflow file**

```yaml
name: Docker Publish

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

env:
  IMAGE_NAME: mggs/mockupmcp

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test

  build-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-qemu-action@v3

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest

      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Step 2: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/docker-publish.yml
git commit -m "ci: GitHub Actions Docker Hub publish (multi-arch amd64+arm64)"
```

**NOTE:** User must add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets to their GitHub repo settings.

---

### Task 7: Preview screen fragment endpoint

New endpoint returning only the `.screen` div HTML (no full document) for SPA transitions.

**Files:**
- Modify: `src/preview/server.js`
- Create: `tests/preview/transitions.test.js`

**Step 1: Write failing test**

Create `tests/preview/transitions.test.js`:

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startPreviewServer } from '../../src/preview/server.js';
import { ProjectStore } from '../../src/storage/project-store.js';
import { config } from '../../src/config.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

describe('screen fragment endpoint', () => {
  let tmpDir, store, server, port;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'preview-trans-'));
    const origDataDir = config.dataDir;
    config.dataDir = tmpDir;
    store = new ProjectStore(tmpDir);

    const project = await store.createProject({
      name: 'Test',
      viewport: { width: 393, height: 852, preset: 'mobile' },
    });
    const screen = await store.addScreen(project.id, {
      name: 'Home', width: 393, height: 852, background: '#FFF',
    });
    await store.addElement(screen.id, {
      type: 'text', x: 0, y: 0, width: 200, height: 40, z_index: 0,
      properties: { content: 'Hello' },
    });

    server = startPreviewServer(0);
    port = server.address().port;
    config.dataDir = origDataDir;
  });

  afterEach(async () => {
    if (server) await new Promise(r => server.close(r));
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /api/screen-fragment returns HTML fragment without doctype', async () => {
    const projects = await store.listProjects();
    const project = projects[0];
    const screen = project.screens[0];

    const res = await get(port, `/api/screen-fragment/${project.id}/${screen.id}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('class="screen"'), 'should have .screen div');
    assert.ok(!res.body.includes('<!DOCTYPE'), 'should NOT be full HTML document');
    assert.ok(!res.body.includes('<html'), 'should NOT have html tag');
  });

  it('fragment endpoint returns 404 for unknown screen', async () => {
    const projects = await store.listProjects();
    const project = projects[0];

    const res = await get(port, `/api/screen-fragment/${project.id}/scr_nonexistent`);
    assert.equal(res.status, 404);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/preview/transitions.test.js`
Expected: FAIL — 404 (route not defined).

**Step 3: Write implementation**

Edit `src/preview/server.js` — add `buildScreenFragment` function and route.

Add before `startPreviewServer`:

```javascript
function buildScreenFragment(screen, style) {
  const fullHtml = buildScreenHtml(screen, style);
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return '';
  return bodyMatch[1].trim();
}
```

Add inside `startPreviewServer`, after the `/api/lastmod` route:

```javascript
  app.get('/api/screen-fragment/:projectId/:screenId', async (req, res) => {
    try {
      const project = await store.getProject(req.params.projectId);
      const screen = project.screens.find(s => s.id === req.params.screenId);
      if (!screen) return res.status(404).send('Screen not found');

      const style = screen.style || project.style || 'wireframe';
      const fragment = buildScreenFragment(screen, style);
      res.type('html').send(fragment);
    } catch (err) {
      res.status(500).send('Error: ' + err.message);
    }
  });
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/preview/transitions.test.js`
Expected: PASS.

**Step 5: Run all tests for regression**

Run: `node --test tests/**/*.test.js`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add src/preview/server.js tests/preview/transitions.test.js
git commit -m "feat: screen fragment endpoint for SPA transitions"
```

---

### Task 8: CSS animated transitions in preview

Replace redirect-based LINK_SCRIPT with SPA fetch+swap and CSS animations.

**Files:**
- Modify: `src/preview/server.js`
- Test: `tests/preview/transitions.test.js` (append)

**Step 1: Write failing tests**

Append to `tests/preview/transitions.test.js`:

```javascript
describe('preview page transition support', () => {
  let tmpDir2, store2, server2, port2, projectId, screenId1, screenId2;

  beforeEach(async () => {
    tmpDir2 = mkdtempSync(join(tmpdir(), 'preview-trans2-'));
    const origDataDir = config.dataDir;
    config.dataDir = tmpDir2;
    store2 = new ProjectStore(tmpDir2);

    const project = await store2.createProject({
      name: 'NavTest',
      viewport: { width: 393, height: 852, preset: 'mobile' },
    });
    projectId = project.id;
    const s1 = await store2.addScreen(project.id, {
      name: 'Home', width: 393, height: 852, background: '#FFF',
    });
    const s2 = await store2.addScreen(project.id, {
      name: 'Detail', width: 393, height: 852, background: '#FFF',
    });
    screenId1 = s1.id;
    screenId2 = s2.id;

    await store2.addElement(screenId1, {
      type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0,
      properties: { label: 'Go', link_to: { screen_id: screenId2, transition: 'push' } },
    });

    server2 = startPreviewServer(0);
    port2 = server2.address().port;
    config.dataDir = origDataDir;
  });

  afterEach(async () => {
    if (server2) await new Promise(r => server2.close(r));
    rmSync(tmpDir2, { recursive: true, force: true });
  });

  it('preview HTML contains transition CSS classes', async () => {
    const res = await get(port2, `/preview/${projectId}/${screenId1}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('transition-container'), 'should have transition container CSS');
  });

  it('preview HTML uses fetch for navigation instead of redirect', async () => {
    const res = await get(port2, `/preview/${projectId}/${screenId1}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('fetch('), 'should use fetch for navigation');
    assert.ok(!res.body.includes("window.location.href = '/preview/'"), 'should NOT use redirect');
  });

  it('preview HTML contains history.pushState for URL management', async () => {
    const res = await get(port2, `/preview/${projectId}/${screenId1}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('history.pushState'), 'should manage browser history');
  });

  it('preview HTML has CSS for all 4 transition types', async () => {
    const res = await get(port2, `/preview/${projectId}/${screenId1}`);
    const body = res.body;
    assert.ok(body.includes('trans-push'), 'should have push transition CSS');
    assert.ok(body.includes('trans-fade'), 'should have fade transition CSS');
    assert.ok(body.includes('trans-slide-up'), 'should have slide-up transition CSS');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/preview/transitions.test.js`
Expected: FAIL — old LINK_SCRIPT still uses `window.location.href`.

**Step 3: Replace LINK_SCRIPT and add TRANSITION_CSS**

Edit `src/preview/server.js`. Replace the existing `LINK_SCRIPT` and add `TRANSITION_CSS`.

New `TRANSITION_CSS` constant (add after `PREVIEW_STYLE`):

```javascript
const TRANSITION_CSS = `
<style>
  .transition-container {
    position: relative;
    overflow: hidden;
  }
  .screen { transition: none; }

  /* Push — iOS-style slide */
  .trans-push-out { animation: pushOut 300ms ease-in-out forwards; }
  .trans-push-in { animation: pushIn 300ms ease-in-out forwards; }
  .trans-push-back-out { animation: pushBackOut 300ms ease-in-out forwards; }
  .trans-push-back-in { animation: pushBackIn 300ms ease-in-out forwards; }
  @keyframes pushOut { from { transform: translateX(0); } to { transform: translateX(-100%); } }
  @keyframes pushIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes pushBackOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
  @keyframes pushBackIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }

  /* Fade — crossfade */
  .trans-fade-out { animation: fadeOut 300ms ease-in-out forwards; }
  .trans-fade-in { animation: fadeIn 300ms ease-in-out forwards; }
  @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  /* Slide-up — modal-style */
  .trans-slide-up-out { animation: slideUpOut 300ms ease-in-out forwards; }
  .trans-slide-up-in { animation: slideUpIn 300ms ease-in-out forwards; }
  .trans-slide-up-back-out { animation: slideDownOut 300ms ease-in-out forwards; }
  .trans-slide-up-back-in { animation: slideDownIn 300ms ease-in-out forwards; }
  @keyframes slideUpOut { from { transform: translateY(0); } to { transform: translateY(-100%); } }
  @keyframes slideUpIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes slideDownOut { from { transform: translateY(0); } to { transform: translateY(100%); } }
  @keyframes slideDownIn { from { transform: translateY(-100%); } to { transform: translateY(0); } }
</style>`;
```

Replace the existing `LINK_SCRIPT` constant entirely:

```javascript
// SPA-style navigation: fetch screen fragment, animate transition, swap DOM.
// Uses our own buildScreenHtml output (already XSS-safe via escapeHtml).
const LINK_SCRIPT = `
<script>
  let isTransitioning = false;

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-link-to]');
    if (!el || isTransitioning) return;
    e.preventDefault();

    const screenId = el.dataset.linkTo;
    const transition = el.dataset.transition || 'push';
    const currentPath = window.location.pathname;
    const projectId = currentPath.split('/')[2];

    await swapScreen(projectId, screenId, transition, false);
  });

  window.addEventListener('popstate', async (e) => {
    if (!e.state || isTransitioning) return;
    const { projectId, screenId, transition } = e.state;
    await swapScreen(projectId, screenId, transition || 'push', true, true);
  });

  async function swapScreen(projectId, screenId, transition, isBack, skipHistory) {
    isTransitioning = true;
    try {
      const res = await fetch('/api/screen-fragment/' + projectId + '/' + screenId);
      if (!res.ok) { isTransitioning = false; return; }
      const newHtml = await res.text();

      const container = document.querySelector('body');
      const currentScreen = container.querySelector('.screen');
      if (!currentScreen) { isTransitioning = false; return; }

      // Parse fragment — safe: HTML comes from our own server (escapeHtml applied)
      const wrapper = document.createElement('div');
      wrapper.className = 'transition-container';
      wrapper.style.cssText = 'position:relative;overflow:hidden;display:inline-block;';
      const template = document.createElement('template');
      template.innerHTML = newHtml;
      const newScreen = template.content.querySelector('.screen');
      if (!newScreen) { isTransitioning = false; return; }

      if (transition === 'none') {
        currentScreen.replaceWith(newScreen);
      } else {
        // Position for animation
        newScreen.style.position = 'absolute';
        newScreen.style.top = '0';
        newScreen.style.left = currentScreen.offsetLeft + 'px';
        currentScreen.parentNode.style.position = 'relative';
        currentScreen.parentNode.style.overflow = 'hidden';

        const suffix = isBack ? '-back' : '';
        const outClass = transition === 'fade' ? 'trans-fade-out' : ('trans-' + transition + suffix + '-out');
        const inClass = transition === 'fade' ? 'trans-fade-in' : ('trans-' + transition + suffix + '-in');

        currentScreen.parentNode.appendChild(newScreen);
        currentScreen.classList.add(outClass);
        newScreen.classList.add(inClass);

        await new Promise(r => setTimeout(r, 310));

        currentScreen.remove();
        newScreen.classList.remove(inClass);
        newScreen.style.position = '';
      }

      // Update history
      if (!skipHistory) {
        const newUrl = '/preview/' + projectId + '/' + screenId;
        history.pushState({ projectId, screenId, transition }, '', newUrl);
      }

      // Update lastMod for polling
      const modRes = await fetch('/api/lastmod/' + projectId);
      if (modRes.ok) {
        const data = await modRes.json();
        lastMod = data.updated_at;
      }
    } catch (err) {
      console.error('Transition error:', err);
    }
    isTransitioning = false;
  }

  // Set initial history state for popstate support
  (function() {
    const parts = window.location.pathname.split('/');
    if (parts[1] === 'preview' && parts[2] && parts[3]) {
      history.replaceState({ projectId: parts[2], screenId: parts[3], transition: 'push' }, '');
    }
  })();
</script>`;
```

Also update `injectPreviewAssets` to include TRANSITION_CSS:

```javascript
function injectPreviewAssets(html, projectId, updatedAt) {
  html = html.replace('</head>', PREVIEW_STYLE + TRANSITION_CSS + '\n</head>');
  html = html.replace('</body>', BACK_BUTTON + LINK_SCRIPT + buildReloadScript(projectId, updatedAt) + '\n</body>');
  return html;
}
```

**Step 4: Run tests**

Run: `node --test tests/preview/transitions.test.js`
Expected: PASS.

**Step 5: Run all tests for regression**

Run: `node --test tests/**/*.test.js`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add src/preview/server.js tests/preview/transitions.test.js
git commit -m "feat: CSS animated transitions in preview (push/fade/slide-up/none)"
```

---

## Sprint 3: Integration + Docs

### Task 9: E2E integration test — HTTP transport

Test that HTTP transport can initialize, list tools, and call MCP tools.

**Files:**
- Create: `tests/integration/m3b-integration.test.js`

**Step 1: Write test**

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHttpTransportApp } from '../../src/mcp/http-transport.js';
import { ProjectStore } from '../../src/storage/project-store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function post(port, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port, method: 'POST', path,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('M3b Integration', () => {
  let tmpDir, store, httpServer, port;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mcp-m3b-'));
    store = new ProjectStore(tmpDir);
  });

  afterEach(async () => {
    if (httpServer) {
      httpServer._mcpApp?._mcpCleanupAll?.();
      await new Promise(r => httpServer.close(r));
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  async function initSession(p) {
    const initRes = await post(p, '/mcp', {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0' },
      },
    });
    assert.equal(initRes.status, 200);
    const sessionId = initRes.headers['mcp-session-id'];
    assert.ok(sessionId);

    // Send initialized notification
    await post(p, '/mcp', {
      jsonrpc: '2.0', method: 'notifications/initialized',
    }, { 'mcp-session-id': sessionId });

    return sessionId;
  }

  it('HTTP transport initializes and lists 24+ tools', async () => {
    const app = createHttpTransportApp(store);
    httpServer = app.listen(0);
    httpServer._mcpApp = app;
    port = httpServer.address().port;

    const sessionId = await initSession(port);

    const toolsRes = await post(port, '/mcp', {
      jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
    }, { 'mcp-session-id': sessionId });

    assert.equal(toolsRes.status, 200);
    const toolsBody = JSON.parse(toolsRes.body);
    assert.ok(toolsBody.result);
    assert.ok(
      toolsBody.result.tools.length >= 24,
      `Expected 24+ tools, got ${toolsBody.result.tools.length}`,
    );
  });

  it('HTTP transport can call mockup_create_project', async () => {
    const app = createHttpTransportApp(store);
    httpServer = app.listen(0);
    httpServer._mcpApp = app;
    port = httpServer.address().port;

    const sessionId = await initSession(port);

    const callRes = await post(port, '/mcp', {
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: {
        name: 'mockup_create_project',
        arguments: { name: 'Test Project' },
      },
    }, { 'mcp-session-id': sessionId });

    assert.equal(callRes.status, 200);
    const callBody = JSON.parse(callRes.body);
    assert.ok(callBody.result, 'should have result');
  });

  it('max sessions limit rejects 11th connection', async () => {
    const app = createHttpTransportApp(store);
    httpServer = app.listen(0);
    httpServer._mcpApp = app;
    port = httpServer.address().port;

    // Create 10 sessions
    for (let i = 0; i < 10; i++) {
      const res = await post(port, '/mcp', {
        jsonrpc: '2.0', id: i + 1, method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: `client-${i}`, version: '1.0' },
        },
      });
      assert.equal(res.status, 200, `Session ${i} should succeed`);
    }

    // 11th should fail with 503
    const res = await post(port, '/mcp', {
      jsonrpc: '2.0', id: 11, method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'overflow', version: '1.0' },
      },
    });
    assert.equal(res.status, 503);
  });
});
```

**Step 2: Run test**

Run: `node --test tests/integration/m3b-integration.test.js`
Expected: PASS.

**Step 3: Commit**

```bash
git add tests/integration/m3b-integration.test.js
git commit -m "test: M3b integration tests — HTTP transport + session limits"
```

---

### Task 10: Update PM docs and milestones

**Files:**
- Create: `PM/tasks/M3b.md`
- Modify: `PM/milestones.md`

**Step 1: Create M3b tasks file**

Write `PM/tasks/M3b.md` with task statuses from implementation.

**Step 2: Update milestones.md**

Add M3b section with DoD checklist.

**Step 3: Run all tests as final check**

Run: `node --test tests/**/*.test.js`
Expected: All tests PASS (550+).

**Step 4: Commit**

```bash
git add PM/tasks/M3b.md PM/milestones.md
git commit -m "docs: M3b tasks and milestones update"
```

---

## Summary

| Sprint | Tasks | Key Deliverables |
|--------|-------|-----------------|
| 1 | T1-T5 | HTTP transport on port 3200, config, Dockerfile |
| 2 | T6-T8 | GitHub Actions CI/CD, CSS transitions in preview |
| 3 | T9-T10 | Integration tests, PM docs |

**New files:** 4 (`http-transport.js`, `docker-publish.yml`, `transitions.test.js`, `m3b-integration.test.js`)
**Modified files:** 6 (`config.js`, `index.js`, `tools/index.js`, `preview/server.js`, `Dockerfile`, `docker-compose.yml`)
**Estimated new tests:** 30-40
