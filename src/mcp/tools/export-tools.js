import { z } from 'zod';
import { buildScreenHtml } from '../../renderer/html-builder.js';
import { takeScreenshot, takePdfExport, htmlToSvg } from '../../renderer/screenshot.js';
import { config } from '../../config.js';
import { generateMermaid } from '../../codegen/flow.js';
import { getGenerator, getAvailableFrameworks } from '../../codegen/index.js';

export function registerExportTools(server, store) {
  server.tool(
    'mockup_export',
    'Export a screen as PNG, SVG, or PDF. Each export renders via Puppeteer (~400ms). For iterating on layouts, prefer mockup_get_preview_url for instant browser preview. Returns the file path and inline content.',
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

        // Puppeteer >=22 returns Uint8Array, not Buffer. Uint8Array.toString() ignores
        // the encoding argument and returns a comma-separated decimal string which fails
        // the SDK's Base64 validation (atob rejects commas). Wrap in Buffer to get real base64.
        const base64 = Buffer.from(buffer).toString('base64');

        return {
          content: [
            {
              type: 'text',
              text: `Exported to ${filePath} (${screen.width}x${screen.height} @${scale}x)`,
            },
            {
              type: 'image',
              data: base64,
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

  server.tool(
    'mockup_export_flow',
    'Export the navigation flow diagram for a project as Mermaid text. Shows all screens as nodes and navigation links as edges.',
    {
      project_id: z.string().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const project = await store.getProject(project_id);
        const mermaid = generateMermaid(project);
        const linkCount = project.screens.reduce((sum, s) =>
          sum + (s.elements || []).filter(e => e.properties?.link_to?.screen_id).length, 0);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              format: 'mermaid',
              screens: project.screens.length,
              links: linkCount,
              diagram: mermaid,
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
    'mockup_to_code',
    'Generate framework code from a screen mockup. Supports: html, react, flutter, swiftui.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      framework: z.enum(['html', 'react', 'flutter', 'swiftui']).describe('Target framework'),
    },
    async ({ project_id, screen_id, framework }) => {
      try {
        const project = await store.getProject(project_id);
        const screen = project.screens.find(s => s.id === screen_id);
        if (!screen) {
          throw new Error(`Screen ${screen_id} not found in project ${project_id}`);
        }
        const gen = getGenerator(framework);
        if (!gen) {
          throw new Error(`Unknown framework: ${framework}. Available: ${getAvailableFrameworks().join(', ')}`);
        }
        const code = gen.generate(screen);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              code,
              framework,
              component_count: (screen.elements || []).length,
              screen_name: screen.name,
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
