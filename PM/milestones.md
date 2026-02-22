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

## M2b — Templates, Auto-Layout, Export Formats (Phase 2, Sprint 2)
**Status:** DONE
**Branch:** `feature/m2b-templates-layout`
**Scope:** 7 templates, auto-layout engine (vertical/horizontal/grid), SVG/PDF export
**Tasks:** `PM/tasks/M2b.md`
**DoD:**
- [x] Template registry + 7 templates (login, dashboard, settings, list, form, profile, onboarding)
- [x] applyTemplate storage method + mockup_apply_template + mockup_list_templates tools
- [x] Auto-layout engine: vertical, horizontal, grid modes with z_index pinning
- [x] bulkMoveElements storage method + mockup_auto_layout tool
- [x] SVG export (foreignObject wrapping) + PDF export (Puppeteer)
- [x] mockup_export format param (png/svg/pdf)
- [x] 17 MCP tools total (14 → 17)
- [x] 449 tests pass (321 existing + 128 new)

## M2 — Rozbudowa (Phase 2)
**Status:** DONE (M2a + M2b)
**Scope:** Full component library, multiple styles, templates, auto-layout, SVG/PDF

## M3a — Code Export, Navigation, Grouping (Phase 3, Sprint 1)
**Status:** DONE
**Branch:** `feature/m3a-codegen-navigation`
**Scope:** Code generation (HTML/React/Flutter/SwiftUI), navigation links, Mermaid flow export, element grouping, opacity
**Tasks:** `PM/tasks/M3a.md`
**DoD:**
- [x] Codegen registry + 4 generators (html, react, flutter, swiftui)
- [x] Navigation: addLink/removeLink storage + mockup_add_link/remove_link MCP tools
- [x] Flow export: generateMermaid + mockup_export_flow tool
- [x] Element grouping: group/ungroup/moveGroup + 3 MCP tools
- [x] Opacity CSS in html-builder + link data attributes
- [x] Preview clickable links + back navigation
- [x] mockup_to_code MCP tool
- [x] 24 MCP tools total (17→24)
- [x] 520+ tests pass

## M3b — SSE Transport, Docker Hub, Animated Transitions (Phase 3, Sprint 2)
**Status:** DONE
**Branch:** `feature/m3b-sse-transitions`
**Scope:** Streamable HTTP transport (port 3200), Docker Hub CI/CD, CSS animated transitions in preview
**Tasks:** `PM/tasks/M3b.md`
**DoD:**
- [x] HTTP transport on port 3200 (StreamableHTTPServerTransport, session management)
- [x] Config: MCP_TRANSPORT (stdio|http|both), MCP_PORT
- [x] Shared ProjectStore between stdio and HTTP transports
- [x] GitHub Actions: multi-arch Docker Hub publish (amd64+arm64)
- [x] Dockerfile + docker-compose updated for port 3200
- [x] Screen fragment endpoint for SPA transitions
- [x] CSS animated transitions: push, fade, slide-up, none
- [x] SPA fetch+swap navigation (no page reload)
- [x] history.pushState + popstate for back/forward
- [x] Integration tests for HTTP transport
- [x] 550+ tests pass

## M3 — Zaawansowane (Phase 3)
**Status:** DONE (M3a + M3b)
**Scope:** Code export, navigation flow, SSE, grouping, Docker Hub

## M4 — Screen Generation (Phase 4)
**Status:** DONE
**Branch:** `feature/m4-generate-screen`
**Scope:** NLP-based screen generation from natural language descriptions
**DoD:**
- [x] parseDescription — keyword extraction (screen/component/modifier)
- [x] matchTemplate — scoring engine against 7 template profiles
- [x] augmentElements — keyword-based element injection with dedup
- [x] generateScreen — orchestrator with template fallback
- [x] mockup_generate_screen MCP tool (25 tools total)
- [x] Integration tests (login, fallback, all 7 templates)
- [x] 578 tests pass (30 new, 0 failures)

## M5 — MCP Resources (Phase 5)
**Status:** DONE
**Branch:** `feature/m5-mcp-resources`
**Scope:** 5 MCP resources via mockup:// URI scheme
**DoD:**
- [x] mockup://projects — project list (static)
- [x] mockup://templates — 7 templates with descriptions (static)
- [x] mockup://components — 35 component types with defaults (static)
- [x] mockup://projects/{id} — full project detail (ResourceTemplate)
- [x] mockup://projects/{id}/screens/{id}/preview — PNG preview with cache (dynamic)
- [x] PreviewCache — MD5 content-hash invalidation
- [x] Wired into both stdio and HTTP transports
- [x] 588 tests pass (10 new, 0 failures)

## M6 — Documentation + E2E (Phase 6)
**Status:** DONE
**Branch:** `feature/m6-readme-e2e`
**Scope:** User-facing README, Docker E2E tests
**DoD:**
- [x] README.md — quick start, tools reference, resources, configuration
- [x] Docker E2E tests — HTTP transport, resources, preview server (RUN_E2E=1)
- [x] All unit tests pass (588)

## Content Hints (incremental)
**Status:** DONE
**Branch:** `feature/m7-sidebar-tabbar` (prior commits)
**Scope:** All 7 templates accept contentHints param, parseDescription extracts hints from description
**DoD:**
- [x] parseDescription returns contentHints array
- [x] All 7 templates use contentHints with fallback defaults
- [x] 611 tests pass

## M7 — Sidebar Navigation + Tabbar Fix
**Status:** DONE
**Branch:** `feature/m7-sidebar-tabbar`
**Scope:** Collapsible sidebar in preview pages, tabbar generation fix, landing page
**DoD:**
- [x] augmentElements adds tabbar when keyword present (dedup-safe)
- [x] Dashboard template includes tabbar by default
- [x] GET /api/projects endpoint (JSON tree: projects + screens)
- [x] Collapsible sidebar injected in every preview page (260px, localStorage persistence)
- [x] Landing page at /preview with sidebar + placeholder
- [x] GET / redirects to /preview
- [x] SPA navigation from sidebar (uses swapScreen when available)
- [x] Auto-refresh project tree every 3s
- [x] Mobile responsive (overlay mode)
- [x] 621 tests pass (10 new, 0 failures)

## M8 — Blueprint, Flat, Hand-drawn Styles
**Status:** DONE
**Branch:** `feature/m8-styles`
**Scope:** 3 new rendering styles completing the PRD style library (3→6 total)
**DoD:**
- [x] blueprint.css — technical/monospace/grid/blue palette (887 lines)
- [x] flat.css — vibrant colors/solid fills/zero shadows (661 lines)
- [x] hand-drawn.css — Comic Neue/irregular borders/Balsamiq-like (912 lines)
- [x] Style registry updated (VALID_STYLES: 6 entries)
- [x] 750 tests pass (129 new from expanded 6×35 style×component matrix)
