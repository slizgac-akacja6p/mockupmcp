/**
 * Resize handle logic for the in-browser editor.
 *
 * Pure logic functions (clampSize, maintainAspectRatio, computeResizeResult) are
 * decoupled from the DOM so they can be tested in Node.js without a browser.
 * initResize() wires them to DOM events and is only called at runtime.
 */

import { snapToGrid } from './drag.js';

// ---------------------------------------------------------------------------
// Pure logic
// ---------------------------------------------------------------------------

/**
 * Enforce minimum dimensions so elements cannot be shrunk to invisible sizes.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} [minSize=20]
 * @returns {{ width: number, height: number }}
 */
export function clampSize(width, height, minSize = 20) {
  return {
    width: Math.max(width, minSize),
    height: Math.max(height, minSize),
  };
}

/**
 * When Shift is held, preserve the original aspect ratio by adjusting whichever
 * dimension changed less. The larger relative change wins; the smaller follows.
 *
 * @param {number} origWidth
 * @param {number} origHeight
 * @param {number} newWidth
 * @param {number} newHeight
 * @returns {{ width: number, height: number }}
 */
export function maintainAspectRatio(origWidth, origHeight, newWidth, newHeight) {
  const ratio = origWidth / origHeight;
  // Drive from whichever dimension changed more to avoid compounding rounding error
  if (Math.abs(newWidth - origWidth) >= Math.abs(newHeight - origHeight)) {
    return { width: newWidth, height: Math.round(newWidth / ratio) };
  }
  return { width: Math.round(newHeight * ratio), height: newHeight };
}

/**
 * Eight compass-direction handles, each paired with the CSS cursor that signals
 * the resize direction to the user.
 *
 * @type {Array<{ id: string, cursor: string }>}
 */
export const HANDLE_POSITIONS = [
  { id: 'nw', cursor: 'nwse-resize' },
  { id: 'n',  cursor: 'ns-resize' },
  { id: 'ne', cursor: 'nesw-resize' },
  { id: 'e',  cursor: 'ew-resize' },
  { id: 'se', cursor: 'nwse-resize' },
  { id: 's',  cursor: 'ns-resize' },
  { id: 'sw', cursor: 'nesw-resize' },
  { id: 'w',  cursor: 'ew-resize' },
];

/**
 * Compute the new bounding rect after a resize gesture.
 *
 * Each handle moves a different subset of edges; the table below describes
 * how deltas propagate:
 *
 *   nw: x+=dx, y+=dy, w-=dx, h-=dy   (top-left corner)
 *   n:  y+=dy, h-=dy                  (top edge)
 *   ne: w+=dx, y+=dy, h-=dy           (top-right corner)
 *   e:  w+=dx                         (right edge)
 *   se: w+=dx, h+=dy                  (bottom-right corner)
 *   s:  h+=dy                         (bottom edge)
 *   sw: x+=dx, w-=dx, h+=dy           (bottom-left corner)
 *   w:  x+=dx, w-=dx                  (left edge)
 *
 * After computing raw values the function applies (in order):
 *   1. clampSize   — minimum 20×20
 *   2. maintainAspectRatio — only when shiftKey is true
 *   3. snapToGrid  — only when gridEnabled is true
 *   4. x,y >= 0 clamp — prevent elements from leaving the canvas top-left
 *
 * @param {'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'} handle
 * @param {{ x: number, y: number, width: number, height: number }} startRect
 * @param {number} deltaX
 * @param {number} deltaY
 * @param {boolean} shiftKey
 * @param {boolean} gridEnabled
 * @param {number} [gridSize=8]
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function computeResizeResult(handle, startRect, deltaX, deltaY, shiftKey, gridEnabled, gridSize = 8) {
  let { x, y, width, height } = startRect;

  // Apply per-handle edge deltas
  switch (handle) {
    case 'nw': x += deltaX; y += deltaY; width -= deltaX; height -= deltaY; break;
    case 'n':               y += deltaY;                  height -= deltaY; break;
    case 'ne':              y += deltaY; width += deltaX; height -= deltaY; break;
    case 'e':                            width += deltaX;                   break;
    case 'se':                           width += deltaX; height += deltaY; break;
    case 's':                                             height += deltaY; break;
    case 'sw': x += deltaX;             width -= deltaX; height += deltaY; break;
    case 'w':  x += deltaX;             width -= deltaX;                   break;
  }

  // Enforce minimum dimensions before aspect-ratio correction so the ratio
  // calculation never starts from a degenerate (near-zero) size.
  const clamped = clampSize(width, height);
  width  = clamped.width;
  height = clamped.height;

  if (shiftKey) {
    const ar = maintainAspectRatio(startRect.width, startRect.height, width, height);
    width  = ar.width;
    height = ar.height;
  }

  if (gridEnabled) {
    width  = snapToGrid(width, gridSize);
    height = snapToGrid(height, gridSize);
    // Keep position snapped as well so edges remain on the grid
    x = snapToGrid(x, gridSize);
    y = snapToGrid(y, gridSize);
  }

  // Prevent elements from escaping the visible canvas area
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width,
    height,
  };
}

// ---------------------------------------------------------------------------
// DOM binding (browser-only)
// ---------------------------------------------------------------------------

/**
 * Attach resize handles to the editor canvas for the currently selected element.
 *
 * Handle elements are created once and reused — they are absolutely positioned
 * siblings of the element being resized (appended to `container`). This avoids
 * layout interference with the element's own children.
 *
 * Visual feedback during a resize uses direct style mutation on the target
 * element; no layout recalculation occurs until mouseup, when `onResizeEnd` is
 * called so the caller can persist changes via the API and trigger a re-render.
 *
 * @param {Element} container - The canvas wrapper containing rendered elements
 * @param {ReturnType<import('./selection.js').createSelectionState>} selectionState
 * @param {{
 *   gridEnabled?: boolean,
 *   gridSize?: number,
 *   onResizeEnd: (result: { elementId: string, x: number, y: number, width: number, height: number }) => void
 * }} options
 * @returns {{ showHandles: (elementDom: Element) => void, hideHandles: () => void, updateHandles: (elementDom: Element) => void }}
 */
