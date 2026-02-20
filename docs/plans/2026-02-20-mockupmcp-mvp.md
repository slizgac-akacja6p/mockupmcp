# MockupMCP MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Docker-containerized MCP server that creates UI mockups from Claude Code via 13 MCP tools, rendering wireframe-style PNG screenshots.

**Architecture:** Single Node.js process running MCP server (stdio) + Express preview server (HTTP 3100). Rendering pipeline: JSON screen definition -> HTML string (inline CSS, pure component functions) -> Puppeteer screenshot -> PNG. Storage: one JSON file per project on /data Docker volume.

**Tech Stack:** Node.js 20 (Alpine), @modelcontextprotocol/sdk, puppeteer-core, express, nanoid, zod

**Design doc:** `docs/plans/mvp-architecture.md` — read ADRs for rationale on all decisions.

---

## Wave A — Foundation (parallel tasks T1, T2, T3)

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.dockerignore`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `src/config.js`

**Step 1: Create package.json**

```json
{
  "name": "mockupmcp",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test tests/**/*.test.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.9.0",
    "express": "^4.21.0",
    "nanoid": "^5.0.0",
    "puppeteer-core": "^23.0.0",
    "zod": "^3.23.0"
  }
}
```

**Step 2: Create .gitignore**

```
node_modules/
mockups/
*.png
.DS_Store
```

**Step 3: Create .dockerignore**

```
node_modules/
mockups/
.git/
tests/
PM/
docs/
*.md
!README.md
```

**Step 4: Create Dockerfile**

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
ENV MCP_TRANSPORT=stdio

EXPOSE 3100

VOLUME ["/data"]

ENTRYPOINT ["node", "src/index.js"]
```

**Step 5: Create docker-compose.yml**

```yaml
services:
  mockupmcp:
    build: .
    image: mockupmcp:latest
    container_name: mockupmcp
    ports:
      - "3100:3100"
    volumes:
      - ./mockups:/data
    environment:
      - MCP_TRANSPORT=stdio
      - PREVIEW_PORT=3100
      - DEFAULT_STYLE=wireframe
    stdin_open: true
    tty: true
```

**Step 6: Create src/config.js**

```javascript
export const config = {
  dataDir: process.env.DATA_DIR || './mockups',
  previewPort: parseInt(process.env.PREVIEW_PORT || '3100', 10),
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

**Step 7: Run npm install**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

**Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore .dockerignore Dockerfile docker-compose.yml src/config.js
git commit -m "chore: project scaffolding with package.json, Dockerfile, config"
```

---

### Task 2: Storage Layer

**Files:**
- Create: `src/storage/id-generator.js`
- Create: `src/storage/project-store.js`
- Create: `tests/storage/project-store.test.js`

**Step 1: Create id-generator.js**

```javascript
import { nanoid } from 'nanoid';

const ID_PATTERN = /^[a-z]+_[A-Za-z0-9_-]+$/;

export function generateId(prefix) {
  return `${prefix}_${nanoid(10)}`;
}

export function validateId(id) {
  return ID_PATTERN.test(id);
}
```

**Step 2: Create project-store.js**

Full CRUD for projects/screens/elements. Key behaviors:
- One JSON file per project at `{dataDir}/projects/{projectId}.json`
- Exports saved to `{dataDir}/exports/{projectId}/{screenId}.png`
- Atomic writes: write to `.tmp` then rename
- Per-project mutex (simple promise chain) to prevent concurrent write corruption
- `updated_at` timestamp on every write
- All methods async

