// Shared utility functions for the editor

/**
 * Returns a debounced version of fn that delays execution by `delay` ms.
 * Each call resets the timer so only the last invocation within the delay
 * window actually fires.
 *
 * @param {Function} fn
 * @param {number} delay - Milliseconds to wait before executing
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Fast non-cryptographic hash for change detection.
 * Returns a 32-bit integer suitable for equality comparison.
 *
 * @param {string} str
 * @returns {number}
 */
export function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}
