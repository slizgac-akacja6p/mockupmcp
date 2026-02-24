export class CanvasState {
  constructor() {
    this.selectedId = null;
    this.selectedIds = new Set();
    this.snapSize = 8;
    this._dragStart = null;
    this._listeners = {};
  }

  on(event, fn) { (this._listeners[event] ??= []).push(fn); }
  _emit(event, ...args) { (this._listeners[event] ?? []).forEach(fn => fn(...args)); }

  selectElement(id, shift = false) {
    if (shift && id) {
      if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
      } else {
        this.selectedIds.add(id);
      }
      this.selectedId = id;
    } else {
      this.selectedIds.clear();
      if (id) this.selectedIds.add(id);
      this.selectedId = id;
    }
    this._emit('select', id);
  }

  snapPosition(x, y) {
    if (!this.snapSize) return { x, y };
    return {
      x: Math.round(x / this.snapSize) * this.snapSize,
      y: Math.round(y / this.snapSize) * this.snapSize,
    };
  }

  startDrag(mouseX, mouseY, elementPos) {
    this._dragStart = { mouseX, mouseY, elX: elementPos.x, elY: elementPos.y };
  }

  computeDrag(mouseX, mouseY) {
    if (!this._dragStart) return null;
    const dx = mouseX - this._dragStart.mouseX;
    const dy = mouseY - this._dragStart.mouseY;
    return this.snapPosition(this._dragStart.elX + dx, this._dragStart.elY + dy);
  }

  endDrag() {
    this._dragStart = null;
  }
}
