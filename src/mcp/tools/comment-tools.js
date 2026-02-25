import { z } from 'zod';

export async function registerCommentTools(server, store) {
  server.tool(
    'mockup_add_comment',
    'Add a comment to a specific element or screen. Comments appear as numbered pins in the editor.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      element_id: z.string().optional().nullable().describe('Element ID (null for screen-level comment)'),
      text: z.string().describe('Comment text (e.g. "This should be blue")'),
      author: z
        .enum(['user', 'ai'])
        .optional()
        .default('user')
        .describe('Comment author — "user" or "ai"'),
    },
    async ({ project_id, screen_id, element_id, text, author }) => {
      try {
        const comment = await store.addComment(project_id, screen_id, {
          element_id: element_id || null,
          text,
          author,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(comment, null, 2) }],
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
    'mockup_list_comments',
    'List all comments on a screen. Optionally include resolved comments.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      include_resolved: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include resolved comments (default: false)'),
    },
    async ({ project_id, screen_id, include_resolved }) => {
      try {
        const comments = await store.listComments(project_id, screen_id, { include_resolved });
        return {
          content: [{ type: 'text', text: JSON.stringify(comments, null, 2) }],
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
    'mockup_resolve_comment',
    'Mark a comment as resolved. Resolved comments are hidden by default.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      comment_id: z.string().describe('Comment ID to resolve'),
    },
    async ({ project_id, screen_id, comment_id }) => {
      try {
        const comment = await store.resolveComment(project_id, screen_id, comment_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(comment, null, 2) }],
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
