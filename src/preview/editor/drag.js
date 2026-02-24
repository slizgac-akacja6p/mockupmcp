/**
 * Drag & drop logic for the in-browser editor.
 *
 * Pure logic functions (snapToGrid, constrainAxis, computeDragResult) are
 * decoupled from the DOM so they can be tested in Node.js without a browser.
 * initDrag() wires them to DOM events and is only called at runtime.
 */

/**
 * Round a pixel value to the nearest multiple of gridSize.
 * Used to align elements to the editor grid after a drag.
 *
 * @param {number} value
 * @param {number} [gridSize=8]
 * @returns {number}
 */
export function snapToGrid(value, gridSize = 8) {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * When Shift is held, constrain movement to the dominant axis so the user can
 * drag perfectly horizontally or vertically without jitter on the other axis.
 *
 * Ties are broken in favour of the horizontal axis (matches most design tools).
 *
 * @param {number} startX  - Element's mouse-down X position
 * @param {number} startY  - Element's mouse-down Y position
 * @param {number} currentX
 * @param {number} currentY
 * @returns {{ x: number, y: number }}
 */
export function constrainAxis(startX, startY, currentX, currentY) {
  const dx = Math.abs(currentX - startX);
  const dy = Math.abs(currentY - startY);

  // Horizontal dominant (dx >= dy covers the tie case intentionally)
  if (dx >= dy) return { x: currentX, y: startY };
  return { x: startX, y: currentY };
}

/**
 * Compute the final element position after a drag gesture, applying optional
 * axis-lock (Shift), grid snapping, and a >= 0 clamp so elements cannot be
 * dragged off the top-left edge of the canvas.
 *
 * @param {number}  startElX     - Element's x before drag started
 * @param {number}  startElY     - Element's y before drag started
 * @param {number}  startMouseX  - Mouse x at drag start
 * @param {number}  startMouseY  - Mouse y at drag start
 * @param {number}  currentMouseX
 * @param {number}  currentMouseY
 * @param {boolean} shiftKey     - When true, axis is locked to the dominant direction
 * @param {boolean} gridEnabled  - When true, result is snapped to the grid
 * @param {number}  [gridSize=8]
 * @returns {{ x: number, y: number }}
 */
export function computeDragResult(
  startElX, startElY,
  startMouseX, startMouseY,
  currentMouseX, currentMouseY,
  shiftKey, gridEnabled, gridSize = 8,
) {
  const rawX = startElX + (currentMouseX - startMouseX);
  const rawY = startElY + (currentMouseY - startMouseY);

  // Axis-lock: re-derive constrained position from the element start coordinates
  // by treating the element origin as the anchor, then applying the mouse delta.
  let x = rawX;
  let y = rawY;

  if (shiftKey) {
    // constrainAxis works on absolute mouse positions; translate to element space
    const constrained = constrainAxis(startMouseX, startMouseY, currentMouseX, currentMouseY);
    x = startElX + (constrained.x - startMouseX);
    y = startElY + (constrained.y - startMouseY);
  }

  if (gridEnabled) {
    x = snapToGrid(x, gridSize);
    y = snapToGrid(y, gridSize);
  }

  // Prevent elements from leaving the visible canvas area
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
  };
}

// Minimum mouse movement (px) before a mousedown is promoted to a drag gesture.
// Below this threshold the interaction is treated as a click (selection only).
const DRAG_THRESHOLD = 3;

/**
 * Bind drag behaviour to a container element in the editor canvas.
 *
 * Unlike the original implementation that required an element to already carry
 * the `.selected` class, this version captures mousedown on ANY element and
 * distinguishes click from drag via a movement threshold. This allows
 * single-click-drag (like Figma/Sketch) without a prior selection click.
 *
 * Visual feedback during the drag is provided by a CSS `translate(dx, dy)`
 * transform applied directly to the element; no layout reflow occurs until
 * mouseup when the transform is cleared and `onDragEnd` is called so the
 * caller can persist the new position via the API and trigger a re-render.
 *
 * @param {Element} container - The canvas wrapper containing rendered elements
 * @param {ReturnType<import('./selection.js').createSelectionState>} selectionState
 * @param {{
 *   gridEnabled?: boolean,
 *   gridSize?: number,
 *   onDragStart?: (elementId: string) => void,
 *   onDragMove?: (elementId: string, wouldBeX: number, wouldBeY: number) => { snapX: number|null, snapY: number|null }|null,
 *   onDragEnd: (result: { elementId: string, x: number, y: number }) => void
 * }} options
 */
