import { z } from 'zod';

// approval-tools.js — MCP tool for polling screen approval status.
// Redesigned for M23: supports 3-state responses (accepted, accepted_with_comments, rejected)
// plus timeout, replacing the old binary approved/not-approved flow.

export function registerApprovalTools(server, store) {
  server.tool(
    'mockup_await_approval',
    'Wait for reviewer to approve, reject, or accept-with-comments a screen in the browser editor. Polls screen status every 2 seconds until a decision is made or timeout is reached. Returns one of: accepted | accepted_with_comments | rejected | timeout.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID to await approval for'),
      timeout_seconds: z.number().optional().default(300).describe('Max wait time in seconds (default 300)'),
      auto_version: z.boolean().optional().default(false).describe('If true, automatically create a new screen version when rejected or accepted_with_comments'),
    },
    async ({ project_id, screen_id, timeout_seconds, auto_version }) => {
      const deadline = Date.now() + timeout_seconds * 1000;

      // Reset any stale _approval_action from a previous cycle so we start clean.
      // This makes the tool re-usable across multiple approval rounds.
      try {
        const project = await store.getProject(project_id);
        const screenNow = project.screens.find(s => s.id === screen_id);
        if (!screenNow) {
          return {
            content: [{ type: 'text', text: `Error: screen ${screen_id} not found in project ${project_id}` }],
            isError: true,
          };
        }
        // Only clear if it carried over a terminal action from a previous approval round.
        if (screenNow._approval_action) {
          await store.updateScreen(project_id, screen_id, { _approval_action: null });
        }
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }

      while (Date.now() < deadline) {
        try {
          const project = await store.getProject(project_id);
          const screen = project.screens.find(s => s.id === screen_id);
          if (!screen) {
            return {
              content: [{ type: 'text', text: `Error: screen ${screen_id} not found` }],
              isError: true,
            };
          }

          if (screen.status === 'approved') {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'accepted',
                  // backward compat field for older consumers
                  approved: true,
                  screen_id,
                }, null, 2),
              }],
            };
          }

          if (screen.status === 'rejected') {
            const result = {
              status: 'rejected',
              screen_id,
              reason: screen.reject_reason || '',
            };

            if (auto_version) {
              try {
                const newVersion = await store.createScreenVersion(project_id, screen_id);
                result.new_version_screen_id = newVersion.id;
              } catch (vErr) {
                // Non-fatal — version creation failure should not block the rejection response.
                result.auto_version_error = vErr.message;
              }
            }

            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          // accept_with_comments: server keeps status as 'draft' and sets _approval_action.
          if (screen.status === 'draft' && screen._approval_action === 'accept_with_comments') {
            const unresolvedComments = (screen.comments || []).filter(c => !c.resolved);
            const result = {
              status: 'accepted_with_comments',
              screen_id,
              comments: unresolvedComments.map(c => ({
                id: c.id,
                element_id: c.element_id || null,
                text: c.text,
                pin_number: c.pin_number || null,
              })),
            };

            if (auto_version) {
              try {
                const newVersion = await store.createScreenVersion(project_id, screen_id);
                result.new_version_screen_id = newVersion.id;
              } catch (vErr) {
                result.auto_version_error = vErr.message;
              }
            }

            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
        } catch (err) {
          return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
        }

        await new Promise(r => setTimeout(r, 2000));
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ status: 'timeout', screen_id }, null, 2),
        }],
      };
    }
  );
}
