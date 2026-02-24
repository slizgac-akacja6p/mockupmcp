# Bug Backlog

## BUG-001 — Zoom (+/-/Fit) loads wrong screen content (Safari)
**Status:** DONE
**Repro:** Open preview page in Safari → click any zoom button (+, -, Fit) → canvas shows different screen content than expected (appears to load a different screen or re-fetch wrong HTML)
**Not reproduced:** Playwright headless Chromium — zoom works correctly (100%→125%, URL unchanged, no navigation)
**Suspected area:** Safari-specific JS behavior OR SPA fetch+swap navigation triggered by zoom on screens with navigation links
**Affected screens:** "Edit Mode — Light/Dark" mockup screens (scr_jCldFdvZvU, scr_UhQyj7R04a) in MockupMCP Redesign project
**Priority:** Medium
