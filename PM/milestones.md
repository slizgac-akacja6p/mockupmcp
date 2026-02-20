# MockupMCP Milestones

## M1 — MVP (Phase 1)
**Status:** DONE — merged to develop (PR #1)
**Branch:** `feature/m1-mvp`
**Scope:** Docker container + MCP server (stdio) + 13 tools + 10 element types + wireframe style + PNG export + preview server
**DoD:**
- [x] Docker build (909MB — Chromium heavy, optimization deferred)
- [x] All 13 MCP tools functional
- [x] 10 element types render correctly in wireframe style
- [x] PNG export works (E2E verified)
- [x] Preview URL works in browser with auto-reload
- [x] Claude Code MCP config works (`docker run -i`)
- [x] 108 tests pass (0 failures)
- [x] Code review passed (5 critical XSS fixed, security hardened)

## M2a — Components + Styles (Phase 2, Sprint 1)
**Status:** DONE
**Branch:** `feature/m2a-components-styles`
**Scope:** 25 new components (10 → 35 total), 3 styles (wireframe/material/ios), style registry, duplicate_screen tool
**Tasks:** `PM/tasks/M2a.md`
**DoD:**
- [x] Style registry with loadStyle + getAvailableStyles
- [x] html-builder refactored for multi-style support
- [x] style field on project + screen, mockup_duplicate_screen tool
- [x] 25 new components across 6 categories
- [x] wireframe.css extended (260 → 858 lines)
- [x] material.css — Material Design 3 (903 lines)
- [x] ios.css — iOS HIG (928 lines)
- [x] 321 tests pass (216 unit + 105 integration: 3 styles x 35 components)

## M2 — Rozbudowa (Phase 2)
**Status:** IN PROGRESS (M2a DONE)
**Scope:** Full component library, multiple styles, templates, auto-layout, SVG/PDF

## M3 — Zaawansowane (Phase 3)
**Status:** PLANNED
**Scope:** Code export, navigation flow, SSE, grouping, Docker Hub
