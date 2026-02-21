# Sidebar Navigation + Tabbar Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a collapsible project/screen sidebar to every preview page and fix tabbar generation in screen-generator + dashboard template.

**Architecture:** Sidebar is injected via the existing `injectPreviewAssets()` pattern in preview/server.js. New `/api/projects` endpoint feeds the sidebar with project tree data. Tabbar fix adds augmentation logic in screen-generator.js and a default tabbar to dashboard.js template.

**Tech Stack:** Node.js, Express, HTML/CSS/JS (inline injected), node:test

---

### Task 1: Tabbar augmentation in screen-generator

**Files:**
- Modify: `src/mcp/screen-generator.js` (augmentElements function, ~line 195)
- Test: `tests/mcp/screen-generator.test.js`

**Step 1: Write the failing test**

Add to `tests/mcp/screen-generator.test.js` inside `augmentElements` describe block:

```javascript
it('adds tabbar when keyword present and not already in elements', () => {
  const base = [
    { type: 'navbar', x: 0, y: 0, width: 393, height: 56, z_index: 10, properties: { title: 'Test' } },
  ];
  const parsed = {
    screenKeywords: ['dashboard'],
    componentKeywords: ['tabbar'],
    modifierKeywords: [],
    tokens: ['dashboard', 'tabbar'],
  };
  const result = augmentElements(base, parsed, 393, 852);
  const tabbar = result.find(el => el.type === 'tabbar');
  assert.ok(tabbar, 'should add tabbar element');
  assert.equal(tabbar.y, 852 - 56, 'tabbar at bottom of screen');
  assert.equal(tabbar.z_index, 10, 'tabbar is pinned');
  assert.equal(tabbar.width, 393, 'tabbar is full width');
});

it('does not add tabbar if already present', () => {
  const base = [
    { type: 'tabbar', x: 0, y: 796, width: 393, height: 56, z_index: 10, properties: { tabs: [] } },
  ];
  const parsed = {
    screenKeywords: [],
    componentKeywords: ['tabbar'],
    modifierKeywords: [],
    tokens: ['tabbar'],
  };
  const result = augmentElements(base, parsed, 393, 852);
  const tabbars = result.filter(el => el.type === 'tabbar');
  assert.equal(tabbars.length, 1, 'should not duplicate tabbar');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: FAIL — "should add tabbar element"

**Step 3: Write minimal implementation**

In `src/mcp/screen-generator.js`, inside `augmentElements()`, after the alert augmentation block (~line 230), add:

```javascript
if (parsed.componentKeywords.includes('tabbar') && !existingTypes.has('tabbar')) {
  result.push({
    type: 'tabbar',
    x: 0,
    y: screenHeight - 56,
    width: screenWidth,
    height: 56,
    z_index: 10,
    properties: {
      tabs: [
        { icon: 'home', label: 'Home', active: true },
        { icon: 'search', label: 'Search' },
        { icon: 'user', label: 'Profile' },
      ],
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: PASS (all tests including new ones)

**Step 5: Commit**

```bash
git add src/mcp/screen-generator.js tests/mcp/screen-generator.test.js
git commit -m "feat: augmentElements adds tabbar when keyword present"
```

---

### Task 2: Dashboard template tabbar

**Files:**
- Modify: `src/renderer/templates/dashboard.js`
- Test: `tests/mcp/screen-generator.test.js` (integration via generateScreen)

**Step 1: Write the failing test**

Add to `tests/mcp/screen-generator.test.js`:

```javascript
describe('generateScreen — dashboard tabbar', () => {
  it('dashboard template includes tabbar by default', () => {
    const result = generateScreen('dashboard screen', 393, 852, 'wireframe');
    const tabbar = result.elements.find(el => el.type === 'tabbar');
    assert.ok(tabbar, 'dashboard should include tabbar');
    assert.equal(tabbar.y, 852 - 56);
    assert.equal(tabbar.z_index, 10);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: FAIL — "dashboard should include tabbar"

**Step 3: Write minimal implementation**

In `src/renderer/templates/dashboard.js`, add tabbar as last element before the `return` (inside the `elements` array), adjusting list height to account for tabbar:

```javascript
// Tabbar — pinned at bottom
{
  type: 'tabbar',
  x: 0,
  y: screenHeight - 56,
  width: screenWidth,
  height: 56,
  z_index: 10,
  properties: {
    tabs: [
      { icon: 'home', label: 'Home', active: true },
      { icon: 'bar-chart-2', label: 'Analytics' },
      { icon: 'settings', label: 'Settings' },
    ],
  },
},
```

Also reduce the list height calculation by 56px to avoid overlapping with tabbar.

**Step 4: Run test to verify it passes**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: PASS

**Step 5: Run full test suite for regressions**

Run: `node --test tests/**/*.test.js`
Expected: All 611+ tests pass

**Step 6: Commit**

```bash
git add src/renderer/templates/dashboard.js tests/mcp/screen-generator.test.js
git commit -m "feat: dashboard template includes tabbar by default"
```

---

### Task 3: Projects API endpoint

**Files:**
- Modify: `src/preview/server.js`
- Test: `tests/preview/sidebar.test.js` (new file)

**Step 1: Write the failing test**

Create `tests/preview/sidebar.test.js`:

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
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

describe('projects API', () => {
  let tmpDir, server, port, origDataDir;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'preview-sidebar-'));
    origDataDir = config.dataDir;
    config.dataDir = tmpDir;

    const store = new ProjectStore(tmpDir);
    await store.init();

    const project = await store.createProject('Test Project', 'desc', { width: 393, height: 852, preset: 'mobile' });
    await store.addScreen(project.id, 'Screen A', 393, 852, '#fff');

    port = 3100 + Math.floor(Math.random() * 1000);
    server = startPreviewServer(port);
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(() => {
    config.dataDir = origDataDir;
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /api/projects returns JSON array with project and screens', async () => {
    const res = await get(port, '/api/projects');
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 1);
    assert.equal(data[0].name, 'Test Project');
    assert.ok(Array.isArray(data[0].screens));
    assert.equal(data[0].screens.length, 1);
    assert.equal(data[0].screens[0].name, 'Screen A');
  });

  it('GET /api/projects returns empty array when no projects', async () => {
    config.dataDir = mkdtempSync(join(tmpdir(), 'preview-empty-'));
    const emptyPort = port + 1;
    const emptyServer = startPreviewServer(emptyPort);
    await new Promise(r => setTimeout(r, 100));
    const res = await get(emptyPort, '/api/projects');
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), []);
    emptyServer.close();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/preview/sidebar.test.js`
Expected: FAIL — 404 on `/api/projects`

**Step 3: Write minimal implementation**

In `src/preview/server.js`, add route before the `app.listen()` call:

```javascript
app.get('/api/projects', async (_req, res) => {
  try {
    const projects = await store.listProjects();
    const result = [];
    for (const proj of projects) {
      const full = await store.getProject(proj.id);
      result.push({
        id: full.id,
        name: full.name,
        style: full.style,
        screens: (full.screens || []).map(s => ({ id: s.id, name: s.name })),
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/preview/sidebar.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/preview/server.js tests/preview/sidebar.test.js
git commit -m "feat: GET /api/projects endpoint for sidebar navigation"
```

---

### Task 4: Sidebar HTML/CSS/JS injection

**Files:**
- Modify: `src/preview/server.js` (add SIDEBAR_HTML, SIDEBAR_CSS, SIDEBAR_JS constants + inject)
- Test: `tests/preview/sidebar.test.js` (extend)

**Step 1: Write the failing test**

Add to `tests/preview/sidebar.test.js`:

```javascript
describe('sidebar injection', () => {
  it('preview page contains sidebar HTML', async () => {
    const res = await get(port, '/api/projects');
    const projects = JSON.parse(res.body);
    const screenId = projects[0].screens[0].id;
    const previewRes = await get(port, `/preview/${projects[0].id}/${screenId}`);
    assert.equal(previewRes.status, 200);
    assert.ok(previewRes.body.includes('mockup-sidebar'), 'should contain sidebar element');
    assert.ok(previewRes.body.includes('mockup-sidebar-toggle'), 'should contain toggle button');
  });

  it('sidebar contains project name and screen name', async () => {
    const res = await get(port, '/api/projects');
    const projects = JSON.parse(res.body);
    const screenId = projects[0].screens[0].id;
    const previewRes = await get(port, `/preview/${projects[0].id}/${screenId}`);
    assert.ok(previewRes.body.includes('/api/projects'), 'sidebar JS fetches project list');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/preview/sidebar.test.js`
Expected: FAIL — "should contain sidebar element"

**Step 3: Write implementation**

In `src/preview/server.js`, add three new constants:

**SIDEBAR_CSS** (~60 lines): left sidebar 260px, collapsible, tree styling, active state highlight, mobile responsive overlay.

**SIDEBAR_HTML**: `<div id="mockup-sidebar">` container with toggle button and `<div id="mockup-sidebar-tree">` for dynamic content.

**SIDEBAR_JS** (~50 lines): fetches `/api/projects` on load, renders tree, polls every 3s for updates, highlights active screen from URL, toggle collapse with localStorage persistence, navigates on click (SPA-style using existing swapScreen if available, otherwise location.href).

Inject via `injectPreviewAssets()` — add sidebar CSS to `</head>` and sidebar HTML+JS to `</body>`.

Update `PREVIEW_STYLE` to shift the `.screen` container right when sidebar is open:

```css
body { margin-left: 260px; transition: margin-left 0.3s; }
body.sidebar-collapsed { margin-left: 40px; }
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/preview/sidebar.test.js`
Expected: PASS

**Step 5: Run full test suite**

Run: `node --test tests/**/*.test.js`
Expected: All tests pass (transitions test uses preview server — verify no regressions)

**Step 6: Commit**

```bash
git add src/preview/server.js tests/preview/sidebar.test.js
git commit -m "feat: collapsible sidebar navigation in preview pages"
```

---

### Task 5: Landing page route

**Files:**
- Modify: `src/preview/server.js`
- Test: `tests/preview/sidebar.test.js` (extend)

**Step 1: Write the failing test**

Add to `tests/preview/sidebar.test.js`:

```javascript
describe('landing page', () => {
  it('GET / redirects to /preview', async () => {
    const res = await get(port, '/');
    // http.get follows redirects, so we check the final body
    assert.ok(res.body.includes('mockup-sidebar'), 'landing page has sidebar');
    assert.ok(res.body.includes('Select a screen'), 'landing page has placeholder text');
  });

  it('GET /preview returns landing page with sidebar', async () => {
    const res = await get(port, '/preview');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('mockup-sidebar'));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/preview/sidebar.test.js`
Expected: FAIL — 404 on `/preview`

**Step 3: Write implementation**

In `src/preview/server.js`, add two routes:

```javascript
app.get('/', (_req, res) => res.redirect('/preview'));

app.get('/preview', (_req, res) => {
  const html = buildLandingPage();
  res.type('html').send(html);
});
```

`buildLandingPage()` returns a minimal HTML page with sidebar + centered "Select a screen to preview" placeholder. Reuses SIDEBAR_CSS and SIDEBAR_JS.

**Step 4: Run test to verify it passes**

Run: `node --test tests/preview/sidebar.test.js`
Expected: PASS

**Step 5: Run full test suite**

Run: `node --test tests/**/*.test.js`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/preview/server.js tests/preview/sidebar.test.js
git commit -m "feat: landing page with project sidebar at /preview"
```

---

### Task 6: Final integration test + regression check

**Files:**
- Test: `tests/preview/sidebar.test.js` (extend)

**Step 1: Write integration test**

Add to `tests/preview/sidebar.test.js`:

```javascript
describe('sidebar + screen preview integration', () => {
  it('navigating to a screen shows both sidebar and mockup content', async () => {
    const res = await get(port, '/api/projects');
    const projects = JSON.parse(res.body);
    const proj = projects[0];
    const screen = proj.screens[0];
    const previewRes = await get(port, `/preview/${proj.id}/${screen.id}`);
    assert.equal(previewRes.status, 200);
    // Both sidebar and screen content present
    assert.ok(previewRes.body.includes('mockup-sidebar'));
    assert.ok(previewRes.body.includes('class="screen"'));
  });
});
```

**Step 2: Run full test suite**

Run: `node --test tests/**/*.test.js`
Expected: All tests pass (611+ existing + ~8 new)

**Step 3: Commit**

```bash
git add tests/preview/sidebar.test.js
git commit -m "test: sidebar + preview integration tests"
```

---

### Task 7: Update milestones + memory

**Files:**
- Modify: `PM/milestones.md`

**Step 1:** Add M7 entry to milestones.md with sidebar + tabbar fix scope and DoD.

**Step 2:** Update auto memory with new component count and test count.

**Step 3: Commit**

```bash
git add PM/milestones.md
git commit -m "docs: M7 milestone — sidebar navigation + tabbar fix"
```
