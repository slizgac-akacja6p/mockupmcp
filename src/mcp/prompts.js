// MCP Prompt registration — AI-assisted design review, accessibility, and comparison prompts.

import { z } from 'zod';
import { buildScreenHtml } from '../renderer/html-builder.js';
import { takeScreenshot } from '../renderer/screenshot.js';

/**
 * Render a screen to a base64 PNG string.
 * Centralised here to avoid repeating the same 6-line pattern in each prompt.
 *
 * @param {import('../storage/project-store.js').ProjectStore} store
 * @param {string} project_id
 * @param {string} screen_id
 * @returns {Promise<{screen: object, project: object, style: string, base64: string}>}
 */
async function renderScreen(store, project_id, screen_id) {
  const project = await store.getProject(project_id);
  const screen = project.screens.find(s => s.id === screen_id);
  if (!screen) throw new Error(`Screen ${screen_id} not found`);

  const style = screen.style || project.style || 'wireframe';
  const html = buildScreenHtml(screen, style);
  const buffer = await takeScreenshot(html, screen.width, screen.height);
  const base64 = Buffer.from(buffer).toString('base64');

  return { screen, project, style, base64 };
}

/**
 * Register all MCP prompts on the given server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('../storage/project-store.js').ProjectStore} store
 */
export function registerPrompts(server, store) {
  // --- Design review: visual hierarchy, spacing, CTA placement ---
  server.prompt(
    'mockup_design_review',
    {
      description: 'Review a UI mockup for design quality and UX issues',
      argsSchema: {
        project_id: z.string(),
        screen_id: z.string(),
      },
    },
    async ({ project_id, screen_id }) => {
      try {
        const { screen, style, base64 } = await renderScreen(store, project_id, screen_id);

        const text =
`Review this UI mockup for design quality and usability issues.

Screen: "${screen.name}" (${screen.width}x${screen.height}, style: ${style})
Elements: ${screen.elements.length}

Element data:
${JSON.stringify(screen.elements, null, 2)}

Please evaluate:
1. Visual hierarchy — is the most important content prominent?
2. Spacing and alignment — are elements consistently spaced?
3. CTA placement — are call-to-action buttons easy to find?
4. Information density — is the screen cluttered or too sparse?
5. Navigation clarity — is it clear how to navigate?
6. Component consistency — are similar elements styled consistently?
7. Typography hierarchy — are font sizes and weights used meaningfully?

For each issue found, suggest a specific fix using the mockup_update_element or mockup_move_element tools.`;

        return {
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text },
              { type: 'image', data: base64, mimeType: 'image/png' },
            ],
          }],
        };
      } catch (error) {
        return {
          messages: [{
            role: 'user',
            content: { type: 'text', text: `Error: ${error.message}` },
          }],
        };
      }
    }
  );

  // --- Accessibility check: touch targets, contrast, labels ---
  server.prompt(
    'mockup_accessibility_check',
    {
      description: 'Check a UI mockup for accessibility issues',
      argsSchema: {
        project_id: z.string(),
        screen_id: z.string(),
      },
    },
    async ({ project_id, screen_id }) => {
      try {
        const { screen, style, base64 } = await renderScreen(store, project_id, screen_id);

        const text =
`Check this UI mockup for accessibility issues.

Screen: "${screen.name}" (${screen.width}x${screen.height}, style: ${style})
Elements: ${screen.elements.length}

Element data:
${JSON.stringify(screen.elements, null, 2)}

Please check:
1. Touch target sizes — all interactive elements should be at least 44x44px
2. Text sizes — body text should be at least 12px, labels at least 11px
3. Text contrast — ensure sufficient contrast between text and background
4. Spacing between interactive elements — at least 8px gap to prevent mis-taps
5. Text hierarchy — headings should be distinguishable from body text
6. Icon labels — icons should have text labels or be self-explanatory
7. Form labels — all inputs should have visible labels
8. Error states — forms should have room for error messages

For each issue found, suggest a specific fix with element IDs and property changes.`;

        return {
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text },
              { type: 'image', data: base64, mimeType: 'image/png' },
            ],
          }],
        };
      } catch (error) {
        return {
          messages: [{
            role: 'user',
            content: { type: 'text', text: `Error: ${error.message}` },
          }],
        };
      }
    }
  );

  // --- Screen comparison: visual + structural consistency between two screens ---
  server.prompt(
    'mockup_compare_screens',
    {
      description: 'Compare two UI mockup screens for consistency',
      argsSchema: {
        project_id: z.string(),
        screen_id_a: z.string(),
        screen_id_b: z.string(),
      },
    },
    async ({ project_id, screen_id_a, screen_id_b }) => {
      try {
        const [resultA, resultB] = await Promise.all([
          renderScreen(store, project_id, screen_id_a),
          renderScreen(store, project_id, screen_id_b),
        ]);

        const { screen: screenA, base64: base64A } = resultA;
        const { screen: screenB, base64: base64B } = resultB;

        const text =
`Compare these two UI mockup screens for visual consistency.

Screen A: "${screenA.name}" (${screenA.width}x${screenA.height})
Elements: ${screenA.elements.length}

Screen B: "${screenB.name}" (${screenB.width}x${screenB.height})
Elements: ${screenB.elements.length}

Screen A elements:
${JSON.stringify(screenA.elements, null, 2)}

Screen B elements:
${JSON.stringify(screenB.elements, null, 2)}

Please compare:
1. Visual consistency — do both screens use the same styling patterns?
2. Spacing and sizing — are margins, padding, and element sizes consistent?
3. Component reuse — are similar components styled the same way?
4. Typography — are font sizes and weights consistent across screens?
5. Color palette — do both screens use the same color scheme?
6. Navigation patterns — is navigation placement consistent?
7. Information architecture — is content organized similarly?

For each inconsistency found, suggest specific fixes with element IDs.`;

        return {
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text },
              { type: 'image', data: base64A, mimeType: 'image/png' },
              { type: 'image', data: base64B, mimeType: 'image/png' },
            ],
          }],
        };
      } catch (error) {
        return {
          messages: [{
            role: 'user',
            content: { type: 'text', text: `Error: ${error.message}` },
          }],
        };
      }
    }
  );

  console.error('[MockupMCP] 3 prompts registered (design_review, accessibility_check, compare_screens)');
}
