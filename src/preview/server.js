import express from 'express';
import { fileURLToPath } from 'url';
import { dirname as pathDirname, join as pathJoin } from 'path';
import { ProjectStore } from '../storage/project-store.js';
import { buildScreenHtml } from '../renderer/html-builder.js';
import { loadStyle } from '../renderer/styles/index.js';
import { getAvailableTypes, getComponent } from '../renderer/components/index.js';
import { config } from '../config.js';

// Centered background styling injected into every preview page so the mockup
// renders on a neutral canvas without modifying the stored screen data.
// Layout mirrors the editor canvas: gray background, centered screen with shadow.
// Sidebar margin-left comes from SIDEBAR_CSS (260px / 40px collapsed).
const PREVIEW_STYLE = `
<style>
  html { background: #e8e8e8; min-height: 100vh; }
  body {
    display: flex; justify-content: center; align-items: flex-start;
    width: auto !important; height: auto !important;
    margin-left: 260px; margin-right: 24px;
    padding: 68px 24px 20px;
    min-height: calc(100vh - 68px);
    overflow-x: hidden;
    overflow: visible !important;
  }
  body.sidebar-collapsed { margin-left: 40px; }
  .screen { box-shadow: 0 4px 16px rgba(0,0,0,0.18); }
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
    // Safety timeout: if isTransitioning gets stuck (e.g. due to a JS engine
    // quirk or a future code change that bypasses the finally block), reset it
    // after 500ms so subsequent clicks are not permanently dropped.
    if (!el || isTransitioning) {
      if (isTransitioning) setTimeout(() => { isTransitioning = false; }, 500);
      return;
    }
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
      if (!res.ok) { return; }
      const newHtml = await res.text();

      const container = document.querySelector('body');
      const currentScreen = container.querySelector('.screen');
      if (!currentScreen) { return; }

      const template = document.createElement('template');
      template.innerHTML = newHtml;
      const newScreen = template.content.querySelector('.screen');
      if (!newScreen) { return; }

      if (transition === 'none') {
        currentScreen.replaceWith(newScreen);
      } else {
        const suffix = isBack ? '-back' : '';
        const outClass = transition === 'fade' ? 'trans-fade-out' : ('trans-' + transition + suffix + '-out');
        const inClass = transition === 'fade' ? 'trans-fade-in' : ('trans-' + transition + suffix + '-in');

        // Wrapper div replaces body-as-container to avoid PREVIEW_STYLE
        // overflow:visible !important overriding JS-set overflow:hidden,
        // and to eliminate the body padding offset bug in Safari.
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'width:' + currentScreen.offsetWidth + 'px;height:' + currentScreen.offsetHeight + 'px;position:relative;overflow:hidden;flex-shrink:0;';
        currentScreen.parentNode.insertBefore(wrapper, currentScreen);
        wrapper.appendChild(currentScreen);

        // Capture original position before overriding for animation — html-builder.js
        // sets position:relative inline, clearing to '' would leave position:static which
        // breaks absolute children in Safari (they escape to viewport).
        const savedPosition = newScreen.style.position || 'relative';
        newScreen.style.position = 'absolute';
        newScreen.style.top = '0';
        newScreen.style.left = '0';
        wrapper.appendChild(newScreen);

        currentScreen.classList.add(outClass);
        newScreen.classList.add(inClass);

        await new Promise(r => setTimeout(r, 310));

        currentScreen.remove();
        newScreen.classList.remove(inClass);

        // Move newScreen back into normal flex flow where wrapper was.
        wrapper.parentNode.insertBefore(newScreen, wrapper);
        wrapper.remove();

        newScreen.style.position = savedPosition;
        newScreen.style.left = '';
        newScreen.style.top = '';
      }

      // Bug A: update toolbar title to reflect the newly loaded screen.
      // Screen name comes from the sidebar anchor text for the destination
      // screen — avoids an extra API call while staying accurate.
      const toolbarName = document.querySelector('#preview-toolbar .screen-name');
      if (toolbarName) {
        const sidebarLink = document.querySelector('.mockup-sidebar-screen[href$="/' + screenId + '"]');
        if (sidebarLink) toolbarName.textContent = sidebarLink.textContent.trim();
      }
      // Keep toolbar data-screen-id in sync so zoom localStorage key is correct.
      const toolbar = document.getElementById('preview-toolbar');
      if (toolbar) toolbar.dataset.screenId = screenId;

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
    } finally {
      // Bug B: use finally so isTransitioning is always cleared even when an
      // early return or unexpected exception short-circuits normal control flow.
      // A stuck true value silently drops all subsequent sidebar clicks.
      isTransitioning = false;
    }
  }

  (function() {
    const parts = window.location.pathname.split('/');
    if (parts[1] === 'preview' && parts[2] && parts[3]) {
      history.replaceState({ projectId: parts[2], screenId: parts[3], transition: 'push' }, '');
    }
  })();
<\/script>`;

