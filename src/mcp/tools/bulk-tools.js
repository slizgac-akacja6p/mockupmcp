import { z } from 'zod';
import { getAvailableTypes } from '../../renderer/components/index.js';
import { generateId } from '../../storage/id-generator.js';
import { getAvailableStyles } from '../../renderer/styles/index.js';

export function registerBulkTools(server, store) {
  server.tool(
    'mockup_create_screen_full',
    'Create a screen with multiple elements in a single call. Much faster than creating elements one by one. Supports ref system for linking elements.',
    {
      project_id: z.string().describe('Project ID'),
      name: z.string().describe('Screen name'),
      width: z.number().optional().describe('Screen width in pixels (optional, uses project viewport width if omitted)'),
      height: z.number().optional().describe('Screen height in pixels (optional, uses project viewport height if omitted)'),
      background: z.string().optional().default('#FFFFFF').describe('Screen background color (default: #FFFFFF)'),
      style: z.enum(getAvailableStyles()).optional()
        .describe('Visual style for the screen'),
      elements: z.array(z.object({
        type: z.string().describe('Element type (rectangle, text, button, card, etc.)'),
        x: z.number().describe('X position in pixels'),
        y: z.number().describe('Y position in pixels'),
        width: z.number().describe('Width in pixels'),
        height: z.number().describe('Height in pixels'),
        properties: z.record(z.any()).optional().default({}).describe('Component properties'),
        z_index: z.number().optional().default(0).describe('Z-index layer'),
        ref: z.string().optional().describe('Optional reference name for linking later'),
      })).describe('Array of elements to create on the screen'),
      links: z.array(z.object({
        ref: z.string().describe('Element ref to add link to'),
        target_screen_id: z.string().describe('Screen ID to navigate to'),
        transition: z.enum(['push', 'fade', 'slide', 'none']).optional().default('push')
          .describe('Transition animation type'),
      })).optional().default([]).describe('Navigation links between elements and screens'),
    },
    async ({ project_id, name, width, height, background, style, elements, links }) => {
      try {
        const { screen, refMap } = await store.createScreenFull(project_id, {
          name,
          width,
          height,
          background: background || '#FFFFFF',
          style,
          elements: elements || [],
          links: links || [],
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              screen_id: screen.id,
              screen_name: screen.name,
              element_count: screen.elements.length,
              refMap: Object.fromEntries(refMap),
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

  server.tool(
    'mockup_create_project_full',
    'Create a complete project with multiple screens, elements, and navigation links in a single call. Ideal for creating entire mockup flows at once.',
    {
      name: z.string().describe('Project name'),
      description: z.string().optional().describe('Project description'),
      viewport: z.enum(['mobile', 'tablet', 'desktop']).optional()
        .describe('Viewport preset (mobile: 393x852, tablet: 768x1024, desktop: 1280x800)'),
      style: z.enum(getAvailableStyles()).optional()
        .describe('Default visual style for screens'),
      folder: z.string().optional().describe('Folder path to create project in'),
      screens: z.array(z.object({
        ref: z.string().optional().describe('Reference name for screen (used in links)'),
        name: z.string().describe('Screen name'),
        width: z.number().optional().describe('Screen width (optional, uses viewport preset)'),
        height: z.number().optional().describe('Screen height (optional, uses viewport preset)'),
        background: z.string().optional().default('#FFFFFF').describe('Screen background color'),
        style: z.enum(getAvailableStyles()).optional()
          .describe('Screen-specific style (overrides project style)'),
        elements: z.array(z.object({
          type: z.string().describe('Element type'),
          x: z.number().describe('X position'),
          y: z.number().describe('Y position'),
          width: z.number().describe('Width'),
          height: z.number().describe('Height'),
          properties: z.record(z.any()).optional().default({}).describe('Component properties'),
          z_index: z.number().optional().default(0).describe('Z-index'),
          ref: z.string().optional().describe('Reference name for element'),
        })).describe('Elements on this screen'),
      })).describe('Array of screens to create'),
      links: z.array(z.object({
        screen_ref: z.string().describe('Source screen ref'),
        element_ref: z.string().describe('Source element ref'),
        target_screen_ref: z.string().describe('Target screen ref'),
        transition: z.enum(['push', 'fade', 'slide', 'none']).optional().default('push')
          .describe('Transition animation'),
      })).optional().default([]).describe('Navigation links between screens'),
    },
    async ({ name, description, viewport, style, folder, screens, links }) => {
      try {
        // Map viewport preset to dimensions
        let viewportObj = { width: 393, height: 852, preset: 'mobile' };
        if (viewport === 'tablet') {
          viewportObj = { width: 768, height: 1024, preset: 'tablet' };
        } else if (viewport === 'desktop') {
          viewportObj = { width: 1280, height: 800, preset: 'desktop' };
        }

        const { project, screenRefMap } = await store.createProjectFull({
          name,
          description: description || '',
          viewport: viewportObj,
          style: style || 'wireframe',
          folder,
          screens: screens || [],
          links: links || [],
        });

        const total_elements = project.screens.reduce((sum, s) => sum + s.elements.length, 0);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              project_id: project.id,
              project_name: project.name,
              screen_count: project.screens.length,
              total_elements,
              screenRefMap: Object.fromEntries(screenRefMap),
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

  server.tool(
    'mockup_import_project',
    'Import a complete project from JSON (as returned by mockup_export_project). All IDs are regenerated to prevent conflicts.',
    {
      project_json: z.record(z.any()).describe('Full project JSON object'),
      name: z.string().optional().describe('Override project name (optional)'),
      folder: z.string().optional().describe('Folder path to import project into'),
    },
    async ({ project_json, name, folder }) => {
      try {
        const { project } = await store.importProject(project_json, name || null, folder || null);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              project_id: project.id,
              project_name: project.name,
              screen_count: project.screens.length,
              total_elements: project.screens.reduce((sum, s) => sum + s.elements.length, 0),
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

  server.tool(
    'mockup_export_project',
    'Export a complete project as JSON, including all screens, elements, and links. Can be used with mockup_import_project to clone or backup projects.',
    {
      project_id: z.string().describe('Project ID to export'),
    },
    async ({ project_id }) => {
      try {
        const project = await store.getProject(project_id);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(project, null, 2),
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
