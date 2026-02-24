# Technical Decisions — MockupMCP

## 2026-02-24 (Phase A+B: M19, M20, M21, M22, M24)

### Parallel agent isolation: always use `isolation: worktree`

When running multiple agents in parallel on the same repository, each agent must
operate in a separate git worktree. Without this, agents on different branches
share the working tree and can overwrite each other's uncommitted changes — even
when assigned non-overlapping files. Lesson learned from branch contamination
incident in M19/M20 parallel run.

### Additive data model changes with `??=` migration

New fields on the screen/element model (`version`, `status`, `parent_screen_id`,
`color_scheme`, `comments`) are always added additively. On read, missing fields
are set to defaults using `??=`. This means:
- No migration scripts needed.
- Existing JSON files on `/data` continue to work unchanged.
- Rolling back the code leaves old files intact (new fields simply ignored).

### Layout sections compile to elements at creation time

The Layout API (`mockup_create_screen_layout`) resolves sections into a flat
element list before persisting. There is no "section" model at runtime — just
elements with the standard schema. This keeps the renderer and all downstream
tools (export, codegen, versioning) unaware of sections, avoiding a second
entity type and associated complexity.

### Slate style uses `data-color-scheme` attribute

The `slate` style supports dark and light variants. Rather than two separate
CSS files, a single `slate.css` scopes rules under `[data-color-scheme="dark"]`
and `[data-color-scheme="light"]`. The `color_scheme` field on the screen model
drives which attribute `html-builder.js` sets on the screen root element. This
pattern should be followed by any future style that needs theme variants.

### Cherry-pick as recovery for branch contamination

When a branch is contaminated (contains commits from another feature branch due
to worktree misuse), the recovery strategy is:
1. Identify the target commits via `git log --oneline`.
2. Create a clean branch from the correct base (`develop`).
3. `git cherry-pick` only the intended commits onto the clean branch.
4. Open a PR from the clean branch; discard the contaminated branch.

### Dev (haiku) must be explicitly told not to spawn sub-agents

Haiku models may attempt to spawn sub-agents when given complex multi-step tasks.
The spawn prompt must include an explicit constraint: "Do not spawn sub-agents.
Implement everything yourself in this single agent context." This prevents
unexpected nesting and context loss.

---

## 2026-02-23 (M18: Design System Styles)

### Styles as isolated CSS files, no JS logic

Each style is a self-contained CSS file. Style selection is done by `html-builder.js`
injecting a `<link>` tag — no conditional rendering in component code. This makes
styles fully independent: adding a new style requires only a CSS file + registry entry.

### Style registry in `src/renderer/styles/index.js`

A central `STYLES` map (name → file path + metadata) is the single source of truth
for available styles. Tools (`mockup_list_styles`) and the renderer both read from
this registry. Adding a style = one registry entry + one CSS file.

---

## 2026-02-22 (M16/M17: Visual Editor Redesign)

### i18n via `window.t(key, fallback)` — not a framework

Translation is a thin wrapper: `window.t(key, fallback)` returns a string from a
loaded JSON locale file. `window.initI18n()` must be awaited before `initEditor()`.
No build step, no bundler — browser loads JSON directly via fetch.

### Canvas coordinates: always relative to `.screen`, not `#editor-canvas`

The mockup element `.screen` is the actual rendered mockup container. All element
position calculations (drag, resize, click-to-select) must use
`document.querySelector('.screen').getBoundingClientRect()` as the origin — not the
outer `#editor-canvas` wrapper, which has a different size due to zoom/padding.

### `rAF` + debounce for canvas performance

All canvas re-renders are gated through `requestAnimationFrame`. Property panel
updates are debounced (150ms). Without this, heavy screens (50+ elements) caused
visible lag on every mouse move during drag.
