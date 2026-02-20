import express from 'express';
import { ProjectStore } from '../storage/project-store.js';
import { buildScreenHtml } from '../renderer/html-builder.js';
import { config } from '../config.js';

// Centered background styling injected into every preview page so the mockup
// renders on a neutral canvas without modifying the stored screen data.
const PREVIEW_STYLE = `
<style>
  html { background: #E0E0E0; min-height: 100vh; display: flex; justify-content: center; padding: 20px; }
  body { display: flex; justify-content: center; }
  .screen { box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
</style>`;

function buildReloadScript(projectId, updatedAt) {
  // Polling rather than WebSockets keeps the server stateless and avoids
  // connection management across MCP tool calls that mutate project data.
  return `
<script>
  let lastMod = '${updatedAt}';
  setInterval(async () => {
    try {
      const r = await fetch('/api/lastmod/${projectId}');
      const data = await r.json();
      if (data.updated_at !== lastMod) location.reload();
    } catch (_) {}
  }, 2000);
</script>`;
}

function injectPreviewAssets(html, projectId, updatedAt) {
  // buildScreenHtml returns a full HTML document, so we inject into it
  // rather than nesting docs (which is invalid HTML).
  html = html.replace('</head>', PREVIEW_STYLE + '\n</head>');
  html = html.replace('</body>', buildReloadScript(projectId, updatedAt) + '\n</body>');
  return html;
}

export function startPreviewServer(port = config.previewPort) {
  const app = express();
  const store = new ProjectStore(config.dataDir);

  app.get('/preview/:projectId/:screenId', async (req, res) => {
    try {
      const project = await store.getProject(req.params.projectId);
      const screen = project.screens.find(s => s.id === req.params.screenId);
      if (!screen) return res.status(404).send('Screen not found');

      const html = injectPreviewAssets(
        buildScreenHtml(screen),
        project.id,
        project.updated_at,
      );
      res.type('html').send(html);
    } catch (err) {
      res.status(500).send('Error: ' + err.message);
    }
  });

  app.get('/api/lastmod/:projectId', async (req, res) => {
    try {
      const project = await store.getProject(req.params.projectId);
      res.json({ updated_at: project.updated_at });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  const server = app.listen(port, () => {
    console.error('[MockupMCP] Preview server: http://localhost:' + port);
  });

  return server;
}
