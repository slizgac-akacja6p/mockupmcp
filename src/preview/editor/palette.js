// palette.js — Component palette sidebar (client-side ES module)
//
// Renders 35 components in 6 categories, manages add mode and recent
// component tracking. Requires the DOM structure baked into the editor page
// by server.js: #palette-categories, #palette-recent, #palette-recent-items,
// #palette-search-input.

import { getPaletteCategories } from './palette-data.js';

// Safe i18n helper — delegates to window.t when available (loaded via /i18n/index.js),
// falls back to the provided fallback or the raw key when running outside browser context.
const _t = (key, fallback) => (typeof globalThis.window !== 'undefined' && typeof window.t === 'function' ? window.t(key, fallback) : (fallback ?? key));

// Maps English category names (as defined in palette-data.js) to i18n keys so
// category headers are translated when a non-English locale is active.
const CATEGORY_KEY_MAP = {
  'Layout':     'palette.categories.layout',
  'Forms':      'palette.categories.forms',
  'Display':    'palette.categories.display',
  'Navigation': 'palette.categories.navigation',
  'Feedback':   'palette.categories.feedback',
  'Media':      'palette.categories.media',
};

// localStorage key for the 5 most recently used component types.
const RECENT_KEY = 'palette-recent';
const MAX_RECENT = 5;

// ---------------------------------------------------------------------------
// Recent component persistence
// ---------------------------------------------------------------------------

/**
 * Read the recent list from localStorage.
 * @returns {string[]} Array of component type names (newest-first).
 */
export function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Prepend a type to the recent list and persist it.
 * Keeps the list at most MAX_RECENT entries, deduplicating before prepend.
 *
 * @param {string} type
 * @returns {string[]} Updated recent list.
 */
export function pushRecent(type) {
  const prev = loadRecent().filter(t => t !== type);
  const next = [type, ...prev].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be blocked in sandboxed contexts — silently skip.
  }
  return next;
}

// ---------------------------------------------------------------------------
// Search filtering (pure — easy to unit-test)
// ---------------------------------------------------------------------------

/**
 * Filter a flat list of component labels against a search query.
 *
 * @param {Array<{ type: string, label: string }>} components
 * @param {string} query
 * @returns {Array<{ type: string, label: string }>} Matching components (case-insensitive).
 */
export function filterComponents(components, query) {
  const q = query.trim().toLowerCase();
  if (!q) return components;
  return components.filter(c =>
    c.label.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)
  );
}

// ---------------------------------------------------------------------------
// DOM rendering helpers (internal)
// ---------------------------------------------------------------------------

/** Clear all children of a DOM node without using innerHTML. */
function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Rebuild the recent-chips row from the current localStorage state.
 * Shows #palette-recent when list is non-empty.
 *
 * @param {string}   activeType - The currently active add-mode type, or null.
 * @param {(type: string) => void} onClickChip
 */
function renderRecent(activeType, onClickChip) {
  const container = document.getElementById('palette-recent');
  const list      = document.getElementById('palette-recent-items');
  if (!container || !list) return;

  const recent = loadRecent();
  container.style.display = recent.length ? '' : 'none';
  clearChildren(list);

  for (const type of recent) {
    const chip = document.createElement('div');
    chip.className = 'palette-recent-chip' + (type === activeType ? ' active' : '');
    chip.textContent = type;
    chip.dataset.type = type;
    chip.addEventListener('click', () => onClickChip(type));
    list.appendChild(chip);
  }
}

/**
 * Render all categories into #palette-categories.
 *
 * @param {string}   activeType   - Type string of the add-mode-active item, or null.
 * @param {string}   searchQuery  - Current search filter value.
 * @param {(type: string) => void} onClickItem
 */
function renderCategories(activeType, searchQuery, onClickItem) {
  const container = document.getElementById('palette-categories');
  if (!container) return;

  const categories = getPaletteCategories();
  clearChildren(container);

  for (const cat of categories) {
    // Determine which items survive the search filter.
    const visible = filterComponents(cat.components, searchQuery);

    // Skip entirely empty categories during a search.
    if (searchQuery.trim() && visible.length === 0) continue;

    const section = document.createElement('div');
    section.className = 'palette-category';
    section.dataset.category = cat.name;

    const header = document.createElement('div');
    header.className = 'palette-category-header';
    const catKey = CATEGORY_KEY_MAP[cat.name] ?? cat.name;
    header.textContent = _t(catKey, cat.name);

    const items = document.createElement('div');
    items.className = 'palette-items';

    // Collapse/expand on header click — collapsed state stored inline so it
    // survives a category re-render without needing external state.
    header.addEventListener('click', () => {
      const collapsed = items.style.display === 'none';
      items.style.display = collapsed ? '' : 'none';
    });

    for (const comp of visible) {
      const item = document.createElement('div');
      item.className = 'palette-item' + (comp.type === activeType ? ' add-mode-active' : '');
      item.dataset.type = comp.type;

      // Small colour square acts as a simple visual icon without SVG deps.
      const icon = document.createElement('span');
      icon.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:2px;background:#4a90e2;flex-shrink:0;';

      const labelEl = document.createElement('span');
      labelEl.textContent = comp.label;

      item.appendChild(icon);
      item.appendChild(labelEl);

      item.addEventListener('click', () => onClickItem(comp.type));
      items.appendChild(item);
    }

    section.appendChild(header);
    section.appendChild(items);
    container.appendChild(section);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Currently active add-mode type inside this module (module-level singleton). */
let _activeType = null;
let _onAddModeEnter = null;
let _onAddModeExit  = null;

/**
 * Initialise the component palette sidebar.
 *
 * Must be called once after the DOM is ready (editor page load).
 *
 * @param {{
 *   onAddModeEnter: (componentType: string) => void,
 *   onAddModeExit:  () => void,
 *   getAddModeType: () => string|null,
 * }} options
 */
export function initPalette(options) {
  _onAddModeEnter = options.onAddModeEnter;
  _onAddModeExit  = options.onAddModeExit;

  let searchQuery = '';

  // Callback shared by category items and recent chips.
  function enterAddMode(type) {
    _activeType = type;
    pushRecent(type);
    renderAll();
    if (_onAddModeEnter) _onAddModeEnter(type);
  }

  function renderAll() {
    renderCategories(_activeType, searchQuery, enterAddMode);
    renderRecent(_activeType, enterAddMode);
  }

  // Search input wiring
  const searchInput = document.getElementById('palette-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderAll();
    });
  }

  // Initial render
  renderAll();
}

/**
 * Remove the add-mode-active class from all palette items and clear internal
 * state. Called by editor.js when add mode is cancelled (e.g. Escape key or
 * successful element placement).
 */
export function exitPaletteAddMode() {
  _activeType = null;
  if (_onAddModeExit) _onAddModeExit();

  // Update DOM directly — avoids a full re-render just for class removal.
  document.querySelectorAll('.palette-item.add-mode-active, .palette-recent-chip.active')
    .forEach(el => el.classList.remove('add-mode-active', 'active'));
}
