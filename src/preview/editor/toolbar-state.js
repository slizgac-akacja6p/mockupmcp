export class ToolbarState {
  constructor() {
    this.mode = 'view';
    this.snapToGrid = true;
    this._listeners = {};
  }

  on(event, fn) {
    (this._listeners[event] ??= []).push(fn);
  }

  _emit(event, ...args) {
    (this._listeners[event] ?? []).forEach(fn => fn(...args));
  }

  setMode(mode) {
    this.mode = mode;
    this._emit('modeChange', mode);
  }

  toggleSnap() {
    this.snapToGrid = !this.snapToGrid;
    this._emit('snapChange', this.snapToGrid);
  }
}
