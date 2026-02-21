import { z } from 'zod';
import { getAvailableTypes } from '../../renderer/components/index.js';

export function registerElementTools(server, store) {
  server.tool(
    'mockup_add_element',
    'Add a UI element to a screen. Types: text, rectangle, circle, line, image, icon, avatar, badge, chip, skeleton, progress, tooltip, button, input, textarea, checkbox, radio, toggle, select, slider, navbar, tabbar, sidebar, breadcrumb, card, list, table, alert, modal, login_form, search_bar, header, footer, data_table, chart_placeholder',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      type: z.string().describe('Element type — see tool description for available types'),
      x: z.number().describe('X position in pixels'),
      y: z.number().describe('Y position in pixels'),
      width: z.number().describe('Element width in pixels'),
      height: z.number().describe('Element height in pixels'),
      properties: z
        .record(z.any())
        .optional()
        .default({})
        .describe('Type-specific properties (e.g. { label: "Click", variant: "primary" } for button)'),
      z_index: z
        .number()
        .optional()
        .default(0)
        .describe('Z-index for layering order, defaults to 0'),
    },
    async ({ project_id, screen_id, type, x, y, width, height, properties, z_index }) => {
      try {
        const availableTypes = getAvailableTypes();
        if (!availableTypes.includes(type)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Invalid element type "${type}". Available types: ${availableTypes.join(', ')}`,
              },
            ],
            isError: true,
          };
        }

        const element = await store.addElement(
          project_id,
          screen_id,
          type,
          x,
          y,
          width,
          height,
          properties,
          z_index
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(element, null, 2) }],
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
    'mockup_update_element',
    'Update the properties of an existing element (partial merge with existing properties)',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      element_id: z.string().describe('Element ID'),
      properties: z.record(z.any()).describe('Properties to merge with existing ones'),
    },
    async ({ project_id, screen_id, element_id, properties }) => {
      try {
        const element = await store.updateElement(project_id, screen_id, element_id, properties);
        return {
          content: [{ type: 'text', text: JSON.stringify(element, null, 2) }],
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
    'mockup_delete_element',
    'Delete an element from a screen',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      element_id: z.string().describe('Element ID to delete'),
    },
    async ({ project_id, screen_id, element_id }) => {
      try {
        await store.deleteElement(project_id, screen_id, element_id);
        return {
          content: [{ type: 'text', text: `Element ${element_id} deleted successfully` }],
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
    'mockup_move_element',
    'Move or resize an element. Only provided fields are updated; omitted fields keep their current values.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      element_id: z.string().describe('Element ID'),
      x: z.number().optional().describe('New X position'),
      y: z.number().optional().describe('New Y position'),
      width: z.number().optional().describe('New width'),
      height: z.number().optional().describe('New height'),
      z_index: z.number().optional().describe('New z-index'),
    },
    async ({ project_id, screen_id, element_id, x, y, width, height, z_index }) => {
      try {
        const element = await store.moveElement(
          project_id,
          screen_id,
          element_id,
          x,
          y,
          width,
          height,
          z_index
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(element, null, 2) }],
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
    'mockup_list_elements',
    'List all elements on a screen with their full details (type, position, size, properties)',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
    },
    async ({ project_id, screen_id }) => {
      try {
        const elements = await store.listElements(project_id, screen_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(elements, null, 2) }],
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
    'mockup_add_link',
    'Add a navigation link from an element to another screen. When the element is clicked in preview, it navigates to the target screen.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen containing the element'),
      element_id: z.string().describe('Element to add link to'),
      target_screen_id: z.string().describe('Screen to navigate to when clicked'),
      transition: z.enum(['push', 'fade', 'slide', 'none']).optional().default('push')
        .describe('Transition animation type'),
    },
    async ({ project_id, screen_id, element_id, target_screen_id, transition }) => {
      try {
        const element = await store.addLink(project_id, screen_id, element_id, target_screen_id, transition);
        return {
          content: [{ type: 'text', text: JSON.stringify(element, null, 2) }],
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
    'mockup_remove_link',
    'Remove a navigation link from an element',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen containing the element'),
      element_id: z.string().describe('Element to remove link from'),
    },
    async ({ project_id, screen_id, element_id }) => {
      try {
        const element = await store.removeLink(project_id, screen_id, element_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(element, null, 2) }],
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