```javascript
import { readFile, writeFile, readdir, mkdir, unlink, rename } from 'fs/promises';
import { join } from 'path';
import { generateId, validateId } from './id-generator.js';

export class ProjectStore {
  constructor(dataDir) {
    this.projectsDir = join(dataDir, 'projects');
    this.exportsDir = join(dataDir, 'exports');
    this.locks = new Map();
  }

  async init() {
    await mkdir(this.projectsDir, { recursive: true });
    await mkdir(this.exportsDir, { recursive: true });
  }

  // -- Projects --

  async createProject(name, description, viewport) {
    const project = {
      id: generateId('proj'),
      name,
      description: description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      viewport,
      screens: [],
    };
    await this._save(project);
    return project;
  }

  async getProject(projectId) {
    this._validateId(projectId);
    const data = await readFile(this._path(projectId), 'utf-8');
    return JSON.parse(data);
  }

  async listProjects() {
    await this.init();
    const files = await readdir(this.projectsDir);
    const projects = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const data = await readFile(join(this.projectsDir, f), 'utf-8');
      const p = JSON.parse(data);
      projects.push({ id: p.id, name: p.name, screens: p.screens.length, updated_at: p.updated_at });
    }
    return projects;
  }

  async deleteProject(projectId) {
    this._validateId(projectId);
    await unlink(this._path(projectId));
  }

  // -- Screens --

  async addScreen(projectId, name, width, height, background) {
    const project = await this.getProject(projectId);
    const screen = {
      id: generateId('scr'),
      name,
      width: width || project.viewport.width,
      height: height || project.viewport.height,
      background: background || '#FFFFFF',
      elements: [],
    };
    project.screens.push(screen);
    await this._save(project);
    return screen;
  }

  async listScreens(projectId) {
    const project = await this.getProject(projectId);
    return project.screens.map(s => ({
      id: s.id, name: s.name, width: s.width, height: s.height,
      elements: s.elements.length,
    }));
  }

  async deleteScreen(projectId, screenId) {
    const project = await this.getProject(projectId);
    const idx = project.screens.findIndex(s => s.id === screenId);
    if (idx === -1) throw new Error(`Screen ${screenId} not found`);
    project.screens.splice(idx, 1);
    await this._save(project);
  }

  // -- Elements --

  async addElement(projectId, screenId, type, x, y, width, height, properties, zIndex) {
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);
    const element = {
      id: generateId('el'),
      type, x, y, width, height,
      z_index: zIndex || 0,
      properties: properties || {},
    };
    screen.elements.push(element);
    await this._save(project);
    return element;
  }

  async updateElement(projectId, screenId, elementId, properties) {
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);
    const el = screen.elements.find(e => e.id === elementId);
    if (!el) throw new Error(`Element ${elementId} not found`);
    el.properties = { ...el.properties, ...properties };
    await this._save(project);
    return el;
  }

  async deleteElement(projectId, screenId, elementId) {
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);
    const idx = screen.elements.findIndex(e => e.id === elementId);
    if (idx === -1) throw new Error(`Element ${elementId} not found`);
    screen.elements.splice(idx, 1);
    await this._save(project);
  }

  async moveElement(projectId, screenId, elementId, x, y, width, height, zIndex) {
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);
    const el = screen.elements.find(e => e.id === elementId);
    if (!el) throw new Error(`Element ${elementId} not found`);
    if (x !== undefined) el.x = x;
    if (y !== undefined) el.y = y;
    if (width !== undefined) el.width = width;
    if (height !== undefined) el.height = height;
    if (zIndex !== undefined) el.z_index = zIndex;
    await this._save(project);
    return el;
  }

  async listElements(projectId, screenId) {
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);
    return screen.elements;
  }

  // -- Exports --

  async saveExport(projectId, screenId, pngBuffer) {
    const dir = join(this.exportsDir, projectId);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${screenId}.png`);
    await writeFile(filePath, pngBuffer);
    return filePath;
  }

  // -- Internal --

  _path(projectId) {
    return join(this.projectsDir, `${projectId}.json`);
  }

  _validateId(id) {
    if (!validateId(id)) throw new Error(`Invalid ID format: ${id}`);
  }

  _findScreen(project, screenId) {
    const screen = project.screens.find(s => s.id === screenId);
    if (!screen) throw new Error(`Screen ${screenId} not found in project ${project.id}`);
    return screen;
  }

  async _save(project) {
    project.updated_at = new Date().toISOString();
    await this.init();
    const tmpPath = this._path(project.id) + '.tmp';
    await writeFile(tmpPath, JSON.stringify(project, null, 2));
    await rename(tmpPath, this._path(project.id));
  }
}
```

**Step 3: Write tests for project-store**

```javascript
// tests/storage/project-store.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { ProjectStore } from '../../src/storage/project-store.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ProjectStore', () => {
  let store;
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mockupmcp-test-'));
    store = new ProjectStore(tmpDir);
    await store.init();
  });

  after(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it('creates and retrieves a project', async () => {
    const project = await store.createProject('Test', 'desc', { width: 393, height: 852, preset: 'mobile' });
    assert.ok(project.id.startsWith('proj_'));
    const retrieved = await store.getProject(project.id);
    assert.strictEqual(retrieved.name, 'Test');
  });

  it('lists projects', async () => {
    const list = await store.listProjects();
    assert.ok(list.length >= 1);
  });

  it('adds and lists screens', async () => {
    const proj = await store.createProject('S', '', { width: 393, height: 852, preset: 'mobile' });
    const screen = await store.addScreen(proj.id, 'Home', 393, 852, '#FFF');
    assert.ok(screen.id.startsWith('scr_'));
    const screens = await store.listScreens(proj.id);
    assert.strictEqual(screens.length, 1);
  });

  it('adds, updates, moves, lists, and deletes elements', async () => {
    const proj = await store.createProject('E', '', { width: 393, height: 852, preset: 'mobile' });
    const scr = await store.addScreen(proj.id, 'Test', 393, 852, '#FFF');
    const el = await store.addElement(proj.id, scr.id, 'button', 10, 20, 100, 40, { label: 'Click' });
    assert.ok(el.id.startsWith('el_'));

    const updated = await store.updateElement(proj.id, scr.id, el.id, { label: 'Press' });
    assert.strictEqual(updated.properties.label, 'Press');

    const moved = await store.moveElement(proj.id, scr.id, el.id, 50, 60, undefined, undefined, 5);
    assert.strictEqual(moved.x, 50);
    assert.strictEqual(moved.z_index, 5);

    const elems = await store.listElements(proj.id, scr.id);
    assert.strictEqual(elems.length, 1);

    await store.deleteElement(proj.id, scr.id, el.id);
    const afterDel = await store.listElements(proj.id, scr.id);
    assert.strictEqual(afterDel.length, 0);
  });

  it('deletes a project', async () => {
    const proj = await store.createProject('Del', '', { width: 393, height: 852, preset: 'mobile' });
    await store.deleteProject(proj.id);
    await assert.rejects(() => store.getProject(proj.id));
  });

  it('rejects invalid IDs', async () => {
    await assert.rejects(() => store.getProject('../../etc/passwd'));
  });
});
```

**Step 4: Run tests**

Run: `node --test tests/storage/project-store.test.js`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/storage/ tests/storage/
git commit -m "feat: storage layer with project/screen/element CRUD"
```

