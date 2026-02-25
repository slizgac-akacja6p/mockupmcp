// MCP Resource registration — exposes project data and catalogs via mockup:// URIs.

import { createHash } from 'node:crypto';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAvailableTemplates, getTemplate } from '../renderer/templates/index.js';
import { getAvailableTypes, getComponent } from '../renderer/components/index.js';

/**
 * In-memory cache for screen preview PNGs.
 * Keyed by projectId/screenId, invalidated by content hash of elements.
 */
export class PreviewCache {
  constructor() {
    /** @type {Map<string, {hash: string, png: Buffer}>} */
    this._cache = new Map();
  }

  _key(projectId, screenId) {
    return `${projectId}/${screenId}`;
  }

  _hash(elements) {
    return createHash('md5').update(JSON.stringify(elements)).digest('hex');
  }

  get(projectId, screenId, elements) {
    const entry = this._cache.get(this._key(projectId, screenId));
    if (!entry) return null;
    if (entry.hash !== this._hash(elements)) return null;
    return entry.png;
  }

  set(projectId, screenId, elements, png) {
    this._cache.set(this._key(projectId, screenId), {
      hash: this._hash(elements),
      png,
    });
  }
}

/**
 * Register all MCP resources on the given server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('../storage/project-store.js').ProjectStore} store
 */
export async function registerResources(server, store) {
  // --- Static: project list ---
  server.resource(
    'projects-list',
    'mockup://projects',
    { description: 'List of all mockup projects (summary)' },
    async (uri) => ({
      contents: [{
        uri: uri.toString(),
        text: JSON.stringify(await store.listProjects()),
        mimeType: 'application/json',
      }],
    })
  );

  // --- Static: template catalog ---
  server.resource(
    'templates-catalog',
    'mockup://templates',
    { description: 'Available screen templates with descriptions' },
    async (uri) => {
      const names = getAvailableTemplates();
      const catalog = names.map(name => {
        const tpl = getTemplate(name);
        return { name, description: tpl.description || '' };
      });
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(catalog),
          mimeType: 'application/json',
        }],
      };
    }
  );

  // --- Static: component catalog ---
  server.resource(
    'components-catalog',
    'mockup://components',
    { description: 'Available UI component types with default properties' },
    async (uri) => {
      const types = getAvailableTypes();
      const catalog = types.map(type => {
        const comp = getComponent(type);
        return { type, defaults: comp.defaults ? comp.defaults() : {} };
      });
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(catalog),
          mimeType: 'application/json',
        }],
      };
    }
  );

  // --- Dynamic: project detail ---
  const projectTemplate = new ResourceTemplate('mockup://projects/{projectId}', {
    list: async () => {
      const projects = await store.listProjects();
      return {
        resources: projects.map(p => ({
          uri: `mockup://projects/${p.id}`,
          name: p.name,
        })),
      };
    },
  });

  server.resource(
    'project-detail',
    projectTemplate,
    { description: 'Full project definition with all screens and elements' },
    async (uri, variables) => {
      const project = await store.getProject(variables.projectId);
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(project),
          mimeType: 'application/json',
        }],
      };
    }
  );

  // --- Dynamic: screen preview (PNG, lazy render + cache) ---
  const { buildScreenHtml } = await import('../renderer/html-builder.js');
  const { takeScreenshot } = await import('../renderer/screenshot.js');

  const previewCache = new PreviewCache();

  const previewTemplate = new ResourceTemplate(
    'mockup://projects/{projectId}/screens/{screenId}/preview',
    {
      list: async () => {
        const projects = await store.listProjects();
        const resources = [];
        for (const p of projects) {
          const fullProject = await store.getProject(p.id);
          for (const scr of fullProject.screens) {
            resources.push({
              uri: `mockup://projects/${p.id}/screens/${scr.id}/preview`,
              name: `${p.name} — ${scr.name} (preview)`,
            });
          }
        }
        return { resources };
      },
    }
  );

  server.resource(
    'screen-preview',
    previewTemplate,
    { description: 'PNG preview of a screen (base64-encoded)', mimeType: 'image/png' },
    async (uri, variables) => {
      const { projectId, screenId } = variables;
      const project = await store.getProject(projectId);
      const screen = project.screens.find(s => s.id === screenId);
      if (!screen) throw new Error(`Screen ${screenId} not found`);

      const style = screen.style || project.style || 'wireframe';

      // Check cache before invoking Puppeteer (expensive).
      let png = previewCache.get(projectId, screenId, screen.elements);
      if (!png) {
        const html = buildScreenHtml(screen, style);
        png = await takeScreenshot(html, screen.width, screen.height);
        previewCache.set(projectId, screenId, screen.elements, png);
      }

      return {
        contents: [{
          uri: uri.toString(),
          blob: png.toString('base64'),
          mimeType: 'image/png',
        }],
      };
    }
  );

  // --- Dynamic: screen approval status (M23) ---
  // Returns versioning and comment data alongside status so the MCP client
  // can decide whether to create a new version without extra round-trips.
  const approvalTemplate = new ResourceTemplate(
    'mockup://projects/{projectId}/screens/{screenId}/approval',
    { list: undefined }
  );

  server.resource(
    'screen-approval',
    approvalTemplate,
    { description: 'Screen approval status — status, version, unresolved comments, parent screen ID' },
    async (uri, variables) => {
      const { projectId, screenId } = variables;
      const project = await store.getProject(projectId);
      const screen = project.screens.find(s => s.id === screenId);
      if (!screen) throw new Error(`Screen ${screenId} not found in project ${projectId}`);

      const unresolvedComments = (screen.comments || []).filter(c => !c.resolved);

      const data = {
        screen_id: screenId,
        version: screen.version ?? 1,
        status: screen.status ?? 'draft',
        unresolved_comments: unresolvedComments,
        parent_screen_id: screen.parent_screen_id ?? null,
        // backward compat: mirrors old approved boolean
        approved: screen.status === 'approved',
      };

      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(data, null, 2),
          mimeType: 'application/json',
        }],
      };
    }
  );

  // --- Dynamic: screen comments ---
  const commentsTemplate = new ResourceTemplate(
    'mockup://projects/{projectId}/screens/{screenId}/comments',
    { list: undefined }
  );

  server.resource(
    'screen-comments',
    commentsTemplate,
    { description: 'All comments (including resolved) for a screen' },
    async (uri, variables) => {
      const { projectId, screenId } = variables;
      const comments = await store.listComments(projectId, screenId, { include_resolved: true });
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(comments),
          mimeType: 'application/json',
        }],
      };
    }
  );

  console.error('[MockupMCP] 3 static + 4 dynamic resources registered');
}