// Shared zoom CSS injected into both preview and editor pages.
// Zoom is applied via transform:scale so the mockup layout is unaffected.
const ZOOM_CSS = `
<style>
  .zoom-controls {
    display: flex; align-items: center; gap: 2px;
  }
  .zoom-btn {
    width: 26px; height: 26px; border: 1px solid #dee2e6; border-radius: 4px;
    background: #fff; cursor: pointer; font-size: 14px; font-weight: 600;
    color: #495057; display: flex; align-items: center; justify-content: center;
    transition: background 0.1s; padding: 0; line-height: 1;
  }
  .zoom-btn:hover { background: #e9ecef; }
  .zoom-level {
    min-width: 38px; text-align: center; font-size: 12px; font-weight: 500;
    color: #495057; padding: 0 2px;
  }
  /* Preview toolbar — matches editor toolbar style */
  #preview-toolbar {
    position: fixed; top: 0; left: 260px; right: 0; height: 48px; z-index: 9999;
    background: #f8f9fa; border-bottom: 1px solid #dee2e6;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    display: flex; align-items: center; padding: 0 16px; gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px;
    transition: left 0.3s;
  }
  #preview-toolbar .back-btn {
    padding: 5px 10px; font-size: 12px; font-weight: 500;
    border: 1px solid #dee2e6; border-radius: 5px;
    background: #fff; color: #495057; cursor: pointer;
    text-decoration: none; display: flex; align-items: center; gap: 4px;
    transition: background 0.1s;
  }
  #preview-toolbar .back-btn:hover { background: #e9ecef; }
  #preview-toolbar .screen-name {
    font-weight: 600; font-size: 14px; flex: 1; color: #212529;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  #preview-toolbar a.edit-link {
    padding: 6px 14px; font-size: 12px; font-weight: 500;
    border: none; border-radius: 5px;
    background: #4A90D9; color: #fff; text-decoration: none;
    transition: background 0.15s; white-space: nowrap;
  }
  #preview-toolbar a.edit-link:hover { background: #3a7bc8; }
  body.sidebar-collapsed #preview-toolbar { left: 40px; }
  @media (max-width: 768px) { #preview-toolbar { left: 0; } }
</style>`;

