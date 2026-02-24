// Property panel logic for the in-browser editor.
//
// All rendering/parsing functions are pure so they can be unit-tested in
// Node.js without a DOM. initPropertyPanel() is the single DOM-aware entry
// point and is only called at runtime.

import { getComponentDefaults } from './component-meta.js';

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

/**
 * Render the property panel HTML from a list of field definitions.
 * Groups are rendered as labelled sections; each field gets data-field and
 * data-field-type attributes so initPropertyPanel() can bind events without
 * querying by name.
 *
 * @param {ReturnType<typeof buildFieldDefinitions>} fields
 * @returns {string}
 */
export function renderPanelHtml(fields) {
  // Group fields preserving encounter order of group names
  const groupOrder = [];
  const grouped = {};

  for (const field of fields) {
    if (!grouped[field.group]) {
      groupOrder.push(field.group);
      grouped[field.group] = [];
    }
    grouped[field.group].push(field);
  }

  // Range slider limits for position fields so the slider covers a useful range
  // without requiring manual typing for extreme values.
  const RANGE_LIMITS = { x: 1000, y: 1500, width: 1000, height: 1500 };

  function renderField(f, group) {
    const disabledAttr = f.readonly ? ' disabled' : '';

    // Position fields: label + number input on one row, full-width slider below.
    // Stacking vertically avoids overflow in the 280px panel that the old
    // side-by-side (label | slider | number) layout caused.
    if (group === 'position' && f.fieldType === 'number' && !f.readonly) {
      const maxVal = RANGE_LIMITS[f.name] || 1000;
      const minVal = (f.name === 'width' || f.name === 'height') ? 1 : 0;
      return `<div class="panel-field">
  <div class="panel-range-combo">
    <div class="panel-field-header">
      <label class="panel-label">${escPanelVal(f.name)}</label>
      <input type="number" class="panel-input"
             data-field="${escPanelVal(f.name)}"
             data-field-type="number"
             value="${escPanelVal(f.value)}">
    </div>
    <input type="range" class="panel-slider"
           data-field="${escPanelVal(f.name)}"
           data-field-type="number"
           min="${minVal}" max="${maxVal}"
           value="${escPanelVal(f.value)}">
  </div>
</div>`;
    }

    const input = f.fieldType === 'boolean'
      ? `<select
           class="panel-input"
           data-field="${escPanelVal(f.name)}"
           data-field-type="${escPanelVal(f.fieldType)}"${disabledAttr}>
           <option value="true"${f.value === true  ? ' selected' : ''}>true</option>
           <option value="false"${f.value === false ? ' selected' : ''}>false</option>
         </select>`
      : `<input
           class="panel-input"
           type="${f.fieldType === 'number' ? 'number' : f.fieldType === 'color' ? 'color' : 'text'}"
           data-field="${escPanelVal(f.name)}"
           data-field-type="${escPanelVal(f.fieldType)}"
           value="${escPanelVal(f.value)}"${disabledAttr}>`;

    return `<div class="panel-field">
  <label class="panel-label">${escPanelVal(f.name)}</label>
  ${input}
</div>`;
  }

  const sections = groupOrder.map((group) => {
    const groupFields = grouped[group];

    // Position group: render x,y and width,height in a 2-column grid
    // so related dimension pairs sit side by side.
    if (group === 'position') {
      const fieldHtmls = groupFields.map(f => renderField(f, group));
      return `<div class="panel-group" data-group="${escPanelVal(group)}">
  <div class="panel-group-title">${escPanelVal(group)}</div>
  <div class="panel-position-grid">
    ${fieldHtmls.join('\n    ')}
  </div>
</div>`;
    }

    const rows = groupFields.map(f => renderField(f, group));

    return `<div class="panel-group" data-group="${escPanelVal(group)}">
  <div class="panel-group-title">${escPanelVal(group)}</div>
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
 * @param {Element} panelEl
 * @param {(changes: Record<string, unknown>) => void} onSave
 */
export function initPropertyPanel(panelEl, onSave) {
  // Sync range slider → companion number input in real-time while dragging
  panelEl.addEventListener('input', (e) => {
    const slider = e.target;
    if (slider.type !== 'range' || !slider.classList.contains('panel-slider')) return;
    const fieldName = slider.dataset.field;
    const numberInput = panelEl.querySelector(
      `input[type="number"][data-field="${fieldName}"]`
    );
    if (numberInput) numberInput.value = slider.value;
  });

  panelEl.addEventListener('change', (e) => {
    const input = e.target;
    const fieldName = input.dataset.field;
    const fieldType = input.dataset.fieldType;

    // Ignore events from elements that aren't panel fields
    if (!fieldName || !fieldType) return;

    const parsed = parseFieldValue(input.value, fieldType);

    // Sync number input → companion range slider
    if (input.type === 'number') {
      const slider = panelEl.querySelector(
        `input[type="range"][data-field="${fieldName}"]`
      );
      if (slider) slider.value = parsed;
    }
    // Sync range slider → companion number input (on final commit)
    if (input.type === 'range') {
      const numberInput = panelEl.querySelector(
        `input[type="number"][data-field="${fieldName}"]`
      );
      if (numberInput) numberInput.value = parsed;
    }

    onSave({ [fieldName]: parsed });
  });
}
