// Main editor controller — orchestrates selection, property panel, drag,
// resize, undo/redo history, keyboard shortcuts, and screen re-rendering.
//
// Pure logic functions (computeScreenHash, createEditorState) are exported and
// decoupled from the DOM so they can be tested in Node.js without a browser.
// initEditor() is the single DOM-aware entry point and is only called at runtime.

import { createSelectionState, findElementInScreen, initSelection, initBoxSelect } from './selection.js';
import { buildFieldDefinitions, buildUpdatePayload, renderPanelHtml, initPropertyPanel } from './property-panel.js';
import { loadComponentMeta } from './component-meta.js';
import { initDrag } from './drag.js';
import { initResize } from './resize.js';
import { findAlignmentGuides, createGuideRenderer } from './guides.js';
import { createHistory, invertOperation } from './history.js';
import { initShortcuts } from './shortcuts.js';
import { initPalette, exitPaletteAddMode } from './palette.js';
import * as api from './api-client.js';

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

/**
 * Compute a djb2-style integer hash of the serialised screen data and return
 * it as a string. Used to detect whether the server-side data has changed
 * since the last fetch without doing a deep-equal comparison.
 *
 * @param {object} screenData
 * @returns {string}
 */
export function computeScreenHash(screenData) {
  const str = JSON.stringify(screenData);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // force 32-bit integer
  }
  return String(hash);
}

// ---------------------------------------------------------------------------
// Editor state
// ---------------------------------------------------------------------------

/**
 * Create a state container for a single editor session.
 * Owns the cached screen data and its change-detection hash.
 *
 * @param {string} projectId
 * @param {string} screenId
 * @returns {{
 *   projectId: string,
 *   screenId: string,
 *   setScreenData: (data: object) => void,
 *   getScreenData: () => object|null,
 *   getHash: () => string|null,
 *   hasChanged: (newData: object) => boolean,
 * }}
 */
export function createEditorState(projectId, screenId) {
  let screenData = null;
  let currentHash = null;

  return {
    projectId,
    screenId,

    setScreenData(data) {
      screenData = data;
      currentHash = computeScreenHash(data);
    },

    getScreenData() {
      return screenData;
    },

    getHash() {
      return currentHash;
    },

    // Returns true when newData differs from the last stored snapshot.
    // Allows the polling loop to skip unnecessary re-renders.
    hasChanged(newData) {
      return computeScreenHash(newData) !== currentHash;
    },
  };
}

// ---------------------------------------------------------------------------
// DOM initialisation (browser-only)
// ---------------------------------------------------------------------------

/**
 * Bootstrap the in-browser editor for a single screen.
 *
 * Responsibilities:
 * - Loads initial screen data from the API.
 * - Wires up element selection -> property panel population.
 * - Saves property-panel changes back via PATCH and triggers a re-render.
 * - Drag & drop for repositioning selected elements.
 * - Resize handles on selected elements.
 * - Undo/redo history with keyboard shortcuts and toolbar buttons.
 * - Keyboard shortcuts for nudge, delete, undo/redo.
 * - Polls every 3 s for external changes (e.g. AI tool updates) and
 *   refreshes the canvas when a change is detected.
 *
 * @param {{ projectId: string, screenId: string, canvas: Element, panel: Element }} opts
 */
