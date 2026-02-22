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
<\/script>`;

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
  // Redirect to /preview when the project has been deleted (404 response).
  return `
<script>
  let lastMod = '${updatedAt}';
  setInterval(async () => {
    try {
      const r = await fetch('/api/lastmod/${projectId}');
      if (r.status === 404) { window.location.href = '/preview'; return; }
      const data = await r.json();
      if (data.updated_at !== lastMod) location.reload();
    } catch (_) {}
  }, 2000);
<\/script>`;
}

// Sidebar: left panel showing project tree with collapsible navigation.
// Uses mockup-sidebar prefix on all classes to avoid conflicts with mockup content.
const SIDEBAR_CSS = `
<style>
  #mockup-sidebar {
    position: fixed; top: 0; left: 0; bottom: 0; width: 260px;
    background: #f5f5f5; border-right: 1px solid #ddd; z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px; color: #333; overflow-y: auto;
    transition: transform 0.3s ease;
  }
  #mockup-sidebar.collapsed { transform: translateX(-220px); }
  #mockup-sidebar-toggle {
    position: absolute; top: 12px; right: -32px; width: 28px; height: 28px;
    background: #f5f5f5; border: 1px solid #ddd; border-left: none;
    border-radius: 0 4px 4px 0; cursor: pointer; display: flex;
    align-items: center; justify-content: center; font-size: 14px; color: #666;
  }
  #mockup-sidebar-toggle:hover { background: #e8e8e8; }
  #mockup-sidebar h3 {
    margin: 0; padding: 16px 12px 8px; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.5px; color: #999;
  }
  .mockup-sidebar-project { padding: 4px 0; }
  .mockup-sidebar-project-name {
    padding: 6px 12px; font-weight: 600; cursor: pointer; display: flex;
    align-items: center; gap: 6px;
  }
  .mockup-sidebar-project-name:hover { background: #e8e8e8; }
  .mockup-sidebar-project-name .arrow { font-size: 10px; transition: transform 0.2s; }
  .mockup-sidebar-project-name .arrow.open { transform: rotate(90deg); }
  .mockup-sidebar-folder { padding: 2px 0; }
  .mockup-sidebar-folder-name {
    padding: 6px 12px; font-weight: 600; cursor: pointer; display: flex;
    align-items: center; gap: 6px; color: #666;
  }
  .mockup-sidebar-folder-name:hover { background: #e8e8e8; }
  .mockup-sidebar-folder-name .arrow { font-size: 10px; transition: transform 0.2s; }
  .mockup-sidebar-folder-name .arrow.open { transform: rotate(90deg); }
  .mockup-sidebar-screen {
    padding: 5px 12px 5px 28px; cursor: pointer; text-decoration: none;
    display: block; color: #555; border-radius: 4px; margin: 1px 8px;
  }
  .mockup-sidebar-screen:hover { background: #e0e0e0; }
  .mockup-sidebar-screen.active { background: #d0d0ff; color: #333; font-weight: 500; }
  body { margin-left: 260px; transition: margin-left 0.3s; }
  body.sidebar-collapsed { margin-left: 40px; }
  @media (max-width: 768px) {
    #mockup-sidebar { transform: translateX(-260px); }
    #mockup-sidebar.mobile-open { transform: translateX(0); }
    #mockup-sidebar-toggle { right: -36px; }
    body { margin-left: 0; }
    body.sidebar-collapsed { margin-left: 0; }
  }
</style>`;

const SIDEBAR_HTML = `
<div id="mockup-sidebar">
  <button id="mockup-sidebar-toggle" aria-label="Toggle sidebar">&lsaquo;</button>
  <h3>Projects</h3>
  <div id="mockup-sidebar-tree"></div>
</div>`;

// Sidebar client-side JS: fetches project tree from /api/projects, handles
// folder expand/collapse, highlights active screen, auto-refreshes every 3s.
// All HTML is built server-side from trusted data; tree.innerHTML is safe here.
const SIDEBAR_JS = `
<script>
(function() {
  var sidebar = document.getElementById('mockup-sidebar');
  var toggle = document.getElementById('mockup-sidebar-toggle');
  var tree = document.getElementById('mockup-sidebar-tree');
  if (!sidebar) return;

  // expandedNodes tracks both folder paths and project IDs so collapse/expand
  // state survives the periodic 3s re-render without losing user choices.
  var expandedNodes = new Set();
  var collapsed = localStorage.getItem('mockup-sidebar-collapsed') === '1';
  if (collapsed) { sidebar.classList.add('collapsed'); document.body.classList.add('sidebar-collapsed'); toggle.textContent = '\\u203a'; }

  toggle.addEventListener('click', function() {
    var isMobile = window.innerWidth <= 768;
    if (isMobile) {
      sidebar.classList.toggle('mobile-open');
    } else {
      var nowCollapsed = sidebar.classList.toggle('collapsed');
      document.body.classList.toggle('sidebar-collapsed', nowCollapsed);
      toggle.textContent = nowCollapsed ? '\\u203a' : '\\u2039';
      localStorage.setItem('mockup-sidebar-collapsed', nowCollapsed ? '1' : '0');
    }
  });

  function getActivePath() {
    var parts = window.location.pathname.split('/');
    return { projectId: parts[2] || '', screenId: parts[3] || '' };
  }

  function escName(s) { var d = document.createElement('div'); d.textContent = s; return d.textContent; }

  // Walk the tree to find ancestor folder paths for the active project so we
  // can auto-expand them on first load without user interaction.
  function findActiveProjectPath(node, activeProjId) {
    for (var i = 0; i < node.projects.length; i++) {
      if (node.projects[i].id === activeProjId) return [];
    }
    for (var j = 0; j < node.folders.length; j++) {
      var sub = findActiveProjectPath(node.folders[j], activeProjId);
      if (sub !== null) return [node.folders[j].path].concat(sub);
    }
    return null;
  }

  function countProjects(node) {
    var count = node.projects.length;
    for (var i = 0; i < node.folders.length; i++) {
      count += countProjects(node.folders[i]);
    }
    return count;
  }

  function renderNode(node, depth, items, active, singleRoot) {
    // Render folders before projects so hierarchy is visually grouped.
    for (var i = 0; i < node.folders.length; i++) {
      var folder = node.folders[i];
      var isFolderExpanded = expandedNodes.has(folder.path);
      var pad = 12 + depth * 16;
      items.push('<div class="mockup-sidebar-folder">');
      items.push('<div class="mockup-sidebar-folder-name" data-folder-path="' + escName(folder.path) + '" style="padding-left:' + pad + 'px">');
      items.push('<span class="arrow' + (isFolderExpanded ? ' open' : '') + '">\\u25b6<\\/span> ' + escName(folder.name));
      items.push('<\\/div>');
      if (isFolderExpanded) {
        renderNode(folder, depth + 1, items, active, false);
      }
      items.push('<\\/div>');
    }
    for (var j = 0; j < node.projects.length; j++) {
      var proj = node.projects[j];
      var isActiveProj = proj.id === active.projectId;
      var isProjExpanded = isActiveProj || expandedNodes.has(proj.id) || singleRoot;
      var projPad = 12 + depth * 16;
      items.push('<div class="mockup-sidebar-project">');
      items.push('<div class="mockup-sidebar-project-name" data-proj="' + proj.id + '" style="padding-left:' + projPad + 'px">');
      items.push('<span class="arrow' + (isProjExpanded ? ' open' : '') + '">\\u25b6<\\/span> ' + escName(proj.name));
      items.push('<\\/div>');
      if (isProjExpanded) {
        var screenPad = 12 + (depth + 1) * 16;
        for (var k = 0; k < proj.screens.length; k++) {
          var scr = proj.screens[k];
          var cls = scr.id === active.screenId ? ' active' : '';
          items.push('<a class="mockup-sidebar-screen' + cls + '" href="\\/preview\\/' + proj.id + '\\/' + scr.id + '" style="padding-left:' + screenPad + 'px">' + escName(scr.name) + '<\\/a>');
        }
      }
      items.push('<\\/div>');
    }
  }

  function loadTree() {
    fetch('/api/projects').then(function(res) { return res.json(); }).then(function(data) {
      // Read scroll right before DOM write so it reflects the latest position.
      var scrollTop = sidebar.scrollTop;
      var active = getActivePath();

      // Auto-expand folder ancestors of the currently viewed project on load.
      if (active.projectId) {
        var activePath = findActiveProjectPath(data, active.projectId);
        if (activePath) {
          for (var a = 0; a < activePath.length; a++) {
            expandedNodes.add(activePath[a]);
          }
        }
      }

      var totalProjects = countProjects(data);
      var singleRoot = totalProjects === 1;
      var items = [];
      renderNode(data, 0, items, active, singleRoot);
      tree.innerHTML = items.join('');
      sidebar.scrollTop = scrollTop;
    }).catch(function() {});
  }

  tree.addEventListener('click', function(e) {
    var folderName = e.target.closest('.mockup-sidebar-folder-name');
    if (folderName) {
      var folderPath = folderName.dataset.folderPath;
      if (expandedNodes.has(folderPath)) {
        expandedNodes.delete(folderPath);
      } else {
        expandedNodes.add(folderPath);
      }
      loadTree();
      return;
    }
    var projName = e.target.closest('.mockup-sidebar-project-name');
    if (projName) {
      var projId = projName.dataset.proj;
      // Toggle membership in the expanded set, then re-render via loadTree
      // so expand state is consistent with the periodic refresh path.
      if (expandedNodes.has(projId)) {
        expandedNodes.delete(projId);
      } else {
        expandedNodes.add(projId);
      }
      loadTree();
      return;
    }
    var link = e.target.closest('.mockup-sidebar-screen');
    if (!link) return;
    e.preventDefault();
    var href = link.getAttribute('href');
    var parts = href.split('/');
    var projectId = parts[2];
    var screenId = parts[3];
    if (typeof swapScreen === 'function') {
      swapScreen(projectId, screenId, 'push', false);
    } else {
      window.location.href = href;
    }
    tree.querySelectorAll('.mockup-sidebar-screen').forEach(function(s) { s.classList.remove('active'); });
    link.classList.add('active');
  });

  loadTree();
  setInterval(loadTree, 3000);
})();
<\/script>`;

function injectPreviewAssets(html, projectId, updatedAt) {
  // buildScreenHtml returns a full HTML document, so we inject into it
  // rather than nesting docs (which is invalid HTML).
  html = html.replace('</head>', PREVIEW_STYLE + SIDEBAR_CSS + TRANSITION_CSS + '\n</head>');
  html = html.replace('</body>', SIDEBAR_HTML + BACK_BUTTON + LINK_SCRIPT + SIDEBAR_JS + buildReloadScript(projectId, updatedAt) + '\n</body>');
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

// Standalone landing page shown at /preview — gives users an entry point
// with the sidebar already rendered so they can pick a screen to view.
function buildLandingPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MockupMCP Preview</title>
  ${PREVIEW_STYLE}
  ${SIDEBAR_CSS}
</head>
<body>
  ${SIDEBAR_HTML}
  <div style="display:flex;align-items:center;justify-content:center;height:80vh;color:#999;font-family:-apple-system,sans-serif;font-size:18px;">
    Select a screen from the sidebar to preview
  </div>
  ${SIDEBAR_JS}
</body>
</html>`;
}


export function startPreviewServer(port = config.previewPort) {
  const app = express();
  const store = new ProjectStore(config.dataDir);

  // Root redirect and landing page must be registered before the parameterized
  // /preview/:projectId/:screenId route so Express doesn't treat "preview" as a projectId.
  app.get('/', (_req, res) => res.redirect('/preview'));

  app.get('/preview', (_req, res) => {
    res.type('html').send(buildLandingPage());
  });

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
      await projectStore.init();
      const tree = await projectStore.listProjectsTree();
      res.json(tree);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const server = app.listen(port, () => {
    console.error('[MockupMCP] Preview server: http://localhost:' + port);
  });

  return server;
}
