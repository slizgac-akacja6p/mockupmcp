// src/preview/routes/elements-api.js
import { ProjectStore } from '../../storage/project-store.js';
import { config } from '../../config.js';

// Creates a fresh store per request so tests can swap config.dataDir between
// requests without restarting the server — same pattern as /api/projects.
async function getStore() {
  const store = new ProjectStore(config.dataDir);
  await store.init();
  return store;
}

export function registerElementsApi(app) {
  // GET /api/screens/:projectId/:screenId/elements
  app.get('/api/screens/:projectId/:screenId/elements', async (req, res) => {
    try {
      const store = await getStore();
      const elements = await store.listElements(req.params.projectId, req.params.screenId);
      res.json(elements);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // POST /api/screens/:projectId/:screenId/elements
  app.post('/api/screens/:projectId/:screenId/elements', async (req, res) => {
    try {
      const store = await getStore();
      const body = await parseJsonBody(req);
      const { type, x, y, width, height, properties = {}, z_index = 0 } = body;
      const el = await store.addElement(
        req.params.projectId,
        req.params.screenId,
        type, x, y, width, height, properties, z_index,
      );
      res.status(201).json(el);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // PATCH /api/screens/:projectId/:screenId/elements/:elementId
  // Supports partial updates: position fields (x, y, width, height, z_index)
  // and/or properties object can be sent independently or together.
  app.patch('/api/screens/:projectId/:screenId/elements/:elementId', async (req, res) => {
    try {
      const store = await getStore();
      const { projectId, screenId, elementId } = req.params;
      const body = await parseJsonBody(req);
      const { x, y, width, height, z_index, properties } = body;

      if (x !== undefined || y !== undefined || width !== undefined || height !== undefined || z_index !== undefined) {
        await store.moveElement(projectId, screenId, elementId, x, y, width, height, z_index);
      }

      let el;
      if (properties !== undefined) {
        el = await store.updateElement(projectId, screenId, elementId, properties);
      } else {
        const elements = await store.listElements(projectId, screenId);
        el = elements.find(e => e.id === elementId);
      }
      res.json(el);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // DELETE /api/screens/:projectId/:screenId/elements/:elementId
  app.delete('/api/screens/:projectId/:screenId/elements/:elementId', async (req, res) => {
    try {
      const store = await getStore();
      await store.deleteElement(req.params.projectId, req.params.screenId, req.params.elementId);
      res.status(204).end();
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });
}

// Reads the raw request body as JSON. Falls back to empty object on parse failure
// so callers always get a usable body even for malformed requests.
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}
