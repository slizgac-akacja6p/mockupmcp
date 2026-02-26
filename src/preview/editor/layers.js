/**
 * Layers panel logic for the in-browser editor.
 *
 * Pure logic functions (getElementList, computeBringToFront, computeSendToBack, isPinned)
 * are decoupled from the DOM so they can be tested in Node.js without a browser.
 * initLayers() and renderLayers() are the DOM-aware entry points and are only called at runtime.
 */

// i18n helper — safe fallback when the i18n module hasn't loaded yet or in Node.js tests.
const _t = (key, fallback) => (typeof globalThis.window !== 'undefined' && typeof window.t === 'function' ? window.t(key, fallback) : (fallback ?? key));

/**
 * Safely escape HTML special characters in strings for safe DOM insertion.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Check if an element is pinned (z_index >= 10).
 * Pinned elements cannot be reordered below z_index = 10.
 *
 * @param {object} element - Element with z_index property
 * @returns {boolean}
 */
export function isPinned(element) {
  const z = element.z_index ?? 0;
  return z >= 10;
}

/**
 * Get elements sorted by z_index descending (top = front, bottom = back).
 * Preserves original order for elements with same z_index.
 *
 * @param {object} screenData - Screen object with elements array
 * @returns {Array<object>} Sorted elements (descending z_index)
 */
export function getElementList(screenData) {
  if (!screenData || !Array.isArray(screenData.elements)) {
    return [];
  }
  return [...screenData.elements].sort((a, b) => {
    const zA = a.z_index ?? 0;
    const zB = b.z_index ?? 0;
    return zB - zA; // Descending
  });
}

/**
 * Compute the new z_index for bring-to-front operation.
 * Returns max(all z_index) + 1. If element is already pinned, returns null (no-op).
 *
 * @param {Array<object>} elements - All elements on screen
 * @param {string} selectedElementId - Element to bring to front
 * @returns {number|null} New z_index or null if already pinned
 */
export function computeBringToFront(elements, selectedElementId) {
  const selected = elements.find(el => el.id === selectedElementId);
  if (!selected) return null;

  // Skip if already pinned
  if (isPinned(selected)) return null;

  const zIndices = elements.map(el => el.z_index ?? 0);
  const maxZ = zIndices.length > 0 ? Math.max(...zIndices) : 0;
  return maxZ + 1;
}

/**
 * Compute the new z_index for send-to-back operation.
 * Returns min(all z_index) - 1, clamped to 0. If element is already pinned, returns null (no-op).
 *
 * @param {Array<object>} elements - All elements on screen
 * @param {string} selectedElementId - Element to send to back
 * @returns {number|null} New z_index or null if already pinned
 */
export function computeSendToBack(elements, selectedElementId) {
  const selected = elements.find(el => el.id === selectedElementId);
  if (!selected) return null;

  // Skip if already pinned
  if (isPinned(selected)) return null;

  const zIndices = elements.map(el => el.z_index ?? 0);
  const minZ = zIndices.length > 0 ? Math.min(...zIndices) : 0;
  return Math.max(minZ - 1, 0);
}

// =========================================================================
// Module-level state
// =========================================================================

let _apiClient = null;
let _selectionModule = null;
let _screenData = null;
let _projectId = null;
let _screenId = null;
let _reRender = null;
let _dragSourceIndex = null;
let _dragSourceElement = null;
let _keydownListener = null;

/**
 * Get the current cached screen data.
 * @returns {object|null}
 */
export function getCurrentScreenData() {
  return _screenData;
}

/**
 * Initialise the layers panel.
 * Must be called once after the DOM is ready.
 *
 * @param {{
 *   projectId: string,
 *   screenId: string,
 *   apiClient: object,
 *   selectionModule: object,
 *   screenData: object,
 *   reRender: function,
 * }} options
 */
export function initLayers({ projectId, screenId, apiClient, selectionModule, screenData, reRender }) {
  _projectId = projectId;
  _screenId = screenId;
  _apiClient = apiClient;
  _selectionModule = selectionModule;
  _screenData = screenData;
  // reRender triggers a canvas refresh after mutations (e.g. visibility toggle)
  _reRender = reRender ?? null;

  const container = document.getElementById('layers-container');
  if (!container) return;

  // Render initial list
  renderLayers();

  // Wire up keyboard shortcuts for bring-to-front (]) and send-to-back ([)
  // Remove old listener if initLayers is called multiple times
  if (_keydownListener) {
    document.removeEventListener('keydown', _keydownListener);
  }

  _keydownListener = (e) => {
    // Skip if focused on input/textarea
    const focused = document.activeElement;
    if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) {
      return;
    }

    if (e.key === ']') {
      e.preventDefault();
      handleBringToFront();
    } else if (e.key === '[') {
      e.preventDefault();
      handleSendToBack();
    }
  };

  document.addEventListener('keydown', _keydownListener);
}

