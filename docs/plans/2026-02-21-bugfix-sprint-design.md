# Bugfix Sprint Design

**Goal:** Fix 3 bugs found during live demo.

## Bug 1: Export PNG — SDK base64 validation failure
- **Root cause:** `mockup_export` returns `{ type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' }`. Newer SDK validates `data` field and rejects our base64.
- **Fix:** Check SDK `ImageContent` expectations, adjust format. Fallback: return as text with base64 string.

## Bug 2: Shutdown crash — Promise instead of Server
- **Root cause:** `index.js:25` — `startHttpTransport()` is async, returns Promise, but not awaited. `httpMcpServer.close()` calls `.close()` on Promise.
- **Fix:** `await startHttpTransport(...)`.

## Bug 3: ProjectStore — missing auto-create directories
- **Root cause:** ProjectStore assumes `projects/` and `exports/` exist. Fresh volume or local run has empty dir.
- **Fix:** `mkdirSync(path, { recursive: true })` in ProjectStore constructor.

**Testing:** Each bug gets a unit test confirming the fix.
