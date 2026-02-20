import { z } from 'zod';

export function registerGroupTools(server, store) {
  server.tool(
    'mockup_group_elements',
    'Group multiple elements together. Groups can be moved as a unit.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      element_ids: z.array(z.string()).min(2).describe('Element IDs to group (minimum 2)'),
      group_name: z.string().optional().default('Group').describe('Name for the group'),
    },
    async ({ project_id, screen_id, element_ids, group_name }) => {
      try {
        const group = await store.groupElements(project_id, screen_id, element_ids, group_name);
        return {
          content: [{ type: 'text', text: JSON.stringify(group, null, 2) }],
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
    'mockup_ungroup_elements',
    'Remove a group. Elements remain in place.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      group_id: z.string().describe('Group ID to remove'),
    },
    async ({ project_id, screen_id, group_id }) => {
      try {
        await store.ungroupElements(project_id, screen_id, group_id);
        return {
          content: [{ type: 'text', text: `Group ${group_id} removed successfully` }],
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
    'mockup_move_group',
    'Move all elements in a group by delta X/Y offset.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      group_id: z.string().describe('Group ID'),
      delta_x: z.number().describe('Horizontal offset (positive = right)'),
      delta_y: z.number().describe('Vertical offset (positive = down)'),
    },
    async ({ project_id, screen_id, group_id, delta_x, delta_y }) => {
      try {
        const screen = await store.moveGroup(project_id, screen_id, group_id, delta_x, delta_y);
        return {
          content: [{ type: 'text', text: JSON.stringify({ group_id, delta_x, delta_y, elements: screen.elements.length }, null, 2) }],
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
