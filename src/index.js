import { createMcpServer, startMcpServer } from './mcp/server.js';
import { registerAllTools } from './mcp/tools/index.js';
import { startPreviewServer } from './preview/server.js';
import { closeBrowser } from './renderer/screenshot.js';
import { config } from './config.js';

// Redirect all console.log to stderr to keep stdout clean for MCP protocol
const originalLog = console.log;
console.log = (...args) => console.error(...args);

async function main() {
  console.error('[MockupMCP] Starting...');

  // Start preview HTTP server
  const httpServer = startPreviewServer(config.previewPort);

  // Create and configure MCP server
  const mcpServer = createMcpServer();
  registerAllTools(mcpServer);

  // Graceful shutdown
  const shutdown = async () => {
    console.error('[MockupMCP] Shutting down...');
    httpServer.close();
    await closeBrowser();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start MCP server (blocks on stdio)
  console.error('[MockupMCP] MCP server ready (stdio)');
  await startMcpServer(mcpServer);
}

main().catch(err => {
  console.error('[MockupMCP] Fatal error:', err);
  process.exit(1);
});
