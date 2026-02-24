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
 *
 * @returns {{ getSelectedId: () => string|null, select: (id: string) => void, deselect: () => void }}
 */
export function createSelectionState() {
  let selectedId = null;

  return {
    getSelectedId() { return selectedId; },
    select(id) { selectedId = id; },
    deselect() { selectedId = null; },
  };
}

/**
 * Bind selection behaviour to a container element in the editor canvas.
 *
 * Handles two interactions:
 * - Click on container: selects the nearest [data-element-id] ancestor of the
 *   click target; deselects when clicking the bare canvas.
 * - Escape key (document-level): always deselects, regardless of focus.
 *
 * @param {Element}  container  - The canvas wrapper that contains rendered elements
 * @param {ReturnType<typeof createSelectionState>} state
 * @param {(id: string) => void} onSelect    - Called with the selected element ID
 * @param {() => void}           onDeselect  - Called when selection is cleared
 */
export function initSelection(container, state, onSelect, onDeselect) {
  container.addEventListener('click', (e) => {
    const id = findElementId(e.target);

    // Remove highlight from whatever was selected before
    const previousId = state.getSelectedId();
    if (previousId) {
      const prev = container.querySelector(`[data-element-id="${previousId}"]`);
      if (prev) prev.classList.remove('selected');
    }

    if (id) {
      const el = container.querySelector(`[data-element-id="${id}"]`);
      if (el) el.classList.add('selected');
      state.select(id);
      onSelect(id);
    } else {
      state.deselect();
      onDeselect();
    }
  });

  // Escape always clears selection regardless of which element has keyboard focus
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    const previousId = state.getSelectedId();
    if (previousId) {
      const prev = container.querySelector(`[data-element-id="${previousId}"]`);
      if (prev) prev.classList.remove('selected');
    }

    state.deselect();
    onDeselect();
  });
}
