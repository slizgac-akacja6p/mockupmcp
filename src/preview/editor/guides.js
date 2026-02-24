/**
 * Alignment / snap guide logic for the in-browser editor.
 *
 * Pure logic functions (findAlignmentGuides) are decoupled from the DOM so
 * they can be tested in Node.js without a browser.
 * createGuideRenderer() is the DOM-aware counterpart and is only called at runtime.
 *
 * When the user drags an element, the editor calls findAlignmentGuides() on
 * every mousemove to detect when the dragged element aligns with another
 * element's edges/center or the screen edges/center. Matching guides are
 * displayed as thin overlay lines (like Figma/Sketch smart guides).
 */

// ---------------------------------------------------------------------------
// Pure logic
// ---------------------------------------------------------------------------

/**
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 * @typedef {{ id?: string } & Rect} IdentifiedRect
 * @typedef {{ axis: 'x'|'y', position: number, type: 'edge'|'center'|'screen-edge'|'screen-center' }} Guide
 * @typedef {{ guides: Guide[], snappedX: number|null, snappedY: number|null }} AlignmentResult
 */

/**
 * Derive the 5 key points (left, right, centerX, top, bottom, centerY) from a rect.
 *
 * @param {Rect} r
 * @returns {{ left: number, right: number, centerX: number, top: number, bottom: number, centerY: number }}
 */
export function rectPoints(r) {
  return {
    left:    r.x,
    right:   r.x + r.width,
    centerX: r.x + r.width / 2,
    top:     r.y,
    bottom:  r.y + r.height,
    centerY: r.y + r.height / 2,
  };
}

/**
 * Find alignment guides between the dragged element and all other elements
 * (+ screen edges/center). Returns the set of guide lines to draw and optional
 * snapped coordinates to replace the raw drag position.
 *
 * The algorithm compares the dragged rect's 5 X-axis points (left, right, center)
 * and 5 Y-axis points (top, bottom, center) against the same points on every
 * other element. When a pair is within `threshold` pixels, a guide is emitted
 * and the closest snap is selected.
 *
 * @param {Rect}             draggedRect  - Current position of the dragged element
 * @param {IdentifiedRect[]} otherRects   - All other elements on the screen
 * @param {{ width: number, height: number }} screenSize - Screen dimensions
 * @param {number}           [threshold=5] - Snap distance in px
 * @returns {AlignmentResult}
 */
export function findAlignmentGuides(draggedRect, otherRects, screenSize, threshold = 5) {
  const guides = [];

  // Track the best (closest) snap for each axis independently.
  // `bestDist` is the smallest absolute distance found so far; `snap` is the
  // position the dragged element should jump to on that axis.
  let bestDistX = Infinity;
  let snapX = null;
  let bestDistY = Infinity;
  let snapY = null;

  const dp = rectPoints(draggedRect);

  // --- Helper: check a single axis comparison ---
  // dragVal: the dragged-side value being compared
  // refVal:  the reference value (other element or screen edge)
  // axis:    'x' or 'y'
  // type:    guide type label
  // dragAnchor: which anchor of the dragged rect (left/right/center for X;
  //             top/bottom/center for Y) — needed to compute the snapped
  //             element position from the snap point.
  function check(dragVal, refVal, axis, type, dragAnchor) {
    const dist = Math.abs(dragVal - refVal);
    if (dist > threshold) return;

    guides.push({ axis, position: refVal, type });

    if (axis === 'x') {
      // Compute what the element's X should be if we snap this anchor to refVal
      let candidateX;
      if (dragAnchor === 'left')   candidateX = refVal;
      else if (dragAnchor === 'right')  candidateX = refVal - draggedRect.width;
      else /* center */            candidateX = refVal - draggedRect.width / 2;

      if (dist < bestDistX) {
        bestDistX = dist;
        snapX = candidateX;
      }
    } else {
      let candidateY;
      if (dragAnchor === 'top')    candidateY = refVal;
      else if (dragAnchor === 'bottom') candidateY = refVal - draggedRect.height;
      else /* center */            candidateY = refVal - draggedRect.height / 2;

      if (dist < bestDistY) {
        bestDistY = dist;
        snapY = candidateY;
      }
    }
  }

  // --- Compare against other elements ---
  for (const other of otherRects) {
    const op = rectPoints(other);

    // X-axis comparisons (vertical guide lines)
    check(dp.left,    op.left,    'x', 'edge',   'left');
    check(dp.left,    op.right,   'x', 'edge',   'left');
    check(dp.right,   op.right,   'x', 'edge',   'right');
    check(dp.right,   op.left,    'x', 'edge',   'right');
    check(dp.centerX, op.centerX, 'x', 'center', 'center');

    // Y-axis comparisons (horizontal guide lines)
    check(dp.top,     op.top,     'y', 'edge',   'top');
    check(dp.top,     op.bottom,  'y', 'edge',   'top');
    check(dp.bottom,  op.bottom,  'y', 'edge',   'bottom');
    check(dp.bottom,  op.top,     'y', 'edge',   'bottom');
    check(dp.centerY, op.centerY, 'y', 'center', 'center');
  }

  // --- Compare against screen edges and center ---
  if (screenSize) {
    // Screen edges
    check(dp.left,    0,                    'x', 'screen-edge', 'left');
    check(dp.right,   screenSize.width,     'x', 'screen-edge', 'right');
    check(dp.top,     0,                    'y', 'screen-edge', 'top');
    check(dp.bottom,  screenSize.height,    'y', 'screen-edge', 'bottom');

    // Screen center
    check(dp.centerX, screenSize.width / 2,  'x', 'screen-center', 'center');
    check(dp.centerY, screenSize.height / 2, 'y', 'screen-center', 'center');
  }

  // Deduplicate guides (same axis + position can appear multiple times when
  // several elements share an edge). Keep the most specific type.
  const unique = deduplicateGuides(guides);

  return { guides: unique, snappedX: snapX, snappedY: snapY };
}

