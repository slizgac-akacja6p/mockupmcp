// Main editor controller — orchestrates selection, property panel, drag,
// resize, undo/redo history, keyboard shortcuts, and screen re-rendering.
//
// Pure logic functions (computeScreenHash, createEditorState) are exported and
// decoupled from the DOM so they can be tested in Node.js without a browser.
// initEditor() is the single DOM-aware entry point and is only called at runtime.

import { createSelectionState, findElementId, findElementInScreen, initSelection, initBoxSelect } from './selection.js';
import { buildFieldDefinitions, buildUpdatePayload, renderPanelHtml, renderScreenStyleHtml, initPropertyPanel } from './property-panel.js';
import { loadComponentMeta } from './component-meta.js';
import { initDrag } from './drag.js';
import { initResize } from './resize.js';
import { findAlignmentGuides, createGuideRenderer } from './guides.js';
import { createHistory, invertOperation } from './history.js';
import { initShortcuts } from './shortcuts.js';
import { initPalette, exitPaletteAddMode } from './palette.js';
import { initLayers, renderLayers, onSelectionChange, updateScreenData } from './layers.js';
import { getComponentDefaults } from './palette-data.js';
import * as api from './api-client.js';

// i18n helper — safe fallback when the i18n module hasn't loaded yet or in Node.js tests.
const _t = (key, fallback) => (typeof globalThis.window !== 'undefined' && typeof window.t === 'function' ? window.t(key, fallback) : (fallback ?? key));

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

  // --- selection visual update (surgical DOM — classList only, no rerender) ---
  // Toggles .selected on individual elements to match the current selection
  // state. Used after outerHTML swaps and wherever only visual refresh is needed.
  function updateSelectionVisuals() {
    const selectedIds = selectionState.getSelectedIds();
    canvas.querySelectorAll('[data-element-id]').forEach(el => {
      const id = el.dataset.elementId;
      el.classList.toggle('selected', selectedIds.has(id));
    });
    // Restore resize handles for single-selected element
    const singleId = selectionState.getSelectedId();
    if (singleId && selectedIds.size === 1) {
      const el = canvas.querySelector(`[data-element-id="${singleId}"]`);
      if (el && resizeHandles) resizeHandles.showHandles(el);
    }
  }

  // --- re-render helper ---
  // Fetches fresh HTML from the server, swaps the .screen element, refreshes
  // the cached screen data, and restores the previous selection highlight.
  // Only called after actual data mutations (PATCH/POST/DELETE), not for
  // selection-only changes which use updateSelectionVisuals() instead.
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

    // Update layers panel with new data
    updateScreenData(freshData);
    renderLayers();

    // Restore selection visuals on the fresh DOM nodes
    updateSelectionVisuals();
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

    // Refresh the property panel so it reflects the post-undo/redo state.
    // reRender() restores canvas visuals and selection highlights but does
    // not rebuild the panel fields — without this the panel would show stale
    // values from before the operation was reversed/reapplied.
    const selectedId = selectionState.getSelectedId();
    if (selectedId) {
      onSelect(selectedId);
    }
  }

  // --- property-panel save handler ---
  async function handlePropertyChange(changes) {
    const selectedId = selectionState.getSelectedId();
    if (!selectedId) return;

    // Capture the current values of the changed fields before the update so
    // undo can restore them. We only snapshot the keys that are changing —
    // consistent with how move/resize record positional diffs only.
    const data = editorState.getScreenData();
    const element = findElementInScreen(data, selectedId);
    const before = {};
    if (element) {
      for (const key of Object.keys(changes)) {
        // Properties are nested under element.properties; positional fields
        // (x, y, width, height) live at the top level.
        before[key] = key in element ? element[key] : element.properties?.[key];
      }
    }

    const payload = buildUpdatePayload(changes);
    await api.updateElement(projectId, screenId, selectedId, payload);
    await reRender();

    // Push after re-render so editorState reflects the new server state;
    // applyOperation(invertOperation) will re-apply the snapshot on undo.
    history.push({ type: 'update', elementId: selectedId, before, after: changes });
    updateUndoRedoButtons();
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

    // Highlight corresponding row in layers panel
    onSelectionChange(id);
  }

  function onDeselect() {
    // Show screen properties (including style override) when nothing is selected.
    // renderScreenStyleHtml produces controlled markup, not user input — safe for innerHTML.
    // Use hasOwnProperty check so explicit null (inherited) is preserved vs undefined.
    const currentScreenStyle = Object.prototype.hasOwnProperty.call(window, '__SCREEN_STYLE__')
      ? window.__SCREEN_STYLE__
      : null;
    const screenStyleHtml = renderScreenStyleHtml(
      currentScreenStyle,
      window.__STYLE_OPTIONS__ || [],
      window.__PROJECT_STYLE__ || 'wireframe',
    );
    // eslint-disable-next-line no-unsanitized/property
    panel.innerHTML = screenStyleHtml;

    const inheritCheckbox = panel.querySelector('#screen-style-inherit');
    const screenStyleSelect = panel.querySelector('#screen-style-select');

    // Inherit checkbox: toggles between null (inherit project style) and an explicit override.
    if (inheritCheckbox) {
      inheritCheckbox.addEventListener('change', async (e) => {
        const nowInherited = e.target.checked;
        const newStyle = nowInherited
          ? null
          : (screenStyleSelect?.value || window.__PROJECT_STYLE__ || 'wireframe');
        try {
          await api.updateScreen(projectId, screenId, { style: newStyle });
          window.__SCREEN_STYLE__ = newStyle;
          window.location.reload();
        } catch (err) {
          console.error('[editor] update screen style (inherit toggle) failed', err);
        }
      });
    }

    // Dropdown: only active when inherit is unchecked.
    if (screenStyleSelect) {
      screenStyleSelect.addEventListener('change', async (e) => {
        const newStyle = e.target.value || null;
        try {
          await api.updateScreen(projectId, screenId, { style: newStyle });
          window.__SCREEN_STYLE__ = newStyle;
          window.location.reload();
        } catch (err) {
          console.error('[editor] update screen style failed', err);
        }
      });
    }

    if (resizeHandles) resizeHandles.hideHandles();
    guideRenderer.hideGuides();

    // Clear layers panel selection
    onSelectionChange(null);
  }

  // Wire up selection and property panel
  initSelection(canvas, selectionState, onSelect, onDeselect, (selectedIds) => {
    updateMultiSelectToolbar(selectedIds);
    updateMultiSelectVisual(selectedIds);
  }, () => addModeType);
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

  // Add-mode click: place a new element at the clicked canvas position.
  // Single-shot: exits add mode after one successful placement.
  // We intentionally do NOT bail out when clicking on an existing element —
  // the canvas is often fully covered by elements, so honoring clicks on top
  // of them is the only way add mode can ever work.
  canvas.addEventListener('click', async (e) => {
    if (!addModeType) return;

    // Use the .screen element (actual mockup) as the coordinate reference,
    // not #editor-canvas (the flex wrapper) which has centering padding/offsets
    // that would place the element outside the visible mockup area.
    const screenEl = canvas.querySelector('.screen');
    const refEl = screenEl || canvas;
    const rect = refEl.getBoundingClientRect();

    // Divide by zoom scale so the element lands at the clicked mockup coordinate,
    // not at the scaled viewport coordinate (which would be off at any zoom != 1).
    const zoomMatch = screenEl?.style.transform?.match(/scale\(([^)]+)\)/);
    const zoom = zoomMatch ? parseFloat(zoomMatch[1]) : 1;

    // Use palette-data defaults so all 35 component types get their correct
    // dimensions regardless of whether they appear in the keyboard-shortcut map.
    const { width: w, height: h } = getComponentDefaults(addModeType);

    // Compute position relative to the screen element and clamp so the new
    // element stays fully within the mockup boundaries.
    const data = editorState.getScreenData();
    const screenWidth = data?.width || 375;
    const screenHeight = data?.height || 812;
    const rawX = Math.round((e.clientX - rect.left) / zoom);
    const rawY = Math.round((e.clientY - rect.top) / zoom);
    const x = Math.max(0, Math.min(rawX, screenWidth - w));
    const y = Math.max(0, Math.min(rawY, screenHeight - h));

    try {
      const created = await api.addElement(projectId, screenId, { type: addModeType, x, y, width: w, height: h });
      await reRender();

      // Record add operation for undo support
      history.push({
        type: 'add',
        elementId: created.id,
        before: null,
        after: { type: addModeType, x, y, width: w, height: h, properties: created.properties ?? {} },
      });
      updateUndoRedoButtons();

      showToast(_t('toast.added', 'Added') + ' ' + addModeType);
    } catch (err) {
      console.error('[editor] add element failed', err);
    }
    exitAddMode();
  });

  // --- drag-and-drop from palette onto canvas ---
  // Complements click-to-add: users can drag a component from the sidebar
  // palette and drop it onto the canvas to place an element at the drop point.
  canvas.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('component/type')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  canvas.addEventListener('drop', async (e) => {
    const compType = e.dataTransfer.getData('component/type');
    if (!compType) return;
    e.preventDefault();

    const screenEl = canvas.querySelector('.screen');
    const refEl = screenEl || canvas;
    const rect = refEl.getBoundingClientRect();

    // Account for zoom so the element lands at the correct mockup coordinate.
    const zoomMatch = screenEl?.style.transform?.match(/scale\(([^)]+)\)/);
    const zoom = zoomMatch ? parseFloat(zoomMatch[1]) : 1;

    const { width: w, height: h } = getComponentDefaults(compType);

    const data = editorState.getScreenData();
    const screenWidth = data?.width || 375;
    const screenHeight = data?.height || 812;
    const rawX = Math.round((e.clientX - rect.left) / zoom);
    const rawY = Math.round((e.clientY - rect.top) / zoom);
    const x = Math.max(0, Math.min(rawX, screenWidth - w));
    const y = Math.max(0, Math.min(rawY, screenHeight - h));

    try {
      const created = await api.addElement(projectId, screenId, { type: compType, x, y, width: w, height: h });
      await reRender();

      history.push({
        type: 'add',
        elementId: created.id,
        before: null,
        after: { type: compType, x, y, width: w, height: h, properties: created.properties ?? {} },
      });
      updateUndoRedoButtons();

      showToast(_t('toast.added', 'Added') + ' ' + compType);
    } catch (err) {
      console.error('[editor] drop element failed', err);
    }
  });

  // --- scroll containment (JS-level defense) ---
  // Prevent wheel events on side panels from bubbling up and scrolling the
  // canvas or body. CSS overscroll-behavior:contain handles most cases but
  // this catches edge cases where the panel content is not scrollable.
  for (const panelId of ['mockup-sidebar', 'editor-right-panel']) {
    const panelEl = document.getElementById(panelId);
    if (panelEl) {
      panelEl.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
    }
  }

  // Palette sidebar — handles category rendering, search, recent list, and
  // entering add mode when the user clicks a component type in the sidebar.
  initPalette({
    onAddModeEnter(type) { enterAddMode(type); },
    onAddModeExit()      { exitAddMode(); },
    getAddModeType()     { return addModeType; },
  });

  // Layers panel — shows elements sorted by z_index with drag-to-reorder
  initLayers({
    projectId,
    screenId,
    apiClient: api,
    selectionModule: selectionState,
    screenData: initialData,
    reRender,
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

      // Show resize handles at the element's current position — they will
      // be updated every frame via onDragMove → updateHandles() below.
      const dragTarget = canvas.querySelector(`[data-element-id="${id}"]`);
      if (dragTarget && resizeHandles) resizeHandles.showHandles(dragTarget);
    },
    onDragMove(elId, wouldBeX, wouldBeY) {
      // Update resize handle positions to follow the element during drag.
      // getBoundingClientRect on the element reflects its CSS transform,
      // so handles track the visual position accurately.
      const draggedEl = canvas.querySelector(`[data-element-id="${elId}"]`);
      if (draggedEl && resizeHandles) resizeHandles.updateHandles(draggedEl);

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
    async onDragEnd({ elementId, x, y }) {
      // Hide alignment guides now that the drag is complete
      guideRenderer.hideGuides();

      // Look up the element's position before the drag so we can record it
      const data = editorState.getScreenData();
      const element = findElementInScreen(data, elementId);
      const before = element ? { x: element.x, y: element.y } : { x: 0, y: 0 };

      history.push({ type: 'move', elementId, before, after: { x, y } });
      updateUndoRedoButtons();

      // Await persist + re-render so undo state is consistent after drag
      await api.moveElement(projectId, screenId, elementId, { x, y });
      await reRender();
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
        showToast(_t('toast.copied', 'Copied'));
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
      const pastePayload = {
        type: clipboard.type,
        x, y,
        width: clipboard.width,
        height: clipboard.height,
        properties: { ...clipboard.properties },
      };
      const created = await api.addElement(projectId, screenId, pastePayload);
      await reRender();

      // Record paste as add operation for undo support
      history.push({
        type: 'add',
        elementId: created.id,
        before: null,
        after: pastePayload,
      });
      updateUndoRedoButtons();

      showToast(_t('toast.pasted', 'Pasted'));
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

  // --- project style selector ---
  const styleSelect = document.getElementById('style-select');
  if (styleSelect) {
    styleSelect.addEventListener('change', async (e) => {
      const newStyle = e.target.value;
      try {
        await api.updateProject(projectId, { style: newStyle });
        // Full page reload to re-render with the new style CSS
        window.location.reload();
      } catch (err) {
        console.error('[editor] update project style failed', err);
      }
    });
  }

  // --- language switcher ---
  const langSelect = document.getElementById('lang-select');
  if (langSelect) {
    // Set initial value from current language
    langSelect.value = localStorage.getItem('editor-lang') || 'en';
    langSelect.addEventListener('change', async (e) => {
      const lang = e.target.value;
      if (typeof window.setLanguage === 'function') {
        await window.setLanguage(lang);
      }

      // Refresh all translatable toolbar and panel labels after language change
      const undoBtn = document.getElementById('btn-undo');
      const redoBtn = document.getElementById('btn-redo');
      if (undoBtn) undoBtn.title = _t('toolbar.undo', 'Undo (Cmd+Z)');
      if (redoBtn) redoBtn.title = _t('toolbar.redo', 'Redo (Cmd+Shift+Z)');
      document.querySelectorAll('.panel-tab').forEach(tab => {
        const tabName = tab.dataset.tab;
        if (tabName === 'properties') tab.textContent = _t('panel.properties', 'Properties');
        if (tabName === 'components') tab.textContent = _t('panel.components', 'Components');
        if (tabName === 'layers') tab.textContent = _t('panel.layers', 'Layers');
      });
      const searchInput = document.getElementById('palette-search');
      if (searchInput) searchInput.placeholder = _t('palette.search', 'Search components...');

      // Re-render property panel with new language
      const selectedId = selectionState.getSelectedId();
      if (selectedId) {
        onSelect(selectedId);
      } else {
        onDeselect();
      }
    });
  }

  // --- sidebar collapse toggle ---
  const collapseBtn = document.getElementById('editor-sidebar-collapse-btn');
  if (collapseBtn) {
    const sidebar = collapseBtn.closest('#mockup-sidebar');
    const wrapper = document.getElementById('editor-flex-wrapper');
    const toolbar = document.getElementById('editor-toolbar');
    const isCollapsed = localStorage.getItem('editor-sidebar-collapsed') === 'true';

    function applyCollapse(collapsed) {
      if (sidebar) sidebar.classList.toggle('collapsed', collapsed);
      if (wrapper) wrapper.classList.toggle('sidebar-collapsed', collapsed);
      if (toolbar) toolbar.classList.toggle('sidebar-collapsed', collapsed);
      collapseBtn.textContent = collapsed ? '\u203A' : '\u2039';
      localStorage.setItem('editor-sidebar-collapsed', String(collapsed));
    }

    applyCollapse(isCollapsed);
    collapseBtn.addEventListener('click', () => {
      const nowCollapsed = !sidebar?.classList.contains('collapsed');
      applyCollapse(nowCollapsed);
    });
  }

  // --- read-only mode (approved / rejected screens) ---
  // Disables all editing interactions to prevent accidental changes after a
  // screen has been signed off by a reviewer. Banner replaces the add-mode
  // badge area to make the locked state visually obvious at a glance.
  function setReadOnlyMode(isReadOnly) {
    // Toolbar action buttons — undo/redo intentionally kept readable for audit.
    const editBtns = [
      document.getElementById('btn-delete-selected'),
      document.getElementById('add-mode-badge'),
    ];
    // Palette items — disable click-to-add in the component sidebar.
    document.querySelectorAll('.palette-item').forEach(el => {
      el.style.pointerEvents = isReadOnly ? 'none' : '';
      el.style.opacity = isReadOnly ? '0.4' : '';
    });

    // Disable / re-enable all property-panel form controls so values are
    // visible but not editable (read-only audit view).
    panel.querySelectorAll('input, select, textarea, button').forEach(el => {
      el.disabled = isReadOnly;
    });

    // Show or remove the read-only banner above the canvas.
    const BANNER_ID = 'editor-readonly-banner';
    const existing = document.getElementById(BANNER_ID);
    if (isReadOnly && !existing) {
      const banner = document.createElement('div');
      banner.id = BANNER_ID;
      // Inline styles — no new CSS file to keep the change self-contained.
      banner.style.cssText = [
        'position:sticky',
        'top:0',
        'z-index:100',
        'background:#92400E',
        'color:#FEF3C7',
        'text-align:center',
        'padding:6px 12px',
        'font-size:12px',
        'font-weight:600',
        'letter-spacing:0.02em',
        'flex-shrink:0',
      ].join(';');
      banner.textContent = _t('editor.readOnly', 'Screen approved — read only');
      canvas.parentElement?.insertBefore(banner, canvas);
    } else if (!isReadOnly && existing) {
      existing.remove();
    }

    // Prevent drag and resize by clamping pointer events on the canvas itself.
    // Selection (click-to-inspect) is still allowed because the cursor changes
    // to default, making it clear that dragging is disabled.
    canvas.style.userSelect = isReadOnly ? 'none' : '';
    // Override drag.js and resize.js: they check addModeType but not readonly,
    // so we block their mousedown at the canvas level via a capture listener.
    if (isReadOnly) {
      canvas._readOnlyBlocker = (e) => {
        // Allow clicks for selection; block mousedown-driven drag/resize.
        if (e.type === 'mousedown') e.stopImmediatePropagation();
      };
      canvas.addEventListener('mousedown', canvas._readOnlyBlocker, true);
    } else if (canvas._readOnlyBlocker) {
      canvas.removeEventListener('mousedown', canvas._readOnlyBlocker, true);
      canvas._readOnlyBlocker = null;
    }
  }

  // Apply read-only mode immediately if the screen is already in a terminal state.
  // window.__SCREEN_STATUS__ is injected by server.js at page-build time.
  const initialStatus = typeof window !== 'undefined' ? window.__SCREEN_STATUS__ : null;
  if (initialStatus === 'approved' || initialStatus === 'rejected') {
    setReadOnlyMode(true);
  }

  // React to approval actions taken during the current editor session so the
  // lock engages without a page reload.
  document.addEventListener('approvalSubmitted', (e) => {
    const { status, screenId: eventScreenId } = e.detail ?? {};
    if (eventScreenId !== screenId) return; // Only lock current screen, not others
    if (status === 'approved' || status === 'rejected') {
      setReadOnlyMode(true);
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
