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
