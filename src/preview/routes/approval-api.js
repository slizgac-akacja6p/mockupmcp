import { ProjectStore } from '../../storage/project-store.js';
import { config } from '../../config.js';

// In-memory approval state per screen, keyed by `${projectId}/${screenId}`.
// Resets on server restart — acceptable for local dev tool usage.
const editSessions = new Map();

function sessionKey(pid, sid) {
  return `${pid}/${sid}`;
}

export function registerApprovalApi(app) {
  // Creates a fresh ProjectStore per request so tests can swap config.dataDir
  // between requests without restarting the server (mirrors /api/projects pattern).
  async function getStore() {
    const store = new ProjectStore(config.dataDir);
    await store.init();
    return store;
  }

  // POST /api/screens/:projectId/:screenId/edit
  // Starts an edit session by snapshotting current elements.
  // Resets any prior approval so the MCP tool must re-approve after new edits.
  app.post('/api/screens/:projectId/:screenId/edit', async (req, res) => {
    try {
      const { projectId, screenId } = req.params;
      const store = await getStore();
      const elements = await store.listElements(projectId, screenId);
      const key = sessionKey(projectId, screenId);
      editSessions.set(key, {
        snapshot: JSON.parse(JSON.stringify(elements)),
        approved: false,
        approvedAt: null,
        summary: null,
      });
      res.json({ editing: true, snapshotCount: elements.length });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // GET /api/screens/:projectId/:screenId/approval
  // Returns current approval status + live element count.
  // Returns a zero-state response when no edit session exists (polling-safe).
  app.get('/api/screens/:projectId/:screenId/approval', async (req, res) => {
    const { projectId, screenId } = req.params;
    const key = sessionKey(projectId, screenId);
    const session = editSessions.get(key);

    try {
      const store = await getStore();
      const elements = await store.listElements(projectId, screenId);
      if (!session) {
        return res.json({ approved: false, approvedAt: null, summary: null, elementCount: elements.length });
      }
      res.json({
        approved: session.approved,
        approvedAt: session.approvedAt,
        summary: session.summary,
        elementCount: elements.length,
      });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // POST /api/screens/:projectId/:screenId/approve
  // Marks the current state as approved and records a diff summary.
  // Works even without a prior /edit call — treats snapshot as empty in that case.
  app.post('/api/screens/:projectId/:screenId/approve', async (req, res) => {
    try {
      const { projectId, screenId } = req.params;
      const key = sessionKey(projectId, screenId);
      const session = editSessions.get(key);
      const store = await getStore();
      const current = await store.listElements(projectId, screenId);
      const snapshot = session ? session.snapshot : [];
      const summary = buildSummary(snapshot, current);
      const approvedAt = new Date().toISOString();
      editSessions.set(key, { snapshot, approved: true, approvedAt, summary });
      res.json({ approved: true, approvedAt, summary, elementCount: current.length });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });
}

// Computes a human-readable diff summary between snapshot and current elements.
// Counts added, deleted and moved/resized elements by ID comparison.
function buildSummary(snapshot, current) {
  const oldIds = new Set(snapshot.map((e) => e.id));
  const newIds = new Set(current.map((e) => e.id));

  const added = current.filter((e) => !oldIds.has(e.id)).length;
  const deleted = snapshot.filter((e) => !newIds.has(e.id)).length;

  let moved = 0;
  for (const el of current) {
    const old = snapshot.find((e) => e.id === el.id);
    if (old && (old.x !== el.x || old.y !== el.y || old.width !== el.width || old.height !== el.height)) {
      moved++;
    }
  }

  const parts = [];
  if (added) parts.push(`${added} added`);
  if (deleted) parts.push(`${deleted} deleted`);
  if (moved) parts.push(`${moved} moved`);
  return parts.length ? parts.join(', ') : 'no changes';
}

export { editSessions, buildSummary };
