/**
 * Auto-layout engine — repositions elements according to layout rules.
 * Pure function: takes elements array + options, returns new array with updated positions.
 * Does NOT mutate input.
 *
 * @param {Array} elements - Array of element objects with {id, x, y, width, height, z_index}
 * @param {number} screenWidth - Screen width in pixels
 * @param {number} screenHeight - Screen height in pixels
 * @param {Object} options - Layout options
 * @returns {Array} New array with updated element positions
 */
export function autoLayout(elements, screenWidth, screenHeight, options = {}) {
  if (elements.length === 0) return [];

  const {
    direction = 'vertical',
    spacing = 16,
    padding = 16,
    align = 'stretch',
    columns = 2,
    element_ids = null,
    start_y = null,
  } = options;

  // Normalize padding to object
  const pad = typeof padding === 'number'
    ? { top: padding, right: padding, bottom: padding, left: padding }
    : { top: 16, right: 16, bottom: 16, left: 16, ...padding };

  // Deep clone so we never mutate input
  const result = elements.map(el => ({ ...el }));

  // Separate pinned (z_index >= 10) from layoutable elements
  const layoutable = [];

  for (let i = 0; i < result.length; i++) {
    const el = result[i];

    // Skip pinned elements — they keep their original positions
    if (el.z_index >= 10) continue;

    // Skip elements not in element_ids filter (if provided)
    if (element_ids !== null && !element_ids.includes(el.id)) continue;

    layoutable.push({ index: i, el });
  }

  if (layoutable.length === 0) return result;

  const startOffset = start_y !== null ? start_y + pad.top : pad.top;
  const availableWidth = screenWidth - pad.left - pad.right;
  const availableHeight = screenHeight - pad.top - pad.bottom;

  if (direction === 'vertical') {
    layoutVertical(layoutable, result, pad, spacing, availableWidth, startOffset, align);
  } else if (direction === 'horizontal') {
    layoutHorizontal(layoutable, result, pad, spacing, availableHeight, align);
  } else if (direction === 'grid') {
    layoutGrid(layoutable, result, pad, spacing, availableWidth, startOffset, columns);
  }

  return result;
}

function layoutVertical(layoutable, result, pad, spacing, availableWidth, startY, align) {
  let currentY = startY;

  for (const { index, el } of layoutable) {
    result[index].y = currentY;

    if (align === 'stretch') {
      result[index].x = pad.left;
      result[index].width = availableWidth;
    } else if (align === 'center') {
      result[index].x = pad.left + Math.round((availableWidth - el.width) / 2);
    } else {
      // start (left-aligned)
      result[index].x = pad.left;
    }

    currentY += el.height + spacing;
  }
}

function layoutHorizontal(layoutable, result, pad, spacing, availableHeight, align) {
  let currentX = pad.left;

  for (const { index, el } of layoutable) {
    result[index].x = currentX;

    if (align === 'stretch') {
      result[index].y = pad.top;
      result[index].height = availableHeight;
    } else if (align === 'center') {
      result[index].y = pad.top + Math.round((availableHeight - el.height) / 2);
    } else {
      // start (top-aligned)
      result[index].y = pad.top;
    }

    currentX += el.width + spacing;
  }
}

function layoutGrid(layoutable, result, pad, spacing, availableWidth, startY, columns) {
  const cellWidth = Math.round((availableWidth - spacing * (columns - 1)) / columns);
  let currentY = startY;
  let col = 0;
  let maxRowHeight = 0;

  for (const { index, el } of layoutable) {
    result[index].x = pad.left + col * (cellWidth + spacing);
    result[index].y = currentY;
    result[index].width = cellWidth;

    maxRowHeight = Math.max(maxRowHeight, el.height);

    col++;
    if (col >= columns) {
      col = 0;
      currentY += maxRowHeight + spacing;
      maxRowHeight = 0;
    }
  }
}

// --- Overlap resolution ---

/**
 * Check if two rectangles overlap (axis-aligned bounding box).
 */
function rectsOverlap(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}

