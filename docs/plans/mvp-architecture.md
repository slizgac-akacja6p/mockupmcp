# MockupMCP -- MVP Architecture Design Document

**Version:** 1.0
**Date:** 2026-02-20
**Author:** Architect (Claude Opus)
**Status:** Draft -- awaiting review

---

## TL;DR

MockupMCP MVP = Docker container with Node.js MCP server (stdio) that converts JSON mockup definitions into PNG screenshots via Puppeteer. 13 MCP tools (project CRUD, screen CRUD, element CRUD, export PNG, preview URL). 10 UI element types rendered as HTML/CSS in wireframe style. JSON file storage on mounted /data volume. Express preview server on port 3100 with file-watch reload. Rendering pipeline: JSON -> HTML template string (no framework) -> Puppeteer screenshot. Component system: one file per element type, each exports a `render(props): string` function returning HTML. Estimated ~15 source files, ~2000 LOC.

---

## 1. MVP Scope Decision

### 1.1 PRD Phase 1 scope -- confirmed with adjustments

The PRD defines MVP as: 10 element types, wireframe style, PNG export, stdio MCP, JSON storage. This is correct and achievable in 1-2 weeks. Below is the exact tool set.

### 1.2 MCP Tools for MVP (13 tools)

| # | Tool | Category | MVP? | Rationale |
|---|------|----------|------|-----------|
| 1 | `mockup_create_project` | Project | YES | Core CRUD |
| 2 | `mockup_list_projects` | Project | YES | Core CRUD |
| 3 | `mockup_delete_project` | Project | YES | Core CRUD |
| 4 | `mockup_add_screen` | Screen | YES | Core CRUD |
| 5 | `mockup_list_screens` | Screen | YES | Core CRUD |
| 6 | `mockup_delete_screen` | Screen | YES | Core CRUD |
| 7 | `mockup_add_element` | Element | YES | Core -- main creative tool |
| 8 | `mockup_update_element` | Element | YES | Core -- iteration on mockups |
| 9 | `mockup_delete_element` | Element | YES | Core CRUD |
| 10 | `mockup_move_element` | Element | YES | Core -- repositioning |
| 11 | `mockup_list_elements` | Element | YES | Core -- Claude needs to see what's on screen |
| 12 | `mockup_export` | Export | YES | Core -- PNG output (only format in MVP) |
| 13 | `mockup_get_preview_url` | Preview | YES | Core -- live preview link |

### 1.3 Tools deferred to Phase 2+

| Tool | Phase | Why deferred |
|------|-------|-------------|
| `mockup_duplicate_screen` | 2 | Nice-to-have, Claude can add_screen + add_elements |
| `mockup_group_elements` | 3 | Adds complexity to data model and rendering |
| `mockup_generate_screen` | 2 | NLP mapping is complex, needs templates first |
| `mockup_apply_template` | 2 | Requires template library |
| `mockup_auto_layout` | 2 | Layout algorithms are non-trivial |
| `mockup_export_all` | 2 | Loop over export is trivial for Claude to do |
| `mockup_to_code` | 3 | Large feature, separate concern |
| `mockup_add_link` | 3 | Navigation flow is Phase 3 |
| `mockup_export_flow` | 3 | Depends on navigation |

### 1.4 MVP Element Types (10)

From PRD section 5, the following 10 cover the most common UI patterns:

| # | Type | Category | Why included |
|---|------|----------|-------------|
| 1 | `text` | Basic | Fundamental |
| 2 | `rectangle` | Basic | Container/divider/background |
| 3 | `button` | Form | Most common interactive element |
| 4 | `input` | Form | Forms are everywhere |
| 5 | `image` | Basic | Placeholder images |
| 6 | `icon` | Basic | Visual indicators |
| 7 | `navbar` | Navigation | Top bar -- present on nearly every screen |
| 8 | `tabbar` | Navigation | Bottom tabs -- mobile essential |
| 9 | `card` | Data | Content containers |
| 10 | `list` | Data | Data display |

These 10 types can compose any basic wireframe. Missing types (checkbox, toggle, select, etc.) can be approximated with rectangle + text in MVP.

---

## 2. Project Structure

