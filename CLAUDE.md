# MockupMCP

Dockerized MCP server for creating UI mockups from Claude Code. Converts JSON mockup definitions into PNG screenshots via Puppeteer.

## Stack

- **Runtime:** Node.js 20 (Alpine Docker)
- **MCP:** `@modelcontextprotocol/sdk` (stdio transport)
- **Rendering:** HTML/CSS -> Puppeteer (chromium) -> PNG
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
    tools/
      index.js          # Tool registry
      project-tools.js  # Project CRUD (3 tools)
      screen-tools.js   # Screen CRUD (3 tools)
      element-tools.js  # Element CRUD (5 tools)
      export-tools.js   # Export PNG + preview URL (2 tools)
  storage/
    project-store.js    # JSON file CRUD
    id-generator.js     # nanoid prefixed IDs
  renderer/
    html-builder.js     # Screen JSON -> HTML string
    screenshot.js       # Puppeteer HTML -> PNG
    styles/
      wireframe.css     # Wireframe style
    components/
      index.js          # Component registry
      text.js, rectangle.js, button.js, input.js,
      image.js, icon.js, navbar.js, tabbar.js,
      card.js, list.js
  preview/
    server.js           # Express preview server
    templates/
      preview-page.html
tests/
  storage/, renderer/, mcp/
```

## Conventions

- ESM modules (`"type": "module"`)
- All logging to stderr (stdout reserved for MCP protocol)
- Components: pure functions `render(props) -> HTML string`
- IDs: `proj_`, `scr_`, `el_` prefixes + nanoid
- Code + comments in English
- Tests: Node.js built-in test runner

## Key Constraints

- NOTHING writes to stdout except MCP SDK
- Puppeteer browser instance is singleton (reused)
- Element tools require `screen_id` + `element_id`
- Export returns file path + base64 image content

## Git

- Branch: `main` -> `develop` -> `feature/*`
- Commits: `type: description` (feat, fix, refactor, test, docs, chore)

## Docs

- PRD: `PM/PRD_MockupMCP.md`
- Architecture: `docs/plans/mvp-architecture.md`
- Tasks: `PM/tasks/M1.md`