---

### Task 3: Component Renderers + Wireframe CSS

**Files:**
- Create: `src/renderer/styles/wireframe.css`
- Create: `src/renderer/components/text.js`
- Create: `src/renderer/components/rectangle.js`
- Create: `src/renderer/components/button.js`
- Create: `src/renderer/components/input.js`
- Create: `src/renderer/components/image.js`
- Create: `src/renderer/components/icon.js`
- Create: `src/renderer/components/navbar.js`
- Create: `src/renderer/components/tabbar.js`
- Create: `src/renderer/components/card.js`
- Create: `src/renderer/components/list.js`
- Create: `src/renderer/components/index.js`
- Create: `tests/renderer/components.test.js`

**Step 1: Create wireframe.css**

Wireframe palette (from architecture doc Appendix C):
- Text: #333, Secondary: #666, Placeholder: #999
- Borders: #DDD, Background: #F5F5F5, White: #FFF
- Font: system stack, border-radius: 4px
- No shadows, no gradients

CSS classes: `.mockup-button`, `.mockup-button--primary`, `.mockup-button--secondary`, `.mockup-button--outline`, `.mockup-button--ghost`, `.mockup-button--sm`, `.mockup-button--md`, `.mockup-button--lg`, `.mockup-input`, `.mockup-navbar`, `.mockup-tabbar`, `.mockup-card`, `.mockup-list`, `.mockup-list-item`, `.mockup-image-placeholder`, `.mockup-icon`, `.mockup-badge`

