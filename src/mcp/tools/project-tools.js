import { z } from 'zod';
import { config } from '../../config.js';
import { getAvailableStyles } from '../../renderer/styles/index.js';

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
        .enum(getAvailableStyles())
        .optional()
        .default('wireframe')
        .describe('Visual style for the project (inherited by screens unless overridden)'),
      folder: z.string().optional().describe('Always provide this parameter — if omitted, project is created in root data directory with no folder organization. Recommended: use a meaningful folder name (e.g. "MGGS/Audiobook Maker")'),
    },
    async ({ name, description, viewport, style, folder }) => {
      try {
        const dims = config.viewportPresets[viewport];
        const project = await store.createProject(name, description || '', {
          width: dims.width,
          height: dims.height,
          preset: viewport,
        }, style, folder || null);

        // Warn agent when a project with the same name already exists in the same folder —
        // signal to prefer mockup_get_or_create_project for idempotent workflows.
        const allProjects = await store.listProjects();
        const sameNameProjects = allProjects.filter(
          p => p.name === name && (p.folder || null) === (folder || null) && p.id !== project.id
        );
        if (sameNameProjects.length > 0) {
          const result = {
            ...project,
            warning: `Project "${name}" already exists ${sameNameProjects.length} time(s) in this folder. Consider using mockup_get_or_create_project to avoid duplicates.`,
          };
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

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
    'mockup_get_or_create_project',
    'Get existing project by name and folder, or create a new one if not found. Idempotent — safe to call multiple times. Returns { project, created: boolean }. PREFER this over mockup_create_project to avoid duplicates.',
    {
      name: z.string().describe('Project name'),
      description: z.string().optional().describe('Description (used only when creating)'),
      viewport: z.enum(['mobile', 'tablet', 'desktop']).optional().default('mobile')
        .describe('Viewport preset (mobile: 393x852, tablet: 768x1024, desktop: 1280x800)'),
      style: z.enum(getAvailableStyles()).optional().default('wireframe')
        .describe('Default visual style'),
      folder: z.string().optional().describe('Folder path'),
    },
    async ({ name, description, viewport, style, folder }) => {
      try {
        const existing = await store.findProjectByName(name, folder || null);
        if (existing) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ project: existing, created: false }, null, 2) }],
          };
        }
        const dims = config.viewportPresets[viewport];
        const project = await store.createProject(name, description || '', {
          width: dims.width,
          height: dims.height,
          preset: viewport,
        }, style, folder || null);
        return {
          content: [{ type: 'text', text: JSON.stringify({ project, created: true }, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'mockup_list_projects',
    'List all mockup projects with their IDs, names, screen counts, folder paths, and last update timestamps',
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
