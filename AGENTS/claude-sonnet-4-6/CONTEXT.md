# Project Context — MockupMCP

## Status

Phase A + Phase B complete (M19, M20, M21, M22, M24 merged to `develop`).
Next: Phase C — M23 Approval Redesign (depends on M21 + M22, both done).

Open PRs:
- PR #22: `develop` → `main` (covers M16–M24, pending merge)
- PR #23: `feature/m18-design-styles` → `develop` (M18, pending merge)

## Architecture

```
Docker container (Alpine, Node.js 20)
  ├── MCP server — stdio or HTTP (port 3200)
  │     ├── 34 tools (project/screen/element/export/layout/versioning/comments)
  │     ├── 6 resources (mockup:// URIs)
  │     └── 4 prompts (design_review, accessibility_check, compare_screens, layout_guide)
  ├── Preview server — Express (port 3100)
  │     └── Browser editor (canvas + palette + inspector + layers + comments)
  └── Storage — JSON files on /data volume
```

Renderer pipeline: screen JSON → `html-builder.js` → HTML string → Puppeteer → PNG.

Styles are plain CSS files in `src/renderer/styles/`. Each style scopes rules under a
class or attribute selector — no JS logic in styles.

The Layout API (`layout-composer.js` + `src/renderer/sections/`) sits above the
element model: sections render to a flat element list before being saved, so they
are fully compatible with the existing renderer.

Versioning is additive: new fields (`version`, `status`, `parent_screen_id`) default
via `??=` on read — existing data files need no migration.

## Key Decisions

See `AGENTS/claude-sonnet-4-6/DECISIONS.md` for full list.

- Parallel agents: always use `isolation: worktree` — prevents git contamination.
- Additive data model changes (never rename/remove fields, always `??=`).
- Cherry-pick as recovery strategy when branch contamination occurs.
- Layout sections compile to elements at creation time — no new runtime model.
- Slate style uses `data-color-scheme` attribute for dark/light; same pattern
  should be followed by any future multi-variant style.

## Current Milestones

| Milestone | Status | Branch | PR |
|-----------|--------|--------|----|
| M16 Editor UI | DONE | feature/m16-editor-design | merged to develop |
| M17 Visual Redesign | DONE | feature/m16-editor-design | merged to develop |
| M18 Design Styles | DONE | feature/m18-design-styles | PR #23 open |
| M19 Layers Panel | DONE | feature/m19-layers | PR #24 merged to develop |
| M20 Layout API | DONE | feature/m20-layout-api | PR #25 merged to develop |
| M21 Versioning | DONE | feature/m21-versioning | PR #27 merged to develop |
| M22 Comments | DONE | feature/m22-comments | PR #29 merged to develop |
| M24 Slate Style | DONE | feature/m24-slate | PR #26 merged to develop |
| M23 Approval Redesign | PENDING | — | — |

## Key File Paths

| Purpose | Path |
|---------|------|
| Entry point | `src/index.js` |
| Tool registry | `src/mcp/tools/index.js` |
| Resources | `src/mcp/resources.js` |
| Prompts | `src/mcp/prompts.js` |
| HTML builder | `src/renderer/html-builder.js` |
| Layout composer | `src/renderer/layout-composer.js` |
| Sections | `src/renderer/sections/` |
| Styles | `src/renderer/styles/` |
| Project store | `src/storage/project-store.js` |
| Preview server | `src/preview/server.js` |
| Layers panel | `src/preview/editor/layers.js` |
| Comments (editor) | `src/preview/editor/comments.js` |
| Comment tools | `src/mcp/tools/comment-tools.js` |

## Test Baseline

~1564 tests, Node.js built-in runner (`npm test`).
E2E tests gated: `RUN_E2E=1 npm test` (requires running Docker container).
