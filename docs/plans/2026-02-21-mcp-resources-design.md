# MCP Resources Design

> **TL;DR:** Add 5 MCP resources to expose project data, screen previews, templates, and component catalog via `mockup://` URI scheme. Lazy-rendered PNG preview with in-memory cache.

## Resources

| Resource | Type | URI | Data |
|----------|------|-----|------|
| Projects list | Static | `mockup://projects` | JSON array of project summaries |
| Project detail | Template | `mockup://projects/{projectId}` | Full project with screens + elements |
| Screen preview | Template | `mockup://projects/{projectId}/screens/{screenId}/preview` | PNG base64 (lazy render + cache) |
| Templates catalog | Static | `mockup://templates` | 7 templates with descriptions |
| Components catalog | Static | `mockup://components` | 35 component types with props |

## Architecture

- New module: `src/mcp/resources.js` — `registerResources(server, store)`
- Called from `server.js` alongside `registerAllTools`
- Same pattern for both stdio and HTTP transports

### Resource Registration

Static resources use `server.registerResource(name, uri, metadata, handler)`.

Dynamic resources use `ResourceTemplate` from SDK:
```js
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

const template = new ResourceTemplate('mockup://projects/{projectId}', {
  list: async () => ({ resources: [...] })
});
server.registerResource('project-detail', template, { description: '...' }, handler);
```

### Preview Cache

- In-memory `Map<string, { png: Buffer, hash: string }>` keyed by `${projectId}/${screenId}`
- Hash: `crypto.createHash('md5').update(JSON.stringify(screen.elements)).digest('hex')`
- On read: compare hash → cache hit returns existing PNG, cache miss renders via `screenshot.js`
- No TTL — invalidation by content hash is sufficient

### Data Sources

| Resource | Store method | Format |
|----------|-------------|--------|
| projects | `store.listProjects()` | `application/json` |
| project/{id} | `store.getProject(id)` | `application/json` |
| screen preview | `screenshot.js` + cache | `image/png` (base64) |
| templates | `getAvailableTemplates()` + template descriptions | `application/json` |
| components | Component registry `getComponentNames()` + defaults | `application/json` |

## Dependencies

- `@modelcontextprotocol/sdk` — `ResourceTemplate` from `server/mcp.js`
- `src/renderer/screenshot.js` — for preview rendering
- `src/renderer/html-builder.js` — for building HTML before screenshot
- `src/renderer/styles/index.js` — for loading styles
- `src/renderer/components/index.js` — for component catalog
- `src/renderer/templates/index.js` — for template catalog
- `crypto` (Node.js built-in) — for content hashing
