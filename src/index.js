import { createMcpServer, startMcpServer } from './mcp/server.js';
import { registerAllTools } from './mcp/tools/index.js';
import { registerResources } from './mcp/resources.js';
import { startHttpTransport } from './mcp/http-transport.js';
import { startPreviewServer } from './preview/server.js';
import { closeBrowser } from './renderer/screenshot.js';
import { ProjectStore } from './storage/project-store.js';
import { config } from './config.js';

// Redirect all console.log to stderr to keep stdout clean for MCP protocol
console.log = (...args) => console.error(...args);

async function main() {
  console.error('[MockupMCP] Starting...');

  const store = new ProjectStore(config.dataDir);
  const transport = config.mcpTransport;

  // Start preview HTTP server
  const previewServer = startPreviewServer(config.previewPort);

  // Start HTTP MCP transport if configured
  let httpMcpServer = null;
  if (transport === 'http' || transport === 'both') {
    httpMcpServer = await startHttpTransport(store, config.mcpPort);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.error('[MockupMCP] Shutting down...');
    previewServer.close();
    if (httpMcpServer) httpMcpServer.close();
    await closeBrowser();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start stdio MCP transport if configured (blocks on stdin)
  if (transport === 'stdio' || transport === 'both') {
    const mcpServer = createMcpServer();
    await registerAllTools(mcpServer, store);
    await registerResources(mcpServer, store);
    console.error('[MockupMCP] MCP server ready (stdio)');
    await startMcpServer(mcpServer);
  } else {
    console.error('[MockupMCP] MCP server ready (http only, no stdio)');
    // Keep process alive when no stdio
    await new Promise(() => {});
  }
}

main().catch(err => {
  console.error('[MockupMCP] Fatal error:', err);
  process.exit(1);
});