Full CSS: ~120 lines. Box-sizing border-box on all elements. System font stack as body default.

**Step 2: Create each component file**

Each file exports `render(props)` and `defaults()`. Pattern:

```javascript
// src/renderer/components/text.js
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function defaults() {
  return { content: 'Text', fontSize: 16, fontWeight: 'normal', color: '#333333', align: 'left' };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  return `<span style="font-size:${p.fontSize}px;font-weight:${p.fontWeight};color:${p.color};text-align:${p.align};display:block;width:100%;height:100%;overflow:hidden;">${escapeHtml(p.content)}</span>`;
}
```

**Component specifics:**

| Component | HTML structure | Key props |
|-----------|---------------|-----------|
| `text` | `<span>` with inline styles | content, fontSize, fontWeight, color, align |
| `rectangle` | `<div>` with border/bg/radius | fill, stroke, cornerRadius, opacity |
| `button` | `<button class="mockup-button ...">` | label, variant, size |
| `input` | `<div>` with `<label>` + styled `<div class="mockup-input">` | placeholder, label, type |
| `image` | `<div class="mockup-image-placeholder">` with diagonal cross SVG | placeholder, aspectRatio |
| `icon` | `<svg>` with Lucide path data | name, size, color |
| `navbar` | Flexbox row: left icon + title + right icons | title, leftIcon, rightIcons[] |
| `tabbar` | Flexbox row: tab items with icon + label | tabs[] with icon, label, active |
| `card` | Div with optional image area, title, subtitle | title, subtitle, image, actions[] |
| `list` | Repeated div items with variant styling | items[], variant (simple/detailed/card) |

**Icon component** needs inline Lucide SVG paths for ~20 icons: home, search, user, menu, settings, bell/notifications, plus, x/close, chevron-left, chevron-right, heart, star, share, send, trash, edit, camera, image, check, more-horizontal.

**navbar.js and tabbar.js** import `render` from `icon.js` internally for icon rendering.

**Step 3: Create component registry (index.js)**

```javascript
import * as text from './text.js';
import * as rectangle from './rectangle.js';
import * as button from './button.js';
import * as input from './input.js';
import * as image from './image.js';
import * as icon from './icon.js';
import * as navbar from './navbar.js';
import * as tabbar from './tabbar.js';
import * as card from './card.js';
import * as list from './list.js';

const components = { text, rectangle, button, input, image, icon, navbar, tabbar, card, list };

export function getComponent(type) {
  return components[type] || null;
}

export function getAvailableTypes() {
  return Object.keys(components);
}
```

**Step 4: Write component tests**

Test each component renders valid HTML containing expected content. Test registry maps all 10 types. Test unknown type returns null.

