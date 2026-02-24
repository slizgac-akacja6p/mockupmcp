/**
 * Selection logic for the in-browser editor.
 *
 * Pure logic functions (findElementId, findElementInScreen, createSelectionState)
 * are decoupled from the DOM so they can be tested in Node.js without a browser.
 * initSelection() wires them to DOM events and is only called at runtime.
 */

/**
 * Walk up the DOM tree to the nearest [data-element-id] wrapper.
 * Returns the element ID string, or null if the click landed outside any element.
 *
 * @param {Element} domNode - The node that received the event (e.target)
 * @returns {string|null}
 */
export function findElementId(domNode) {
  const el = domNode.closest('[data-element-id]');
  return el ? el.dataset.elementId : null;
}

/**
 * Look up an element by ID within a screen's elements array.
 *
 * @param {{ elements: Array<{ id: string }> }} screenData
 * @param {string} elementId
 * @returns {object|null}
 */
export function findElementInScreen(screenData, elementId) {
  return screenData.elements.find(el => el.id === elementId) ?? null;
}

/**
 * Create a lightweight selection state object.
 * Intentionally not reactive — callers own the update cycle.
 * Supports both single-select (backward compat) and multi-select.
 *
 * @returns {{
 *   getSelectedId: () => string|null,
 *   getSelectedIds: () => Set<string>,
 *   select: (id: string) => void,
 *   addToSelection: (id: string) => void,
 *   removeFromSelection: (id: string) => void,
 *   deselect: () => void,
 *   selectAll: (ids: string[]) => void,
 *   isSelected: (id: string) => boolean,
 *   count: () => number
 * }}
 */
export function createSelectionState() {
  let selectedIds = new Set();

  return {
    // Backward compatibility: returns first selected ID or null
    getSelectedId() {
      const first = selectedIds.values().next().value;
      return first ?? null;
    },

    // New multi-select methods
    getSelectedIds() {
      return new Set(selectedIds);
    },

    select(id) {
      selectedIds = new Set([id]);
    },

    addToSelection(id) {
      selectedIds.add(id);
    },

    removeFromSelection(id) {
      selectedIds.delete(id);
    },

    deselect() {
      selectedIds.clear();
    },

    selectAll(ids) {
      selectedIds = new Set(ids);
    },

    isSelected(id) {
      return selectedIds.has(id);
    },

    count() {
      return selectedIds.size;
    },
  };
}

/**
 * Bind selection behaviour to a container element in the editor canvas.
 *
 * Handles three interactions:
 * - Click on element: single-select (replaces any multi-selection)
 * - Cmd/Ctrl + Click: toggle element in multi-selection
 * - Click on empty canvas: deselects
 * - Escape key (document-level): always deselects, regardless of focus.
 *
 * @param {Element}  container  - The canvas wrapper that contains rendered elements
 * @param {ReturnType<typeof createSelectionState>} state
 * @param {(id: string) => void} onSelect       - Called with the selected element ID (single-select)
 * @param {() => void}           onDeselect     - Called when selection is cleared
 * @param {(ids: Set<string>) => void} [onMultiSelect] - Optional: called with Set of selected IDs on multi-select
 */
export function initSelection(container, state, onSelect, onDeselect, onMultiSelect) {
  container.addEventListener('click', (e) => {
    // Guard: skip if box-select just completed (race condition prevention)
    if (container.dataset.didBoxSelect === '1') {
      container.dataset.didBoxSelect = '';
      return;
    }

    const id = findElementId(e.target);
    const isMultiSelect = e.metaKey || e.ctrlKey;

    if (id && isMultiSelect) {
      // Multi-select: toggle in current selection
      if (state.isSelected(id)) {
        state.removeFromSelection(id);
      } else {
        state.addToSelection(id);
      }
      updateMultiSelectUI(container, state.getSelectedIds());
      if (onMultiSelect) onMultiSelect(state.getSelectedIds());
    } else if (id) {
      // Single-select: replace all
      const previousIds = state.getSelectedIds();
      previousIds.forEach((prevId) => {
        const prev = container.querySelector(`[data-element-id="${prevId}"]`);
        if (prev) prev.classList.remove('selected');
      });

      const el = container.querySelector(`[data-element-id="${id}"]`);
      if (el) el.classList.add('selected');
      state.select(id);
      onSelect(id);
    } else {
      // Empty space: deselect all
      const previousIds = state.getSelectedIds();
      previousIds.forEach((prevId) => {
        const prev = container.querySelector(`[data-element-id="${prevId}"]`);
        if (prev) prev.classList.remove('selected');
      });
      state.deselect();
      onDeselect();
    }
  });

  // Escape always clears selection regardless of which element has keyboard focus
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    const previousIds = state.getSelectedIds();
    previousIds.forEach((id) => {
      const el = container.querySelector(`[data-element-id="${id}"]`);
      if (el) el.classList.remove('selected');
    });

    state.deselect();
    onDeselect();
  });
}

