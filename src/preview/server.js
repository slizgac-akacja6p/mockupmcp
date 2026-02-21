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

// CSS keyframe animations for screen-to-screen transitions (push, fade, slide-up).
// Each transition type has forward and reverse variants for back navigation.
const TRANSITION_CSS = `
<style>
  .transition-container {
    position: relative;
    overflow: hidden;
  }
  .screen { transition: none; }

  /* Push — iOS-style slide */
  .trans-push-out { animation: pushOut 300ms ease-in-out forwards; }
  .trans-push-in { animation: pushIn 300ms ease-in-out forwards; }
  .trans-push-back-out { animation: pushBackOut 300ms ease-in-out forwards; }
  .trans-push-back-in { animation: pushBackIn 300ms ease-in-out forwards; }
  @keyframes pushOut { from { transform: translateX(0); } to { transform: translateX(-100%); } }
  @keyframes pushIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes pushBackOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
  @keyframes pushBackIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }

  /* Fade — crossfade */
  .trans-fade-out { animation: fadeOut 300ms ease-in-out forwards; }
  .trans-fade-in { animation: fadeIn 300ms ease-in-out forwards; }
  @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  /* Slide-up — modal-style */
  .trans-slide-up-out { animation: slideUpOut 300ms ease-in-out forwards; }
  .trans-slide-up-in { animation: slideUpIn 300ms ease-in-out forwards; }
  .trans-slide-up-back-out { animation: slideDownOut 300ms ease-in-out forwards; }
  .trans-slide-up-back-in { animation: slideDownIn 300ms ease-in-out forwards; }
  @keyframes slideUpOut { from { transform: translateY(0); } to { transform: translateY(-100%); } }
  @keyframes slideUpIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes slideDownOut { from { transform: translateY(0); } to { transform: translateY(100%); } }
  @keyframes slideDownIn { from { transform: translateY(-100%); } to { transform: translateY(0); } }
</style>`;

// SPA-style navigation: fetch screen fragment, animate transition, swap DOM.
// Uses innerHTML with trusted server-rendered content from our own fragment endpoint.
const LINK_SCRIPT = `
<script>
  let isTransitioning = false;

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-link-to]');
    if (!el || isTransitioning) return;
    e.preventDefault();

    const screenId = el.dataset.linkTo;
    const transition = el.dataset.transition || 'push';
    const currentPath = window.location.pathname;
    const projectId = currentPath.split('/')[2];

    await swapScreen(projectId, screenId, transition, false);
  });

  window.addEventListener('popstate', async (e) => {
    if (!e.state || isTransitioning) return;
    const { projectId, screenId, transition } = e.state;
    await swapScreen(projectId, screenId, transition || 'push', true, true);
  });

  async function swapScreen(projectId, screenId, transition, isBack, skipHistory) {
    isTransitioning = true;
    try {
      const res = await fetch('/api/screen-fragment/' + projectId + '/' + screenId);
      if (!res.ok) { isTransitioning = false; return; }
      const newHtml = await res.text();

      const container = document.querySelector('body');
      const currentScreen = container.querySelector('.screen');
      if (!currentScreen) { isTransitioning = false; return; }

      const template = document.createElement('template');
      template.innerHTML = newHtml;
      const newScreen = template.content.querySelector('.screen');
      if (!newScreen) { isTransitioning = false; return; }

      if (transition === 'none') {
        currentScreen.replaceWith(newScreen);
      } else {
        newScreen.style.position = 'absolute';
        newScreen.style.top = '0';
        newScreen.style.left = currentScreen.offsetLeft + 'px';
        currentScreen.parentNode.style.position = 'relative';
        currentScreen.parentNode.style.overflow = 'hidden';

        const suffix = isBack ? '-back' : '';
        const outClass = transition === 'fade' ? 'trans-fade-out' : ('trans-' + transition + suffix + '-out');
        const inClass = transition === 'fade' ? 'trans-fade-in' : ('trans-' + transition + suffix + '-in');

        currentScreen.parentNode.appendChild(newScreen);
        currentScreen.classList.add(outClass);
        newScreen.classList.add(inClass);

        await new Promise(r => setTimeout(r, 310));

        currentScreen.remove();
        newScreen.classList.remove(inClass);
        newScreen.style.position = '';
      }

      if (!skipHistory) {
        const newUrl = '/preview/' + projectId + '/' + screenId;
        history.pushState({ projectId, screenId, transition }, '', newUrl);
      }

      const modRes = await fetch('/api/lastmod/' + projectId);
      if (modRes.ok) {
        const data = await modRes.json();
        lastMod = data.updated_at;
      }
    } catch (err) {
      console.error('Transition error:', err);
    }
    isTransitioning = false;
  }

  (function() {
    const parts = window.location.pathname.split('/');
    if (parts[1] === 'preview' && parts[2] && parts[3]) {
      history.replaceState({ projectId: parts[2], screenId: parts[3], transition: 'push' }, '');
    }
  })();
</script>`;