export async function initEditor({ projectId, screenId, canvas, panel }) {
  // Ensure component metadata is available before anything touches
  // buildFieldDefinitions (which reads defaults from the cache).
  await loadComponentMeta();

  const editorState    = createEditorState(projectId, screenId);
  const selectionState = createSelectionState();

  // --- history ---
  const history = createHistory();

  // --- grid state ---
  // Grid snapping is on by default (8px grid). The toolbar toggle flips this.
  let gridEnabled = true;

  // --- add mode state ---
  // null = normal pointer mode; string = component type being added on click.
  let addModeType = null;

  // --- clipboard state ---
  // Stores a shallow copy of the last copied element for paste operations.
  let clipboard = null; // { type, properties, width, height }

  // Declared early so closures (onSelect, onDeselect, reRender) can reference
  // it safely before initResize() assigns the real value below.
  let resizeHandles = null;

  // --- alignment guides ---
  const guideRenderer = createGuideRenderer(canvas);

  // --- initial load ---
  const initialData = await api.getScreen(projectId, screenId);
  editorState.setScreenData(initialData);

  // --- re-render helper ---
  // Fetches fresh HTML from the server, swaps the .screen element, refreshes
  // the cached screen data, and restores the previous selection highlight.
  async function reRender() {
    const html = await api.getScreenFragment(projectId, screenId);
    const screenEl = canvas.querySelector('.screen');
    // Safe: html is server-generated markup from our own renderer, not user input.
    // eslint-disable-next-line no-unsanitized/property
    if (screenEl) screenEl.outerHTML = html;

    // outerHTML replacement creates a new DOM node with no inline styles, so any
    // zoom transform set by ZOOM_JS is silently discarded. Re-apply from the same
    // localStorage key that ZOOM_JS writes, keeping the zoom level consistent.
    const savedZoom = localStorage.getItem(`mockup-zoom-${screenId}`);
    if (savedZoom) {
      const newScreenEl = canvas.querySelector('.screen');
      if (newScreenEl) {
        newScreenEl.style.transform = `scale(${savedZoom})`;
        newScreenEl.style.transformOrigin = 'top center';
      }
    }

    // Refresh cached data so hasChanged comparisons stay accurate
    const freshData = await api.getScreen(projectId, screenId);
    editorState.setScreenData(freshData);

    // Restore visual highlight and resize handles if an element is still selected
    const selectedId = selectionState.getSelectedId();
    if (selectedId) {
      const el = canvas.querySelector(`[data-element-id="${selectedId}"]`);
      if (el) {
        el.classList.add('selected');
        if (resizeHandles) resizeHandles.showHandles(el);
      }
    }
  }

  // --- toolbar undo/redo button state ---
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnGrid = document.getElementById('btn-grid');

  function updateUndoRedoButtons() {
    if (btnUndo) btnUndo.disabled = !history.canUndo();
    if (btnRedo) btnRedo.disabled = !history.canRedo();
  }

  // --- apply operation helper (for undo/redo) ---
  async function applyOperation(op) {
    if (op.type === 'move' || op.type === 'resize') {
      await api.moveElement(projectId, screenId, op.elementId, op.after);
    } else if (op.type === 'update') {
      await api.updateElement(projectId, screenId, op.elementId, buildUpdatePayload(op.after));
    } else if (op.type === 'delete') {
      await api.deleteElement(projectId, screenId, op.elementId);
    } else if (op.type === 'add') {
      await api.addElement(projectId, screenId, op.after);
    }
    await reRender();
  }

  // --- property-panel save handler ---
  async function handlePropertyChange(changes) {
    const selectedId = selectionState.getSelectedId();
    if (!selectedId) return;

    const payload = buildUpdatePayload(changes);
    await api.updateElement(projectId, screenId, selectedId, payload);
    await reRender();
  }

  // --- selection callbacks ---
  function onSelect(id) {
    const data    = editorState.getScreenData();
    const element = findElementInScreen(data, id);
    if (!element) return;

    const fields = buildFieldDefinitions(element);
    // Safe: renderPanelHtml produces server-controlled markup, not user input.
    // eslint-disable-next-line no-unsanitized/property
    panel.innerHTML = renderPanelHtml(fields);

    // Show resize handles around the selected element
    const el = canvas.querySelector(`[data-element-id="${id}"]`);
    if (el && resizeHandles) resizeHandles.showHandles(el);
  }

  function onDeselect() {
    panel.innerHTML = '<p class="panel-placeholder">Select an element to edit its properties</p>';
    if (resizeHandles) resizeHandles.hideHandles();
    guideRenderer.hideGuides();
  }

  // Wire up selection and property panel
  initSelection(canvas, selectionState, onSelect, onDeselect, (selectedIds) => {
    updateMultiSelectToolbar(selectedIds);
    updateMultiSelectVisual(selectedIds);
  });
  initPropertyPanel(panel, handlePropertyChange);

  // Box-select: drag over empty canvas to select multiple elements at once.
  initBoxSelect(canvas, selectionState, () => {
    return Array.from(document.querySelectorAll('[data-element-id]')).map(el => {
      const r  = el.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      return { id: el.dataset.elementId, x: r.left - cr.left, y: r.top - cr.top, width: r.width, height: r.height };
    });
  }, (selectedIds) => {
    updateMultiSelectToolbar(selectedIds);
    updateMultiSelectVisual(selectedIds);
  });

  // Add-mode click: place a new element wherever the user clicks on the canvas.
  // Stays in add mode after each placement for rapid sequential drops.
  canvas.addEventListener('click', async (e) => {
    if (!addModeType) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    // Default sizes per component type — palette-data.js has the full catalog
    // but these cover the keyboard-shortcut add targets without an extra import.
    const SIZES = { button: [120, 36], input: [200, 36], card: [280, 160], text: [160, 24], rect: [120, 80] };
    const [w, h] = SIZES[addModeType] || [120, 60];

    try {
      await api.addElement(projectId, screenId, { type: addModeType, x, y, width: w, height: h });
      await reRender();
      showToast(`Added ${addModeType}`);
    } catch (err) {
      console.error('[editor] add element failed', err);
    }
    // Intentionally stay in add mode — user can press Esc to exit.
  });

  // Palette sidebar — handles category rendering, search, recent list, and
  // entering add mode when the user clicks a component type in the sidebar.
  initPalette({
    onAddModeEnter(type) { enterAddMode(type); },
    onAddModeExit()      { exitAddMode(); },
    getAddModeType()     { return addModeType; },
  });

  // --- drag ---
  initDrag(canvas, selectionState, {
    gridEnabled,
    gridSize: 8,
    onDragStart(id) {
      // Select the element being dragged — mirrors initSelection logic so the
      // user can click-drag in a single gesture without a prior selection click.
      const prevId = selectionState.getSelectedId();
      if (prevId && prevId !== id) {
        const prev = canvas.querySelector(`[data-element-id="${prevId}"]`);
        if (prev) prev.classList.remove('selected');
      }
      const el = canvas.querySelector(`[data-element-id="${id}"]`);
      if (el) el.classList.add('selected');
      selectionState.select(id);
      onSelect(id);

      // Hide resize handles while dragging — they would lag behind the
      // translate-based visual feedback and look broken.
      if (resizeHandles) resizeHandles.hideHandles();
    },
    onDragMove(elId, wouldBeX, wouldBeY) {
      // Compute alignment guides against all other elements on the screen
      const data = editorState.getScreenData();
      if (!data || !data.elements) return null;

      const element = findElementInScreen(data, elId);
      if (!element) return null;

      const draggedRect = {
        x: wouldBeX,
        y: wouldBeY,
        width: element.width || 0,
        height: element.height || 0,
      };

      const otherRects = data.elements
        .filter(e => e.id !== elId)
        .map(e => ({ id: e.id, x: e.x, y: e.y, width: e.width || 0, height: e.height || 0 }));

      const screenSize = {
        width: data.width || 375,
        height: data.height || 812,
      };

      const result = findAlignmentGuides(draggedRect, otherRects, screenSize);

      if (result.guides.length > 0) {
        guideRenderer.showGuides(result.guides, screenSize);
      } else {
        guideRenderer.hideGuides();
      }

      return { snapX: result.snappedX, snapY: result.snappedY };
    },
    onDragEnd({ elementId, x, y }) {
      // Hide alignment guides now that the drag is complete
      guideRenderer.hideGuides();

      // Look up the element's position before the drag so we can record it
      const data = editorState.getScreenData();
      const element = findElementInScreen(data, elementId);
      const before = element ? { x: element.x, y: element.y } : { x: 0, y: 0 };

      history.push({ type: 'move', elementId, before, after: { x, y } });
      updateUndoRedoButtons();

      // Fire-and-forget: persist and re-render
      api.moveElement(projectId, screenId, elementId, { x, y }).then(() => reRender());
    },
  });

  // --- resize ---
  resizeHandles = initResize(canvas, selectionState, {
    gridEnabled,
    gridSize: 8,
    onResizeEnd({ elementId, x, y, width, height }) {
      const data = editorState.getScreenData();
      const element = findElementInScreen(data, elementId);
      const before = element
        ? { x: element.x, y: element.y, width: element.width, height: element.height }
        : { x: 0, y: 0, width: 0, height: 0 };

      history.push({
        type: 'resize', elementId,
        before,
        after: { x, y, width, height },
      });
      updateUndoRedoButtons();

      api.moveElement(projectId, screenId, elementId, { x, y, width, height })
        .then(() => reRender());
    },
  });

  // Show placeholder until first selection — must be after initResize so
  // resizeHandles is assigned and onDeselect() can safely call hideHandles().
  onDeselect();

  // --- toast notifications ---
  function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // --- multi-select toolbar helpers ---
  function updateMultiSelectToolbar(selectedIds) {
    const toolbar = document.getElementById('multi-select-toolbar');
    const count   = document.getElementById('multi-select-count');
    if (selectedIds.size > 1) {
      if (toolbar) toolbar.style.display = 'flex';
      if (count)   count.textContent = selectedIds.size;
    } else {
      if (toolbar) toolbar.style.display = 'none';
    }
  }

  function updateMultiSelectVisual(selectedIds) {
    // Remove stale outlines from a previous multi-select pass.
    document.querySelectorAll('.element-selected-multi').forEach(el => {
      el.classList.remove('element-selected-multi');
    });
    selectedIds.forEach(id => {
      const el = document.querySelector(`[data-element-id="${id}"]`);
      if (el) el.classList.add('element-selected-multi');
    });
  }

  // --- add mode helpers ---
  function enterAddMode(type) {
    addModeType = type;
    const badge = document.getElementById('add-mode-badge');
    const label = document.getElementById('add-mode-label');
    if (badge) badge.style.display = '';
    if (label) label.textContent = type;
    canvas.style.cursor = 'crosshair';
  }

  function exitAddMode() {
    addModeType = null;
    const badge = document.getElementById('add-mode-badge');
    if (badge) badge.style.display = 'none';
    canvas.style.cursor = '';
    exitPaletteAddMode();
  }

  // --- nudge helper (arrow key movement) ---
  async function nudgeSelected(dx, dy) {
    const selectedId = selectionState.getSelectedId();
    if (!selectedId) return;

    const data = editorState.getScreenData();
    const element = findElementInScreen(data, selectedId);
    if (!element) return;

    const before = { x: element.x, y: element.y };
    const after  = { x: Math.max(0, element.x + dx), y: Math.max(0, element.y + dy) };

    history.push({ type: 'move', elementId: selectedId, before, after });
    updateUndoRedoButtons();

    await api.moveElement(projectId, screenId, selectedId, after);
    await reRender();
  }

  // --- shortcuts ---
  initShortcuts({
    async undo() {
      const op = history.undo();
      if (!op) return;
      await applyOperation(invertOperation(op));
      updateUndoRedoButtons();
    },
    async redo() {
      const op = history.redo();
      if (!op) return;
      await applyOperation(op);
      updateUndoRedoButtons();
    },
    async delete() {
      const selectedId = selectionState.getSelectedId();
      if (!selectedId) return;

      // Snapshot the full element for undo
      const data = editorState.getScreenData();
      const element = findElementInScreen(data, selectedId);

      history.push({ type: 'delete', elementId: selectedId, before: element, after: null });
      updateUndoRedoButtons();

      await api.deleteElement(projectId, screenId, selectedId);
      selectionState.deselect();
      onDeselect();
      await reRender();
    },
    moveUp()         { nudgeSelected(0, -1); },
    moveDown()       { nudgeSelected(0,  1); },
    moveLeft()       { nudgeSelected(-1, 0); },
    moveRight()      { nudgeSelected( 1, 0); },
    moveUpLarge()    { nudgeSelected(0, -10); },
    moveDownLarge()  { nudgeSelected(0,  10); },
    moveLeftLarge()  { nudgeSelected(-10, 0); },
    moveRightLarge() { nudgeSelected( 10, 0); },
    // Add-mode shortcuts — keyboard equivalents of clicking palette items.
    addButton() { enterAddMode('button'); },
    addInput()  { enterAddMode('input');  },
    addCard()   { enterAddMode('card');   },
    addText()   { enterAddMode('text');   },
    addRect()   { enterAddMode('rectangle'); },
    // Copy selected element into clipboard (in-memory only — no OS clipboard).
    copy() {
      const id = selectionState.getSelectedId();
      if (!id) return;
      const data = editorState.getScreenData();
      const el = findElementInScreen(data, id);
      if (el) {
        clipboard = {
          type: el.type,
          width: el.width,
          height: el.height,
          properties: JSON.parse(JSON.stringify(el.properties ?? {}))
        };
        showToast('Copied');
      }
    },
    // Paste clipboard content offset by 20px from the selected element (or a
    // fixed position when nothing is selected).
    async paste() {
      if (!clipboard) return;
      const selId = selectionState.getSelectedId();
      const data  = editorState.getScreenData();
      const selEl = selId ? findElementInScreen(data, selId) : null;
      const x = (selEl?.x ?? 100) + 20;
      const y = (selEl?.y ?? 100) + 20;
      await api.addElement(projectId, screenId, {
        type: clipboard.type,
        x, y,
        width: clipboard.width,
        height: clipboard.height,
        properties: { ...clipboard.properties },
      });
      await reRender();
      showToast('Pasted — Cmd+V to paste again');
    },
  });

  // --- toolbar buttons ---
  if (btnUndo) {
    btnUndo.addEventListener('click', async () => {
      const op = history.undo();
      if (!op) return;
      await applyOperation(invertOperation(op));
      updateUndoRedoButtons();
    });
  }

  if (btnRedo) {
    btnRedo.addEventListener('click', async () => {
      const op = history.redo();
      if (!op) return;
      await applyOperation(op);
      updateUndoRedoButtons();
    });
  }

  if (btnGrid) {
    btnGrid.addEventListener('click', () => {
      gridEnabled = !gridEnabled;
      btnGrid.classList.toggle('toolbar-btn-active', gridEnabled);
    });
  }

  // --- multi-select delete button ---
  document.getElementById('btn-delete-selected')?.addEventListener('click', async () => {
    const ids = Array.from(selectionState.getSelectedIds());
    try {
      for (const id of ids) {
        try {
          await api.deleteElement(projectId, screenId, id);
        } catch (err) {
          console.error('[editor] delete element failed', id, err);
        }
      }
    } finally {
      selectionState.deselect();
      updateMultiSelectToolbar(new Set());
      await reRender();
    }
  });

  // --- Escape: cancel add mode (selection.js Escape handler deselects, this
  //     intercepts first so add mode is exited before deselect fires).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && addModeType !== null) {
      exitAddMode();
    }
  });

  // --- polling (3 s) ---
  // Detects external edits (e.g. from Claude via MCP tools) and refreshes the
  // canvas without requiring a manual page reload.
  setInterval(async () => {
    try {
      const latest = await api.getScreen(projectId, screenId);
      if (editorState.hasChanged(latest)) {
        editorState.setScreenData(latest);
        await reRender();
      }
    } catch {
      // Polling failures are silently ignored — network hiccups should not
      // break the editing session.
    }
  }, 3000);
}
