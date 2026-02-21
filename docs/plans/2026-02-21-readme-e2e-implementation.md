# README + E2E Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create user-facing README.md and Docker E2E tests covering HTTP transport, stdio, and preview server.

**Architecture:** README is a standalone Markdown file. E2E tests use Docker CLI + Node.js fetch/child_process to test the running container from the host.

**Tech Stack:** Markdown, Node.js test runner, Docker CLI, native fetch (Node 20+), child_process.

---

### Task 1: README.md

**Files:**
- Create: `README.md`

**Step 1: Write README.md**

Create `README.md` in the project root. Content includes:
- Header with project description
- Quick Start: docker pull + Claude Code MCP config
- Features bullet list
- Usage Examples (3 scenarios)
- MCP Tools Reference (25 tools in categorized tables)
- MCP Resources Reference (5 resources)
- Configuration (env vars table)
- Docker Compose example
- UI Components list
- Development section (tests, structure)
- MIT License

Full content is specified in the agent prompt (too long for plan doc).

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README — quick start, tools reference, configuration"
```

---

### Task 2: E2E test — Docker build + HTTP transport + preview

**Files:**
- Create: `tests/e2e/docker-e2e.test.js`

**Prerequisites:** Docker must be available on host.

**Approach:**
1. Build Docker image in `before()` hook
2. Start container with `-d -p 3110:3100 -p 3210:3200 -e MCP_TRANSPORT=both`
3. Wait for server readiness (poll preview port)
4. Test HTTP transport: initialize session, list tools (25), list resources, create project, generate screen, export PNG
5. Test preview server: GET / returns 200
6. Cleanup in `after()`: docker stop + rm

**Key patterns:**
- `execSync` for docker CLI commands (controlled input, no user data)
- SSE response parsing: SDK returns `text/event-stream` even for req-res — parse `data:` lines
- Session management: store `mcp-session-id` header from initialize response
- Timeouts: 180s for describe block, 300s for docker build

**Step 1: Write the test file**

See agent prompt for full code.

**Step 2: Run tests (requires Docker)**

Run: `node --test tests/e2e/docker-e2e.test.js`
Expected: all PASS (takes 1-3 minutes for Docker build)

**Step 3: Commit**

```bash
git add tests/e2e/docker-e2e.test.js
git commit -m "test: Docker E2E — HTTP transport, resources, preview server"
```

---

### Task 3: PM docs update

**Files:**
- Modify: `PM/milestones.md`

**Step 1: Add M6 section**

```markdown
## M6 — Documentation + E2E (Phase 6)
**Status:** DONE
**Branch:** `feature/m6-readme-e2e`
**Scope:** User-facing README, Docker E2E tests
**DoD:**
- [x] README.md — quick start, tools reference, resources, configuration
- [x] Docker E2E tests — HTTP transport, resources, preview server
- [x] All unit tests pass (588+)
```

**Step 2: Commit**

```bash
git add PM/milestones.md
git commit -m "docs: M6 milestone — README + E2E tests"
```
