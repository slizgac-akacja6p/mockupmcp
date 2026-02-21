# Design: Sidebar Navigation + Tabbar Fix

**Date:** 2026-02-22
**Status:** Approved

## Feature 1: Preview Sidebar Navigation

### Problem
Preview server only serves individual screens at `/preview/:projectId/:screenId`. No way to browse projects/screens without knowing the exact URL.

### Solution
Persistent sidebar injected into every preview page. Collapsible, auto-refreshing project/screen tree.

### Routes
| Route | Behavior |
|-------|----------|
| `GET /` | Redirect to `/preview` |
| `GET /preview` | Landing page: sidebar + "Select a screen" placeholder |
| `GET /preview/:projectId/:screenId` | Existing preview + sidebar |
| `GET /api/projects` | JSON tree: projects with nested screens |

### Sidebar Spec
- Width: 260px, left side
- Collapsible via toggle button (persists state in localStorage)
- Tree structure: Project name (expandable) > Screen items (clickable)
- Active screen highlighted
- Auto-refresh project list every 3s (reuse polling pattern)
- Mobile: hidden by default, hamburger opens as overlay
- Styling: neutral gray, works with all mockup styles

### Preview Layout Change
- Current: screen centered, full width
- New: sidebar (260px) + content area (remaining width), screen centered in content area
- When sidebar collapsed: thin strip (40px) with expand arrow

## Feature 2: Tabbar in Screen Generation

### Problem
Keyword `tabbar` is recognized by `parseDescription()` but `augmentElements()` has no logic to inject tabbar component. Dashboard template also lacks tabbar.

### Fix 1: augmentElements()
Add tabbar injection when keyword `tabbar` detected:
- Position: bottom of screen (y = viewport.height - 56)
- Size: full width, 56px height
- z_index: 10 (pinned, excluded from auto-layout)
- Default tabs: Home, Search, Profile (3 tabs with icons)

### Fix 2: Dashboard template
Add tabbar as default element in dashboard template:
- Same positioning as augmentation (bottom, pinned)
- Tabs: Home, Analytics, Settings (dashboard-relevant labels)
- Respects contentHints if provided

## Out of Scope
- Screen thumbnails in sidebar (would require extra Puppeteer renders)
- Drag-and-drop reordering
- Sidebar search/filter
