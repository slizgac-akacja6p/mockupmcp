# Editor Redesign — Design Document
**Date:** 2026-02-24
**Status:** Approved
**Scope:** Full redesign of MockupMCP editor UI — new design token system, layout improvements, visual language, i18n architecture, performance fixes.

## Overview

Complete redesign of the MockupMCP preview editor to achieve a Linear/Vercel-style professional SaaS aesthetic. The redesign covers:
1. New design token system with proper hierarchy
2. Three-panel layout improvements (proportions, separators, collapse, panel reorganization)
3. Visual language for all UI components
4. i18n architecture (EN + PL, extensible to more languages)
5. Performance fixes for drag, selection, and property panel lag

## 1. Design Token System

### Surfaces (layering hierarchy)
```css
--surface-0: #0A0A0B;   /* canvas background — darkest */
--surface-1: #111113;   /* sidebar, right panel */
--surface-2: #1A1A1F;   /* toolbar, input fields */
--surface-3: #242429;   /* hover states, active items */
--surface-4: #2E2E35;   /* tooltips, dropdowns */
```

### Accent & Gradients
```css
--accent: #6366F1;
--accent-hover: #818CF8;
--accent-gradient: linear-gradient(135deg, #6366F1, #8B5CF6);
--accent-subtle: rgba(99, 102, 241, 0.15);
--accent-glow: 0 0 20px rgba(99, 102, 241, 0.3);
```

### Borders
```css
--border-subtle: rgba(255, 255, 255, 0.04);
--border-default: rgba(255, 255, 255, 0.08);
--border-strong: rgba(255, 255, 255, 0.16);
```

### Typography Scale
```css
--text-xxs: 10px;   /* labels, metadata */
--text-xs: 11px;    /* property labels */
--text-sm: 12px;    /* body, panel content */
--text-base: 13px;  /* default UI */
--text-md: 14px;    /* section headers */
```

### Spacing Scale
`4px / 6px / 8px / 12px / 16px / 24px / 32px`

### Shadow Scale
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.6);
```

### Border Radius
```css
--radius-sm: 4px;   /* inputs */
--radius-md: 6px;   /* buttons, cards */
--radius-lg: 10px;  /* panels, modals */
```

## 2. Layout Structure

### Panel Proportions
```
[Sidebar 240px] [Canvas flex:1] [Right panel 280px]
```
- Sidebar: 240px (was 260px)
- Right panel: 280px (was 260px)

### Separators
- Panel borders: `1px solid var(--border-default)`
- Canvas inset shadow: `box-shadow: inset 2px 0 8px rgba(0,0,0,0.3)` — depth effect

### Sidebar Collapse
- Collapse button `‹` on panel edge — single click
- Collapsed state: 48px width (icons only)
- Canvas auto-expands to fill space
- State persisted in `localStorage`

### Right Panel — Tab Navigation
Replace current property-panel-top + palette-bottom split with tabs:
- Tabs: `Properties` | `Components`
- Active tab fills 100% of panel height
- Clicking an element → auto-switches to `Properties` tab
- No selection → defaults to `Components` tab

### Toolbar
- Background: `var(--surface-2)` + `border-bottom: 1px solid var(--border-subtle)`
- Sections separated by `1px solid var(--border-subtle)` vertical dividers
- Mode toggle (select/add): pill-style toggle button group
- Light/Dark toggle: icon button `☾`/`☀` in right corner

## 3. Visual Language

### Property Panel Fields
- Input background: `var(--surface-2)`, border: `1px solid var(--border-default)`, radius: `var(--radius-sm)`
- Focus: `border-color: var(--accent)` + `box-shadow: var(--accent-glow)`
- Field pairs (x/y, w/h): `display: grid; grid-template-columns: 1fr 1fr; gap: 4px`
- Section headers: `var(--text-xxs)`, `letter-spacing: 0.08em`, `text-transform: uppercase`, color: `var(--text-secondary)`

### Component Palette
- Component cards: `border-radius: var(--radius-md)`, background: `var(--surface-2)`, icon + label
- Hover: `background: var(--surface-3)` + `border: 1px solid var(--border-default)`
- Search input: full width, magnifier icon, `border-radius: var(--radius-md)`
- Categories: collapsible with `▸`/`▾` chevron, `var(--border-subtle)` divider between sections

### Toolbar Buttons
- Inactive: `color: var(--text-secondary)`, `background: transparent`
- Active (mode): `background: var(--accent-gradient)`, `color: white`, `border-radius: var(--radius-md)`
- Hover: `background: var(--surface-3)`

### Canvas
- Background: `var(--surface-0)` — visually recessed vs panels
- Grid dots: `rgba(255,255,255,0.04)`
- Canvas elements: `box-shadow: var(--shadow-sm)` — slight float effect
- Selection handles: `var(--accent)` outline `2px`, handle squares `6×6px`

## 4. i18n Architecture

### File Structure
```
src/preview/i18n/
  index.js      # t(key) helper + language loader
  en.json       # English (default)
  pl.json       # Polish
```

### API
```js
// t('toolbar.addMode') → 'Add Mode' or 'Tryb dodawania'
export function t(key) { return locale[key] ?? key }
export function setLanguage(lang) { /* loads locale, saves localStorage */ }
```

### UI Integration
- All editor modules import `{ t }` from `i18n/index.js`
- All hardcoded UI strings replaced with `t('...')` calls
- Language switcher in toolbar: `EN`/`PL` button with dropdown (extensible)
- Language change → re-renders UI panels without page reload

### Translation Scope (Phase 1)
- Toolbar (modes, buttons, tooltips)
- Property panel (sections, field labels, placeholders)
- Palette (search placeholder, categories, component tooltips)
- Toast messages (copy, paste, undo, error)
- Sidebar (headers, actions)

### Extensibility
- New language = new `src/preview/i18n/xx.json` file — zero code changes
- Language switcher dynamically detects available locales

## 5. Performance Fixes

### Fix 1 — Drag & Resize Lag: requestAnimationFrame throttle
**Files:** `drag.js`, `resize.js`, `editor.js` (alignment guides)
```js
let rafPending = false
onMouseMove(e) {
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => { updatePosition(e); rafPending = false })
}
```

### Fix 2 — Selection Lag: surgical DOM updates
**File:** `editor.js`
Replace `screenEl.outerHTML = await fetchHtml()` on selection change with:
```js
el.classList.toggle('selected', isSelected)
```
Full HTML fetch only on actual data changes (not selection).

### Fix 3 — Property Panel Lag: debounce API calls
**File:** `property-panel.js`
```js
input.addEventListener('input', debounce((e) => {
  patchElement({ [field]: e.target.value })
}, 150))
```

### Fix 4 — Polling: hash-based diff
**File:** `editor.js`
```js
const newHash = hash(screenData)
if (newHash === lastHash) return  // skip rerender
lastHash = newHash
```

### Fix 5 — Palette Search: debounce
**File:** `palette.js`
```js
searchInput.addEventListener('input', debounce(renderAll, 100))
```

## Success Criteria

- [ ] Editor loads in <1s on first open
- [ ] Drag/resize: no visible jank on 60fps display
- [ ] Property panel updates feel instant (no lag after keystroke)
- [ ] Design matches Linear/Vercel aesthetic (dark, professional, sharp contrast)
- [ ] EN and PL fully translated, language switcher works
- [ ] Sidebar collapse works and persists across page reloads
- [ ] Tab navigation (Properties / Components) works correctly
