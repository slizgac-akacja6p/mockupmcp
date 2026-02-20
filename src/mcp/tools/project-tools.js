import { z } from 'zod';
import { config } from '../../config.js';

export function registerProjectTools(server, store) {
  server.tool(
    'mockup_create_project',
    'Create a new mockup project with a name, optional description, viewport preset, and style',
    {
      name: z.string().describe('Project name'),
      description: z.string().optional().describe('Project description'),
      viewport: z
        .enum(['mobile', 'tablet', 'desktop'])
        .optional()
        .default('mobile')
        .describe('Viewport preset: mobile (393x852), tablet (834x1194), desktop (1440x900)'),
      style: z
        .enum(['wireframe', 'material', 'ios'])
        .optional()
        .default('wireframe')
        .describe('Visual style: wireframe (grey/sketch), material (Material Design 3), ios (iOS HIG)'),
    },
    async ({ name, description, viewport, style }) => {
      try {
        const dims = config.viewportPresets[viewport];
        const project = await store.createProject(name, description || '', {
          width: dims.width,
          height: dims.height,
          preset: viewport,
        }, style);
        return {
          content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
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
    'mockup_list_projects',
    'List all mockup projects with their IDs, names, screen counts, and last update timestamps',
    {},
    async () => {
      try {
        const projects = await store.listProjects();
        return {
          content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
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
    'mockup_delete_project',
    'Delete a mockup project and all its screens/elements by project ID',
    {
      project_id: z.string().describe('Project ID to delete'),
    },
    async ({ project_id }) => {
      try {
        await store.deleteProject(project_id);
        return {
          content: [{ type: 'text', text: `Project ${project_id} deleted successfully` }],
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
