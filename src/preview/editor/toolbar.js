export const TOOLBAR_HTML = `<div id="editor-toolbar" style="display:none">
  <button class="btn-edit" id="btn-toggle-edit" onclick="window._editorToggleMode()">Edit</button>
  <div class="separator"></div>
  <button class="btn-snap active" id="btn-snap" onclick="window._editorToggleSnap()" title="Snap to grid">Grid</button>
  <button class="btn-undo" onclick="window._editorUndo()" title="Undo (Ctrl+Z)">&#8617;</button>
  <button class="btn-redo" onclick="window._editorRedo()" title="Redo">&#8618;</button>
  <span class="separator"></span>
  <span class="mode-label" id="editor-mode-label">View mode</span>
  <button class="btn-approve" id="btn-approve" style="display:none" onclick="window._editorApprove()">Approve Changes</button>
</div>`;

export const TOOLBAR_JS = `<script>
(function() {
  var toolbar = document.getElementById('editor-toolbar');
  if (toolbar) toolbar.style.display = 'flex';

  window._editorMode = 'view';

  window._editorToggleMode = function() {
    var btn = document.getElementById('btn-toggle-edit');
    var label = document.getElementById('editor-mode-label');
    var approveBtn = document.getElementById('btn-approve');
    if (window._editorMode === 'view') {
      window._editorMode = 'edit';
      btn.classList.add('active');
      btn.textContent = 'View';
      label.textContent = 'Edit mode';
      if (approveBtn) approveBtn.style.display = 'flex';
      document.body.classList.add('editor-mode-active');
      document.dispatchEvent(new CustomEvent('editor:modeChange', { detail: { mode: 'edit' } }));
    } else {
      window._editorMode = 'view';
      btn.classList.remove('active');
      btn.textContent = 'Edit';
      label.textContent = 'View mode';
      if (approveBtn) approveBtn.style.display = 'none';
      document.body.classList.remove('editor-mode-active');
      document.dispatchEvent(new CustomEvent('editor:modeChange', { detail: { mode: 'view' } }));
    }
  };

  window._editorToggleSnap = function() {
    var btn = document.getElementById('btn-snap');
    btn.classList.toggle('active');
    var enabled = btn.classList.contains('active');
    document.dispatchEvent(new CustomEvent('editor:snapChange', { detail: { enabled: enabled } }));
  };

  window._editorUndo = function() {
    document.dispatchEvent(new CustomEvent('editor:undo'));
  };

  window._editorRedo = function() {
    document.dispatchEvent(new CustomEvent('editor:redo'));
  };

  window._editorApprove = function() {
    document.dispatchEvent(new CustomEvent('editor:approve'));
  };

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); window._editorUndo(); }
    if (e.ctrlKey && e.key === 'z' && e.shiftKey) { e.preventDefault(); window._editorRedo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); window._editorRedo(); }
    if (e.key === 'e' && !e.ctrlKey && !e.altKey &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA') {
      window._editorToggleMode();
    }
  });
})();
<\/script>`;
