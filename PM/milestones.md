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

## M9 — MCP Prompts
**Status:** DONE
**Branch:** `feature/m9-prompts`
**Scope:** 3 MCP Prompts completing the PRD (design review, accessibility, compare screens)
**DoD:**
- [x] mockup_design_review — UX review with JSON + PNG screenshot
- [x] mockup_accessibility_check — a11y checklist with JSON + PNG screenshot
- [x] mockup_compare_screens — side-by-side comparison with 2 PNGs
- [x] Wired into both stdio and HTTP transports
- [x] ESM loader mock for Puppeteer-free testing
- [x] 767 tests pass (17 new)

## M10 — Preview + Performance Bugfixes
**Status:** DONE
**Branch:** `fix/m10-preview-perf`
**PR:** #15 → develop
**Scope:** Bugs from first real-world usage (MGGS Audiobook Maker): screenshot shadow, sidebar dedup/scroll, tool perf guidance
**Tasks:** `PM/tasks/M10.md`
**DoD:**
- [x] Body CSS constrains Puppeteer viewport to screen size (no gray bleed)
- [x] Sidebar: expandedProjects Set for persistent expand/collapse state
- [x] Sidebar: scrollTop preserved across 3s polling refreshes
- [x] Sidebar: no duplicate screens on repeated clicks (insertAdjacentHTML removed)
- [x] Tool descriptions: performance hints for batch vs individual operations
- [x] 768 tests pass (767 existing + 1 new)
- [x] Docker verified: PNG clean, sidebar functional, tools/list updated

## M11 — Folder-Based Navigation
**Status:** DONE
**Branch:** `feature/m11-folder-nav`
**Scope:** Hierarchical folder organization for projects — disk folders = sidebar tree, nested subfolders, auto-redirect on delete
**Tasks:** `PM/tasks/M11.md`
**DoD:**
- [x] Folder scanner utility (recursive discovery, exclude exports/hidden)
- [x] ProjectStore refactor: _pathIndex Map, _buildIndex, createProject(folder), listProjectsTree()
- [x] Preview API returns nested tree { folders, projects }
- [x] Sidebar renders folders with expand/collapse, depth indentation
- [x] 404 auto-redirect to landing when project deleted
- [x] MCP mockup_create_project accepts optional folder param
- [x] Path traversal protection on folder param
- [x] Backward compat: legacy projects/ subdir still discovered
- [x] 796 tests pass (768 → 796, +28 new)

## M12 — Editor Backend (REST API + Approval + MCP)
**Status:** DONE
**Branch:** `feature/m12-editor-backend`
**Scope:** REST API for element CRUD, approval flow, MCP resource + tool for Claude round-trip
**DoD:**
- [x] GET/POST/PATCH/DELETE /api/screens/:pid/:sid/elements
- [x] POST /api/screens/:pid/:sid/approve (approval flow with diff)
- [x] MCP mockup://approval resource (pending approval state)
- [x] MCP mockup_await_approval tool (26 tools total)
- [x] 803 tests pass

## M13 — Editor Frontend (Canvas + Palette + Inspector + Sync)
**Status:** DONE
**Branch:** `fix/preview-ux`
**Scope:** Browser-based visual editor in preview with drag-drop canvas, component palette, property inspector, undo/redo, and REST sync
**DoD:**
- [x] Editor toolbar (view/edit mode toggle, snap, undo/redo, approve button)
- [x] Canvas engine — selection, drag, resize, snap-to-grid, delete
- [x] Component palette — 35 components in 6 categories, drag-to-canvas drop
- [x] Property inspector — dynamic prop editing per component type
- [x] Sync module — debounced REST client + undo/redo history (UndoStack)
- [x] html-builder: data-element-id on element wrappers for canvas targeting
- [x] All modules wired via document CustomEvents
- [x] 842+ tests pass

