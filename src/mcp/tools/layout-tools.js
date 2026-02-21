import { z } from 'zod';
import { autoLayout } from '../../renderer/layout.js';

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
}
