# M2a — Components + Styles

**Branch:** `feature/m2a-components-styles`
**Status:** DONE
**Design doc:** `docs/plans/2026-02-20-m2a-design.md`
**Implementation plan:** `docs/plans/2026-02-20-m2a-implementation.md`
**Tests:** 321 (216 unit + 105 integration)
**Files changed:** 42, +3780 lines

## Sprint 1: Core Implementation (Tasks 1-14)

| # | Task | Status |
|---|------|--------|
| 1 | Style registry (loadStyle + getAvailableStyles) — wireframe/material/ios | DONE |
| 2 | Refactor html-builder for multi-style support | DONE |
| 3 | Storage + MCP schemas (style field on project/screen, duplicateScreen, mockup_duplicate_screen tool) | DONE |
| 4 | Simple Components — Basic (circle, line) | DONE |
| 5 | Simple Components — Forms (textarea, checkbox, radio, toggle, select, slider) | DONE |
| 6 | Simple Components — Navigation (sidebar, breadcrumb) | DONE |
| 7 | Simple Components — Data (table, avatar, badge, chip) | DONE |
| 8 | Simple Components — Feedback (alert, modal, skeleton, progress, tooltip) | DONE |
| 9 | Composite Components (login_form, search_bar, header, footer, data_table, chart_placeholder) | DONE |
| 10 | Component registry update (10 → 35) | DONE |
| 11 | wireframe.css extension (260 → 858 lines) | DONE |
| 12 | material.css — Material Design 3 (903 lines) | DONE |
| 13 | ios.css — iOS HIG (928 lines) | DONE |
| 14 | Run all unit tests + commit Sprint 1 | DONE |

## Sprint 2: Integration + Polish (Tasks 15-16)

| # | Task | Status |
|---|------|--------|
| 15 | Integration test — 3 styles x 35 components = 105 tests | DONE |
| 16 | Update PM files + final commit | DONE |

## Component Inventory

**M1 baseline (10):** text, rectangle, button, input, image, icon, navbar, tabbar, card, list

**M2a additions (25):**
- Basic: circle, line
- Forms: textarea, checkbox, radio, toggle, select, slider
- Navigation: sidebar, breadcrumb
- Data: table, avatar, badge, chip
- Feedback: alert, modal, skeleton, progress, tooltip
- Composite: login_form, search_bar, header, footer, data_table, chart_placeholder

**Total: 35 components**

## Style Inventory

| Style | File | Lines | Description |
|-------|------|-------|-------------|
| wireframe | wireframe.css | 858 | Low-fidelity black & white sketches |
| material | material.css | 903 | Material Design 3 |
| ios | ios.css | 928 | iOS Human Interface Guidelines |
