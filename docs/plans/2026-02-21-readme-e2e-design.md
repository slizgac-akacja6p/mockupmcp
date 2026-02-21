# README + E2E Tests Design

> **TL;DR:** User-facing README.md for developers using Claude Code, plus Docker E2E tests covering stdio MCP, HTTP transport, and preview server.

## README.md

**Audience:** Developers using Claude Code. Technical, concise.

### Sections

1. **Header** — project name, one-liner, badges (tests passing, Docker Hub)
2. **Quick Start** — docker pull + Claude Code MCP config (~5 lines)
3. **Features** — bullets: 25 tools, 5 resources, 35 components, 3 styles, 7 templates, codegen, preview
4. **Usage Examples** — 3 Claude Code scenarios (create project, generate screen, export)
5. **MCP Tools Reference** — table of 25 tools grouped by category
6. **MCP Resources Reference** — table of 5 resources with URIs
7. **Configuration** — env vars: MCP_TRANSPORT, PREVIEW_PORT, MCP_PORT, DEFAULT_STYLE
8. **Development** — running tests, project structure
9. **License** — MIT

## E2E Tests

**File:** `tests/e2e/docker-e2e.test.js`

**Prerequisites:** Built Docker image (`docker build -t mockupmcp:test .`)

**Container setup:** `docker run -d -p 3100:3100 -p 3200:3200 -e MCP_TRANSPORT=both mockupmcp:test`

### Test scenarios

1. **stdio MCP** — via `docker exec -i` with JSON-RPC:
   - Initialize → create project → generate screen → export PNG
   - Verify: tool responses, element counts, base64 PNG in export

2. **HTTP transport** — via `fetch` to `localhost:3200/mcp`:
   - Initialize session → list tools (25) → list resources (5+)
   - Verify: session ID header, tool count, resource URIs

3. **Preview server** — via `fetch` to `localhost:3100`:
   - GET `/preview/{screenId}` → HTTP 200 + HTML content
   - Verify: response contains `<div class="screen"`

### Cleanup
- `docker stop + docker rm` in after() hook
- Timeout: 60s per test (Puppeteer rendering is slow in container)

## Dependencies
- Docker CLI available on host
- No new npm dependencies
- Node.js built-in test runner