// Shared zoom JS injected into both preview and editor pages.
// Reads screen id from data-screen-id on the toolbar or canvas element and
// persists the chosen zoom level in localStorage so it survives page reloads.
const ZOOM_JS = `
<script>
(function() {
  var ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
  var currentZoomIndex = 3; // default 100%

  function getScreenId() {
    var el = document.getElementById('preview-toolbar') || document.getElementById('editor-canvas');
    return el ? (el.dataset.screenId || '') : '';
  }

  function applyZoom(scale) {
    var screen = document.querySelector('.screen');
    if (!screen) return;
    // Bug C: clear any leftover inline position/overflow that the SPA transition
    // animation sets on body. If not cleared before applying transform:scale the
    // body stays in relative/hidden state and the scaled .screen bleeds outside
    // its container as a white rectangle.
    document.body.style.position = '';
    document.body.style.overflow = '';
    screen.style.overflow = 'hidden';
    screen.style.transform = 'scale(' + scale + ')';
    screen.style.transformOrigin = 'top center';
    var lvlEl = document.querySelector('.zoom-level');
    if (lvlEl) lvlEl.textContent = Math.round(scale * 100) + '%';
    var sid = getScreenId();
    if (sid) localStorage.setItem('mockup-zoom-' + sid, String(scale));
  }

  function fitToScreen() {
    var screen = document.querySelector('.screen');
    if (!screen) return;

    // Determine available canvas dimensions based on active layout mode.
    // Both editor and preview reserve 320px right margin for consistent layout.
    // Editor shows the property panel there; preview keeps the space empty.
    var sidebar = document.getElementById('mockup-sidebar');
    var sidebarW = (sidebar && sidebar.classList.contains('collapsed')) ? 40 : 260;
    var toolbarH = 48;
    var panelEl = document.getElementById("property-panel") || document.querySelector(".property-panel"); var panelW = panelEl ? panelEl.offsetWidth : 0;
    var padW = 48;  // horizontal padding inside the canvas area
    var padH = 40;  // vertical padding below toolbar

    // On mobile the sidebar is off-screen, so don't subtract its width.
    if (window.innerWidth <= 768) sidebarW = 0;

    var availW = window.innerWidth - sidebarW - panelW - padW;
    var availH = window.innerHeight - toolbarH - padH;

    // Read the screen's intrinsic (un-scaled) dimensions from inline style so
    // the calculation is independent of the current transform value.
    var screenW = parseInt(screen.style.width, 10) || screen.offsetWidth || 390;
    var screenH = parseInt(screen.style.height, 10) || screen.offsetHeight || 844;

    // Fit both axes — use the more constraining dimension.
    var scale = Math.min(availW / screenW, availH / screenH);
    scale = Math.max(0.1, Math.min(scale, 3));

    // Same body cleanup as applyZoom — fitToScreen can also be called right
    // after a transition that left position/overflow set on body.
    document.body.style.position = '';
    document.body.style.overflow = '';
    screen.style.overflow = 'hidden';
    var lvlEl = document.querySelector('.zoom-level');
    if (lvlEl) lvlEl.textContent = Math.round(scale * 100) + '%';
    screen.style.transform = 'scale(' + scale + ')';
    screen.style.transformOrigin = 'top center';
    var sid = getScreenId();
    if (sid) localStorage.setItem('mockup-zoom-' + sid, String(scale));
  }

  function init() {
    var sid = getScreenId();
    var saved = sid ? localStorage.getItem('mockup-zoom-' + sid) : null;
    if (saved) {
      var savedScale = parseFloat(saved);
      if (!isNaN(savedScale)) {
        var idx = ZOOM_LEVELS.indexOf(savedScale);
        if (idx !== -1) currentZoomIndex = idx;
        applyZoom(savedScale);
      }
    }

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.zoom-btn');
      if (!btn) return;
      var action = btn.dataset.zoom;
      if (action === 'in') {
        currentZoomIndex = Math.min(currentZoomIndex + 1, ZOOM_LEVELS.length - 1);
        applyZoom(ZOOM_LEVELS[currentZoomIndex]);
      } else if (action === 'out') {
        currentZoomIndex = Math.max(currentZoomIndex - 1, 0);
        applyZoom(ZOOM_LEVELS[currentZoomIndex]);
      } else if (action === 'fit') {
        fitToScreen();
      }
    });
  }

  // Run after DOM is ready — may already be ready if deferred.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
<\/script>`;

// Zoom controls HTML snippet — embedded in both preview and editor toolbars.
const ZOOM_CONTROLS_HTML = `<div class="zoom-controls">
    <button class="zoom-btn" data-zoom="out" title="Zoom out">&minus;</button>
    <span class="zoom-level">100%</span>
    <button class="zoom-btn" data-zoom="in" title="Zoom in">+</button>
    <button class="zoom-btn" style="min-width:32px;font-size:11px;" data-zoom="fit" title="Fit to width">Fit</button>
  </div>`;