```javascript
// tests/renderer/components.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getComponent, getAvailableTypes } from '../../src/renderer/components/index.js';

describe('Component Registry', () => {
  it('has 10 registered types', () => {
    assert.strictEqual(getAvailableTypes().length, 10);
  });

  it('returns null for unknown type', () => {
    assert.strictEqual(getComponent('foobar'), null);
  });
});

describe('Components render HTML', () => {
  for (const type of getAvailableTypes()) {
    it(`${type} renders non-empty HTML`, () => {
      const comp = getComponent(type);
      const html = comp.render(comp.defaults());
      assert.ok(html.length > 0);
      assert.ok(typeof html === 'string');
    });
  }
});

describe('Button component', () => {
  it('renders label text', () => {
    const btn = getComponent('button');
    const html = btn.render({ label: 'Click Me' });
    assert.ok(html.includes('Click Me'));
  });

  it('applies variant class', () => {
    const btn = getComponent('button');
    const html = btn.render({ label: 'X', variant: 'secondary' });
    assert.ok(html.includes('secondary'));
  });
});

describe('Text component', () => {
  it('escapes HTML in content', () => {
    const txt = getComponent('text');
    const html = txt.render({ content: '<script>alert("xss")</script>' });
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});

describe('Icon component', () => {
  it('renders SVG for known icon', () => {
    const ico = getComponent('icon');
    const html = ico.render({ name: 'home', size: 24, color: '#333' });
    assert.ok(html.includes('<svg'));
    assert.ok(html.includes('</svg>'));
  });

  it('renders fallback for unknown icon', () => {
    const ico = getComponent('icon');
    const html = ico.render({ name: 'nonexistent' });
    assert.ok(html.includes('<svg'));
  });
});

describe('Navbar component', () => {
  it('renders title', () => {
    const nav = getComponent('navbar');
    const html = nav.render({ title: 'My App' });
    assert.ok(html.includes('My App'));
  });
});
```

**Step 5: Run tests**

Run: `node --test tests/renderer/components.test.js`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/renderer/ tests/renderer/
git commit -m "feat: 10 wireframe UI components with CSS and tests"
```

---

## Wave B — Core Modules (parallel tasks T4, T5, T6)

### Task 4: HTML Builder

**Files:**
- Create: `src/renderer/html-builder.js`
- Create: `tests/renderer/html-builder.test.js`

**Step 1: Create html-builder.js**

See architecture doc ADR-002 for full code. Key points:
- `buildScreenHtml(screen)` returns complete `<!DOCTYPE html>` document
- Inlines wireframe.css via `readFileSync`
- Elements sorted by z_index, rendered via component registry
- Each element wrapped in absolutely-positioned div with `overflow: hidden`
- Screen container has `overflow: hidden` and explicit width/height
- Unknown element types rendered as HTML comments

```javascript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getComponent } from './components/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wireframeCss = readFileSync(join(__dirname, 'styles', 'wireframe.css'), 'utf-8');