/**
 * Update the cached screen data (called by editor.js after mutations).
 * @param {object} screenData
 */
export function updateScreenData(screenData) {
  _screenData = screenData;
}

/**
 * Render the layers panel into #layers-container.
 * Lists all elements sorted by z_index descending.
 */
export function renderLayers() {
  const container = document.getElementById('layers-container');
  if (!container || !_screenData) return;

  const elements = getElementList(_screenData);

  // Clear and rebuild (safe: just removing children)
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (elements.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'layers-empty';
    empty.textContent = _t('layers.noElements', 'No elements');
    container.appendChild(empty);
    return;
  }

  // Create list wrapper
  const list = document.createElement('div');
  list.className = 'layers-list';

  for (const element of elements) {
    const row = createLayerRow(element);
    list.appendChild(row);
  }

  container.appendChild(list);
}

/**
 * Create a single layer row element.
 * @param {object} element
 * @returns {HTMLElement}
 */
function createLayerRow(element) {
  const row = document.createElement('div');
  row.className = 'layers-row';
  row.dataset.elementId = element.id;
  row.draggable = !isPinned(element); // Pinned elements not draggable

  // Drag handle
  const dragHandle = document.createElement('span');
  dragHandle.className = 'layers-drag-handle';
  dragHandle.textContent = '\u2237'; // ⠿ (box drawings light vertical and horizontal)
  dragHandle.style.visibility = isPinned(element) ? 'hidden' : 'visible';

  // Element name (use label if available, else type)
  const nameSpan = document.createElement('span');
  nameSpan.className = 'layers-name';
  const label = element.label || element.type;
  nameSpan.textContent = escapeHtml(label);

  // Visibility toggle (eye icon)
  const eyeBtn = document.createElement('button');
  eyeBtn.className = 'layers-eye-btn';
  const isVisible = element.properties?.opacity !== 0;
  eyeBtn.textContent = isVisible ? '\u{1F441}' : '\u{1F6AB}'; // 👁 or 🚫
  eyeBtn.title = isVisible ? 'Hide' : 'Show';
  eyeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleVisibilityToggle(element);
  });

  // Lock icon (if pinned)
  const lockSpan = document.createElement('span');
  lockSpan.className = 'layers-lock-icon';
  if (isPinned(element)) {
    lockSpan.textContent = '\u{1F512}'; // 🔒
    lockSpan.title = _t('layers.pinned', 'Pinned (z≥10)');
  }

  row.appendChild(dragHandle);
  row.appendChild(nameSpan);
  row.appendChild(eyeBtn);
  row.appendChild(lockSpan);

  // Selection: click row to select element on canvas
  row.addEventListener('click', () => {
    if (_selectionModule) {
      _selectionModule.select(element.id);
    }
  });

  // Drag events for reordering
  row.addEventListener('dragstart', (e) => {
    if (isPinned(element)) {
      e.preventDefault();
      return;
    }
    const elements = getElementList(_screenData);
    _dragSourceIndex = elements.findIndex(el => el.id === element.id);
    _dragSourceElement = element;
    e.dataTransfer.effectAllowed = 'move';
    row.classList.add('dragging');
  });

  row.addEventListener('dragend', () => {
    row.classList.remove('dragging');
    _dragSourceIndex = null;
    _dragSourceElement = null;
  });

  row.addEventListener('dragover', (e) => {
    if (_dragSourceElement && _dragSourceElement.id !== element.id) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Visual feedback: highlight where it will drop
      row.classList.add('drop-target');
    }
  });

  row.addEventListener('dragleave', () => {
    row.classList.remove('drop-target');
  });

  row.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    row.classList.remove('drop-target');

    if (!_dragSourceElement || _dragSourceElement.id === element.id) return;

    handleDragDrop(_dragSourceElement, element);
  });

  return row;
}

/**
 * Handle visibility toggle (eye icon click).
 * @param {object} element
 */
async function handleVisibilityToggle(element) {
  try {
    const isCurrentlyVisible = element.properties?.opacity !== 0;
    const newOpacity = isCurrentlyVisible ? 0 : 1;

    // Update element via API — send only the changed field so the server's
    // shallow merge preserves all other properties unchanged. Spreading the
    // full local cache here would risk overwriting properties that were
    // updated elsewhere (e.g. via MCP tools or the property panel) since the
    // last time _screenData was refreshed.
    if (_apiClient && _projectId && _screenId) {
      const payload = {
        properties: { opacity: newOpacity },
      };

      await _apiClient.updateElement(_projectId, _screenId, element.id, payload);

      // Update local cache
      element.properties = element.properties || {};
      element.properties.opacity = newOpacity;
      renderLayers();

      // Refresh canvas so the opacity change is visible immediately
      if (_reRender) await _reRender();
    }
  } catch (err) {
    console.error('[layers] visibility toggle failed', err);
  }
}

