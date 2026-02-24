// SYNC_JS is injected inline into preview HTML — no import access to server-side modules.
// Manages undo/redo stack and debounced REST persistence for all editor mutations.
export const SYNC_JS = `<script>
(function() {
  var _undoStack = [];
  var _redoStack = [];
  var _maxUndo = 50;
  var _debounceTimer = null;

  var pid = window._editorProjectId || '';
  var sid = window._editorScreenId || '';

  function apiBase() { return '/api/screens/' + pid + '/' + sid; }

  function fetchJSON(method, url, body) {
    return fetch(url, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function(r) { return r.json(); });
  }

  function pushUndo(action) {
    _undoStack.push(action);
    _redoStack = [];
    if (_undoStack.length > _maxUndo) _undoStack.shift();
  }

  function applyAction(action) {
    if (action.type === 'move' || action.type === 'resize' || action.type === 'update') {
      return fetchJSON('PATCH', apiBase() + '/elements/' + action.elementId, action.after);
    } else if (action.type === 'add') {
      return fetchJSON('POST', apiBase() + '/elements', action.after);
    } else if (action.type === 'delete') {
      return fetchJSON('DELETE', apiBase() + '/elements/' + action.elementId);
    }
    return Promise.resolve();
  }

  function reverseAction(action) {
    if (action.type === 'move' || action.type === 'resize' || action.type === 'update') {
      return fetchJSON('PATCH', apiBase() + '/elements/' + action.elementId, action.before);
    } else if (action.type === 'add') {
      return fetchJSON('DELETE', apiBase() + '/elements/' + action.elementId);
    } else if (action.type === 'delete') {
      return fetchJSON('POST', apiBase() + '/elements', action.before);
    }
    return Promise.resolve();
  }

  document.addEventListener('element:moved', function(e) {
    var d = e.detail;
    var action = { type: 'move', elementId: d.id, before: d.before, after: { x: d.x, y: d.y } };
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(function() {
      applyAction(action).then(function() { pushUndo(action); });
    }, 300);
  });

  document.addEventListener('element:resized', function(e) {
    var d = e.detail;
    var action = { type: 'resize', elementId: d.id, before: d.before, after: { x: d.x, y: d.y, width: d.width, height: d.height } };
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(function() {
      applyAction(action).then(function() { pushUndo(action); });
    }, 300);
  });

  document.addEventListener('element:updated', function(e) {
    var d = e.detail;
    var action = { type: 'update', elementId: d.id, before: d.before, after: d.after };
    applyAction(action).then(function() { pushUndo(action); });
  });

  document.addEventListener('element:added', function(e) {
    var d = e.detail;
    fetchJSON('POST', apiBase() + '/elements', d.element).then(function(created) {
      pushUndo({ type: 'add', elementId: created.id, after: created, before: null });
    });
  });

  document.addEventListener('element:deleted', function(e) {
    var d = e.detail;
    fetchJSON('DELETE', apiBase() + '/elements/' + d.id).then(function() {
      pushUndo({ type: 'delete', elementId: d.id, before: d.element, after: null });
    });
  });

  document.addEventListener('editor:undo', function() {
    var action = _undoStack.pop();
    if (!action) return;
    _redoStack.push(action);
    reverseAction(action);
  });

  document.addEventListener('editor:redo', function() {
    var action = _redoStack.pop();
    if (!action) return;
    _undoStack.push(action);
    applyAction(action);
  });

  document.addEventListener('editor:approve', function() {
    fetchJSON('POST', apiBase() + '/approve', {}).then(function(result) {
      if (result && result.approved) {
        document.dispatchEvent(new CustomEvent('editor:approved', { detail: result }));
      }
    });
  });
})();
<\/script>`;
