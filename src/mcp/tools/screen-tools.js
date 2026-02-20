import { z } from 'zod';

export function registerScreenTools(server, store) {
  server.tool(
    'mockup_add_screen',
    'Add a new screen to a project. Width/height default to the project viewport if omitted.',
    {
      project_id: z.string().describe('Project ID'),
      name: z.string().describe('Screen name'),
      width: z.number().optional().describe('Screen width in pixels (defaults to project viewport)'),
      height: z.number().optional().describe('Screen height in pixels (defaults to project viewport)'),
      background: z
        .string()
        .optional()
        .default('#FFFFFF')
        .describe('Background color (hex), defaults to #FFFFFF'),
      style: z
        .enum(['wireframe', 'material', 'ios'])
        .optional()
        .describe('Style override for this screen (defaults to project style)'),
    },
    async ({ project_id, name, width, height, background, style }) => {
      try {
        const screen = await store.addScreen(project_id, name, width, height, background, style);
        return {
          content: [{ type: 'text', text: JSON.stringify(screen, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'mockup_list_screens',
    'List all screens in a project with their IDs, names, dimensions, and element counts',
    {
      project_id: z.string().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const screens = await store.listScreens(project_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(screens, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'mockup_delete_screen',
    'Delete a screen from a project by screen ID',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID to delete'),
    },
    async ({ project_id, screen_id }) => {
      try {
        await store.deleteScreen(project_id, screen_id);
        return {
          content: [{ type: 'text', text: `Screen ${screen_id} deleted successfully` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'mockup_duplicate_screen',
    'Duplicate an existing screen with all its elements. All IDs are regenerated.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID to duplicate'),
      new_name: z.string().optional().describe('Name for the copy (defaults to "Original Name (copy)")'),
    },
    async ({ project_id, screen_id, new_name }) => {
      try {
        const screen = await store.duplicateScreen(project_id, screen_id, new_name);
        return {
          content: [{ type: 'text', text: JSON.stringify(screen, null, 2) }],
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
