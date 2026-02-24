import { z } from 'zod';
import { getAvailableStyles } from '../../renderer/styles/index.js';

export async function registerScreenTools(server, store) {
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
        .enum(getAvailableStyles())
        .optional()
        .describe('Style override for this screen (defaults to project style)'),
      color_scheme: z
        .enum(['dark', 'light'])
        .nullable()
        .optional()
        .describe('Color scheme for the screen. Only affects styles that support it (e.g., slate). "dark" or "light".'),
    },
    async ({ project_id, name, width, height, background, style, color_scheme }) => {
      try {
        const screen = await store.addScreen(project_id, name, width, height, background, style, color_scheme);
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

  // --- Screen generator (NLP -> template-based) ---

  const { generateScreen } = await import('../screen-generator.js');

  server.tool(
    'mockup_generate_screen',
    'RECOMMENDED for new screens. Generate a complete UI screen from a natural language description in a single call — 10x faster than adding elements one by one. Matches to the closest template (login, dashboard, settings, list, form, profile, onboarding) and augments with additional elements based on keywords. Example: "login screen with social auth buttons".',
    {
      project_id: z.string().describe('Project ID'),
      description: z.string().describe('Natural language screen description, e.g. "login screen with email and password fields"'),
      name: z.string().optional().describe('Screen name (auto-derived from description if omitted)'),
      style: z
        .enum(getAvailableStyles())
        .optional()
        .describe('Style override (defaults to project style)'),
    },
    async ({ project_id, description, name, style }) => {
      try {
        const project = await store.getProject(project_id);
        const resolvedStyle = style || project.style || 'wireframe';
        const { width, height } = project.viewport;

        const { elements, matchInfo, nameHint } = generateScreen(description, width, height, resolvedStyle);

        const screenName = name || nameHint;
        const screen = await store.addScreen(project_id, screenName, width, height, '#FFFFFF', resolvedStyle !== project.style ? resolvedStyle : null);
        const populated = await store.applyTemplate(project_id, screen.id, elements, true);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              screen: {
                id: populated.id,
                name: populated.name,
                width: populated.width,
                height: populated.height,
                elements: populated.elements.length,
              },
              match_info: matchInfo,
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
