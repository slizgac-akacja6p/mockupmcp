# Changelog

All notable changes to MockupMCP are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

## [0.7.0] - 2026-02-25

### Added

- **M23 — Approval Flow Redesign:** 3-state approval flow (`accepted`, `accepted_with_comments`, `rejected`); `mockup_await_approval` redesigned to poll store directly, default timeout raised to 300 s (was 120 s), returns `{ status, comments?, reason? }`; `POST /api/projects/:pid/screens/:sid/approve` REST endpoint; `src/preview/editor/approval.js` — 3-button approval panel in editor right panel (Accept / Accept with Comments / Reject); "Accept with Comments" disabled when no unresolved comments; Reject requires a reason textarea; `createScreenVersion()` now copies unresolved comments with fresh IDs to the new version; MCP resource `mockup://projects/{pid}/screens/{sid}/approval` returns `version`, `status`, `unresolved_comments`, `parent_screen_id`; backward-compatible `approved: true` field preserved alongside new `status` field; 13 new tests.

### Changed

- `mockup_await_approval` polling strategy: reads store directly (no `editSessions` Map dependency)
- Test count: ~1564 → 1579

## [0.6.0] - 2026-02-24

### Added

- **M19 — Layers Panel:** `src/preview/editor/layers.js` — visual layer list in the editor sidebar tab; drag-to-reorder elements by `z_index`; Bring to Front / Send to Back actions; keyboard shortcuts `]` (raise) and `[` (lower); real-time sync with canvas selection state.

- **M20 — High-level Layout API:** `src/renderer/sections/` (10 semantic sections: `navbar`, `hero_with_cta`, `card_grid_2`, `card_grid_3`, `feature_list`, `footer`, `login_form`, `profile_header`, `search_bar`, `settings_panel`); `src/renderer/layout-composer.js` orchestrates section stacking; new MCP tool `mockup_create_screen_layout` composes a full screen from a section list; new MCP prompt `layout_guide` explains the Layout API to AI agents.

- **M21 — Screen Versioning:** `version`, `status`, and `parent_screen_id` fields on the screen model (additive, `??=` migration — no breaking changes); `createScreenVersion()` clones a screen as a child version; new MCP tools `mockup_create_screen_version` and `mockup_set_screen_status` (values: `draft`, `review`, `approved`, `rejected`); sidebar version tree with badges and status dots.

- **M22 — Per-element Comments:** `src/mcp/tools/comment-tools.js` (3 tools: `mockup_add_comment`, `mockup_list_comments`, `mockup_resolve_comment`); `src/preview/editor/comments.js` — numbered comment pins on canvas overlaid on element positions; new MCP resource `mockup://projects/{projectId}/screens/{screenId}/comments`; comments stored in screen model, resolved comments preserved with timestamp.

- **M24 — Slate Style:** `src/renderer/styles/slate.css` (~740 lines); supports dark and light variants via `data-color-scheme` attribute on the screen root; new `color_scheme` field in screen model (`"dark"` default, `"light"` opt-in); generic mechanism designed to be reused by future multi-variant styles.

- **M18 — 12 additional design styles:** `dark-minimal`, `pastel`, `corporate`, `retro`, `glassmorphism`, `neon`, `paper`, `terminal`, `playful`, `gradient`, `monochrome`, `soft-ui` — style registry expanded from 6 to 18 styles (19 with slate).

### Changed

- MCP tool count: 25 → 34
- MCP resource count: 5 → 6
- MCP prompt count: 3 → 4
- Style count: 6 → 19
- Test count: 919 → ~1564

## [0.5.0] - 2026-02-23

### Added

- **M18 — Design System Styles:** style selector UI in the editor; 12 new styles added to registry; `mockup_list_styles` tool.

- **M16/M17 — Visual Editor Redesign:** component palette with drag-to-add; multi-select (Shift+click, rubber-band); copy-paste (Cmd+C/V); undo/redo (Cmd+Z/Shift+Z); dark theme toggle in sidebar; i18n support (EN + PL via `window.t()`) with language switcher dropdown; resize handles that follow drag in real time; floating zoom controls (bottom-right corner); sidebar collapse; Properties | Components tab split in right panel; `rAF`-based rendering + debounce for performance.

## [0.4.0] - 2026-02-22

### Added

- **M15 — Preview Editor:** in-browser drag-and-drop element repositioning; property inspector panel; screen navigation in sidebar; polling-based preview reload.

## [0.3.0] - 2026-02-21

### Added

- **M13/M14 — Code Generation + Navigation Flows:** `mockup_to_code` (HTML, React, SwiftUI, Flutter); `mockup_export_flow` (Mermaid); `mockup_add_link` / `mockup_remove_link`.

## [0.2.0] - 2026-02-20

### Added

- **M11/M12 — Grouping + HTTP Transport:** `mockup_group_elements`, `mockup_ungroup_elements`, `mockup_move_group`; Streamable HTTP transport on port 3200; MCP resources and prompts (design_review, accessibility_check, compare_screens).

## [0.1.0] - 2026-02-19

### Added

- Initial release: core MCP server (stdio), project/screen/element CRUD, 6 styles, 7 templates, 35 components, Puppeteer PNG export, Express preview server (port 3100).
