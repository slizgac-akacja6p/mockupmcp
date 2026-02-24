// Client-side component palette panel — populated from the catalog baked in at inject time.
export function buildPaletteJS(categories) {
  const catalogJSON = JSON.stringify(categories.map(cat => ({
    name: cat.name,
    components: cat.components.map(c => ({
      type: c.type,
      label: c.label,
      width: c.width,
      height: c.height,
      properties: c.properties,
    })),
  })));

  return `<script>
(function() {
  var CATALOG = ${catalogJSON};

  var palette = document.createElement('div');
  palette.className = 'editor-palette';
  palette.id = 'editor-palette';

  CATALOG.forEach(function(cat) {
    var h4 = document.createElement('h4');
    h4.textContent = cat.name;
    palette.appendChild(h4);

    cat.components.forEach(function(comp) {
      var item = document.createElement('div');
      item.className = 'palette-item';
      item.textContent = comp.label;
      item.draggable = true;
      item.dataset.type = comp.type;
      item.dataset.width = comp.width;
      item.dataset.height = comp.height;
      item.dataset.properties = JSON.stringify(comp.properties);

      item.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('application/x-mockup-component', JSON.stringify({
          type: comp.type,
          width: comp.width,
          height: comp.height,
          properties: comp.properties,
        }));
        e.dataTransfer.effectAllowed = 'copy';
      });

      palette.appendChild(item);
    });
  });

  document.body.appendChild(palette);

  document.addEventListener('editor:modeChange', function(e) {
    if (e.detail.mode === 'edit') {
      palette.classList.add('visible');
    } else {
      palette.classList.remove('visible');
    }
  });

  // Handle drop on the screen canvas
  var screenEl = document.querySelector('.screen');
  if (screenEl) {
    screenEl.addEventListener('dragover', function(e) {
      if (window._editorMode !== 'edit') return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    screenEl.addEventListener('drop', function(e) {
      if (window._editorMode !== 'edit') return;
      e.preventDefault();
      var data = e.dataTransfer.getData('application/x-mockup-component');
      if (!data) return;
      var comp = JSON.parse(data);
      var rect = screenEl.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      document.dispatchEvent(new CustomEvent('element:added', {
        detail: {
          element: {
            type: comp.type,
            x: Math.round(x),
            y: Math.round(y),
            width: comp.width,
            height: comp.height,
            properties: comp.properties,
          },
        },
      }));
    });
  }
})();
<\/script>`;
}

// Catalog is baked in at module load time (server-side) so the client receives
// a static JSON string — no runtime imports or dynamic lookups needed.
import { getPaletteCategories } from './palette-data.js';
export const PALETTE_JS = buildPaletteJS(getPaletteCategories());