// Preview toolbar replaces the old scattered BACK_BUTTON + buildEditButton overlay.
// Styled to match the editor toolbar for visual consistency between modes.
function buildPreviewToolbar(projectId, screenId, screenName) {
  return `
<div id="preview-toolbar" data-screen-id="${screenId}">
  <button class="back-btn" onclick="history.back()">&#8592; Back</button>
  <span class="screen-name">${screenName}</span>
  ${ZOOM_CONTROLS_HTML}
  <a class="edit-link" href="/editor/${projectId}/${screenId}">Edit</a>
</div>`;
}

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
    background: #f5f5f5; border-right: 1px solid #ddd; z-index: 9990;
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
  .mockup-sidebar-screen.active { background: #d0e3f5; color: #1a5a9e; font-weight: 500; }
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

  // In editor mode screen links must stay within the editor — /editor/:pid/:sid.
  // In all other contexts (preview, landing) use /preview/:pid/:sid.
  var pathPrefix = window.location.pathname.startsWith('/editor') ? '/editor/' : '/preview/';

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
          items.push('<a class="mockup-sidebar-screen' + cls + '" href="' + pathPrefix + proj.id + '\\/' + scr.id + '" style="padding-left:' + screenPad + 'px">' + escName(scr.name) + '<\\/a>');
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

// Returns an "Edit" button overlay injected into preview pages so designers
// can jump directly from preview to the editor for the same screen.
function buildEditButton(projectId, screenId) {
  return `
<div style="position:fixed;top:10px;right:10px;z-index:9999;">
  <a href="/editor/${projectId}/${screenId}" style="padding:4px 12px;font-size:12px;border:1px solid #999;border-radius:4px;background:#fff;cursor:pointer;opacity:0.8;text-decoration:none;color:#333;">
    Edit
  </a>
</div>`;
}

// Editor CSS: three-column layout (sidebar | canvas | property panel) with a
// fixed toolbar. Uses editor- prefix to avoid clashing with mockup content styles.
// Override SIDEBAR_CSS body rule so sidebar + toolbar + panel all cooperate in
// the three-column layout (sidebar is already accounted for via margin-left on canvas/toolbar).
const EDITOR_CSS = `
<style>
  /* Reset the sidebar's body margin — editor layout manages offsets explicitly */
  body { margin: 0 !important; }

  #editor-toolbar {
    position: fixed; top: 0; left: 260px; right: 380px; height: 48px; z-index: 9999;
    background: #f8f9fa; border-bottom: 1px solid #dee2e6;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    display: flex; align-items: center; padding: 0 16px; gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px;
  }
  #editor-toolbar .screen-name {
    font-weight: 600; font-size: 14px; flex: 1; color: #212529;
  }
  #editor-toolbar .edit-mode-badge {
    font-size: 10px; font-weight: 500; color: #6c757d;
    background: #e9ecef; border-radius: 3px; padding: 2px 6px;
    text-transform: uppercase; letter-spacing: 0.4px;
  }
  #editor-toolbar a.preview-link {
    padding: 6px 14px; font-size: 12px; font-weight: 500;
    border: none; border-radius: 5px;
    background: #4A90D9; color: #fff; text-decoration: none;
    transition: background 0.15s;
  }
  #editor-toolbar a.preview-link:hover { background: #3a7bc8; }

  #editor-canvas {
    position: relative;  /* anchor for absolute-positioned resize handles */
    /* Do NOT set overflow:hidden — selection outlines and drag handles extend
       beyond the screen boundary and must not be clipped by the canvas. */
    /* Offset for sidebar (260px) and property panel (280px) */
    margin-left: 260px; margin-right: 380px; margin-top: 48px;
    min-height: calc(100vh - 48px);
    display: flex; align-items: flex-start; justify-content: center; padding: 20px 24px;
    background: #e8e8e8;
  }
  /* Screen shadow matches preview mode — makes the mockup pop against the canvas.
     overflow:visible lets selection outlines and resize handles bleed outside. */
  #editor-canvas .screen { box-shadow: 0 4px 16px rgba(0,0,0,0.18); overflow: visible !important; }

  #editor-property-panel {
    position: fixed; top: 48px; right: 0; bottom: 0; width: 380px;
    background: #fff; border-left: 1px solid #e0e0e0;
    box-shadow: -4px 0 12px rgba(0,0,0,0.06);
    z-index: 9998;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px;
    overflow-y: auto;
  }
  #editor-property-panel .panel-header {
    padding: 16px 24px 12px; border-bottom: 1px solid #dee2e6; margin-bottom: 0;
    font-size: 13px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; color: #495057; background: #f8f9fa;
    position: sticky; top: 0; z-index: 1;
  }
  #editor-property-panel .panel-body { padding: 16px 24px 24px; }
  #editor-property-panel .panel-placeholder {
    color: #adb5bd; font-size: 12px; text-align: center; margin-top: 24px; line-height: 1.5;
  }
  .panel-group { margin-bottom: 16px; }
  .panel-group-title {
    font-size: 13px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.3px; color: #343a40;
    padding: 14px 0 8px; border-top: 1px solid #e9ecef; margin-top: 4px;
  }
  .panel-group:first-child .panel-group-title { border-top: none; margin-top: 0; }
  .panel-field { margin-bottom: 10px; }
  .panel-field label {
    display: block; font-size: 12px; color: #6c757d; margin-bottom: 4px;
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
  }
  .panel-field input[type="number"],
  .panel-field input[type="text"],
  .panel-field input[type="color"],
  .panel-field select {
    width: 100%; padding: 10px 12px; border: 1px solid #dee2e6; border-radius: 6px;
    font-size: 14px; box-sizing: border-box; background: #fff;
    transition: border-color 0.15s;
  }
  .panel-field input:focus, .panel-field select:focus {
    border-color: #4A90D9; outline: none; box-shadow: 0 0 0 2px rgba(74,144,217,0.15);
  }
  .panel-field input:disabled {
    background: #f8f9fa; color: #868e96;
  }
  /* Single-column layout for position fields — 2-column grid overflows the
     280px panel because each cell must fit a label + slider + number input. */
  .panel-position-grid {
    display: flex; flex-direction: column; gap: 12px;
  }
  .panel-position-grid .panel-field { margin-bottom: 0; }
  /* Hide default browser number spinners — inputs are large enough to type into */
  .panel-field input[type="number"] { -moz-appearance: textfield; }
  .panel-field input[type="number"]::-webkit-inner-spin-button,
  .panel-field input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none; margin: 0;
  }
  /* Header row: label on left, number input on right */
  .panel-field-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 4px;
  }
  .panel-field-header label { margin-bottom: 0; }
  .panel-field-header input[type="number"] {
    width: 80px; text-align: right; padding: 6px 10px;
    border: 1px solid #dee2e6; border-radius: 6px;
    font-size: 14px; font-weight: 500; background: #fff;
  }
  /* Slider below the header — stretches full panel width */
  .panel-range-combo {
    display: flex; flex-direction: column; gap: 4px;
  }
  .panel-range-combo input[type="range"] {
    width: 100%; height: 4px; -webkit-appearance: none; appearance: none;
    background: #dee2e6; border-radius: 2px; outline: none;
  }
  .panel-range-combo input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px;
    border-radius: 50%; background: #4A90D9; cursor: pointer;
    border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  }
  .element.selected { outline: 2px solid #4A90D9 !important; outline-offset: 1px; }

  /* Editor toolbar action buttons (undo, redo, grid toggle) */
  .toolbar-separator {
    width: 1px; height: 24px; background: #dee2e6;
  }
  .toolbar-btn {
    width: 32px; height: 32px; border: 1px solid #dee2e6; border-radius: 4px;
    background: #fff; cursor: pointer; font-size: 16px; color: #495057;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, border-color 0.15s;
    padding: 0;
  }
  .toolbar-btn:hover:not(:disabled) { background: #e9ecef; border-color: #adb5bd; }
  .toolbar-btn:disabled { opacity: 0.4; cursor: default; }
  .toolbar-btn-active { background: #e8f0fa; border-color: #a3c4e6; color: #2a6db5; }

  body.sidebar-collapsed #editor-toolbar { left: 40px; }
  body.sidebar-collapsed #editor-canvas { margin-left: 40px; }
</style>`;

// Build the component metadata blob that the editor's component-meta.js reads
// from window.__COMPONENT_META__. Pre-computing this avoids a browser-side
// import of server-only renderer modules (which would 404 in the browser).
function buildComponentMetaJson() {
  const types = getAvailableTypes();
  const defaults = {};
  for (const t of types) {
    const comp = getComponent(t);
    if (comp && typeof comp.defaults === 'function') {
      defaults[t] = comp.defaults();
    }
  }
  return JSON.stringify({ types, defaults });
}

// Full editor page layout: sidebar | palette | canvas (with rendered screen) | property panel.
// screenHtml is the raw fragment content (from buildScreenFragment) — not a full doc.
// style param injects component-specific CSS so element styles (borders, etc.) render
// correctly inside the editor canvas, matching what preview/screenshot produce.
// Palette sidebar shows recent components + search + categories. ADD_MODE shows when
// user presses shortcut to add element. Multi-select toolbar appears when >1 element selected.
function buildEditorPage(screenHtml, projectId, screenId, projectName, screenName, style = 'wireframe') {
  const componentMetaJson = buildComponentMetaJson();
  // Component styles must come before EDITOR_CSS so editor rules can override them.
  const componentStyle = `<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .element > *:first-child { width: 100% !important; height: 100% !important; box-sizing: border-box; }
  ${loadStyle(style)}
</style>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${screenName} — Editor</title>
  ${SIDEBAR_CSS}
  ${componentStyle}
  ${EDITOR_CSS}
  ${ZOOM_CSS}
  <style>
    #editor-palette {
      width: 220px;
      min-width: 220px;
      background: #1e1e1e;
      border-right: 1px solid #333;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 8px 0;
      font-size: 12px;
      color: #ccc;
    }
    .palette-section-title { padding: 4px 12px; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .palette-recent-items { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 8px; }
    .palette-recent-chip { background: #2a2a2a; border: 1px solid #444; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 11px; }
    .palette-recent-chip:hover, .palette-recent-chip.active { background: #3b82f6; color: white; border-color: #3b82f6; }
    .palette-search { padding: 8px; }
    .palette-search input { width: 100%; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; padding: 4px 8px; color: #ccc; font-size: 11px; box-sizing: border-box; }
    .palette-category { margin-bottom: 4px; }
    .palette-category-header { padding: 6px 12px 3px; color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; user-select: none; }
    .palette-category-header:hover { color: #ccc; }
    .palette-items { padding: 0 8px; }
    .palette-item { padding: 5px 8px; border-radius: 4px; cursor: pointer; color: #bbb; display: flex; align-items: center; gap: 6px; }
    .palette-item:hover { background: #2a2a2a; color: #fff; }
    .palette-item.add-mode-active { background: #3b82f6; color: white; }
    .palette-shortcuts-hint { padding: 8px 12px; color: #555; font-size: 10px; border-top: 1px solid #333; margin-top: auto; }
    #multi-select-toolbar { display: none; gap: 4px; align-items: center; }
    .toolbar-btn-danger { background: #dc2626 !important; color: white !important; border-color: #dc2626 !important; }
    .toolbar-badge { padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
    .toolbar-badge-add { background: #f59e0b; color: #1a1a1a; }
    .box-select-overlay { position: absolute; pointer-events: none; }
    .element-selected-multi { outline: 2px solid #3b82f6 !important; outline-offset: 1px; }
    .toast { background: #333; color: #fff; padding: 8px 14px; border-radius: 6px; margin-top: 8px; font-size: 12px; animation: fadeInOut 2.5s forwards; }
    @keyframes fadeInOut { 0%{opacity:0;transform:translateY(8px)} 10%{opacity:1;transform:translateY(0)} 80%{opacity:1} 100%{opacity:0} }
  </style>
</head>
<body>
  ${SIDEBAR_HTML}
  <div id="editor-toolbar">
    <span class="screen-name">${screenName}</span>
    <span class="edit-mode-badge">Edit mode</span>
    <div class="toolbar-separator"></div>
    <button id="btn-undo" class="toolbar-btn" title="Undo (Cmd+Z)" disabled>&#8630;</button>
    <button id="btn-redo" class="toolbar-btn" title="Redo (Cmd+Shift+Z)" disabled>&#8631;</button>
    <div class="toolbar-separator"></div>
    <button id="btn-grid" class="toolbar-btn toolbar-btn-active" title="Snap to grid (8px)">&#8862;</button>
    <div id="add-mode-badge" style="display:none" class="toolbar-badge toolbar-badge-add">
      ADD MODE: <span id="add-mode-label"></span> · Esc to cancel
    </div>
    <div id="multi-select-toolbar" style="display:none">
      <button id="btn-delete-selected" class="toolbar-btn toolbar-btn-danger">Delete (<span id="multi-select-count">0</span>)</button>
    </div>
    ${ZOOM_CONTROLS_HTML}
    <a class="preview-link" href="/preview/${projectId}/${screenId}">Preview</a>
  </div>
  <div style="display: flex; flex: 1; margin-top: 48px;">
    <div id="editor-palette">
      <div class="palette-recent" id="palette-recent" style="display:none">
        <div class="palette-section-title">RECENT</div>
        <div class="palette-recent-items" id="palette-recent-items"></div>
      </div>
      <div class="palette-search">
        <input type="text" id="palette-search-input" placeholder="Search components..." />
      </div>
      <div id="palette-categories"></div>
      <div class="palette-shortcuts-hint">B=Btn I=Input C=Card T=Text R=Rect · Esc=Cancel</div>
    </div>
    <div id="editor-canvas" data-project-id="${projectId}" data-screen-id="${screenId}">
      ${screenHtml}
    </div>
  </div>
  <div id="editor-property-panel">
    <div class="panel-header">Properties</div>
    <div class="panel-body">
      <p class="panel-placeholder">Click an element to edit its properties</p>
    </div>
  </div>
  <div id="toast-container" style="position:fixed;bottom:20px;right:20px;z-index:9999"></div>
  ${SIDEBAR_JS}
  ${ZOOM_JS}
  <script>window.__COMPONENT_META__ = ${componentMetaJson};</script>
  <script type="module">
    import { initEditor } from '/editor/js/editor.js';
    const canvas = document.getElementById('editor-canvas');
    const panel = document.getElementById('editor-property-panel');
    initEditor({
      projectId: canvas.dataset.projectId,
      screenId: canvas.dataset.screenId,
      canvas,
      panel,
    });
  </script>
</body>
</html>`;
}

function injectPreviewAssets(html, projectId, screenId, updatedAt, screenName) {
  // buildScreenHtml returns a full HTML document, so we inject into it
  // rather than nesting docs (which is invalid HTML).
  html = html.replace('</head>', PREVIEW_STYLE + SIDEBAR_CSS + ZOOM_CSS + TRANSITION_CSS + '\n</head>');
  html = html.replace('</body>',
    SIDEBAR_HTML +
    buildPreviewToolbar(projectId, screenId, screenName) +
    LINK_SCRIPT +
    SIDEBAR_JS +
    buildReloadScript(projectId, updatedAt) +
    ZOOM_JS +
    '\n</body>',
  );
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

  // Parse JSON bodies for PATCH/POST mutation endpoints.
  app.use(express.json());

  // Static JS modules for the editor — registered BEFORE /editor/:pid/:sid so
  // Express doesn't interpret the literal segment 'js' as a projectId.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = pathDirname(__filename);
  app.use('/editor/js', express.static(pathJoin(__dirname, 'editor')));

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
        screen.id,
        project.updated_at,
        screen.name,
      );
      res.type('html').send(html);
    } catch (err) {
      res.status(500).send('Error: ' + err.message);
    }
  });

  app.get('/editor/:projectId/:screenId', async (req, res) => {
    try {
      const project = await store.getProject(req.params.projectId);
      const screen = project.screens.find(s => s.id === req.params.screenId);
      if (!screen) return res.status(404).send('Screen not found');

      const style = screen.style || project.style || 'wireframe';
      const fragment = buildScreenFragment(screen, style);
      const html = buildEditorPage(fragment, project.id, screen.id, project.name, screen.name, style);
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

  app.get('/api/projects', async (_req, res) => {
    try {
      // Rebuild index on each listing request so the sidebar reflects files
      // added or moved outside the store since the server started.
      await store.init();
      const tree = await store.listProjectsTree();
      res.json(tree);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Editor data endpoints — parameterized routes registered after the bare
  // /api/projects route so Express does not interpret "projects" as a projectId.
  app.get('/api/projects/:projectId', async (req, res) => {
    try {
      const project = await store.getProject(req.params.projectId);
      res.json(project);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  app.get('/api/projects/:projectId/screens/:screenId', async (req, res) => {
    try {
      const project = await store.getProject(req.params.projectId);
      const screen = project.screens.find(s => s.id === req.params.screenId);
      if (!screen) return res.status(404).json({ error: 'Screen not found' });
      res.json(screen);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // PATCH /api/projects/:projectId/screens/:screenId
  // Updates allowed screen fields (name, background, width, height, style).
  app.patch('/api/projects/:projectId/screens/:screenId', async (req, res) => {
    try {
      const project = await store.getProject(req.params.projectId);
      const screen = project.screens.find(s => s.id === req.params.screenId);
      if (!screen) return res.status(404).json({ error: 'Screen not found' });

      const { name, background, width, height, style } = req.body;
      if (name !== undefined) screen.name = name;
      if (background !== undefined) screen.background = background;
      if (width !== undefined) screen.width = width;
      if (height !== undefined) screen.height = height;
      if (style !== undefined) screen.style = style;

      await store._save(project);
      res.json(screen);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // PATCH /api/projects/:projectId/screens/:screenId/elements/:elementId
  // Applies positional update (moveElement) and/or properties update (updateElement).
  app.patch('/api/projects/:projectId/screens/:screenId/elements/:elementId', async (req, res) => {
    const { projectId, screenId, elementId } = req.params;
    const { x, y, width, height, z_index, properties } = req.body;
    try {
      const hasPositional = [x, y, width, height, z_index].some(v => v !== undefined);
      if (hasPositional) {
        await store.moveElement(projectId, screenId, elementId, x, y, width, height, z_index);
      }
      if (properties !== undefined) {
        await store.updateElement(projectId, screenId, elementId, properties);
      }

      // Return the current element state after all mutations.
      const elements = await store.listElements(projectId, screenId);
      const element = elements.find(e => e.id === elementId);
      if (!element) return res.status(404).json({ error: 'Element not found' });
      res.json(element);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // POST /api/projects/:projectId/screens/:screenId/elements
  // Creates a new element; `type` is required, all positional fields default to 0.
  app.post('/api/projects/:projectId/screens/:screenId/elements', async (req, res) => {
    const { projectId, screenId } = req.params;
    const { type, x = 0, y = 0, width = 100, height = 40, properties = {}, z_index = 0 } = req.body;

    if (!type) return res.status(400).json({ error: 'type is required' });

    try {
      const element = await store.addElement(projectId, screenId, type, x, y, width, height, properties, z_index);
      res.status(201).json(element);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // DELETE /api/projects/:projectId/screens/:screenId/elements/:elementId
  // Removes element; returns 204 on success, 404 if not found.
  app.delete('/api/projects/:projectId/screens/:screenId/elements/:elementId', async (req, res) => {
    const { projectId, screenId, elementId } = req.params;
    try {
      await store.deleteElement(projectId, screenId, elementId);
      res.status(204).end();
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  const server = app.listen(port, () => {
    console.error('[MockupMCP] Preview server: http://localhost:' + port);
  });

  return server;
}