/**
 * Check if `inner` is a visual child of `outer` — used to detect intentional
 * nesting (e.g. text label on a background rectangle, icon inside a card).
 *
 * A "child" must be:
 *   1. Geometrically contained within (or nearly within) the outer bounds
 *   2. Smaller in BOTH dimensions — the inner element must be narrower than the
 *      outer (width < 90% of outer width) to distinguish a real child from
 *      a full-width sibling that merely overlaps vertically (e.g. a progress bar
 *      with the same width as the card above it).
 */
function isChildOf(inner, outer) {
  const margin = 4;
  const contained = inner.x >= outer.x - margin &&
                    inner.y >= outer.y - margin &&
                    inner.x + inner.width <= outer.x + outer.width + margin &&
                    inner.y + inner.height <= outer.y + outer.height + margin;
  if (!contained) return false;

  // Width check: a true child must be meaningfully narrower than its parent.
  // Full-width elements (same width as parent) are siblings, not children.
  if (inner.width >= outer.width * 0.9) return false;

  return true;
}

/**
 * Detect whether an overlap between two same-layer elements is intentional
 * and should be preserved rather than resolved.
 *
 * Intentional patterns:
 * 1. One element is a visual child of the other (text on background, icon inside card)
 * 2. Elements share exact same position (progress bar fill on track)
 * 3. A full-width background element (decorative backdrop)
 */
function isIntentionalOverlap(a, b, screenWidth) {
  // Pattern 1: parent/child — small element inside a larger one
  if (isChildOf(a, b) || isChildOf(b, a)) return true;

  // Pattern 2: same origin — overlay elements (progress fill on track)
  if (a.x === b.x && a.y === b.y) return true;

  // Pattern 3: full-width backdrop — element spanning nearly the entire screen width
  // is a decorative background layer, not a content element
  const widthThreshold = screenWidth * 0.9;
  const xThreshold = screenWidth * 0.05;
  const isBackdropA = a.width >= widthThreshold && a.x <= xThreshold;
  const isBackdropB = b.width >= widthThreshold && b.x <= xThreshold;
  if (isBackdropA || isBackdropB) return true;

  return false;
}

/**
 * Resolve unintentional element overlaps by shifting colliding elements downward.
 * Pure function: returns a new array with corrected positions, does NOT mutate input.
 *
 * Only resolves overlaps between elements on the SAME z_index layer.
 * Pinned elements (z_index >= 10) are never moved.
 * Intentional overlaps (containment, same-origin, backdrops) are preserved.
 *
 * @param {Array} elements - Array of element objects with {x, y, width, height, z_index, type}
 * @param {number} screenWidth - Screen width (used for backdrop detection)
 * @param {number} [gap=8] - Minimum gap between non-overlapping elements
 * @returns {Array} New array with resolved positions
 */
export function resolveOverlaps(elements, screenWidth, gap = 8) {
  if (elements.length <= 1) return elements.map(el => ({ ...el }));

  const result = elements.map(el => ({ ...el }));

  // Group by z_index — only check overlaps within the same layer
  const layerMap = new Map();
  for (let i = 0; i < result.length; i++) {
    const z = result[i].z_index || 0;
    if (!layerMap.has(z)) layerMap.set(z, []);
    layerMap.get(z).push(i);
  }

  for (const [zIndex, indices] of layerMap) {
    // Skip pinned elements — they are fixed chrome (navbars, tabbars)
    if (zIndex >= 10) continue;
    if (indices.length <= 1) continue;

    // Sort by y position (top to bottom), then by x (left to right).
    // Earlier elements in this order are "anchors" — later ones get shifted if needed.
    indices.sort((a, b) => {
      const dy = result[a].y - result[b].y;
      if (dy !== 0) return dy;
      return result[a].x - result[b].x;
    });

    // For each element, check against all previously processed elements in this layer.
    // If an unintentional overlap is found, push the element down below the conflicting one.
    for (let i = 1; i < indices.length; i++) {
      const idx = indices[i];
      const el = result[idx];

      for (let j = 0; j < i; j++) {
        const prevIdx = indices[j];
        const prev = result[prevIdx];

        if (!rectsOverlap(el, prev)) continue;
        if (isIntentionalOverlap(el, prev, screenWidth)) continue;

        // Unintentional overlap detected — push this element below the conflicting one
        el.y = prev.y + prev.height + gap;
      }
    }
  }

  return result;
}
