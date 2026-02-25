/**
 * Keyboard shortcuts for the in-browser editor.
 *
 * Pure logic (isMac, SHORTCUT_MAP, matchShortcut, isInputFocused) is decoupled
 * from the DOM so it can be tested in Node.js without a browser.
 * initShortcuts() wires everything to document and is only called at runtime.
 *
 * Mac-first: modifier key is Cmd (metaKey). Windows/Linux fall back to Ctrl.
 */

/**
 * Detect Mac platform.
 * Falls back to true on the server side (Node.js) where navigator is absent —
 * tests exercise matchShortcut directly with explicit metaKey/ctrlKey values
 * so the fallback does not affect test correctness.
 *
 * @returns {boolean}
 */
export function isMac() {
  if (typeof navigator === 'undefined') return true;
  return navigator.platform.includes('Mac');
}

/**
 * Ordered list of shortcut definitions.
 *
 * ORDERING IS CRITICAL: redo (Cmd+Shift+Z) must appear before undo (Cmd+Z)
 * because matchShortcut returns the first match — without this ordering,
 * Cmd+Shift+Z would be caught by the undo rule first.
 * Similarly, Cmd+C (copy) must appear before plain C (addCard) so copy takes precedence.
 *
 * @type {Array<{ action: string, key: string, meta: boolean, shift: boolean }>}
 */
export const SHORTCUT_MAP = [
  { action: 'redo',           key: 'z',          meta: true,  shift: true  }, // Cmd+Shift+Z — must precede undo
  { action: 'undo',           key: 'z',          meta: true,  shift: false }, // Cmd+Z
  { action: 'duplicate',      key: 'd',          meta: true,  shift: false }, // Cmd+D
  { action: 'selectAll',      key: 'a',          meta: true,  shift: false }, // Cmd+A
  { action: 'copy',           key: 'c',          meta: true,  shift: false }, // Cmd+C
  { action: 'paste',          key: 'v',          meta: true,  shift: false }, // Cmd+V
  { action: 'delete',         key: 'Backspace',  meta: false, shift: false },
  { action: 'delete',         key: 'Delete',     meta: false, shift: false },
  { action: 'addButton',      key: 'b',          meta: false, shift: false }, // B
  { action: 'addInput',       key: 'i',          meta: false, shift: false }, // I
  { action: 'addCard',        key: 'c',          meta: false, shift: false }, // C (no meta)
  { action: 'addText',        key: 't',          meta: false, shift: false }, // T
  { action: 'addRect',        key: 'r',          meta: false, shift: false }, // R
  { action: 'moveUp',         key: 'ArrowUp',    meta: false, shift: false },
  { action: 'moveDown',       key: 'ArrowDown',  meta: false, shift: false },
  { action: 'moveLeft',       key: 'ArrowLeft',  meta: false, shift: false },
  { action: 'moveRight',      key: 'ArrowRight', meta: false, shift: false },
  { action: 'moveUpLarge',    key: 'ArrowUp',    meta: false, shift: true  }, // Shift+Arrow = 10px step
  { action: 'moveDownLarge',  key: 'ArrowDown',  meta: false, shift: true  },
  { action: 'moveLeftLarge',  key: 'ArrowLeft',  meta: false, shift: true  },
  { action: 'moveRightLarge', key: 'ArrowRight', meta: false, shift: true  },
];

/**
 * Match a KeyboardEvent-like object against SHORTCUT_MAP.
 * Returns the action string for the first matching rule, or null.
 *
 * Accepts plain objects with { key, metaKey, ctrlKey, shiftKey } so it can be
 * called with synthetic event objects in tests without a real browser.
 *
 * @param {{ key: string, metaKey: boolean, ctrlKey: boolean, shiftKey: boolean }} event
 * @returns {string|null}
 */
export function matchShortcut(event) {
  // On Mac, the modifier key is Cmd (metaKey); on Windows/Linux it's Ctrl.
  const modKey = isMac() ? event.metaKey : event.ctrlKey;

  for (const sc of SHORTCUT_MAP) {
    if (sc.key === event.key && sc.meta === modKey && sc.shift === event.shiftKey) {
      return sc.action;
    }
  }
  return null;
}

/**
 * Check whether a form field currently has focus.
 * Shortcuts must not fire while the user is typing in the property panel.
 *
 * @returns {boolean}
 */
export function isInputFocused() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || active.isContentEditable;
}

/**
 * Attach a document-level keydown listener that dispatches shortcuts to handlers.
 *
 * @param {{ [action: string]: () => void }} handlers - One entry per action name.
 *   Missing entries are silently skipped, so callers only need to supply the
 *   actions they actually support.
 */
export function initShortcuts(handlers) {
  document.addEventListener('keydown', (event) => {
    // Never intercept keystrokes while the user is editing a form field.
    if (isInputFocused()) return;

    const action = matchShortcut(event);
    if (action && typeof handlers[action] === 'function') {
      event.preventDefault();
      handlers[action]();
    }
  });
}