export function initDrag(container, selectionState, options) {
  const {
    gridEnabled = true,
    gridSize = 8,
    onDragStart,
    onDragMove,
    onDragEnd,
  } = options;

  // Drag session state — reset on every mousedown
  let pendingDrag = false;   // mousedown captured, waiting for threshold
  let dragging = false;      // threshold exceeded, actively dragging
  let dragEl = null;
  let elementId = null;
  let startElX = 0;
  let startElY = 0;
  let startMouseX = 0;
  let startMouseY = 0;
  // CSS zoom (transform: scale) on the .screen element — mouse deltas must be
  // divided by this value to convert viewport pixels to mockup coordinates.
  let zoomScale = 1;

  // Throttle mousemove to one logical frame — prevents jank when the browser
  // fires 100+ events/second during a fast drag gesture.
  let _dragRafPending = false;

  container.addEventListener('mousedown', (e) => {
    // Capture potential drag start on any element, regardless of selection state
    const target = e.target.closest('[data-element-id]');
    if (!target) return;

    pendingDrag = true;
    dragging = false;
    dragEl = target;
    elementId = target.dataset.elementId;

    // Read current position from inline style set by the renderer
    startElX = parseInt(target.style.left, 10) || 0;
    startElY = parseInt(target.style.top, 10) || 0;
    startMouseX = e.clientX;
    startMouseY = e.clientY;

    // Read current zoom scale so deltas can be converted to mockup coordinates
    const screen = container.querySelector('.screen');
    if (screen) {
      const transform = screen.style.transform || '';
      const match = transform.match(/scale\(([^)]+)\)/);
      zoomScale = match ? parseFloat(match[1]) : 1;
    } else {
      zoomScale = 1;
    }

    // Block text selection while potentially dragging
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!pendingDrag && !dragging) return;
    if (!dragEl) return;

    if (_dragRafPending) return;
    _dragRafPending = true;
    requestAnimationFrame(() => {
      _dragRafPending = false;

      const dx = (e.clientX - startMouseX) / zoomScale;
      const dy = (e.clientY - startMouseY) / zoomScale;

      // Promote pending drag to active drag only after movement threshold
      if (pendingDrag && !dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;

        pendingDrag = false;
        dragging = true;

        // Select the element being dragged (triggers onDragStart callback
        // which updates selection state and highlights the element)
        if (onDragStart) onDragStart(elementId);

        // Visual feedback: semi-transparent with shadow so user can see
        // the element is being dragged (not just the selection outline moving)
        dragEl.style.opacity = '0.7';
        dragEl.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
        dragEl.style.zIndex = '999';

        container.style.cursor = 'grabbing';
      }

      if (dragging) {
        let moveX = dx;
        let moveY = dy;

        // Ask the guide system for snap adjustments. The callback returns
        // snapped element coordinates; we convert back to deltas from the
        // element's start position so the translate transform stays correct.
        if (onDragMove) {
          const wouldBeX = startElX + dx;
          const wouldBeY = startElY + dy;
          const snap = onDragMove(elementId, wouldBeX, wouldBeY);
          if (snap) {
            if (snap.snapX !== null) moveX = snap.snapX - startElX;
            if (snap.snapY !== null) moveY = snap.snapY - startElY;
          }
        }

        // Show movement visually via transform rather than mutating left/top —
        // avoids triggering layout recalculation on every pixel.
        dragEl.style.transform = `translate(${moveX}px, ${moveY}px)`;
        e.preventDefault();
      }
    });
  });

  document.addEventListener('mouseup', (e) => {
    if (pendingDrag) {
      // User clicked without exceeding the drag threshold — let the click
      // event (which fires after mouseup) handle selection normally.
      pendingDrag = false;
      dragEl = null;
      elementId = null;
      return;
    }

    if (!dragging || !dragEl) return;

    // Clear visual feedback and transform before computing final position
    dragEl.style.transform = '';
    dragEl.style.opacity = '';
    dragEl.style.boxShadow = '';
    dragEl.style.zIndex = '';
    container.style.cursor = '';

    // Adjust mouse position by zoom scale so computeDragResult works in
    // mockup coordinate space rather than viewport pixel space.
    const adjustedX = startMouseX + (e.clientX - startMouseX) / zoomScale;
    const adjustedY = startMouseY + (e.clientY - startMouseY) / zoomScale;

    const result = computeDragResult(
      startElX, startElY,
      startMouseX, startMouseY,
      adjustedX, adjustedY,
      e.shiftKey, gridEnabled, gridSize,
    );

    const id = elementId;

    // Reset session state before callback so a re-entrant call cannot observe
    // stale drag data (e.g. if onDragEnd triggers a synchronous re-render).
    dragging = false;
    dragEl = null;
    elementId = null;

    // Suppress the click that follows this mouseup — it would re-trigger
    // selection logic and potentially deselect the just-dragged element.
    container.addEventListener('click', function suppress(ev) {
      ev.stopPropagation();
      container.removeEventListener('click', suppress, true);
    }, { capture: true, once: true });

    onDragEnd({ elementId: id, x: result.x, y: result.y });
  });
}
