import { z } from 'zod';
import { buildScreenHtml } from '../../renderer/html-builder.js';
import { takeScreenshot, takePdfExport, htmlToSvg } from '../../renderer/screenshot.js';
import { config } from '../../config.js';

export function registerExportTools(server, store) {
  server.tool(
    'mockup_export',
    'Export a screen as PNG, SVG, or PDF. Returns the file path and inline content.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID to export'),
      format: z.enum(['png', 'svg', 'pdf']).optional().default('png')
        .describe('Export format: png (raster), svg (vector), pdf (document). Default: png'),
      scale: z
        .number()
        .optional()
        .default(config.screenshotScale)
        .describe('Scale factor for PNG screenshots (ignored for SVG/PDF). Default: 2x'),
    },
    async ({ project_id, screen_id, format, scale }) => {
      try {
        const project = await store.getProject(project_id);
        const screen = project.screens.find((s) => s.id === screen_id);
        if (!screen) {
          throw new Error(`Screen ${screen_id} not found in project ${project_id}`);
        }

        const style = screen.style || project.style || 'wireframe';
        const html = buildScreenHtml(screen, style);

        if (format === 'svg') {
          const svgContent = htmlToSvg(html, screen.width, screen.height);
          const filePath = await store.saveExport(project_id, screen_id, svgContent, 'svg');

          return {
            content: [
              {
                type: 'text',
                text: `Exported SVG to ${filePath} (${screen.width}x${screen.height})`,
              },
              {
                type: 'text',
                text: svgContent,
              },
            ],
          };
        }

        if (format === 'pdf') {
          const pdfBuffer = await takePdfExport(html, screen.width, screen.height);
          const filePath = await store.saveExport(project_id, screen_id, pdfBuffer, 'pdf');

          return {
            content: [
              {
                type: 'text',
                text: `Exported PDF to ${filePath} (${screen.width}x${screen.height})`,
              },
            ],
          };
        }

        // Default: PNG
        const buffer = await takeScreenshot(html, screen.width, screen.height, scale);
        const filePath = await store.saveExport(project_id, screen_id, buffer, 'png');

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
