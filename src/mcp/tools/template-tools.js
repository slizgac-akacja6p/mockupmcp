import { z } from 'zod';
import { getTemplate, getAvailableTemplates } from '../../renderer/templates/index.js';

export function registerTemplateTools(server, store) {
  server.tool(
    'mockup_apply_template',
    'Apply a preset template to a screen. Replaces all existing elements by default. Templates: login, dashboard, settings, list, form, profile, onboarding',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID to apply template to'),
      template: z.enum(['login', 'dashboard', 'settings', 'list', 'form', 'profile', 'onboarding'])
        .describe('Template name'),
      clear: z.boolean().optional().default(true)
        .describe('Whether to clear existing elements before applying (default: true)'),
    },
    async ({ project_id, screen_id, template, clear }) => {
      try {
        const tmpl = getTemplate(template);
        if (!tmpl) {
          throw new Error(`Unknown template: "${template}". Available: ${getAvailableTemplates().join(', ')}`);
        }

        const project = await store.getProject(project_id);
        const screen = project.screens.find(s => s.id === screen_id);
        if (!screen) {
          throw new Error(`Screen ${screen_id} not found in project ${project_id}`);
        }

        const style = screen.style || project.style || 'wireframe';
        const elements = tmpl.generate(screen.width, screen.height, style);
        const updatedScreen = await store.applyTemplate(project_id, screen_id, elements, clear);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(updatedScreen, null, 2),
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
    'mockup_list_templates',
    'List available templates with their descriptions and expected element counts',
    {},
    async () => {
      try {
        const templates = getAvailableTemplates().map(name => {
          const tmpl = getTemplate(name);
          const sampleElements = tmpl.generate(393, 852, 'wireframe');
          return {
            name,
            description: tmpl.description,
            elementCount: sampleElements.length,
          };
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(templates, null, 2),
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
