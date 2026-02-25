// Canvas engine — overlay for selection, drag, resize, and snap in edit mode.
// Communicates via document CustomEvents so it stays decoupled from server logic.
export const CANVAS_JS = `<script>
(function() {
  var snapEnabled = true;
  var snapSize = 8;
  var selectedId = null;
  var isDragging = false;
  var isResizing = false;
  var dragStartMouse = null;
  var dragStartPos = null;
  var resizeHandle = null;
  var overlay = null;

  function snap(v) {
    if (!snapEnabled || !snapSize) return Math.round(v);
    return Math.round(v / snapSize) * snapSize;
  }

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'editor-canvas-overlay';
    overlay.id = 'editor-canvas-overlay';
    var screen = document.querySelector('.screen');
    if (screen) {
      screen.style.position = 'relative';
      screen.appendChild(overlay);
    }
  }

  function showSelection(el) {
    if (!overlay || !el) return;
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

    var rect = el.getBoundingClientRect();
    var parentRect = overlay.getBoundingClientRect();
    var offsetX = rect.left - parentRect.left;
    var offsetY = rect.top - parentRect.top;

    var box = document.createElement('div');
    box.className = 'editor-selection-box';
    box.style.left = offsetX + 'px';
    box.style.top = offsetY + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
    overlay.appendChild(box);

    // 8 resize handles around the selection border
    var positions = [
      { x: '0%',   y: '0%',   cursor: 'nw-resize' },
      { x: '50%',  y: '0%',   cursor: 'n-resize'  },
      { x: '100%', y: '0%',   cursor: 'ne-resize' },
      { x: '100%', y: '50%',  cursor: 'e-resize'  },
      { x: '100%', y: '100%', cursor: 'se-resize' },
      { x: '50%',  y: '100%', cursor: 's-resize'  },
      { x: '0%',   y: '100%', cursor: 'sw-resize' },
      { x: '0%',   y: '50%',  cursor: 'w-resize'  },
    ];
    positions.forEach(function(p) {
      var h = document.createElement('div');
      h.className = 'editor-handle';
      h.style.left = 'calc(' + p.x + ' + ' + offsetX + 'px - 4px)';
      h.style.top  = 'calc(' + p.y + ' + ' + offsetY + 'px - 4px)';
      h.style.cursor = p.cursor;
      h.dataset.handle = p.cursor;
      overlay.appendChild(h);
    });
  }

  function clearSelection() {
    selectedId = null;
    if (overlay) while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    document.dispatchEvent(new CustomEvent('editor:select', { detail: { id: null } }));
  }

  function getElementById(id) {
    return document.querySelector('[data-el-id="' + id + '"]');
  }

  function handleMouseDown(e) {
    if (window._editorMode !== 'edit') return;

    // Resize handle takes priority
    if (e.target.classList.contains('editor-handle')) {
      isResizing = true;
      resizeHandle = e.target.dataset.handle;
      dragStartMouse = { x: e.clientX, y: e.clientY };
      var selEl = getElementById(selectedId);
      if (selEl) {
        var sr = selEl.getBoundingClientRect();
        dragStartPos = {
          x: parseInt(selEl.style.left) || 0,
          y: parseInt(selEl.style.top)  || 0,
          w: sr.width,
          h: sr.height,
        };
      }
      e.preventDefault();
      return;
    }

    var elEl = e.target.closest('[data-el-id]');
    if (elEl) {
      var id = elEl.dataset.elId;
      selectedId = id;
      isDragging = true;
      dragStartMouse = { x: e.clientX, y: e.clientY };
      dragStartPos = {
        x: parseInt(elEl.style.left) || 0,
        y: parseInt(elEl.style.top)  || 0,
      };
      showSelection(elEl);
      document.dispatchEvent(new CustomEvent('editor:select', { detail: { id: id } }));
      e.preventDefault();
    } else {
      clearSelection();
    }
  }

  function handleMouseMove(e) {
    if (!isDragging && !isResizing) return;
    if (!dragStartMouse) return;
    var dx = e.clientX - dragStartMouse.x;
    var dy = e.clientY - dragStartMouse.y;

    if (isDragging && selectedId) {
      var el = getElementById(selectedId);
      if (el) {
        el.style.left = snap(dragStartPos.x + dx) + 'px';
        el.style.top  = snap(dragStartPos.y + dy) + 'px';
        showSelection(el);
      }
    }
  }

  function handleMouseUp(e) {
    if (isDragging && selectedId) {
      var el = getElementById(selectedId);
      if (el) {
        var nx = snap(dragStartPos.x + (e.clientX - dragStartMouse.x));
        var ny = snap(dragStartPos.y + (e.clientY - dragStartMouse.y));
        document.dispatchEvent(new CustomEvent('element:moved', {
          detail: {
            id: selectedId,
            x: nx,
            y: ny,
            before: { x: dragStartPos.x, y: dragStartPos.y },
          },
        }));
      }
    }
    isDragging = false;
    isResizing = false;
    dragStartMouse = null;
    dragStartPos = null;
    resizeHandle = null;
  }

  document.addEventListener('editor:modeChange', function(e) {
    if (!overlay) createOverlay();
    if (e.detail.mode === 'edit') {
      overlay.classList.add('active');
    } else {
      overlay.classList.remove('active');
      clearSelection();
    }
  });

  // Keep snap state in sync with toolbar toggle
  document.addEventListener('editor:snapChange', function(e) {
    snapEnabled = e.detail.enabled;
  });

  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Delete/Backspace removes the selected element while not in a text field
  document.addEventListener('keydown', function(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') &&
        selectedId &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA') {
      document.dispatchEvent(new CustomEvent('element:deleted', { detail: { id: selectedId } }));
      clearSelection();
    }
  });
})();
<\/script>`;