export function initResize(container, selectionState, options) {
  const {
    gridEnabled = true,
    gridSize    = 8,
    onResizeEnd,
  } = options;

  // Build the 8 handle DOM nodes once; reposition them on showHandles()
  const handleEls = HANDLE_POSITIONS.map(({ id, cursor }) => {
    const el = document.createElement('div');
    el.className  = 'resize-handle';
    el.dataset.handle = id;
    el.style.cssText  = [
      'position:absolute',
      'width:8px',
      'height:8px',
      // translate(-50%,-50%) now lives in the CSS .resize-handle rule so
      // the :hover scale(1.2) can layer on top without inline-style conflicts.
      'background:#fff',
      'border:1px solid #0057ff',
      'border-radius:2px',
      `cursor:${cursor}`,
      'z-index:1000',
      'display:none',
      'box-sizing:border-box',
    ].join(';');
    container.appendChild(el);
    return el;
  });

  // Place handles around the element's current bounding box.
  // Handles live in `container` (positioned absolutely within it) so their
  // left/top must be relative to the container's content box.  We use
  // getBoundingClientRect() on both `.screen` and `container` because
  // .screen has `transform: scale(zoom)` which changes its visual position
  // but does NOT affect layout properties like offsetLeft/offsetTop.
  function positionHandles(rect) {
    const { left, top, width, height } = rect;

    const screenEl = container.querySelector('.screen');
    const canvasRect = container.getBoundingClientRect();
    let offsetX = 0;
    let offsetY = 0;
    let scale = 1;
    if (screenEl) {
      // getBoundingClientRect reflects the actual visual position after
      // transform:scale, unlike offsetLeft which ignores transforms.
      const screenRect = screenEl.getBoundingClientRect();
      offsetX = screenRect.left - canvasRect.left + container.scrollLeft;
      offsetY = screenRect.top  - canvasRect.top  + container.scrollTop;
      const transform = screenEl.style.transform || '';
      const match = transform.match(/scale\(([^)]+)\)/);
      scale = match ? parseFloat(match[1]) : 1;
    }

    // Convert element coordinates (screen space) to container coordinates.
    // No manual half-offset needed — transform:translate(-50%,-50%) on the
    // handle elements (via CSS) centres them on the anchor point automatically.
    const cx = offsetX + left * scale;
    const cy = offsetY + top * scale;
    const cw = width * scale;
    const ch = height * scale;

    const positions = {
      nw: { x: cx,          y: cy },
      n:  { x: cx + cw / 2, y: cy },
      ne: { x: cx + cw,     y: cy },
      e:  { x: cx + cw,     y: cy + ch / 2 },
      se: { x: cx + cw,     y: cy + ch },
      s:  { x: cx + cw / 2, y: cy + ch },
      sw: { x: cx,          y: cy + ch },
      w:  { x: cx,          y: cy + ch / 2 },
    };

    handleEls.forEach((el) => {
      const pos = positions[el.dataset.handle];
      el.style.left    = `${pos.x}px`;
      el.style.top     = `${pos.y}px`;
      el.style.display = 'block';
    });
  }

  // Throttle mousemove to one logical frame — prevents jank when the browser
  // fires 100+ events/second during a fast resize gesture.
  let _resizeRafPending = false;

  // Resize session state — reset on every handle mousedown
  let resizing    = false;
  let activeHandle = null;
  let targetEl    = null;
  let elementId   = null;
  let startRect   = null;
  let startMouseX = 0;
  let startMouseY = 0;
  // CSS zoom (transform: scale) on the .screen element — mouse deltas must be
  // divided by this value to convert viewport pixels to mockup coordinates.
  let zoomScale   = 1;

  // Attach mousedown to each handle
  handleEls.forEach((handleEl) => {
    handleEl.addEventListener('mousedown', (e) => {
      e.stopPropagation(); // prevent selection handler from firing

      const id = selectionState.getSelectedId();
      if (!id) return;

      const el = container.querySelector(`[data-element-id="${id}"]`);
      if (!el) return;

      resizing     = true;
      activeHandle = handleEl.dataset.handle;
      targetEl     = el;
      elementId    = id;
      startMouseX  = e.clientX;
      startMouseY  = e.clientY;

      // Read current zoom scale so deltas can be converted to mockup coordinates
      const screen = container.querySelector('.screen');
      if (screen) {
        const transform = screen.style.transform || '';
        const match = transform.match(/scale\(([^)]+)\)/);
        zoomScale = match ? parseFloat(match[1]) : 1;
      } else {
        zoomScale = 1;
      }

      // Snapshot the element's current geometry from inline styles
      startRect = {
        x:      parseInt(el.style.left,   10) || 0,
        y:      parseInt(el.style.top,    10) || 0,
        width:  parseInt(el.style.width,  10) || el.offsetWidth,
        height: parseInt(el.style.height, 10) || el.offsetHeight,
      };

      // Block text selection during resize
      e.preventDefault();
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizing || !targetEl) return;

    if (_resizeRafPending) return;
    _resizeRafPending = true;
    requestAnimationFrame(() => {
      _resizeRafPending = false;

      // Divide by zoomScale to convert viewport pixels to mockup coordinates
      const dx = (e.clientX - startMouseX) / zoomScale;
      const dy = (e.clientY - startMouseY) / zoomScale;

      // Update visual geometry directly (no API call) for responsive feedback
      const result = computeResizeResult(
        activeHandle, startRect, dx, dy, e.shiftKey, gridEnabled, gridSize,
      );

      targetEl.style.left   = `${result.x}px`;
      targetEl.style.top    = `${result.y}px`;
      targetEl.style.width  = `${result.width}px`;
      targetEl.style.height = `${result.height}px`;

      // Keep handles tracking the element during the drag
      positionHandles({ left: result.x, top: result.y, width: result.width, height: result.height });

      e.preventDefault();
    });
  });

  document.addEventListener('mouseup', (e) => {
    if (!resizing || !targetEl) return;

    // Divide by zoomScale to convert viewport pixels to mockup coordinates
    const dx = (e.clientX - startMouseX) / zoomScale;
    const dy = (e.clientY - startMouseY) / zoomScale;

    const result = computeResizeResult(
      activeHandle, startRect, dx, dy, e.shiftKey, gridEnabled, gridSize,
    );

    const id = elementId;

    // Reset session state before callback to guard against re-entrant renders
    resizing     = false;
    activeHandle = null;
    targetEl     = null;
    elementId    = null;
    startRect    = null;

    onResizeEnd({ elementId: id, ...result });
  });

  // Public API so editor.js can show/hide handles on selection change
  function showHandles(elementDom) {
    const rect = {
      left:   parseInt(elementDom.style.left,   10) || 0,
      top:    parseInt(elementDom.style.top,    10) || 0,
      width:  parseInt(elementDom.style.width,  10) || elementDom.offsetWidth,
      height: parseInt(elementDom.style.height, 10) || elementDom.offsetHeight,
    };
    positionHandles(rect);
  }

  function hideHandles() {
    handleEls.forEach((el) => { el.style.display = 'none'; });
  }

  // Reposition handles around an element using its live bounding rect.
  // Unlike showHandles (which reads stale inline styles), this uses
  // getBoundingClientRect so handles track the element during drag when
  // movement is applied via CSS transform: translate().
  function updateHandles(el) {
    if (!el) return;
    const canvasRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const x = elRect.left - canvasRect.left + container.scrollLeft;
    const y = elRect.top - canvasRect.top + container.scrollTop;
    const w = elRect.width;
    const h = elRect.height;

    // positionHandles expects screen-space coords and applies its own zoom
    // scaling. Since getBoundingClientRect already returns zoomed values,
    // we bypass positionHandles and set handle positions directly.
    const positions = {
      nw: { x: x,         y: y },
      n:  { x: x + w / 2, y: y },
      ne: { x: x + w,     y: y },
      e:  { x: x + w,     y: y + h / 2 },
      se: { x: x + w,     y: y + h },
      s:  { x: x + w / 2, y: y + h },
      sw: { x: x,         y: y + h },
      w:  { x: x,         y: y + h / 2 },
    };

    handleEls.forEach((hEl) => {
      const pos = positions[hEl.dataset.handle];
      hEl.style.left    = `${pos.x}px`;
      hEl.style.top     = `${pos.y}px`;
      hEl.style.display = 'block';
    });
  }

  return { showHandles, hideHandles, updateHandles };
}