```
mockupmcp/
+-- package.json
+-- package-lock.json
+-- Dockerfile
+-- docker-compose.yml
+-- .dockerignore
+-- .gitignore
+-- CLAUDE.md
+-- README.md
+--
+-- src/
|   +-- index.js                    # Entry point: starts MCP server + preview server
|   +-- config.js                   # Environment variables, defaults, paths
|   +--
|   +-- mcp/
|   |   +-- server.js               # MCP server setup (SDK, stdio transport)
|   |   +-- tools/
|   |   |   +-- index.js            # Tool registry -- registers all tools with MCP server
|   |   |   +-- project-tools.js    # create_project, list_projects, delete_project
|   |   |   +-- screen-tools.js     # add_screen, list_screens, delete_screen
|   |   |   +-- element-tools.js    # add_element, update_element, delete_element, move_element, list_elements
|   |   |   +-- export-tools.js     # export (PNG), get_preview_url
|   |   +-- schemas/
|   |       +-- tool-schemas.js     # Zod schemas for all tool input validation
|   |
|   +-- storage/
|   |   +-- project-store.js        # CRUD operations on project JSON files
|   |   +-- id-generator.js         # nanoid-based ID generation (proj_, scr_, el_)
|   |
|   +-- renderer/
|   |   +-- html-builder.js         # Converts screen JSON -> full HTML document string
|   |   +-- screenshot.js           # Puppeteer: HTML string -> PNG buffer
|   |   +-- styles/
|   |   |   +-- wireframe.css       # Wireframe style definitions
|   |   +-- components/
|   |       +-- index.js            # Component registry -- maps type names to render functions
|   |       +-- text.js             # render(props) -> HTML string
|   |       +-- rectangle.js
|   |       +-- button.js
|   |       +-- input.js
|   |       +-- image.js
|   |       +-- icon.js
|   |       +-- navbar.js
|   |       +-- tabbar.js
|   |       +-- card.js
|   |       +-- list.js
|   |
|   +-- preview/
|       +-- server.js               # Express server with file-watch based reload
|       +-- templates/
|           +-- preview-page.html   # HTML wrapper with auto-reload script
|
+-- tests/
|   +-- storage/
|   |   +-- project-store.test.js
|   +-- renderer/
|   |   +-- html-builder.test.js
|   |   +-- components.test.js
|   +-- mcp/
|       +-- tools.integration.test.js
|
+-- mockups/                         # Default local mount for /data volume (gitignored)
|
+-- PM/
|   +-- PRD_MockupMCP.md
|   +-- roadmap.md
|   +-- milestones.md
|   +-- tasks/
|
+-- docs/
    +-- plans/
        +-- mvp-architecture.md      # This document
```

**File count:** ~25 source files
**Estimated LOC:** ~1500-2000 (excluding tests)

---

## 3. Architecture Decisions

### ADR-001: MCP SDK setup (stdio transport)

**Context:** MockupMCP needs to expose tools via MCP protocol. Claude Code communicates with MCP servers via stdio (stdin/stdout).

**Decision:** Use `@modelcontextprotocol/sdk` with `StdioServerTransport`. Single process runs both the MCP server (stdio) and the Express preview server (HTTP on port 3100).

**Implementation:**

```javascript
// src/mcp/server.js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export function createMcpServer() {
  const server = new McpServer({
    name: 'mockupmcp',
    version: '0.1.0',
  });

  // Tools registered here by tool modules
  return server;
}

export async function startMcpServer(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

```javascript
// src/index.js
import { createMcpServer, startMcpServer } from './mcp/server.js';
import { registerAllTools } from './mcp/tools/index.js';
import { startPreviewServer } from './preview/server.js';
import { config } from './config.js';

const mcpServer = createMcpServer();
registerAllTools(mcpServer);

// Start preview HTTP server (non-blocking, does not use stdout)
startPreviewServer(config.previewPort);

// Start MCP stdio (blocks on stdin)
startMcpServer(mcpServer);
```

**Key constraint:** Nothing except MCP protocol messages may be written to stdout. All logging must go to stderr. Express server listens on a TCP port, not stdout.

**Consequences:**
- Simple single-process architecture
- Preview server starts automatically with the MCP server
- All console.log replaced with console.error for debug output

---

### ADR-002: Rendering pipeline (JSON -> HTML -> PNG)

**Context:** We need to convert a JSON screen definition (array of positioned elements) into a PNG image.

**Decision:** Three-step pipeline:

```
Screen JSON -> html-builder.js -> HTML string -> screenshot.js (Puppeteer) -> PNG buffer/file
```

**Step 1: HTML Generation (`html-builder.js`)**

The HTML builder constructs a complete HTML document with:
- A viewport-sized container (`<div>` with absolute positioning, set width/height)
- Each element rendered as absolutely-positioned HTML via its component's `render()` function
- Wireframe CSS inlined (from `wireframe.css`)
- No external dependencies (no CDN, no network) -- everything inline

```javascript
// src/renderer/html-builder.js
import { getComponent } from './components/index.js';
import { readFileSync } from 'fs';

const wireframeCss = readFileSync(new URL('./styles/wireframe.css', import.meta.url), 'utf-8');

