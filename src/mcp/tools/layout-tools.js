import { z } from 'zod';
import { autoLayout } from '../../renderer/layout.js';
import { composeLayout } from '../../renderer/layout-composer.js';
import { getAvailableSections } from '../../renderer/sections/index.js';

export function registerLayoutTools(server, store) {
  server.tool(
    'mockup_auto_layout',
    'Automatically reposition elements on a screen using vertical, horizontal, or grid layout. Elements with z_index >= 10 (nav bars) are excluded from layout.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      direction: z.enum(['vertical', 'horizontal', 'grid'])
        .describe('Layout direction'),
      spacing: z.number().optional().default(16)
        .describe('Space between elements in pixels (default: 16)'),
      padding: z.number().optional().default(16)
        .describe('Padding from screen edges in pixels (default: 16)'),
      columns: z.number().optional().default(2)
        .describe('Number of columns for grid layout (default: 2, ignored for vertical/horizontal)'),
      align: z.enum(['start', 'center', 'stretch']).optional().default('stretch')
        .describe('Cross-axis alignment: start (left/top), center, stretch (full width/height)'),
      element_ids: z.array(z.string()).optional()
        .describe('Specific element IDs to include in layout (default: all non-pinned elements)'),
      start_y: z.number().optional()
        .describe('Y offset to start layout from (useful when navbar occupies top area, e.g. start_y: 56)'),
    },
    async ({ project_id, screen_id, direction, spacing, padding, columns, align, element_ids, start_y }) => {
      try {
        const project = await store.getProject(project_id);
        const screen = project.screens.find(s => s.id === screen_id);
        if (!screen) {
          throw new Error(`Screen ${screen_id} not found in project ${project_id}`);
        }

        const layoutOptions = {
          direction,
          spacing,
          padding,
          columns,
          align,
          element_ids: element_ids || null,
          start_y: start_y !== undefined ? start_y : null,
        };

        const updatedElements = autoLayout(screen.elements, screen.width, screen.height, layoutOptions);

        // Build updates array for persistence
        const updates = updatedElements.map(el => ({
          id: el.id,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
        }));

        const updatedScreen = await store.bulkMoveElements(project_id, screen_id, updates);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(updatedScreen, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // --- High-level layout API: semantic sections ---
  server.tool(
    'mockup_create_screen_layout',
    'Create a screen with automatic layout from semantic sections (e.g., navbar, hero_with_cta, card_grid_3). 10x faster mockup creation. Sections are stacked vertically.',
    {
      project_id: z.string().describe('Project ID'),
      name: z.string().describe('Screen name'),
      sections: z.array(
        z.object({
          type: z.string().describe(`Section type: ${getAvailableSections().join(', ')}`),
          props: z.record(z.any()).optional().describe('Section-specific properties (e.g., { title: "...", links: [...] })'),
        })
      ).describe('Array of sections to stack vertically'),
      style: z.string().optional().describe('Style override (defaults to project style)'),
      width: z.number().optional().default(1280).describe('Screen width in pixels (default: 1280)'),
      height: z.number().optional().default(900).describe('Screen height in pixels (default: 900, actual will be auto-calculated)'),
    },
    async ({ project_id, name, sections, style, width, height }) => {
      try {
        const { elements, totalHeight } = await composeLayout(project_id, sections, store, width);

        // Create screen with calculated height
        const actualHeight = Math.max(totalHeight, height);
        const screen = await store.addScreen(project_id, name, width, actualHeight, '#FFFFFF', style || null);

        // Add all composed elements to the screen in bulk
        await store.bulkAddElements(project_id, screen.id, elements);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              screen_id: screen.id,
              name: screen.name,
              width: screen.width,
              height: screen.height,
              element_count: elements.length,
              sections_applied: sections.length,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