/**
 * Handle drag-drop reordering of elements.
 * Reassigns z_index values based on new order.
 *
 * @param {object} draggedElement
 * @param {object} targetElement
 */
async function handleDragDrop(draggedElement, targetElement) {
  if (!_screenData || !_apiClient) return;

  try {
    const elements = getElementList(_screenData);
    const draggedIdx = elements.findIndex(el => el.id === draggedElement.id);
    const targetIdx = elements.findIndex(el => el.id === targetElement.id);

    if (draggedIdx === -1 || targetIdx === -1) return;

    // Swap positions in the sorted array
    [elements[draggedIdx], elements[targetIdx]] = [elements[targetIdx], elements[draggedIdx]];

    // Reassign z_index values to maintain order
    // Separate pinned and non-pinned elements
    const nonPinned = elements.filter(el => !isPinned(el));
    const pinned = elements.filter(el => isPinned(el));

    // Assign z_index to non-pinned elements only (descending from count-1 down to 0)
    // This keeps non-pinned z_index < 10, avoiding contamination of the pinned zone
    let newZ = nonPinned.length - 1;
    for (const el of nonPinned) {
      el.z_index = newZ;
      newZ--;
    }

    // Pinned elements keep their existing z_index unchanged

    // PATCH each changed element
    for (const el of _screenData.elements) {
      const newZIdx = elements.find(e => e.id === el.id)?.z_index;
      if (newZIdx !== undefined && newZIdx !== (el.z_index ?? 0)) {
        el.z_index = newZIdx;
        if (_apiClient && _projectId && _screenId) {
          try {
            await _apiClient.updateElement(_projectId, _screenId, el.id, { z_index: newZIdx });
          } catch (err) {
            console.error('[layers] failed to update z_index for', el.id, err);
          }
        }
      }
    }

    // Re-render after reorder
    renderLayers();
  } catch (err) {
    console.error('[layers] drag-drop failed', err);
  }
}

/**
 * Handle bring-to-front keyboard shortcut (] key).
 */
async function handleBringToFront() {
  if (!_selectionModule || !_screenData || !_apiClient) return;

  const selectedId = _selectionModule.getSelectedId?.();
  if (!selectedId) return;

  const elements = getElementList(_screenData);
  const newZ = computeBringToFront(elements, selectedId);

  if (newZ === null) return; // Already pinned or not found

  try {
    // Update the element's z_index
    const selected = _screenData.elements.find(el => el.id === selectedId);
    if (selected) {
      selected.z_index = newZ;
      if (_projectId && _screenId) {
        await _apiClient.updateElement(_projectId, _screenId, selectedId, { z_index: newZ });
      }
      renderLayers();
    }
  } catch (err) {
    console.error('[layers] bring-to-front failed', err);
  }
}

/**
 * Handle send-to-back keyboard shortcut ([ key).
 */
async function handleSendToBack() {
  if (!_selectionModule || !_screenData || !_apiClient) return;

  const selectedId = _selectionModule.getSelectedId?.();
  if (!selectedId) return;

  const elements = getElementList(_screenData);
  const newZ = computeSendToBack(elements, selectedId);

  if (newZ === null) return; // Already pinned or not found

  try {
    // Update the element's z_index
    const selected = _screenData.elements.find(el => el.id === selectedId);
    if (selected) {
      selected.z_index = newZ;
      if (_projectId && _screenId) {
        await _apiClient.updateElement(_projectId, _screenId, selectedId, { z_index: newZ });
      }
      renderLayers();
    }
  } catch (err) {
    console.error('[layers] send-to-back failed', err);
  }
}

/**
 * Called when canvas selection changes.
 * Highlights the corresponding row and scrolls it into view.
 *
 * @param {string|null} elementId
 */
export function onSelectionChange(elementId) {
  const container = document.getElementById('layers-container');
  if (!container) return;

  // Clear previous selection highlight
  container.querySelectorAll('.layers-row').forEach(row => {
    row.classList.remove('selected');
  });

  // Highlight new selection
  if (elementId) {
    const row = container.querySelector(`[data-element-id="${elementId}"]`);
    if (row) {
      row.classList.add('selected');
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}