## M14 — Preview UX Fixes + Performance (fix/preview-ux)
**Status:** DONE
**Branch:** `fix/preview-ux`
**Scope:** Safari SPA navigation bug, mockup canvas redesign, Puppeteer page pool
**DoD:**
- [x] swapScreen: wrapper div for animation (Safari overflow:hidden fix)
- [x] swapScreen: preserve position:relative on .screen after transition (Safari absolute-child escape fix)
- [x] Playwright webkit: 265 children visible after round-trip, position preserved
- [x] Mockup screens: canvas darkened (#151515) for Landing Page + Screen Preview
- [x] Mockup screens: Light/Dark toggle added to bottom of sidebar in all 4 screens
- [x] Puppeteer page pool (POOL_SIZE=3): warm render ~22-37ms vs ~58-81ms baseline (2x)
- [x] warmUp() at startup: zero cold-start penalty on first render
- [x] 838 tests pass

## PRD Completion
**All PRD items implemented.** 25 tools, 5 resources, 3 prompts, 6 styles, 35 components, 7 templates.

## M15 — Bulk Creation API
**Status:** DONE
**Branch:** `feature/m15-bulk-api` (merged into feature/m16-editor-design)
**Scope:** Batch creation tools — screen+elements+links in 1 call, full project in 1 call, import/export
**DoD:**
- [x] `mockup_create_screen_full` — screen + elements + links in single call (ref system)
- [x] `mockup_create_project_full` — full project in single call
- [x] `mockup_import_project` / `mockup_export_project` — JSON import/export
- [x] ProjectStore: `createScreenFull()`, `createProjectFull()`, `importProject()` methods
- [x] 30 MCP tools total (26 → 30)
- [x] 884 tests pass (838 → 884, +46 new)

## M16 — Editor UI Enhancements
**Status:** DONE
**Branch:** `feature/m16-editor-design`
**Scope:** Component palette (right panel), multi-select, add mode, copy-paste, undo integration
**DoD:**
- [x] Component palette — 35 components in 6 categories, search, recent tray (right panel)
- [x] Multi-select — Cmd+Click, box-select drag, bulk delete
- [x] Add Mode — click palette component → click canvas to place (keyboard shortcuts: B/I/C/T/R)
- [x] Copy-Paste — Cmd+C/V, +20px offset, deep clone
- [x] Undo integration — undo after insert + paste
- [x] Fix: `data-el-id` → `data-element-id` (unblocked drag, selection, delete)
- [x] 919 tests pass

## M17 — Editor Visual Redesign
**Status:** DONE
**Branch:** `feature/m16-editor-design`
**Scope:** Full dark theme redesign (Linear/Vercel aesthetic), i18n (EN+PL), performance fixes, UX improvements
**Design doc:** `docs/plans/2026-02-24-editor-redesign.md`
**DoD:**
- [x] Design token system — surface-0–4, accent, border, shadow, radius, typography scales
- [x] Layout — sidebar 240px, right panel 300px, toolbar 48px, proper flex constraints
- [x] Sidebar collapse — `‹` button, 48px icon-only mode, localStorage persistence
- [x] Right panel tabs — Properties | Components, auto-switch on element select
- [x] Property panel redesign — 2-col grid x/y/w/h, toggle switch, color swatch, slim sliders
- [x] Toolbar redesign — mode toggle pill, floating zoom controls (bottom-right), Język dropdown
- [x] Sidebar — theme toggle (dark/light) at bottom
- [x] i18n — `src/preview/i18n/` (index.js + en.json + pl.json), 58 translation keys
- [x] Performance — rAF throttle on drag/resize, debounce property panel (150ms), hash-based polling diff
- [x] Fix: add mode coordinates — use `.screen` element as reference with zoom scale
- [x] Fix: resize handles — `getBoundingClientRect()` for correct position + zoom
- [x] Fix: resize handles follow element during drag (`updateHandles` via `onDragMove`)
- [x] Fix: selection skip during add mode (`getAddModeType` guard in selection.js)
- [x] Fix: `exitAddMode` recursion — removed callback loop between editor.js and palette.js
- [x] Fix: canvas flex `min-width: 0` — right panel stays visible in viewport
- [x] 919 tests pass

## M18 — Design System Styles
**Status:** DONE — PR #23 open (feature/m18-design-styles → develop)
**Branch:** `feature/m18-design-styles`
**Scope:** 12 new rendering styles + style inheritance (project default + per-screen override)
**Design goal:** Enable mockups in any major design language or visual aesthetic

### Style inheritance model
- Project has `style` field (default for all screens)
- Screen can override with own `style` field (takes precedence)
- Editor: project style selector in toolbar; per-screen override in screen properties panel

### New styles — Design Systems
| ID | Design System | Key Visual |
|----|--------------|------------|
| `material3` | Material Design 3 (Google) | Dynamic color tokens, tonal elevation, radius 0–28px scale |
| `hig` | Apple HIG / Liquid Glass | backdrop-filter blur, rgba whites, inner light shadow, radius 16–24px |
| `fluent2` | Microsoft Fluent 2 | Acrylic blur, neutral token scale, radius 4/8/16px |
| `antd` | Ant Design (Alibaba) | #1677FF accent, compact tables, 4px grid, business B2B |
| `carbon` | IBM Carbon | Grid-heavy, IBM Plex, monochrome, industrial enterprise |

### New styles — Visual Aesthetics
| ID | Aesthetic | Key Visual |
|----|-----------|------------|
| `neubrutalism` | Neobrutalism | 3px solid black border, `box-shadow: 4px 4px 0 #000` (zero blur), neon fills |
| `glassmorphism` | Glassmorphism | `backdrop-filter: blur(20px)`, rgba(255,255,255,0.15) surfaces, vivid bg |
| `neumorphic` | Neumorphism / Soft UI | dual outer mono shadows, single mid-tone bg, no borders |
| `claymorphism` | Claymorphism | inner+outer combined shadows, radius 28–40px, vibrant pastels |
| `dark-minimal` | Dark Minimal SaaS | #0A0A0B surfaces, rgba(255,255,255,0.08) borders, Inter/Geist (Linear/Vercel style) |
| `aurora` | Aurora / Mesh Gradient | blurred radial gradient orbs as background layer, neon on dark |
| `skeuomorphic` | Skeuomorphism | textures, realistic gradients, deep shadows, physical metaphors |

### Update existing styles
- `flat` — refresh (already exists, needs modernization)
- `material` → superseded by `material3`
- `ios` → superseded by `hig`

### DoD
- [x] Style inheritance: `projectStore` + `html-builder` support screen-level style override
- [x] 12 new CSS style files in `src/renderer/styles/`
- [x] Style registry updated (VALID_STYLES: 6→18), dynamic Zod enum
- [x] Editor: project style dropdown in toolbar
- [x] Editor: per-screen style override in properties panel
- [x] PATCH /api/projects/:id endpoint added
- [x] Tests: 1424 pass (was 919, +505 new)

## M19 — Layers Panel
**Status:** PLANNED
**Branch:** `feature/m19-layers`
**Scope:** Wizualny panel warstw w edytorze — lista elementów wg z_index, drag-to-reorder, bring-to-front/send-to-back, sync z canvasem.
**Tasks:** `PM/tasks/M19.md`
**Depends on:** nothing
**DoD:** Panel warstw w sidebarze, drag reorder persistuje z_index, dwukierunkowa sync z canvasem, pinned elements chronione.

## M20 — High-level Layout API
**Status:** PLANNED
**Branch:** `feature/m20-layout-api`
**Scope:** Semantic layout — Claude opisuje sekcje, tool pozycjonuje elementy. Section library (10 sekcji v1). Nowy MCP tool + prompt.
**Tasks:** `PM/tasks/M20.md`
**Depends on:** nothing
**DoD:** `mockup_create_screen_layout` tool, 10 sekcji, `layout_guide` MCP prompt, testy.

## M21 — Versioning
**Status:** PLANNED
**Branch:** `feature/m21-versioning`
**Scope:** Każda iteracja = nowy rekord screena. Status draft/approved. Sidebar version tree. Draft bez podglądu.
**Tasks:** `PM/tasks/M21.md`
**Depends on:** nothing (ale M23 wymaga M21)
**DoD:** `mockup_create_screen_version`, `mockup_set_screen_status`, sidebar version tree, preview gate.

## M22 — Comments per-element
**Status:** PLANNED
**Branch:** `feature/m22-comments`
**Scope:** Komentarze przypisane do elementów. Numerowane piny w edytorze i PNG. MCP resource + 3 tools.
**Tasks:** `PM/tasks/M22.md`
**Depends on:** nothing (ale M23 korzysta z M22)
**DoD:** CRUD komentarzy, piny na canvasie, PNG render z pinami+legendą, MCP resource.

## M23 — Approval Flow Redesign
**Status:** DONE (PR #30)
**Branch:** `feature/m23-approval`
**Scope:** 3 stany: rejected / accepted_with_comments / accepted. Integracja z M21+M22. Claude dostaje strukturalny feedback.
**Tasks:** `PM/tasks/M23.md`
**Depends on:** M21 + M22 (HARD)
**DoD:** 3-state approval end-to-end, comments w response, 3 przyciski w edytorze, timeout 300s.

## M24 — Slate Style (dark + light)
**Status:** DONE (PR #26)
**Branch:** `feature/m24-slate`
**Scope:** Styl "slate" z Tailwind Slate palette. Dark + light mode przez `data-color-scheme` attribute. Generyczny mechanizm dla przyszłych styli.
**Tasks:** `PM/tasks/M24.md`
**Depends on:** M18 DONE
**DoD:** slate.css z 35 komponentami × 2 schematy, `data-color-scheme` w html-builder, `color_scheme` param w MCP tools.
