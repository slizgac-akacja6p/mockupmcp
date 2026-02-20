import { z } from 'zod';
import { buildScreenHtml } from '../../renderer/html-builder.js';
import { takeScreenshot } from '../../renderer/screenshot.js';
import { config } from '../../config.js';

export function registerExportTools(server, store) {
  server.tool(
    'mockup_export',
    'Export a screen as a PNG image. Returns both a file path and the image data inline.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID to export'),
      scale: z
        .number()
        .optional()
        .default(config.screenshotScale)
        .describe('Scale factor for the screenshot (default: 2x)'),
    },
    async ({ project_id, screen_id, scale }) => {
      try {
        const project = await store.getProject(project_id);
        const screen = project.screens.find((s) => s.id === screen_id);
        if (!screen) {
          throw new Error(`Screen ${screen_id} not found in project ${project_id}`);
        }

        // Screen-level style overrides project default; both fall back to wireframe
        const style = screen.style || project.style || 'wireframe';
        const html = buildScreenHtml(screen, style);
        const buffer = await takeScreenshot(html, screen.width, screen.height, scale);
        const filePath = await store.saveExport(project_id, screen_id, buffer);

        return {
          content: [
            {
              type: 'text',
              text: `Exported to ${filePath} (${screen.width}x${screen.height} @${scale}x)`,
            },
            {
              type: 'image',
              data: buffer.toString('base64'),
              mimeType: 'image/png',
            },
          ],
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
    'mockup_get_preview_url',
    'Get the live preview URL for a screen (opens in browser via the preview server)',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
    },
    async ({ project_id, screen_id }) => {
      try {
        // Validate that the project and screen exist before returning a URL.
        const project = await store.getProject(project_id);
        const screen = project.screens.find((s) => s.id === screen_id);
        if (!screen) {
          throw new Error(`Screen ${screen_id} not found in project ${project_id}`);
        }

        const url = `http://localhost:${config.previewPort}/preview/${project_id}/${screen_id}`;
        return {
          content: [{ type: 'text', text: url }],
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
