export class UndoStack {
  constructor(maxSize = 50) {
    this._stack = [];
    this._redoStack = [];
    this._maxSize = maxSize;
  }

  get size() { return this._stack.length; }

  push(action) {
    this._stack.push(action);
    this._redoStack = [];
    if (this._stack.length > this._maxSize) this._stack.shift();
  }

  undo() {
    const action = this._stack.pop();
    if (!action) return null;
    this._redoStack.push(action);
    return action;
  }

  redo() {
    const action = this._redoStack.pop();
    if (!action) return null;
    this._stack.push(action);
    return action;
  }

  clear() {
    this._stack = [];
    this._redoStack = [];
  }
}
