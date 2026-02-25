# MockupMCP

Dockerized MCP server for creating UI mockups from Claude Code. JSON mockup definitions → HTML/CSS → PNG (Puppeteer). Cross-project tool — shared Docker container + volume across all projects.

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start MCP server (stdio mode) |
| `npm test` | Run all tests (~1564 tests, Node.js built-in runner) |
| `node --test tests/renderer/*.test.js` | Run renderer tests only |
| `RUN_E2E=1 npm test` | Run including E2E tests (requires running Docker container) |
| `docker build -t mockupmcp:latest .` | Build Docker image |
| `docker run -d --name mockupmcp -v /Users/maciejgajda/mockups:/data -p 3100:3100 -p 3200:3200 -e MCP_TRANSPORT=http mockupmcp:latest` | Run container (HTTP mode) |

## Stack

- **Runtime:** Node.js 20 (Alpine Docker)
- **MCP:** `@modelcontextprotocol/sdk` ^1.9.0 (stdio + HTTP StreamableHTTPServerTransport)
- **Rendering:** HTML/CSS → Puppeteer (chromium) → PNG/SVG
- **Preview:** Express (port 3100) with polling-based reload
- **Storage:** JSON files on `/data` Docker volume
- **Icons:** Lucide SVG subset (inlined)
- **Deps:** express, puppeteer-core, nanoid, zod

## Project Structure

```
src/
  index.js              # Entry point: MCP + preview server
  config.js             # Env vars + defaults
  mcp/
    server.js           # MCP server (stdio)
    http-transport.js   # HTTP StreamableHTTPServerTransport
    resources.js        # 6 MCP Resources (project/screen data)
    prompts.js          # 4 MCP Prompts (design_review, accessibility_check, compare_screens, comment_summary)
    screen-generator.js # AI-driven screen generation
    tools/
      index.js          # Tool registry (34 tools)
      project-tools.js  # Project CRUD (3)
      screen-tools.js   # Screen CRUD (5)
      element-tools.js  # Element CRUD (7)
      export-tools.js   # Export PNG/SVG + preview URL (4)
      group-tools.js    # Element grouping (3)
      layout-tools.js   # Auto-layout + high-level layout API
      template-tools.js # Screen templates (2)
      comment-tools.js  # Comment CRUD (3)
  storage/
    project-store.js    # JSON file CRUD with folder-aware index
    folder-scanner.js   # Recursive project file discovery
    id-generator.js     # nanoid prefixed IDs
  renderer/
    html-builder.js     # Screen JSON → HTML string
    screenshot.js       # Puppeteer HTML → PNG
    styles/             # 19 styles: wireframe, blueprint, flat, hand-drawn, ios, material, dark-minimal, pastel, corporate, retro, glassmorphism, neon, paper, terminal, playful, gradient, monochrome, soft-ui, slate
    sections/           # 10 section generators (semantic layout sections)
    layout-composer.js  # Layout composition engine
    components/         # 35 components (render(props) → HTML)
    templates/          # 7 templates: dashboard, form, list, login, onboarding, profile, settings
  codegen/              # Code generation: html, react, swiftui, flutter, flow
  preview/
    server.js           # Express preview server (port 3100)
    editor/             # 8 client-side editor modules (canvas, palette, inspector, sync, toolbar, orchestrator, layers, comments)
    templates/
      preview-page.html
tests/
  storage/              # Project store, groups, links
  renderer/             # Components, HTML builder, styles, templates, layout, screenshot
  mcp/                  # Tools, resources, prompts, HTTP transport, screen generator
  codegen/              # Code generation tests
  integration/          # Cross-module integration
  preview/              # Preview server (sidebar, transitions, links)
  e2e/                  # Docker E2E (gated: RUN_E2E=1)
```

## Conventions

- ESM modules (`"type": "module"`)
- All logging to stderr (stdout reserved for MCP protocol)
- Components: pure functions `render(props) → HTML string` + `defaults()`
- IDs: `proj_`, `scr_`, `el_` prefixes + nanoid
- Code + comments in English
- Tests: Node.js built-in test runner (`node --test`)

## Gotchas

- **stdout:** NOTHING writes to stdout except MCP SDK — all logging via stderr
- **XSS:** ALL components with user content MUST use `escapeHtml()` from shared `utils.js`
- **Puppeteer >=22:** returns Uint8Array not Buffer — use `Buffer.from(data).toString('base64')`
- **HTTP transport:** SDK StreamableHTTPServerTransport returns SSE even for req-res — parse `data:` lines
- **HTTP transport:** each session needs own McpServer instance (SDK 1:1 transport:server)
- **Layout engine:** `z_index >= 10` = pinned element (excluded from auto-layout)
- **E2E tests:** gated with `RUN_E2E=1` env var (Docker available != container running)
- **Docker image:** ~900MB (Chromium makes <500MB unrealistic)
- **ProjectStore:** folder-aware — `_pathIndex` Map scans dataDir recursively via `folder-scanner.js`; `createProject(folder)` param validates against path traversal
- **ProjectStore:** `_buildIndex()` reads all project files on each `listProjects`/`listProjectsTree` call — acceptable for small deployments
- **Body CSS:** `html-builder.js` body has width/height/overflow — effective only in Puppeteer; PREVIEW_STYLE overrides in browser preview (by design)
- **Sidebar state:** `expandedNodes` Set (folder paths + project IDs) + `scrollTop` save/restore survive 3s polling; recursive `renderNode` for folder tree
- **Sidebar API:** `/api/projects` returns `{ folders: [...], projects: [...] }` tree (not flat array)

## Git

- Branch: `main` → `develop` → `feature/*`
- Commits: `type: description` (feat, fix, refactor, test, docs, chore)

## Docs

- PRD: `PM/PRD_MockupMCP.md`
- Milestones: `PM/milestones.md`
- Design/impl plans: `docs/plans/`
- Tasks: `PM/tasks/`
