/**
 * In-memory undo/redo history for the in-browser editor.
 *
 * Callers own the actual API call to apply/reverse an operation — this module
 * only manages the stacks and provides the operations back to the caller.
 * The stack is intentionally volatile: it clears on page refresh, so we never
 * risk replaying stale state against a server that was modified externally.
 */

/**
 * Operation types supported by the history stack.
 * @typedef {'move'|'resize'|'update'|'add'|'delete'} OperationType
 */

/**
 * A single reversible editor operation.
 * For 'add':    before is null,          after has the full element data.
 * For 'delete': before has full data,    after is null.
 * For others:   both before/after hold the changed fields only.
 *
 * @typedef {{ type: OperationType, elementId: string, before: object|null, after: object|null }} Operation
 */

/**
 * Create a history manager with separate undo and redo stacks.
 *
 * @param {number} [maxSize=50] - Maximum entries kept in the undo stack.
 *   Oldest entries are evicted when the limit is exceeded, preventing unbounded
 *   memory growth in long editing sessions.
 * @returns {{ push: (op: Operation) => void, undo: () => Operation|null, redo: () => Operation|null,
 *             canUndo: () => boolean, canRedo: () => boolean, clear: () => void,
 *             size: () => {undo: number, redo: number} }}
 */
export function createHistory(maxSize = 50) {
  /** @type {Operation[]} */
  const undoStack = [];
  /** @type {Operation[]} */
  const redoStack = [];

  return {
    /**
     * Record a completed operation. Clears the redo stack because a new branch
     * of history has been created — redoing an operation from a prior branch
     * would produce inconsistent element state.
     *
     * @param {Operation} operation
     */
    push(operation) {
      undoStack.push(operation);
      // Evict the oldest entry when the cap is reached
      if (undoStack.length > maxSize) {
        undoStack.shift();
      }
      // New edit invalidates the redo branch
      redoStack.length = 0;
    },

    /**
     * Pop the most recent operation from the undo stack.
     * Moves it onto the redo stack so the caller can re-apply it later.
     *
     * @returns {Operation|null} The operation to reverse, or null when already at the oldest state.
     */
    undo() {
      if (undoStack.length === 0) return null;
      const op = undoStack.pop();
      redoStack.push(op);
      return op;
    },

    /**
     * Pop the most recently undone operation from the redo stack.
     * Moves it back onto the undo stack so it can be undone again.
     *
     * @returns {Operation|null} The operation to re-apply, or null when nothing has been undone.
     */
    redo() {
      if (redoStack.length === 0) return null;
      const op = redoStack.pop();
      undoStack.push(op);
      return op;
    },

    /** @returns {boolean} */
    canUndo() { return undoStack.length > 0; },

    /** @returns {boolean} */
    canRedo() { return redoStack.length > 0; },

    /** Empty both stacks — useful when navigating away from the current screen. */
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },

    /**
     * @returns {{ undo: number, redo: number }}
     */
    size() {
      return { undo: undoStack.length, redo: redoStack.length };
    },
  };
}

/**
 * Produce the logical inverse of an operation so the caller can pass it to the
 * API without building the inverse manually.
 *
 * add/delete are structural opposites: undoing an 'add' must delete the element,
 * and undoing a 'delete' must re-create it. For positional/property operations
 * (move/resize/update) the inverse is simply swapping before and after.
 *
 * @param {Operation} op
 * @returns {Operation}
 */
export function invertOperation(op) {
  if (op.type === 'add') {
    return { type: 'delete', elementId: op.elementId, before: op.after, after: null };
  }
  if (op.type === 'delete') {
    return { type: 'add', elementId: op.elementId, before: null, after: op.before };
  }
  // move / resize / update — swap the snapshots
  return { type: op.type, elementId: op.elementId, before: op.after, after: op.before };
}