/**
 * Update UI to reflect current multi-select state.
 * @private
 */
function updateMultiSelectUI(container, selectedIds) {
  container.querySelectorAll('[data-element-id]').forEach((el) => {
    const id = el.dataset.elementId;
    if (selectedIds.has(id)) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
}

/**
 * Enable box selection (drag to select multiple elements at once).
 * Activates when dragging on empty canvas (not on an element).
 *
 * @param {Element} container - The canvas wrapper
 * @param {ReturnType<typeof createSelectionState>} state - Selection state
 * @param {() => Array<{ id: string, x: number, y: number, width: number, height: number }>} getElementRects - Function returning element positions
 * @param {(ids: Set<string>) => void} [onMultiSelect] - Optional: called with selected IDs
 */
export function initBoxSelect(container, state, getElementRects, onMultiSelect) {
  let boxStart = null;
  let boxEl = null;

  container.addEventListener('mousedown', (e) => {
    // Only allow drag on empty space or .screen element, not on named elements
    const isEmptySpace =
      e.target === container ||
      (e.target.classList && e.target.classList.contains('screen'));

    if (!isEmptySpace || e.button !== 0) return;

    // Guard: skip if add mode is active (canvas has cursor:crosshair)
    const addModeBadge = document.getElementById('add-mode-badge');
    if (addModeBadge && addModeBadge.style.display !== 'none' && addModeBadge.style.display !== '') {
      return;
    }

    const rect = container.getBoundingClientRect();
    boxStart = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    // Create overlay div
    boxEl = document.createElement('div');
    boxEl.className = 'box-select-overlay';
    boxEl.style.cssText = `position:absolute;border:2px dashed #3b82f6;background:rgba(59,130,246,0.1);pointer-events:none;left:${boxStart.x}px;top:${boxStart.y}px;width:0;height:0;`;
    container.appendChild(boxEl);
  });

  document.addEventListener('mousemove', (e) => {
    if (!boxStart || !boxEl) return;

    const rect = container.getBoundingClientRect();
    const cur = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const left = Math.min(boxStart.x, cur.x);
    const top = Math.min(boxStart.y, cur.y);
    const w = Math.abs(cur.x - boxStart.x);
    const h = Math.abs(cur.y - boxStart.y);

    Object.assign(boxEl.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
  });

  document.addEventListener('mouseup', (e) => {
    if (!boxStart || !boxEl) return;

    const rect = container.getBoundingClientRect();
    const cur = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const selLeft = Math.min(boxStart.x, cur.x);
    const selTop = Math.min(boxStart.y, cur.y);
    const selRight = Math.max(boxStart.x, cur.x);
    const selBottom = Math.max(boxStart.y, cur.y);

    // Only select if box is larger than 5px
    if (selRight - selLeft > 5 || selBottom - selTop > 5) {
      const elementRects = getElementRects();
      const hit = elementRects
        .filter(
          (r) =>
            r.x < selRight &&
            r.x + r.width > selLeft &&
            r.y < selBottom &&
            r.y + r.height > selTop
        )
        .map((r) => r.id);

      if (hit.length > 0) {
        container.dataset.didBoxSelect = '1';
        state.selectAll(hit);
        updateMultiSelectUI(container, state.getSelectedIds());
        if (onMultiSelect) onMultiSelect(state.getSelectedIds());
        requestAnimationFrame(() => { container.dataset.didBoxSelect = ''; });
      }
    }

    boxEl.remove();
    boxStart = null;
    boxEl = null;
  });
}