export function buildScreenHtml(screen) {
  const elementsHtml = screen.elements
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .map(el => {
      const component = getComponent(el.type);
      if (!component) return `<!-- unknown type: ${el.type} -->`;
      const innerHtml = component.render(el.properties);
      return `<div class="element" style="
        position: absolute;
        left: ${el.x}px;
        top: ${el.y}px;
        width: ${el.width}px;
        height: ${el.height}px;
        z-index: ${el.z_index || 0};
      ">${innerHtml}</div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${wireframeCss}</style>
</head>
<body>
  <div class="screen" style="
    position: relative;
    width: ${screen.width}px;
    height: ${screen.height}px;
    background: ${screen.background || '#FFFFFF'};
    overflow: hidden;
  ">
    ${elementsHtml}
  </div>
</body>
</html>`;
}
```

**Step 2: Screenshot (`screenshot.js`)**

Puppeteer launches headless Chromium (already installed in Alpine container), loads HTML string via `page.setContent()`, and takes a screenshot.

```javascript
// src/renderer/screenshot.js
import puppeteer from 'puppeteer';

let browser = null;

export async function initBrowser() {
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

export async function takeScreenshot(html, width, height, scale = 2) {
  if (!browser) await initBrowser();

  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    return buffer;
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (browser) await browser.close();
}
```

**Why `page.setContent()` and not a file/URL?**
- No temp file management
- No race conditions with file writing
- Faster (no file I/O, no HTTP request)
- Content is self-contained (inline CSS, no external resources)

**Why keep browser alive (singleton)?**
- Puppeteer launch is slow (~1-2s). We reuse the browser instance.
- Pages are created/closed per screenshot (~100-200ms per screenshot).
- Target: < 10 seconds from tool call to PNG (per PRD metric).

**Scale factor:** Default `deviceScaleFactor: 2` for retina-quality output. Configurable via `scale` param in export tool.

---

### ADR-003: Component system

**Context:** We need 10 element types now, 30+ later. Each type maps to an HTML rendering function.

**Decision:** Simple module pattern. Each component is a file that exports a `render(properties)` function returning an HTML string. A central registry maps type names to components.

```javascript
// src/renderer/components/index.js
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

const components = {
  text, rectangle, button, input, image, icon,
  navbar, tabbar, card, list,
};

export function getComponent(type) {
  return components[type] || null;
}

export function getAvailableTypes() {
  return Object.keys(components);
}
```

**Component contract (interface):**

```javascript
// Each component file exports:

/**
 * Render the component as an HTML string.
 * The outer positioning div is handled by html-builder.
 * This function only renders the INNER content.
 *
 * @param {object} properties - Component-specific properties from the element definition
 * @returns {string} HTML string
 */
export function render(properties) {
  // return HTML string
}

/**
 * Default properties for this component type.
 * Used to fill in missing properties.
 *
 * @returns {object}
 */
export function defaults() {
  // return default properties object
}
```

**Example -- button component:**

```javascript
// src/renderer/components/button.js
export function defaults() {
  return {
    label: 'Button',
    variant: 'primary',
    size: 'md',
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  return `<button class="mockup-button mockup-button--${p.variant} mockup-button--${p.size}">
    ${escapeHtml(p.label)}
  </button>`;
}
```

**Why not classes?**
- Pure functions are simpler, easier to test, no state management
- Import/export is the only mechanism needed
- Adding a new component = add file + register in index.js

**Extensibility path:** In Phase 2, the registry could scan a directory for `*.js` files automatically. For MVP, explicit imports are fine -- 10 files is manageable.

---

### ADR-004: JSON storage on /data volume

**Context:** Mockup projects need to persist between container restarts. Docker volume `/data` is mounted from host.

**Decision:** One JSON file per project. Directory structure:

```
/data/
+-- projects/
|   +-- proj_abc123.json        # Full project with all screens and elements
|   +-- proj_def456.json
+-- exports/
    +-- proj_abc123/
    |   +-- scr_001.png
    |   +-- scr_002.png
    +-- proj_def456/
        +-- scr_001.png
```

**Project JSON structure (same as PRD section 6):**

```json
{
  "id": "proj_abc123",
  "name": "Drop App Mockups",
  "description": "Mobile app mockups",
  "created_at": "2026-02-20T10:00:00Z",
  "updated_at": "2026-02-20T10:05:00Z",
  "viewport": { "width": 393, "height": 852, "preset": "mobile" },
  "screens": [
    {
      "id": "scr_001",
      "name": "Home Screen",
      "width": 393,
      "height": 852,
      "background": "#FFFFFF",
      "elements": [
        {
          "id": "el_001",
          "type": "navbar",
          "x": 0,
          "y": 0,
          "width": 393,
          "height": 56,
          "z_index": 10,
          "properties": {
            "title": "Drop",
            "leftIcon": "menu",
            "rightIcons": ["search", "notifications"]
          }
        }
      ]
    }
  ]
}
```

**Storage module API:**

```javascript
// src/storage/project-store.js

export class ProjectStore {
  constructor(dataDir) // dataDir = /data

  // Projects
  async createProject(name, description, viewport): Project
  async getProject(projectId): Project
  async listProjects(): ProjectSummary[]
  async deleteProject(projectId): void
  async saveProject(project): void   // internal, saves to disk

  // Screens (mutate project in memory, then save)
  async addScreen(projectId, name, width, height, background): Screen
  async getScreen(projectId, screenId): Screen
  async listScreens(projectId): ScreenSummary[]
  async deleteScreen(projectId, screenId): void

  // Elements (mutate screen in memory, then save)
  async addElement(projectId, screenId, type, x, y, width, height, properties): Element
  async updateElement(projectId, screenId, elementId, properties): Element
  async deleteElement(projectId, screenId, elementId): void
  async moveElement(projectId, screenId, elementId, x, y, width, height, zIndex): Element
  async listElements(projectId, screenId): Element[]

  // Helpers
  async saveExport(projectId, screenId, pngBuffer): string  // returns file path
}
```

**Why one file per project (not one file per screen)?**
- A project typically has 5-20 screens -- well under the JSON file size concern threshold
- Atomic reads/writes at the project level simplify consistency
- Easier to copy/backup/version

**Concurrency:** Not a concern for MVP. Single MCP connection = single client = sequential tool calls. No concurrent writes.

**Lookup by element_id:** The tool API uses `element_id` directly (per PRD), but elements are nested inside screens inside projects. We need a way to find which project/screen an element belongs to.

**Decision:** Element tools will require `screen_id` as a parameter (which implicitly identifies the project too, since screen IDs are globally unique). This avoids scanning all projects. Alternatively, we can derive `project_id` and `screen_id` from the element_id prefix or maintain an in-memory index. For MVP simplicity, tool schemas will accept `screen_id` + `element_id` where the PRD says only `element_id`.

**Deviation from PRD:** `mockup_update_element`, `mockup_delete_element`, and `mockup_move_element` will require `screen_id` in addition to `element_id`. This is a pragmatic simplification. Claude can easily provide both since it just called `list_elements` with a `screen_id`.

---

### ADR-005: Preview server

**Context:** Users need to see mockups in a browser without exporting PNGs manually every time.

**Decision:** Express server on port 3100 with simple file-system polling for "hot reload".

**Routes:**

| Route | Response |
|-------|----------|
| `GET /` | List all projects with links |
| `GET /preview/:projectId/:screenId` | Rendered HTML preview of a single screen |
| `GET /preview/:projectId` | All screens in project (vertical stack) |

**How hot-reload works:**

1. Preview page includes a small `<script>` that polls `GET /api/lastmod/:screenId` every 2 seconds
2. The endpoint returns the `updated_at` timestamp of the project file
3. If timestamp changes, the script reloads the page
4. No WebSocket needed for MVP -- polling is simpler and sufficient

```javascript
// src/preview/server.js
import express from 'express';
import { ProjectStore } from '../storage/project-store.js';
import { buildScreenHtml } from '../renderer/html-builder.js';

export function startPreviewServer(port) {
  const app = express();
  const store = new ProjectStore(process.env.DATA_DIR || '/data');

  app.get('/preview/:projectId/:screenId', async (req, res) => {
    const project = await store.getProject(req.params.projectId);
    const screen = project.screens.find(s => s.id === req.params.screenId);
    const html = buildScreenHtml(screen);
    // Inject auto-reload script
    const fullHtml = html.replace('</body>',
      `<script>
        setInterval(async () => {
          const r = await fetch('/api/lastmod/${req.params.projectId}');
          const { updated_at } = await r.json();
          if (updated_at !== '${project.updated_at}') location.reload();
        }, 2000);
      </script></body>`
    );
    res.type('html').send(fullHtml);
  });

  app.get('/api/lastmod/:projectId', async (req, res) => {
    const project = await store.getProject(req.params.projectId);
    res.json({ updated_at: project.updated_at });
  });

  app.listen(port, () => {
    console.error(`Preview server running on http://localhost:${port}`);
  });
}
```

**Why polling instead of WebSocket?**
- Simpler implementation (no ws dependency, no connection management)
- 2-second poll interval is acceptable for a preview tool
- WebSocket adds operational complexity (reconnection logic, proxy issues)
- Can upgrade to WebSocket in Phase 2 if needed

---

### ADR-006: Icon rendering strategy

**Context:** The `icon` component type needs a set of recognizable icons (home, search, user, etc.). PRD specifies Lucide Icons.

**Decision for MVP:** Use a curated subset of ~30 Lucide SVG icons inlined as a JSON map.

**Implementation:**

```javascript
// src/renderer/components/icon.js
// Icons stored as SVG path data, not full SVG files
const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>...',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  user: '...',
  menu: '...',
  // ~30 most common icons
};

export function render(props) {
  const { name = 'circle', size = 24, color = '#666' } = props;
  const pathData = ICONS[name] || ICONS['circle'];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="${color}" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    ${pathData}
  </svg>`;
}
```

**Why inline SVG data instead of importing Lucide as a dependency?**
- No runtime dependency on lucide package
- No font files or CSS needed
- SVG renders perfectly in Puppeteer
- 30 icons as path data is ~5KB -- trivial
- Easy to extend: just add more entries to the map

---

## 4. Key Implementation Details

### 4.1 Module: `src/config.js`

**What it does:** Centralizes all configuration from environment variables with sensible defaults.

**Public API:**
```javascript
export const config = {
  dataDir: process.env.DATA_DIR || '/data',
  previewPort: parseInt(process.env.PREVIEW_PORT || '3100'),
  chromiumPath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
  defaultStyle: process.env.DEFAULT_STYLE || 'wireframe',
  defaultViewport: { width: 393, height: 852, preset: 'mobile' },
  screenshotScale: 2,
};
```

**Dependencies:** None
**Connections:** Imported by all modules that need configuration.

---

### 4.2 Module: `src/mcp/server.js`

**What it does:** Creates and configures the MCP server instance with stdio transport.

**Public API:**
```javascript
export function createMcpServer(): McpServer
export async function startMcpServer(server: McpServer): Promise<void>
```

**Dependencies:** `@modelcontextprotocol/sdk`
**Connections:** Called from `index.js`. Tool modules register themselves on the returned server instance.

---

### 4.3 Module: `src/mcp/tools/*.js` (tool modules)

**What they do:** Each file registers a group of related MCP tools on the server. They validate input, call storage/renderer, and return results.

**Pattern (all tool modules follow this):**

```javascript
// src/mcp/tools/project-tools.js
import { z } from 'zod';

export function registerProjectTools(server, store) {
  server.tool(
    'mockup_create_project',
    'Create a new mockup project',
    {
      name: z.string().describe('Project name'),
      description: z.string().optional().describe('Project description'),
      viewport: z.enum(['mobile', 'tablet', 'desktop', 'custom']).optional()
        .describe('Viewport preset'),
      width: z.number().optional().describe('Custom viewport width'),
      height: z.number().optional().describe('Custom viewport height'),
    },
    async (params) => {
      const project = await store.createProject(
        params.name,
        params.description,
        resolveViewport(params)
      );
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(project, null, 2),
        }],
      };
    }
  );

  // ... more tools
}
```

**Dependencies:** `zod` (via MCP SDK), `ProjectStore`, `screenshot.js`
**Connections:**
- `project-tools.js` -> `ProjectStore` (create, list, delete projects)
- `screen-tools.js` -> `ProjectStore` (add, list, delete screens)
- `element-tools.js` -> `ProjectStore` (add, update, delete, move, list elements)
- `export-tools.js` -> `ProjectStore` (get screen data) + `html-builder.js` + `screenshot.js` (render PNG)

---

### 4.4 Module: `src/mcp/tools/index.js` (tool registry)

**What it does:** Wires all tool modules together with their dependencies.

```javascript
import { ProjectStore } from '../../storage/project-store.js';
import { registerProjectTools } from './project-tools.js';
import { registerScreenTools } from './screen-tools.js';
import { registerElementTools } from './element-tools.js';
import { registerExportTools } from './export-tools.js';
import { config } from '../../config.js';

export function registerAllTools(server) {
  const store = new ProjectStore(config.dataDir);

  registerProjectTools(server, store);
  registerScreenTools(server, store);
  registerElementTools(server, store);
  registerExportTools(server, store);
}
```

**Dependencies:** All tool modules, `ProjectStore`, `config`
**Connections:** Called once from `index.js`.

---

### 4.5 Module: `src/storage/project-store.js`

**What it does:** Manages JSON files on disk. Full CRUD for projects, screens, and elements. All operations are async (fs.promises).

**Public API:** (see ADR-004 above for full method list)

**Key implementation details:**
- Uses `fs.promises.readFile` / `writeFile` for atomic-ish operations
- Writes use `writeFile` with `JSON.stringify(project, null, 2)` for human-readable files
- All mutations follow read-modify-write pattern
- `updated_at` timestamp updated on every write
- Export files saved to `/data/exports/{projectId}/{screenId}.png`

**Dependencies:** `fs`, `path`, `id-generator.js`
**Connections:** Used by all tool modules and preview server.

---

### 4.6 Module: `src/storage/id-generator.js`

**What it does:** Generates prefixed unique IDs.

```javascript
import { nanoid } from 'nanoid';

export function generateId(prefix) {
  return `${prefix}_${nanoid(10)}`;
}

// Usage:
// generateId('proj') -> 'proj_V1StGXR8_Z'
// generateId('scr')  -> 'scr_kT3sYf9p2Q'
// generateId('el')   -> 'el_mN7cW4xLpA'
```

**Dependencies:** `nanoid`
**Connections:** Used by `ProjectStore`.

---

### 4.7 Module: `src/renderer/html-builder.js`

**What it does:** Converts a screen JSON object into a complete HTML document string ready for Puppeteer rendering or browser preview.

**Public API:**
```javascript
export function buildScreenHtml(screen): string
```

**Dependencies:** Component registry, `wireframe.css`
**Connections:** Used by `export-tools.js` and `preview/server.js`.

---

### 4.8 Module: `src/renderer/screenshot.js`

**What it does:** Manages a Puppeteer browser instance and converts HTML strings to PNG buffers.

**Public API:**
```javascript
export async function initBrowser(): Promise<void>
export async function takeScreenshot(html, width, height, scale?): Promise<Buffer>
export async function closeBrowser(): Promise<void>
```

**Dependencies:** `puppeteer`
**Connections:** Used by `export-tools.js`.

---

### 4.9 Module: `src/renderer/components/*.js`

**What they do:** Each file renders one UI element type as HTML. Pure functions, no side effects.

**Component-specific details:**

| Component | Key rendering approach |
|-----------|----------------------|
| `text` | `<span>` with inline font styles |
| `rectangle` | `<div>` with border, background, border-radius |
| `button` | `<button>` with variant-based CSS classes |
| `input` | `<div>` containing `<label>` + styled `<input>` |
| `image` | `<div>` with gray background, diagonal cross lines (placeholder), or SVG icon |
| `icon` | Inline `<svg>` from icon map |
| `navbar` | `<div>` flexbox row: left icon, title, right icons |
| `tabbar` | `<div>` flexbox row: tab items with icon + label |
| `card` | `<div>` with optional image area, title, subtitle, actions |
| `list` | `<div>` with repeated list items (simple/detailed/card variants) |

**Dependencies:** `icon.js` is used by `navbar.js`, `tabbar.js` (for rendering icons within those components)
**Connections:** Registered in `components/index.js`, used by `html-builder.js`.

---

### 4.10 Module: `src/renderer/styles/wireframe.css`

**What it does:** Defines the wireframe visual style -- gray palette, simple borders, system fonts.

**Key design principles for wireframe style:**
- Monochrome: `#333` (text), `#666` (secondary), `#999` (placeholder), `#DDD` (borders), `#F5F5F5` (backgrounds)
- Font: system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- Borders: 1px solid #DDD everywhere
- Border radius: 4px (subtle)
- No shadows, no gradients
- Buttons: filled background #333 with white text (primary), border-only (secondary)

**Size:** ~100-150 lines of CSS.

---

### 4.11 Module: `src/preview/server.js`

**What it does:** Express HTTP server for live preview of mockups in a browser.

**Public API:**
```javascript
export function startPreviewServer(port): void
```

**Routes:**
- `GET /` -- project listing page
- `GET /preview/:projectId/:screenId` -- single screen preview with auto-reload
- `GET /preview/:projectId` -- all screens in project
- `GET /api/lastmod/:projectId` -- JSON `{ updated_at }` for polling

**Dependencies:** `express`, `ProjectStore`, `html-builder.js`
**Connections:** Started from `index.js`, shares `ProjectStore` config with MCP tools.

---

## 5. Data Flow Diagrams

### 5.1 Creating and exporting a mockup

```
Claude Code                    MCP Server                     Storage           Renderer
    |                              |                              |                 |
    |-- mockup_create_project ---->|                              |                 |
    |                              |-- store.createProject() ---->|                 |
    |                              |<--- project JSON ------------|                 |
    |<-- { project } -------------|                              |                 |
    |                              |                              |                 |
    |-- mockup_add_screen -------->|                              |                 |
    |                              |-- store.addScreen() -------->|                 |
    |<-- { screen } --------------|                              |                 |
    |                              |                              |                 |
    |-- mockup_add_element ------->|                              |                 |
    |                              |-- store.addElement() ------->|                 |
    |<-- { element } -------------|                              |                 |
    |                              |                              |                 |
    |-- mockup_export(png) ------->|                              |                 |
    |                              |-- store.getScreen() -------->|                 |
    |                              |<--- screen JSON -------------|                 |
    |                              |-- buildScreenHtml(screen) ------------------>|
    |                              |<--- HTML string -----------------------------|
    |                              |-- takeScreenshot(html) --------------------->|
    |                              |<--- PNG buffer -------------------------------|
    |                              |-- store.saveExport(buffer) -->|                 |
    |<-- { path: "/data/..." } ---|                              |                 |
```

### 5.2 Preview flow

```
User browser                   Preview Server                 Storage           Renderer
    |                              |                              |                 |
    |-- GET /preview/proj/scr ---->|                              |                 |
    |                              |-- store.getProject() ------->|                 |
    |                              |<--- project JSON ------------|                 |
    |                              |-- buildScreenHtml(screen) ------------------>|
    |                              |<--- HTML string -----------------------------|
    |                              |-- inject reload script ------>|                 |
    |<-- HTML page + JS script ----|                              |                 |
    |                              |                              |                 |
    |  [every 2 seconds:]          |                              |                 |
    |-- GET /api/lastmod/proj ---->|                              |                 |
    |                              |-- stat project file -------->|                 |
    |<-- { updated_at } ----------|                              |                 |
    |  [if changed: reload page]   |                              |                 |
```

---

## 6. Dependencies (package.json)

```json
{
  "name": "mockupmcp",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "node --test tests/**/*.test.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.x",
    "express": "^4.21",
    "nanoid": "^5.x",
    "puppeteer-core": "^23.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "prettier": "^3.x"
  }
}
```

**Note:** `puppeteer-core` (not `puppeteer`) because Chromium is installed at the OS level in the Docker image. This keeps `npm install` fast and avoids downloading Chromium twice.

**Total dependency count:** 5 runtime dependencies. Minimal.

---

## 7. Viewport Presets

```javascript
const VIEWPORT_PRESETS = {
  mobile:  { width: 393, height: 852 },   // iPhone 14/15
  tablet:  { width: 834, height: 1194 },  // iPad Air
  desktop: { width: 1440, height: 900 },  // Standard desktop
};
```

---

## 8. Error Handling Strategy

All MCP tool handlers follow a consistent error pattern:

```javascript
async (params) => {
  try {
    // ... business logic
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}
```

Errors are returned as MCP tool responses (not thrown), so Claude can see the error and retry or adjust.

Common error cases:
- Project/screen/element not found -> `"Error: Project proj_xxx not found"`
- Invalid element type -> `"Error: Unknown element type 'foo'. Available: text, rectangle, ..."`
- File system errors -> `"Error: Failed to write project file: EACCES ..."`
- Puppeteer crash -> Reinitialize browser, retry once

---

## 9. Self-Critique

### 9.1 Weak Points

| # | Weakness | Severity | Mitigation |
|---|----------|----------|------------|
| 1 | **Absolute positioning only.** All elements use `position: absolute` with x/y coordinates. Claude must calculate positions manually. No flex/grid layout. | HIGH | This is the biggest UX problem. Claude will struggle to place 20+ elements correctly without overlaps. Mitigated by: (a) providing smart defaults for common elements (navbar at y:0, tabbar at bottom), (b) `mockup_move_element` for adjustments, (c) auto-layout in Phase 2. |
| 2 | **No undo/history.** Deleting an element is permanent. | MEDIUM | Not critical for MVP -- Claude can re-add elements. Add undo stack in Phase 2. |
| 3 | **Screen ID lookup.** Tools require both `screen_id` and `element_id` for element operations, deviating from PRD. | LOW | Pragmatic choice. Claude always has screen context. Can add global element lookup later if needed. |
| 4 | **Preview polling is crude.** 2-second delay, full page reload, potential stale reads. | LOW | Acceptable for MVP. Users won't notice 2s delay on a preview tool. |
| 5 | **Single browser instance.** If Puppeteer crashes, all subsequent exports fail until restart. | MEDIUM | Add health check: if page creation fails, re-init browser. Already described in screenshot.js. |
| 6 | **No validation of element properties.** Passing wrong props (e.g., `fontSize` on a `button`) silently ignores them. | LOW | Components use defaults() spread -- unknown props are harmless. Could add per-component schema in Phase 2. |

### 9.2 What Could Go Wrong

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Chromium fails in Alpine container** -- font rendering issues, missing libs | Medium | High | Dockerfile already includes `ttf-freefont`, `harfbuzz`, `nss`. Test early. Add `noto-fonts` if CJK needed. |
| **Docker image too large** (>1GB with Chromium) | High | Medium | Alpine + chromium package is ~400MB. Acceptable per PRD target (<500MB). Monitor. |
| **MCP SDK stdout contamination** -- any `console.log` breaks MCP protocol | Medium | High | Replace ALL console.log with console.error globally. Add lint rule. Consider a logger wrapper from day 1. |
| **Claude places elements poorly** -- overlapping, off-screen | High | Medium | This is expected behavior -- Claude will iterate. Good defaults help. Consider returning warnings when elements overlap. |
| **File corruption on crash during write** | Low | High | Use write-to-temp-then-rename pattern in ProjectStore.saveProject(). |

### 9.3 Over-Engineering Concerns

| Area | Assessment | Verdict |
|------|-----------|---------|
| **Component system with defaults()** | Just right for 10 components. Not over-engineered. | KEEP |
| **Preview server** | Borderline. Users can just open the exported PNG. But PRD requires it and `get_preview_url` is an MVP tool. | KEEP but keep minimal |
| **Zod schemas for tool validation** | Provided by MCP SDK pattern -- not extra work. | KEEP |
| **Icon system with 30 inlined SVGs** | Could start with 10 icons. 30 is fine -- it's a one-time copy-paste from Lucide source. | KEEP (reduce to 15-20 if time-pressured) |
| **deviceScaleFactor: 2** | Good default for sharp output. Simple to implement. | KEEP |
| **Export file persistence** | Saving PNGs to /data/exports/ -- maybe unnecessary if we return base64 in tool response? | SIMPLIFY -- see 9.4 |

### 9.4 Edge Cases That Will Bite Us

1. **Empty screen export:** Exporting a screen with 0 elements should return a blank canvas, not crash. Needs explicit handling in `html-builder.js`.

2. **Very long text:** A `text` element with 500 characters will overflow its bounding box. Need `overflow: hidden` on element wrapper divs, or `text-overflow: ellipsis`.

3. **Element outside screen bounds:** Element at x:1000 on a 393-wide screen. Should we clip? Warn? For MVP: `overflow: hidden` on the screen div handles it silently.

4. **Large number of elements:** 100+ elements on one screen. Puppeteer will handle it fine (it's just HTML), but the JSON response from `list_elements` could be very long. Add a note in tool description about practical limits.

5. **Concurrent tool calls from Claude:** MCP SDK handles tool calls sequentially per connection. But if Claude fires `add_element` twice quickly, read-modify-write on the same project file could race. Mitigation: add a per-project file lock (simple mutex).

6. **Path traversal in project IDs:** If someone crafts a `project_id` like `../../etc/passwd`, the file read could escape /data. Mitigation: validate IDs match the `^[a-zA-Z0-9_]+$` pattern.

7. **PNG export return format:** Should `mockup_export` return the file path, or base64-encoded image data? Claude Code can display images from file paths in the mounted volume. Returning base64 would make the tool response very large (~100KB+ for a retina PNG). **Decision: return file path, and additionally return base64 as an MCP image content block so Claude can "see" the result.**

### 9.5 What I Would Simplify

1. **Remove export file persistence for MVP.** Instead of saving to `/data/exports/`, just return the PNG as base64 in the MCP response (as an image content block). Save to file only when explicitly requested (add optional `save_to_file` param). This eliminates file path management complexity.

   **Counter-argument:** Users might want to commit PNGs to git. Keep the save, but also return image content.

   **Final decision:** Do both -- save to file AND return image content. It's only a few lines of code difference.

2. **Reduce preview server scope.** For MVP, only implement the single-screen preview route (`/preview/:projectId/:screenId`). Skip the project listing page and multi-screen view. Those are trivial to add later.

3. **Skip the `description` field on projects.** It adds schema complexity for zero functional value. Include it in the JSON but don't require it.

---

## 10. Revised Final Recommendations

Based on the self-critique above, here are the final implementation guidelines:

### 10.1 Core Architecture -- CONFIRMED

- Single Node.js process: MCP server (stdio) + Express preview (HTTP 3100)
- Rendering: JSON -> HTML string (inline CSS) -> Puppeteer screenshot
- Storage: one JSON file per project in `/data/projects/`
- Component system: one file per type, `render(props)` pure functions
- 13 MCP tools, 10 element types, wireframe style only

### 10.2 Changes from Initial Design

| Change | Reason |
|--------|--------|
| Export tool returns BOTH file path AND base64 image content | Claude can "see" the mockup directly |
| Add `overflow: hidden` to all element wrapper divs and screen div | Prevent rendering artifacts |
| Add per-project write mutex | Prevent file corruption on rapid tool calls |
| Replace all `console.log` with a `log(msg)` wrapper that writes to stderr | Prevent MCP protocol contamination |
| Element tools require `screen_id` parameter (deviation from PRD) | Avoid global element index complexity |
| Preview server: only `/preview/:projectId/:screenId` and `/api/lastmod` routes | Minimal scope |
| Validate all IDs with regex `^[a-z]+_[A-Za-z0-9_-]+$` | Path traversal prevention |
| Write project files via temp-file-then-rename | Atomic writes, prevent corruption |

### 10.3 Implementation Priority Order

Recommended task ordering for the implementation sprint:

| # | Task | Dependencies | Est. LOC |
|---|------|-------------|----------|
| 1 | Project scaffolding (package.json, Dockerfile, config.js, .gitignore) | None | 100 |
| 2 | Storage layer (project-store.js, id-generator.js) | None | 250 |
| 3 | Component renderers (10 files) + wireframe.css | None | 400 |
| 4 | HTML builder (html-builder.js) | Components | 80 |
| 5 | Screenshot module (screenshot.js) | Puppeteer in Docker | 60 |
| 6 | MCP server + tool schemas (server.js, tool-schemas.js) | MCP SDK | 100 |
| 7 | Tool handlers (4 files) | Storage + Renderer + MCP | 350 |
| 8 | Preview server (server.js + template) | Storage + HTML builder | 100 |
| 9 | Entry point (index.js) wiring | All above | 30 |
| 10 | Docker build + Claude Code MCP config test | All above | 50 |
| 11 | Tests | All above | 300 |

**Tasks 1-3 can run in parallel.** Task 4 depends on 3. Task 5 is independent. Tasks 6-7 depend on 2+4+5. Task 8 depends on 2+4. Task 9 depends on everything.

### 10.4 Key Metrics to Validate

| Metric | Target | How to test |
|--------|--------|-------------|
| Container startup | < 5s | `time docker run mockupmcp echo ok` |
| Tool call to PNG export | < 10s | End-to-end: create project + screen + 3 elements + export |
| Docker image size | < 500MB | `docker images mockupmcp` |
| Tool response correctness | All 13 tools work | Integration test via MCP client |

### 10.5 Files That Need Special Attention

1. **`src/renderer/styles/wireframe.css`** -- This defines the visual identity of the MVP. Needs to look professional even in wireframe style. Recommend: study Balsamiq and Excalidraw wireframe aesthetics.

2. **`src/renderer/components/navbar.js` and `tabbar.js`** -- These are composite components (contain icons, text, layout). Most complex of the 10 components. Allocate extra time.

3. **`Dockerfile`** -- Chromium + Alpine is the highest-risk integration point. Test the Docker build early and often. Specific concerns: font rendering, Puppeteer version compatibility with system Chromium.

4. **`src/mcp/tools/export-tools.js`** -- The export tool is the most complex: it chains storage read -> HTML build -> Puppeteer screenshot -> file write -> response with image. Most likely place for bugs.

---

## Appendix A: Technology Versions (pinned for MVP)

| Package | Version | Notes |
|---------|---------|-------|
| Node.js | 20 LTS (Alpine) | Dockerfile base image |
| `@modelcontextprotocol/sdk` | ^1.9 | Latest stable as of 2026-02 |
| `puppeteer-core` | ^23.x | Must match system Chromium version |
| `express` | ^4.21 | Stable, no need for v5 yet |
| `nanoid` | ^5.x | ESM-only, matches our module type |
| `zod` | ^3.x | Used by MCP SDK for schema validation |
| Chromium (Alpine package) | System package | `apk add chromium` -- version tied to Alpine release |

---

## Appendix B: MCP Tool Response Format Examples

### mockup_create_project response

```json
{
  "content": [{
    "type": "text",
    "text": "{\n  \"id\": \"proj_V1StGXR8_Z\",\n  \"name\": \"My App\",\n  \"viewport\": { \"width\": 393, \"height\": 852, \"preset\": \"mobile\" },\n  \"screens\": [],\n  \"created_at\": \"2026-02-20T10:00:00Z\"\n}"
  }]
}
```

### mockup_export response (with image)

```json
{
  "content": [
    {
      "type": "text",
      "text": "Exported to /data/exports/proj_V1StGXR8_Z/scr_kT3sYf9p2Q.png (393x852 @2x)"
    },
    {
      "type": "image",
      "data": "<base64-encoded PNG>",
      "mimeType": "image/png"
    }
  ]
}
```

### mockup_get_preview_url response

```json
{
  "content": [{
    "type": "text",
    "text": "Preview URL: http://localhost:3100/preview/proj_V1StGXR8_Z/scr_kT3sYf9p2Q\n\nOpen this URL in your browser to see a live preview that auto-refreshes when the mockup changes."
  }]
}
```

---

## Appendix C: Wireframe Style Color Palette

```
Text primary:     #333333
Text secondary:   #666666
Text placeholder:  #999999
Border:           #DDDDDD
Background light: #F5F5F5
Background white: #FFFFFF
Button primary:   #333333 (bg) / #FFFFFF (text)
Button secondary: transparent (bg) / #333333 (text) / #333333 (border)
Accent:           #666666
Disabled:         #CCCCCC
```

---

*End of document. Ready for review.*