export function buildScreenHtml(screen) {
  const elementsHtml = (screen.elements || [])
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .map(el => {
      const component = getComponent(el.type);
      if (!component) return `<!-- unknown type: ${el.type} -->`;
      const innerHtml = component.render(el.properties || {});
      return `<div class="element" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.z_index || 0};overflow:hidden;">${innerHtml}</div>`;
    })
    .join('\n    ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    ${wireframeCss}
  </style>
</head>
<body>
  <div class="screen" style="position:relative;width:${screen.width}px;height:${screen.height}px;background:${screen.background || '#FFFFFF'};overflow:hidden;">
    ${elementsHtml}
  </div>
</body>
</html>`;
}
```

**Step 2: Write tests**

```javascript
// tests/renderer/html-builder.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildScreenHtml } from '../../src/renderer/html-builder.js';

describe('buildScreenHtml', () => {
  it('renders empty screen', () => {
    const html = buildScreenHtml({ width: 393, height: 852, background: '#FFF', elements: [] });
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('393px'));
    assert.ok(html.includes('852px'));
  });

  it('renders screen with button element', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{ id: 'el_1', type: 'button', x: 10, y: 20, width: 100, height: 40, z_index: 0, properties: { label: 'OK' } }],
    });
    assert.ok(html.includes('OK'));
    assert.ok(html.includes('left:10px'));
  });

  it('skips unknown element types', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{ id: 'el_1', type: 'unknown_type', x: 0, y: 0, width: 50, height: 50, properties: {} }],
    });
    assert.ok(html.includes('<!-- unknown type: unknown_type -->'));
  });

  it('sorts elements by z_index', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'text', x: 0, y: 0, width: 100, height: 20, z_index: 10, properties: { content: 'TOP' } },
        { id: 'el_2', type: 'text', x: 0, y: 0, width: 100, height: 20, z_index: 1, properties: { content: 'BOTTOM' } },
      ],
    });
    const topIdx = html.indexOf('TOP');
    const bottomIdx = html.indexOf('BOTTOM');
    assert.ok(bottomIdx < topIdx, 'Lower z_index should appear first in HTML');
  });

  it('inlines wireframe CSS', () => {
    const html = buildScreenHtml({ width: 393, height: 852, background: '#FFF', elements: [] });
    assert.ok(html.includes('.mockup-button'));
  });
});
```

**Step 3: Run tests**

Run: `node --test tests/renderer/html-builder.test.js`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/renderer/html-builder.js tests/renderer/html-builder.test.js
git commit -m "feat: HTML builder converts screen JSON to HTML document"
```

---

### Task 5: Screenshot Module

**Files:**
- Create: `src/renderer/screenshot.js`

**Step 1: Create screenshot.js**

See architecture doc ADR-002. Key points:
- Singleton browser instance (lazy init)
- `puppeteer-core` with system Chromium path from config
- `--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage` flags
- Page created/closed per screenshot
- `deviceScaleFactor` for retina quality
- Error recovery: if page creation fails, close and reinit browser

```javascript
import puppeteer from 'puppeteer-core';
import { config } from '../config.js';

let browser = null;

export async function initBrowser() {
  if (browser) return;
  browser = await puppeteer.launch({
    headless: true,
    executablePath: config.chromiumPath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

export async function takeScreenshot(html, width, height, scale = config.screenshotScale) {
  if (!browser) await initBrowser();

  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    return buffer;
  } catch (err) {
    // If browser crashed, try reinit once
    if (page) try { await page.close(); } catch (_) {}
    try { await browser.close(); } catch (_) {}
    browser = null;
    throw err;
  } finally {
    if (page) try { await page.close(); } catch (_) {}
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
```

**Notes:** Unit testing requires Chromium (Docker). Skip in local test runs; validate in E2E (Task 10).

**Step 2: Commit**

```bash
git add src/renderer/screenshot.js
git commit -m "feat: Puppeteer screenshot module with singleton browser"
```

---

### Task 6: MCP Server + Tool Schemas

**Files:**
- Create: `src/mcp/server.js`
- Create: `src/mcp/tools/index.js`

**Step 1: Create MCP server**

```javascript
// src/mcp/server.js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export function createMcpServer() {
  return new McpServer({
    name: 'mockupmcp',
    version: '0.1.0',
    capabilities: { tools: {} },
  });
}

export async function startMcpServer(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

**Step 2: Create tool registry (index.js)**

```javascript
// src/mcp/tools/index.js
import { ProjectStore } from '../../storage/project-store.js';
import { config } from '../../config.js';

export function registerAllTools(server) {
  const store = new ProjectStore(config.dataDir);

  // These will be implemented in Task 7
  // registerProjectTools(server, store);
  // registerScreenTools(server, store);
  // registerElementTools(server, store);
  // registerExportTools(server, store);
}
```

**Step 3: Commit**

```bash
git add src/mcp/
git commit -m "feat: MCP server setup with stdio transport"
```

---

## Wave C — Integration (parallel tasks T7, T8)

### Task 7: Tool Handlers

**Files:**
- Create: `src/mcp/tools/project-tools.js`
- Create: `src/mcp/tools/screen-tools.js`
- Create: `src/mcp/tools/element-tools.js`
- Create: `src/mcp/tools/export-tools.js`
- Modify: `src/mcp/tools/index.js` (uncomment registrations, add imports)
- Create: `tests/mcp/tools.integration.test.js`

**Step 1: Create project-tools.js**

3 tools: `mockup_create_project`, `mockup_list_projects`, `mockup_delete_project`

Pattern (all tools follow this):
```javascript
import { z } from 'zod';
import { config } from '../../config.js';

export function registerProjectTools(server, store) {
  server.tool(
    'mockup_create_project',
    'Create a new mockup project',
    {
      name: z.string().describe('Project name'),
      description: z.string().optional().describe('Project description'),
      viewport: z.enum(['mobile', 'tablet', 'desktop']).optional().default('mobile')
        .describe('Viewport preset: mobile (393x852), tablet (834x1194), desktop (1440x900)'),
    },
    async ({ name, description, viewport }) => {
      try {
        const vp = { ...config.viewportPresets[viewport], preset: viewport };
        const project = await store.createProject(name, description, vp);
        return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    }
  );

  // mockup_list_projects and mockup_delete_project follow same pattern
}
```

**Step 2: Create screen-tools.js**

3 tools: `mockup_add_screen`, `mockup_list_screens`, `mockup_delete_screen`

All require `project_id`. `add_screen` accepts optional `width`, `height`, `background`.

**Step 3: Create element-tools.js**

5 tools: `mockup_add_element`, `mockup_update_element`, `mockup_delete_element`, `mockup_move_element`, `mockup_list_elements`

All require `project_id` + `screen_id`. `add_element` accepts `type` (validated against available types), `x`, `y`, `width`, `height`, `properties` (object), `z_index`.

`add_element` should validate type against `getAvailableTypes()` and return error with available types list if invalid.

**Step 4: Create export-tools.js**

2 tools: `mockup_export`, `mockup_get_preview_url`

`mockup_export`:
1. Get project + screen from store
2. Build HTML via `buildScreenHtml(screen)`
3. Take screenshot via `takeScreenshot(html, width, height, scale)`
4. Save to file via `store.saveExport(projectId, screenId, buffer)`
5. Return BOTH text (file path) AND image content (base64):

```javascript
return {
  content: [
    { type: 'text', text: `Exported to ${filePath} (${screen.width}x${screen.height} @${scale}x)` },
    { type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' },
  ],
};
```

`mockup_get_preview_url`:
```javascript
return {
  content: [{
    type: 'text',
    text: `Preview URL: http://localhost:${config.previewPort}/preview/${projectId}/${screenId}\n\nOpen in browser for live preview with auto-refresh.`,
  }],
};
```

**Step 5: Update index.js with all imports and registrations**

**Step 6: Write integration tests**

Test the full flow via direct store + tool function calls (without actual MCP transport). Create project, add screen, add elements, verify store state.

**Step 7: Run tests**

Run: `node --test tests/mcp/tools.integration.test.js`
Expected: All tests pass.

**Step 8: Commit**

```bash
git add src/mcp/tools/ tests/mcp/
git commit -m "feat: 13 MCP tool handlers with validation and error handling"
```

---

### Task 8: Preview Server

**Files:**
- Create: `src/preview/server.js`
- Create: `src/preview/templates/preview-page.html`

**Step 1: Create preview-page.html**

Minimal HTML wrapper with auto-reload script. The script polls `/api/lastmod/:projectId` every 2 seconds and reloads on change.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MockupMCP Preview</title>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; background: #E0E0E0; padding: 20px; }
    .frame { box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  </style>
</head>
<body>
  <div class="frame">{{CONTENT}}</div>
  <script>
    const projectId = '{{PROJECT_ID}}';
    let lastMod = '{{LAST_MOD}}';
    setInterval(async () => {
      try {
        const r = await fetch(`/api/lastmod/${projectId}`);
        const data = await r.json();
        if (data.updated_at !== lastMod) location.reload();
      } catch (_) {}
    }, 2000);
  </script>
</body>
</html>
```

**Step 2: Create server.js**

```javascript
import express from 'express';
import { ProjectStore } from '../storage/project-store.js';
import { buildScreenHtml } from '../renderer/html-builder.js';
import { config } from '../config.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const previewTemplate = readFileSync(join(__dirname, 'templates', 'preview-page.html'), 'utf-8');

export function startPreviewServer(port) {
  const app = express();
  const store = new ProjectStore(config.dataDir);

  app.get('/preview/:projectId/:screenId', async (req, res) => {
    try {
      const project = await store.getProject(req.params.projectId);
      const screen = project.screens.find(s => s.id === req.params.screenId);
      if (!screen) return res.status(404).send('Screen not found');

      const screenHtml = buildScreenHtml(screen);
      const page = previewTemplate
        .replace('{{CONTENT}}', screenHtml)
        .replace('{{PROJECT_ID}}', project.id)
        .replace('{{LAST_MOD}}', project.updated_at);
      res.type('html').send(page);
    } catch (err) {
      res.status(500).send(`Error: ${err.message}`);
    }
  });

  app.get('/api/lastmod/:projectId', async (req, res) => {
    try {
      const project = await store.getProject(req.params.projectId);
      res.json({ updated_at: project.updated_at });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  const server = app.listen(port, () => {
    console.error(`[MockupMCP] Preview server: http://localhost:${port}`);
  });

  return server;
}
```

**Step 3: Commit**

```bash
git add src/preview/
git commit -m "feat: Express preview server with polling-based auto-reload"
```

---

## Wave D — Wiring & Validation (sequential T9, T10)

### Task 9: Entry Point + Wiring

**Files:**
- Create: `src/index.js`

**Step 1: Create index.js**

```javascript
import { createMcpServer, startMcpServer } from './mcp/server.js';
import { registerAllTools } from './mcp/tools/index.js';
import { startPreviewServer } from './preview/server.js';
import { initBrowser, closeBrowser } from './renderer/screenshot.js';
import { config } from './config.js';

