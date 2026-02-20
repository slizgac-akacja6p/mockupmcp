import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export function createMcpServer() {
  return new McpServer({
    name: 'mockupmcp',
    version: '0.1.0',
  });
}

export async function startMcpServer(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
