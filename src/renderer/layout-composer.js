// Layout composer — combines semantic sections into a complete screen layout.

import { getSection } from './sections/index.js';

/**
 * Compose a complete screen layout from semantic sections.
 * Sections are stacked vertically with their specified height.
 *
 * @param {string} projectId - Project ID (for future per-project style defaults)
 * @param {Array<{type: string, props?: object}>} sections - Array of section descriptors
 * @param {import('../storage/project-store.js').ProjectStore} store - Project store (for future access)
 * @param {number} [screenWidth=1280] - Screen width in pixels
 * @returns {Promise<{elements: Array, totalHeight: number}>} - Generated elements and total height
 */
export async function composeLayout(projectId, sections, store, screenWidth = 1280) {
  let currentY = 0;
  const allElements = [];

  for (const sectionDesc of sections) {
    const { type, props } = sectionDesc;
    const sectionFn = getSection(type);

    if (!sectionFn) {
      throw new Error(`Unknown section type: "${type}"`);
    }

    const { elements, height } = sectionFn.generate(screenWidth, currentY, props || {});
    allElements.push(...elements);
    currentY += height;
  }

  return {
    elements: allElements,
    totalHeight: currentY,
  };
}
