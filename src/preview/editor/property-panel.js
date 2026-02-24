// Property panel logic for the in-browser editor.
//
// All rendering/parsing functions are pure so they can be unit-tested in
// Node.js without a DOM. initPropertyPanel() is the single DOM-aware entry
// point and is only called at runtime.

import { getComponentDefaults } from './component-meta.js';
import { debounce } from './utils.js';

// i18n helper — safe fallback when the i18n module hasn't loaded yet or in Node.js tests.
const _t = (key, fallback) => (typeof globalThis.window !== 'undefined' && typeof window.t === 'function' ? window.t(key, fallback) : (fallback ?? key));

// ---------------------------------------------------------------------------
// Toggle switch CSS — injected once into <head> on first panel render.
// Kept here so the panel is self-contained and doesn't require server-side
// CSS changes when the panel widget set evolves.
// ---------------------------------------------------------------------------
const TOGGLE_SWITCH_CSS = `
<style id="prop-panel-toggle-css">
.prop-toggle { position: relative; display: inline-block; width: 32px; height: 18px; }
.prop-toggle input { opacity: 0; width: 0; height: 0; }
.prop-toggle-slider { position: absolute; inset: 0; background: #333; border-radius: 9px; transition: .2s; cursor: pointer; }
.prop-toggle-slider:before { content: ''; position: absolute; width: 14px; height: 14px; left: 2px; bottom: 2px; background: #888; border-radius: 50%; transition: .2s; }
input:checked + .prop-toggle-slider { background: #6366F1; }
input:checked + .prop-toggle-slider:before { transform: translateX(14px); background: white; }
</style>`;

// Fields that live at element level in the data model, not inside .properties.
const POSITION_FIELDS = new Set(['x', 'y', 'width', 'height']);

// Field names whose string values represent colours.
const COLOR_FIELD_NAMES = new Set([
  'color', 'background', 'backgroundColor', 'borderColor', 'fill', 'stroke',
]);

// ---------------------------------------------------------------------------
// Field type classification
// ---------------------------------------------------------------------------

/**
 * Derive the logical field type from the field name and its current value.
 * Used to choose the right input widget and value parser.
 *
 * @param {string} name
 * @param {unknown} value
 * @returns {'number'|'text'|'boolean'|'color'|'json'}
 */
export function classifyFieldType(name, value) {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number')  return 'number';
  if (typeof value === 'string') {
    if (COLOR_FIELD_NAMES.has(name)) return 'color';
    return 'text';
  }
  if (typeof value === 'object' && value !== null) return 'json';
  return 'text';
}

// ---------------------------------------------------------------------------
// Value parsing
// ---------------------------------------------------------------------------

/**
 * Convert a raw string input value (from an HTML input element) to the
 * runtime type expected by the data model.
 *
 * @param {string|boolean} raw
 * @param {'number'|'text'|'boolean'|'color'|'json'} fieldType
 * @returns {unknown}
 */
export function parseFieldValue(raw, fieldType) {
  switch (fieldType) {
    case 'number':  return Number(raw);
    case 'boolean': return raw === 'true' || raw === true;
    case 'json': {
      try { return JSON.parse(raw); } catch { return raw; }
    }
    // color and text are already strings
    default: return String(raw);
  }
}

// ---------------------------------------------------------------------------
// Field definition builder
// ---------------------------------------------------------------------------

/**
 * Build a flat list of field descriptors for a given element.
 * Ordering: info (type) → position (x,y,w,h) → properties (component-specific).
 *
 * @param {{ id: string, type: string, x: number, y: number, width: number, height: number, properties?: Record<string, unknown> }} element
 * @returns {Array<{ name: string, value: unknown, fieldType: string, readonly: boolean, group: string }>}
 */