// Redirect all console.log to stderr to keep stdout clean for MCP
const originalLog = console.log;
console.log = (...args) => console.error(...args);

async function main() {
  console.error('[MockupMCP] Starting...');

  // Start preview HTTP server
  const httpServer = startPreviewServer(config.previewPort);

  // Create and configure MCP server
  const mcpServer = createMcpServer();
  registerAllTools(mcpServer);

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

**Step 2: Commit**

```bash
git add src/index.js
git commit -m "feat: entry point wiring MCP + preview + graceful shutdown"
```

---

### Task 10: Docker Build + E2E Test

**Files:** No new files — testing and validation.

**Step 1: Build Docker image**

Run: `docker build -t mockupmcp:latest .`
Expected: Build succeeds. Note image size.

**Step 2: Check image size**

Run: `docker images mockupmcp`
Expected: < 500MB

**Step 3: Run container and test MCP handshake**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | docker run -i --rm -v $(pwd)/mockups:/data mockupmcp:latest`
Expected: JSON response with server capabilities and 13 tools listed.

**Step 4: Full E2E flow test**

Send sequence of MCP tool calls via stdin:
1. `mockup_create_project` -> get project_id
2. `mockup_add_screen` -> get screen_id
3. `mockup_add_element` (navbar) -> verify
4. `mockup_add_element` (button) -> verify
5. `mockup_add_element` (text) -> verify
6. `mockup_export` -> verify PNG file created + base64 image returned

**Step 5: Test preview server**

Run container with port mapping: `docker run -d --rm -p 3100:3100 -v $(pwd)/mockups:/data mockupmcp:latest`
Open `http://localhost:3100/preview/{projectId}/{screenId}` — verify rendered page.

**Step 6: Claude Code MCP config test**

Add to `~/.claude/mcp.json` or project `.mcp.json`:
```json
{
  "mcpServers": {
    "mockupmcp": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-v", "./mockups:/data", "-p", "3100:3100", "mockupmcp:latest"]
    }
  }
}
```
Restart Claude Code, verify `mockup_*` tools are available.

**Step 7: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: Docker build and E2E test fixes"
```

---

## Post-Sprint

After all 10 tasks complete:
1. Reviewer does full code review
2. Run all tests: `node --test tests/**/*.test.js`
3. Update `PM/tasks/M1.md` statuses
4. Update `PM/milestones.md`
5. PR: `feature/m1-mvp` -> `develop`