// Fixed back button lets designers navigate the flow history without browser chrome.
const BACK_BUTTON = `
<div style="position:fixed;top:10px;left:10px;z-index:9999;">
  <button onclick="history.back()" style="padding:4px 12px;font-size:12px;border:1px solid #999;border-radius:4px;background:#fff;cursor:pointer;opacity:0.8;">
    Back
  </button>
</div>`;

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
  html = html.replace('</head>', PREVIEW_STYLE + TRANSITION_CSS + '\n</head>');
  html = html.replace('</body>', BACK_BUTTON + LINK_SCRIPT + buildReloadScript(projectId, updatedAt) + '\n</body>');
  return html;
}

// Extracts the <body> content from a full HTML document so the SPA transition
// layer can swap screen content without replacing the whole document (avoids
// re-running scripts and losing scroll position on each navigation).
function buildScreenFragment(screen, style) {
  const fullHtml = buildScreenHtml(screen, style);
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return '';
  return bodyMatch[1].trim();
}

export function startPreviewServer(port = config.previewPort) {
  const app = express();
  const store = new ProjectStore(config.dataDir);

  app.get('/preview/:projectId/:screenId', async (req, res) => {
    try {
      const project = await store.getProject(req.params.projectId);
      const screen = project.screens.find(s => s.id === req.params.screenId);
      if (!screen) return res.status(404).send('Screen not found');

      // Screen-level style overrides project default; both fall back to wireframe
      const style = screen.style || project.style || 'wireframe';
      const html = injectPreviewAssets(
        buildScreenHtml(screen, style),
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

  // Returns only the screen body content so the SPA transition layer can
  // swap .screen divs in-place without a full page reload (used by Task 8).
  app.get('/api/screen-fragment/:projectId/:screenId', async (req, res) => {
    try {
      const project = await store.getProject(req.params.projectId);
      const screen = project.screens.find(s => s.id === req.params.screenId);
      if (!screen) return res.status(404).send('Screen not found');

      const style = screen.style || project.style || 'wireframe';
      const fragment = buildScreenFragment(screen, style);
      res.type('html').send(fragment);
    } catch (err) {
      res.status(500).send('Error: ' + err.message);
    }
  });

  // Read config.dataDir at request time so tests can swap data directories
  // between requests without restarting the server.
  app.get('/api/projects', async (_req, res) => {
    try {
      const projectStore = new ProjectStore(config.dataDir);
      const projects = await projectStore.listProjects();
      const result = [];
      for (const proj of projects) {
        const full = await projectStore.getProject(proj.id);
        result.push({
          id: full.id,
          name: full.name,
          style: full.style,
          screens: (full.screens || []).map(s => ({ id: s.id, name: s.name })),
        });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const server = app.listen(port, () => {
    console.error('[MockupMCP] Preview server: http://localhost:' + port);
  });

  return server;
}