export function buildFieldDefinitions(element) {
  const fields = [];

  // --- info group ---
  fields.push({
    name:      'type',
    value:     element.type,
    fieldType: 'text',
    readonly:  true,
    group:     'info',
  });

  // --- position group (always present, sourced from element root) ---
  for (const name of ['x', 'y', 'width', 'height']) {
    fields.push({
      name,
      value:     element[name] ?? 0,
      fieldType: 'number',
      readonly:  false,
      group:     'position',
    });
  }

  // --- properties group (component defaults merged with element overrides) ---
  const defaults   = getComponentDefaults(element.type);
  const elementProps = element.properties ?? {};

  // Union of keys: defaults first so we always expose all known fields even
  // when the stored element omits them.
  const propKeys = new Set([...Object.keys(defaults), ...Object.keys(elementProps)]);

  for (const name of propKeys) {
    const value = name in elementProps ? elementProps[name] : defaults[name];

    // Skip fields that are better handled elsewhere or are not editable inline.
    // Arrays and nested objects get the 'json' type; _style and link_to are
    // internal renderer/navigation concerns that the panel must not expose.
    if (name === '_style' || name === 'link_to') continue;
    if (Array.isArray(value))                    continue;

    const fieldType = classifyFieldType(name, value);

    // Skip nested objects — json fields clutter the panel and are rarely
    // hand-edited; they can be added back when a dedicated JSON editor exists.
    if (fieldType === 'json') continue;

    fields.push({ name, value, fieldType, readonly: false, group: 'properties' });
  }

  return fields;
}

// ---------------------------------------------------------------------------
// PATCH payload builder
// ---------------------------------------------------------------------------

/**
 * Split a flat changes map into the shape the PATCH API expects:
 * position fields at the top level, everything else under `properties`.
 *
 * @param {Record<string, unknown>} changes
 * @returns {{ x?: number, y?: number, width?: number, height?: number, properties?: Record<string, unknown> }}
 */
export function buildUpdatePayload(changes) {
  const payload = {};
  const properties = {};

  for (const [key, value] of Object.entries(changes)) {
    if (POSITION_FIELDS.has(key)) {
      payload[key] = value;
    } else {
      properties[key] = value;
    }
  }

  if (Object.keys(properties).length > 0) {
    payload.properties = properties;
  }

  return payload;
}

// ---------------------------------------------------------------------------
// HTML rendering (pure, no DOM)
// ---------------------------------------------------------------------------

/**
 * Escape a value for safe use inside an HTML attribute (double-quoted).
 * Handles non-string values by converting them first.
 *
 * @param {unknown} val
 * @returns {string}
 */