/**
 * Remove duplicate guide lines that share the same axis and position.
 * When duplicates exist, prefer more specific types (center > edge > screen-*).
 *
 * @param {Guide[]} guides
 * @returns {Guide[]}
 */
export function deduplicateGuides(guides) {
  const TYPE_PRIORITY = { center: 3, edge: 2, 'screen-center': 1, 'screen-edge': 0 };
  const map = new Map();

  for (const g of guides) {
    const key = `${g.axis}:${g.position}`;
    const existing = map.get(key);
    if (!existing || (TYPE_PRIORITY[g.type] ?? 0) > (TYPE_PRIORITY[existing.type] ?? 0)) {
      map.set(key, g);
    }
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// DOM rendering (browser-only)
// ---------------------------------------------------------------------------

// Colors per guide type — highly visible against any background
const GUIDE_COLORS = {
  edge:            '#FF00FF', // magenta
  center:          '#4CAF50', // green
  'screen-edge':   '#00BCD4', // cyan
  'screen-center': '#FF9800', // orange
};

/**
 * Create a guide renderer attached to a container element.
 *
 * The renderer creates a single SVG overlay (pointer-events: none) that sits
 * above all elements. Guide lines are drawn as SVG <line> elements and
 * positioned in container-space (accounting for the .screen offset and scale).
 *
 * @param {Element} container - The editor canvas wrapper
 * @returns {{ showGuides: (guides: Guide[], screenSize: {width:number,height:number}) => void, hideGuides: () => void }}
 */
export function createGuideRenderer(container) {
  // Create the SVG overlay once — reuse across frames
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.cssText = [
    'position:absolute',
    'top:0',
    'left:0',
    'width:100%',
    'height:100%',
    'pointer-events:none',
    'z-index:999',
    'overflow:visible',
  ].join(';');
  container.appendChild(svg);

  /**
   * Read the .screen element's offset and scale from the container so guide
   * lines align with the visually rendered elements (which are scaled+offset).
   */
  function getScreenTransform() {
    const screenEl = container.querySelector('.screen');
    let offsetX = 0;
    let offsetY = 0;
    let scale = 1;
    if (screenEl) {
      offsetX = screenEl.offsetLeft;
      offsetY = screenEl.offsetTop;
      const transform = screenEl.style.transform || '';
      const match = transform.match(/scale\(([^)]+)\)/);
      scale = match ? parseFloat(match[1]) : 1;
    }
    return { offsetX, offsetY, scale };
  }

  /**
   * Draw guide lines for the given set of guides.
   *
   * @param {Guide[]} guides
   * @param {{ width: number, height: number }} screenSize - Screen dimensions in mockup coords
   */
  function showGuides(guides, screenSize) {
    // Clear previous lines by removing all children (safe — no user content)
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    if (!guides || guides.length === 0) return;

    const { offsetX, offsetY, scale } = getScreenTransform();

    for (const guide of guides) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const color = GUIDE_COLORS[guide.type] || GUIDE_COLORS.edge;

      if (guide.axis === 'x') {
        // Vertical line at guide.position (X coordinate in screen space)
        const cx = offsetX + guide.position * scale;
        line.setAttribute('x1', String(cx));
        line.setAttribute('y1', String(offsetY));
        line.setAttribute('x2', String(cx));
        line.setAttribute('y2', String(offsetY + screenSize.height * scale));
      } else {
        // Horizontal line at guide.position (Y coordinate in screen space)
        const cy = offsetY + guide.position * scale;
        line.setAttribute('x1', String(offsetX));
        line.setAttribute('y1', String(cy));
        line.setAttribute('x2', String(offsetX + screenSize.width * scale));
        line.setAttribute('y2', String(cy));
      }

      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(line);
    }
  }

  /**
   * Remove all guide lines from the overlay.
   */
  function hideGuides() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  return { showGuides, hideGuides };
}
