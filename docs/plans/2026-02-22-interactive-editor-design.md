# Phase 4: Interactive Design Editor

## TL;DR
Browser-based visual editor in MockupMCP preview. Full drag-drop canvas, component palette (35 components), property inspector, approval flow. Claude creates mockup → user edits in browser → approves → Claude reads back modified state via MCP resource. Layered Architecture (vanilla JS modules, no framework).

## Architecture

### Modules (client-side, vanilla JS)

| Module | File | Responsibility |
|--------|------|----------------|
| Canvas | `canvas.js` | Drag-drop, resize handles, snap-to-grid, selection, z-index |
| Palette | `palette.js` | Component panel (35 types, 6 categories), drag-to-canvas |
| Inspector | `inspector.js` | Property panel for selected element (position, props, actions) |
| Sync | `sync.js` | REST sync, undo/redo history stack |
| Toolbar | `toolbar.js` | Mode toggle, undo/redo, snap, approve button |
| Editor | `editor.js` | Orchestrator: init modules, custom event bus |

### Endpoints (server-side, Express)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/screens/:id/elements` | GET | Get screen elements (JSON) |
| `/api/screens/:id/elements` | PUT | Save all modified elements |
| `/api/screens/:id/elements` | POST | Add new element |
| `/api/screens/:id/elements/:elId` | PATCH | Update single element |
| `/api/screens/:id/elements/:elId` | DELETE | Delete element |
| `/api/screens/:id/approve` | POST | Approve — set approved flag |

### MCP Additions

- **Resource:** `mockup://projects/{pid}/screens/{sid}/approval` — returns `{ approved, approvedAt, elementCount, summary }`
- **Tool:** `mockup_await_approval` — polls approval resource every 2s, returns when approved + current screen state

## Canvas Engine

### Modes
- **View mode** (default): current read-only preview, "Edit" button in toolbar
- **Edit mode**: click "Edit" → canvas engine activates, elements become interactive

### Behaviors
- **Selection:** click element → blue border + 8 resize handles. Click empty → deselect
- **Drag:** mousedown on selected → move. CSS transform in real-time, JSON save on mouseup
- **Resize:** mousedown on handle → scale. Shift = proportional. Min 20x20px
- **Snap-to-grid:** 8px default, visual guide lines on snap. Toggle in toolbar
- **Z-index:** toolbar "forward"/"backward" buttons. `z_index >= 10` = pinned
- **Multi-select:** shift+click or drag-rectangle on empty area

### Implementation
- Overlay `<div>` over rendered screen HTML (no component HTML modification)
- Elements positioned absolute — canvas maps `x, y, width, height` from JSON to CSS
- Custom events: `element:select`, `element:move`, `element:resize`

## Component Palette (left panel, 240px)

- Categories: Basic (6), Form (8), Navigation (4), Data (6), Feedback (5), Composite (6)
- Each component = icon + name, drag from palette to canvas
- Drop → POST `/api/screens/:id/elements` with `defaults()` props
- Position = drop location (snap-to-grid)
- Search box at top — filter by name

## Property Inspector (right panel, 280px)

Appears when element selected:
- **Position:** x, y, width, height (number inputs, live update)
- **Component props:** dynamic based on element type (text, label, placeholder, checked, items, etc.)
- **Style overrides:** opacity, z_index
- **Actions:** Duplicate, Delete, Move to group

Changes → immediate re-render + debounced PATCH (300ms)

## Toolbar (top bar)

- View / Edit toggle
- Undo / Redo (in-memory history, max 50 steps)
- Snap-to-grid toggle
- Z-index: Forward / Backward
- **Approve** button (green, right corner) — POST approve, return to View mode

## Layout
```
┌───────────────────────────────────────────────────┐
│ Toolbar: [View/Edit] [Undo][Redo] [Snap] [Approve]│
├──────────┬─────────────────────────┬──────────────┤
│ Palette  │       Canvas            │  Inspector   │
│ (240px)  │    (flex-grow)          │  (280px)     │
│          │                         │              │
│ [Search] │   ┌──────────┐         │ Position     │
│ ─Basic── │   │ element  │         │ x: y: w: h:  │
│  button  │   └──────────┘         │ ─Props────   │
│  text    │        ┌─────┐         │ text: ...    │
│ ─Form──  │        │ el  │         │ variant:...  │
│  input   │        └─────┘         │ ─Actions──   │
│          │                         │ [Dup][Del]   │
└──────────┴─────────────────────────┴──────────────┘
```

## Sync + Approval Flow

### Client → Server
- Every edit (move, resize, prop change, add, delete) → debounced REST call (300ms)
- Undo/Redo: client-side history stack, undo fires REST call with previous state
- No conflict handling — single-user, simple overwrite

### Approval Flow
1. User clicks "Approve" → `POST /api/screens/:id/approve` → server sets `screen.approved = true` + timestamp
2. MCP resource `mockup://projects/{pid}/screens/{sid}/approval` returns approval state + change summary
3. Claude reads resource → sees `approved: true` → reads current screen state
4. `mockup_await_approval` tool: convenience polling (2s interval), returns on approval

### Change Tracking
- Server snapshots elements on Edit mode entry
- On approve: diff snapshot vs current → generate summary ("3 moved, 1 added, 1 deleted")
- Reset snapshot on next Edit mode entry

## File Structure

```
src/
  preview/
    editor/
      canvas.js
      palette.js
      inspector.js
      sync.js
      toolbar.js
      editor.js
    routes/
      elements-api.js
      approval-api.js
  mcp/
    resources.js          # +1 approval resource
    tools/
      approval-tools.js   # mockup_await_approval

tests/
  preview/
    editor/
      canvas.test.js
      palette.test.js
      inspector.test.js
      sync.test.js
      toolbar.test.js
    routes/
      elements-api.test.js
      approval-api.test.js
  mcp/
    approval-tools.test.js
```

## Scope

- ~12-15 new files, ~2000-2500 LOC
- 1 new MCP tool, 1 new MCP resource
- No changes to existing 35 components, html-builder, or 25 MCP tools
- Existing 5 MCP resources unchanged (1 added)
