import { z } from 'zod';
import { editSessions } from '../../preview/routes/approval-api.js';

export function registerApprovalTools(server, store) {
  server.tool(
    'mockup_await_approval',
    'Wait for user to approve screen edits in browser editor. Polls every 2s until approved or timeout.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      timeout_seconds: z.number().optional().default(120).describe('Max wait time in seconds (default 120)'),
    },
    async ({ project_id, screen_id, timeout_seconds }) => {
      const key = `${project_id}/${screen_id}`;
      const deadline = Date.now() + timeout_seconds * 1000;

      while (Date.now() < deadline) {
        const session = editSessions.get(key);
        if (session?.approved) {
          try {
            const elements = await store.listElements(project_id, screen_id);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  approved: true,
                  approvedAt: session.approvedAt,
                  summary: session.summary,
                  elementCount: elements.length,
                  elements,
                }, null, 2),
              }],
            };
          } catch (err) {
            return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
          }
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      return {
        content: [{ type: 'text', text: `Error: approval timeout after ${timeout_seconds}s — user did not approve screen ${screen_id}` }],
        isError: true,
      };
    }
  );
}