function escPanelVal(val) {
  return String(val ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/"/g,  '&quot;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;');
}

// Human-readable section titles for each group name in the panel.
// Computed at render time so i18n picks up the current language.
function getGroupTitles() {
  return {
    info:       _t('panel.element', 'Element'),
    position:   _t('panel.positionAndSize', 'Position & Size'),
    properties: _t('panel.style', 'Style'),
  };
}

/**
 * Render the property panel HTML from a list of field definitions.
 * Groups are rendered as labelled sections; each field gets data-field and
 * data-field-type attributes so initPropertyPanel() can bind events without
 * querying by name.
 *
 * Layout decisions:
 *  - Position group: x+y on one row, width+height on another (2-column grid)
 *    with compact number inputs.
 *  - Color fields: native color picker swatch + text input side by side so
 *    the hex value is always visible and editable.
 *  - Boolean fields: toggle switch (checkbox) instead of a select so
 *    state is immediately obvious without reading a dropdown label.
 *
 * @param {ReturnType<typeof buildFieldDefinitions>} fields
 * @returns {string}
 */
export function renderPanelHtml(fields) {
  // Group fields preserving encounter order of group names.
  const groupOrder = [];
  const grouped = {};

  for (const field of fields) {
    if (!grouped[field.group]) {
      groupOrder.push(field.group);
      grouped[field.group] = [];
    }
    grouped[field.group].push(field);
  }

  // Slider max heuristics: position fields use screen-dimension limits,
  // property number fields use a conservative upper bound.
  function sliderMax(name) {
    if (name === 'x' || name === 'width') return 2000;
    if (name === 'y' || name === 'height') return 2000;
    return 1000;
  }

  function renderNumberCompact(f) {
    const max = sliderMax(f.name);
    return `<div class="panel-field panel-field--compact prop-field-with-slider">
  <label class="panel-label">${escPanelVal(f.name)}</label>
  <input type="number" class="panel-input panel-input--compact"
         data-field="${escPanelVal(f.name)}"
         data-field-type="number"
         value="${escPanelVal(f.value)}">
  <input type="range" class="prop-slider"
         data-field="${escPanelVal(f.name)}"
         data-field-type="number"
         min="0" max="${max}"
         value="${escPanelVal(f.value)}">
</div>`;
  }

  function renderField(f) {
    const disabledAttr = f.readonly ? ' disabled' : '';

    if (f.fieldType === 'boolean') {
      // Toggle switch: visually clear on/off without reading a dropdown value.
      const checkedAttr = f.value === true ? ' checked' : '';
      return `<div class="panel-field panel-field--inline">
  <label class="panel-label">${escPanelVal(f.name)}</label>
  <label class="prop-toggle">
    <input type="checkbox"
           data-field="${escPanelVal(f.name)}"
           data-field-type="boolean"
           value="true"${checkedAttr}${disabledAttr}>
    <span class="prop-toggle-slider"></span>
  </label>
</div>`;
    }

    if (f.fieldType === 'color') {
      // Color swatch (native picker) + text input side by side so the hex
      // value is always readable and editable without opening the picker.
      return `<div class="panel-field">
  <label class="panel-label">${escPanelVal(f.name)}</label>
  <div class="panel-color-row">
    <input type="color" class="panel-color-swatch"
           data-field="${escPanelVal(f.name)}"
           data-field-type="color"
           value="${escPanelVal(f.value)}"${disabledAttr}>
    <input type="text" class="panel-input panel-input--color-text"
           data-field="${escPanelVal(f.name)}"
           data-field-type="color"
           value="${escPanelVal(f.value)}"${disabledAttr}>
  </div>
</div>`;
    }

    const inputType = f.fieldType === 'number' ? 'number' : 'text';
    if (f.fieldType === 'number') {
      const max = sliderMax(f.name);
      return `<div class="panel-field prop-field-with-slider">
  <label class="panel-label">${escPanelVal(f.name)}</label>
  <input class="panel-input"
         type="number"
         data-field="${escPanelVal(f.name)}"
         data-field-type="number"
         value="${escPanelVal(f.value)}"${disabledAttr}>
  <input type="range" class="prop-slider"
         data-field="${escPanelVal(f.name)}"
         data-field-type="number"
         min="0" max="${max}"
         value="${escPanelVal(f.value)}"${disabledAttr}>
</div>`;
    }
    return `<div class="panel-field">
  <label class="panel-label">${escPanelVal(f.name)}</label>
  <input class="panel-input"
         type="${inputType}"
         data-field="${escPanelVal(f.name)}"
         data-field-type="${escPanelVal(f.fieldType)}"
         value="${escPanelVal(f.value)}"${disabledAttr}>
</div>`;
  }

  const groupTitles = getGroupTitles();
  const sections = groupOrder.map((group) => {
    const groupFields = grouped[group];
    const title = groupTitles[group] || group;

    if (group === 'position') {
      // x+y on one row, width+height on another — pairs share a label row.
      const [xF, yF, wF, hF] = groupFields;
      return `<div class="panel-group" data-group="position">
  <div class="panel-group-title">${escPanelVal(title)}</div>
  <div class="panel-pos-pair">
    ${renderNumberCompact(xF)}
    ${renderNumberCompact(yF)}
  </div>
  <div class="panel-pos-pair">
    ${renderNumberCompact(wF)}
    ${renderNumberCompact(hF)}
  </div>
</div>`;
    }

    const rows = groupFields.map(f => renderField(f));
    return `<div class="panel-group" data-group="${escPanelVal(group)}">
  <div class="panel-group-title">${escPanelVal(title)}</div>
  ${rows.join('\n  ')}
</div>`;
  });

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// DOM binding (only runs in browser)
// ---------------------------------------------------------------------------

/**
 * Attach a delegated 'change' listener to the panel element.
 * Parses the changed value to the correct runtime type and forwards a
 * single-key change map to onSave so the caller can build the PATCH payload.
 *
 * Also injects toggle-switch CSS once into <head> and installs a
 * light/dark theme toggle button into the editor toolbar.
 *
 * @param {Element} panelEl
 * @param {(changes: Record<string, unknown>) => void} onSave
 */
export function initPropertyPanel(panelEl, onSave) {
  // Inject toggle-switch styles once — idempotent via the id guard.
  if (!document.getElementById('prop-panel-toggle-css')) {
    document.head.insertAdjacentHTML('beforeend', TOGGLE_SWITCH_CSS);
  }

  // Install light/dark theme toggle into the editor toolbar if not already
  // present. The button self-inserts before the Preview link so it requires
  // no changes to buildEditorPage in server.js.
  _installThemeToggle();

  // Debounce PATCH calls so rapid slider/input changes batch into one request.
  const debouncedSave = debounce((changes) => onSave(changes), 150);

  // Slider ↔ number input sync: dragging the slider updates the number field
  // in real-time and triggers a debounced save. The 'input' event fires
  // continuously while dragging; 'change' fires on release.
  panelEl.addEventListener('input', (e) => {
    const slider = e.target;
    if (slider.type !== 'range') return;
    const fieldName = slider.dataset.field;
    if (!fieldName) return;

    // Update the corresponding number input to reflect the slider position.
    const numInput = panelEl.querySelector(
      `input[type="number"][data-field="${fieldName}"]`
    );
    if (numInput) numInput.value = slider.value;

    const parsed = parseFieldValue(slider.value, 'number');
    debouncedSave({ [fieldName]: parsed });
  });

  panelEl.addEventListener('change', (e) => {
    const input = e.target;
    const fieldName = input.dataset.field;
    const fieldType = input.dataset.fieldType;

    // Ignore events from elements that aren't panel fields.
    if (!fieldName || !fieldType) return;

    // Slider 'change' fires on mouse-up — already handled by 'input' above,
    // but sync the number input one final time for accuracy.
    if (input.type === 'range') {
      const numInput = panelEl.querySelector(
        `input[type="number"][data-field="${fieldName}"]`
      );
      if (numInput) numInput.value = input.value;
      const parsed = parseFieldValue(input.value, 'number');
      debouncedSave({ [fieldName]: parsed });
      return;
    }

    // Checkbox (boolean toggle): use .checked, not .value.
    const rawValue = input.type === 'checkbox' ? input.checked : input.value;
    const parsed = parseFieldValue(rawValue, fieldType);

    // Keep the color text input in sync when the native color swatch changes.
    if (input.type === 'color') {
      const textInput = panelEl.querySelector(
        `input[type="text"][data-field="${fieldName}"]`
      );
      if (textInput) textInput.value = input.value;
    }
    // Keep the color swatch in sync when the text input changes.
    if (input.type === 'text' && fieldType === 'color') {
      const swatchInput = panelEl.querySelector(
        `input[type="color"][data-field="${fieldName}"]`
      );
      if (swatchInput) swatchInput.value = input.value;
    }

    // When a number input changes, keep its sibling slider in sync.
    if (input.type === 'number') {
      const slider = panelEl.querySelector(
        `input[type="range"][data-field="${fieldName}"]`
      );
      if (slider) slider.value = input.value;
    }

    debouncedSave({ [fieldName]: parsed });
  });
}

// ---------------------------------------------------------------------------
// Light/Dark theme toggle — wired to #theme-toggle-btn in left sidebar.
// ---------------------------------------------------------------------------

/**
 * Wire click handler on the pre-rendered #theme-toggle-btn in #sidebar-theme-toggle.
 * Reads/writes the `editor-theme` key in localStorage and toggles
 * data-theme="light"|"dark" on <body> so CSS vars can be overridden.
 * Idempotent — safe to call multiple times (guards via data attribute).
 */
function _installThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';

  const icon = btn.querySelector('#theme-icon');

  // Restore persisted theme before rendering the correct icon.
  const saved = localStorage.getItem('editor-theme') || 'dark';
  document.body.dataset.theme = saved;
  if (icon) icon.textContent = saved === 'light' ? '\u2600' : '\u263E';

  btn.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
    document.body.dataset.theme = next;
    if (icon) icon.textContent = next === 'light' ? '\u2600' : '\u263E';
    localStorage.setItem('editor-theme', next);
  });
}
