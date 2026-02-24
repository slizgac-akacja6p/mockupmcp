// Builds inspector panel HTML from schemas baked in at import time.
import { getEditableProps } from './inspector-schema.js';

// Pre-build schemas for all known types as JSON for client-side use.
const KNOWN_TYPES = [
  'text', 'rectangle', 'circle', 'line', 'image', 'icon',
  'button', 'input', 'textarea', 'checkbox', 'radio', 'toggle', 'select', 'slider',
  'navbar', 'tabbar', 'sidebar', 'breadcrumb',
  'card', 'list', 'table', 'avatar', 'badge', 'chip',
  'alert', 'modal', 'skeleton', 'progress', 'tooltip',
  'login_form', 'search_bar', 'header', 'footer', 'data_table', 'chart_placeholder',
];

const SCHEMAS = {};
for (const t of KNOWN_TYPES) {
  SCHEMAS[t] = getEditableProps(t);
}

export const INSPECTOR_JS = `<script>
(function() {
  var SCHEMAS = ${JSON.stringify(SCHEMAS)};
  var inspector = null;
  var currentElement = null;

  function createInspector() {
    inspector = document.createElement('div');
    inspector.className = 'editor-inspector';
    inspector.id = 'editor-inspector';
    inspector.innerHTML = '<div class="no-selection">Select an element</div>';
    document.body.appendChild(inspector);
  }

  function renderInspector(elementData) {
    if (!inspector) return;
    var type = elementData.type || 'text';
    var props = SCHEMAS[type] || SCHEMAS['text'];
    var html = '<h4>' + type + '</h4>';

    props.forEach(function(prop) {
      var val = '';
      if (prop.key === 'x' || prop.key === 'y' || prop.key === 'width' || prop.key === 'height' || prop.key === 'z_index' || prop.key === 'opacity') {
        val = elementData[prop.key] !== undefined ? elementData[prop.key] : '';
      } else {
        val = (elementData.properties && elementData.properties[prop.key] !== undefined) ? elementData.properties[prop.key] : '';
      }

      html += '<div class="prop-row">';
      html += '<label>' + prop.label + '</label>';
      if (prop.type === 'select') {
        html += '<select data-prop="' + prop.key + '">';
        (prop.options || []).forEach(function(o) {
          html += '<option value="' + o + '"' + (String(val) === String(o) ? ' selected' : '') + '>' + o + '</option>';
        });
        html += '</select>';
      } else if (prop.type === 'boolean') {
        html += '<input type="checkbox" data-prop="' + prop.key + '"' + (val ? ' checked' : '') + '>';
      } else {
        html += '<input type="' + (prop.type === 'number' ? 'number' : 'text') + '" data-prop="' + prop.key + '" value="' + String(val).replace(/"/g, '&quot;') + '">';
      }
      html += '</div>';
    });

    inspector.innerHTML = html;

    // Wire change events so edits dispatch element:updated for the canvas-state undo stack.
    inspector.querySelectorAll('input, select').forEach(function(input) {
      input.addEventListener('change', function() {
        var key = input.dataset.prop;
        var newVal = input.type === 'checkbox' ? input.checked : (input.type === 'number' ? parseFloat(input.value) : input.value);
        var before = {};
        var after = {};
        var isPositionProp = ['x','y','width','height','z_index','opacity'].includes(key);
        if (isPositionProp) {
          before[key] = elementData[key];
          after[key] = newVal;
        } else {
          before = Object.assign({}, elementData.properties || {});
          after = Object.assign({}, elementData.properties || {});
          after[key] = newVal;
        }
        document.dispatchEvent(new CustomEvent('element:updated', {
          detail: { id: elementData.id, before: before, after: after, isPositionProp: isPositionProp },
        }));
      });
    });
  }

  document.addEventListener('editor:modeChange', function(e) {
    if (!inspector) createInspector();
    if (e.detail.mode === 'edit') {
      inspector.classList.add('visible');
    } else {
      inspector.classList.remove('visible');
      inspector.innerHTML = '<div class="no-selection">Select an element</div>';
    }
  });

  document.addEventListener('editor:select', function(e) {
    if (!inspector) return;
    if (!e.detail.id) {
      inspector.innerHTML = '<div class="no-selection">Select an element</div>';
      currentElement = null;
      return;
    }
    // Fetch element data from REST API
    var pid = window._editorProjectId || '';
    var sid = window._editorScreenId || '';
    if (!pid || !sid) return;
    fetch('/api/screens/' + pid + '/' + sid + '/elements')
      .then(function(r) { return r.json(); })
      .then(function(elements) {
        var el = elements.find(function(e) { return e.id === e.detail && false; });
        el = elements.find(function(elem) { return elem.id === e.detail.id; });
        if (el) {
          currentElement = el;
          renderInspector(el);
        }
      });
  });
})();
<\/script>`;
