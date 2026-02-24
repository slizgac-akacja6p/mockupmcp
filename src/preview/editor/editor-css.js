export const EDITOR_CSS = `<style>
  #editor-toolbar {
    position: fixed; top: 0; left: 260px; right: 0; height: 44px; z-index: 1000;
    background: #2c2c2c; display: flex; align-items: center; gap: 8px; padding: 0 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-family: -apple-system, sans-serif;
  }
  #editor-toolbar button {
    padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer;
    font-size: 13px; font-weight: 500;
  }
  #editor-toolbar .btn-edit { background: #4A90E2; color: white; }
  #editor-toolbar .btn-edit.active { background: #357ABD; }
  #editor-toolbar .btn-approve { background: #27AE60; color: white; margin-left: auto; }
  #editor-toolbar .btn-snap { background: #555; color: #ccc; }
  #editor-toolbar .btn-snap.active { background: #4A90E2; color: white; }
  #editor-toolbar .btn-undo, #editor-toolbar .btn-redo { background: #444; color: #ccc; min-width: 32px; }
  #editor-toolbar .separator { width: 1px; height: 24px; background: #555; margin: 0 4px; }
  #editor-toolbar .mode-label { color: #999; font-size: 12px; }
  .editor-palette {
    position: fixed; left: 260px; top: 44px; bottom: 0; width: 200px; z-index: 900;
    background: #1e1e1e; color: #ccc; overflow-y: auto; padding: 8px;
    font-family: -apple-system, sans-serif; font-size: 12px; display: none;
  }
  .editor-palette.visible { display: block; }
  .editor-palette h4 { color: #888; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin: 12px 0 4px; }
  .editor-palette .palette-item {
    padding: 6px 8px; border-radius: 4px; cursor: grab; background: #2a2a2a;
    margin-bottom: 2px; border: 1px solid #333;
  }
  .editor-palette .palette-item:hover { background: #333; border-color: #4A90E2; }
  .editor-inspector {
    position: fixed; right: 0; top: 44px; bottom: 0; width: 220px; z-index: 900;
    background: #1e1e1e; color: #ccc; overflow-y: auto; padding: 8px;
    font-family: -apple-system, sans-serif; font-size: 12px; display: none;
  }
  .editor-inspector.visible { display: block; }
  .editor-inspector h4 { color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 12px 0 4px; }
  .editor-inspector .prop-row { display: flex; flex-direction: column; margin-bottom: 8px; }
  .editor-inspector .prop-row label { color: #888; font-size: 11px; margin-bottom: 2px; }
  .editor-inspector .prop-row input, .editor-inspector .prop-row select {
    background: #2a2a2a; border: 1px solid #444; border-radius: 3px;
    color: #eee; padding: 4px 6px; font-size: 12px;
  }
  .editor-inspector .no-selection { color: #555; padding: 12px; text-align: center; }
  .editor-canvas-overlay {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 100;
    pointer-events: none; display: none;
  }
  .editor-canvas-overlay.active { pointer-events: all; }
  .editor-selection-box {
    position: absolute; border: 2px solid #4A90E2; background: rgba(74,144,226,0.1);
    pointer-events: none; box-sizing: border-box;
  }
  .editor-handle {
    position: absolute; width: 8px; height: 8px; background: white;
    border: 2px solid #4A90E2; border-radius: 1px; pointer-events: all; z-index: 101;
  }
  body.editor-mode-active { padding-top: 44px; }
</style>`;
