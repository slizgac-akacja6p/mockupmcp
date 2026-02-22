import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { registerAllTools } from './tools/index.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

const MAX_SESSIONS = 10;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Creates an Express app with MCP HTTP transport routes.
 *
 * Each initialize request spawns a new session (McpServer + Transport pair).
 * All sessions share the same ProjectStore instance.
 *
 * @param {import('../../storage/project-store.js').ProjectStore} [store] - Shared store instance
 * @returns {import('express').Express} Configured Express app
 */
export function createHttpTransportApp(store) {
  // Use SDK's factory for JSON parsing and optional DNS rebinding protection.
  // host '0.0.0.0' because Docker containers need external access.
  const app = createMcpExpressApp({ host: '0.0.0.0' });

  /** @type {Map<string, {transport: StreamableHTTPServerTransport, server: McpServer, timer: NodeJS.Timeout}>} */
  const sessions = new Map();

  // Expose for testing and shutdown
  app._mcpSessions = sessions;
  app._mcpCleanupAll = () => cleanupAllSessions(sessions);

  // --- POST /mcp ---
  // Handles JSON-RPC messages. Initialize requests create new sessions;
  // subsequent requests are routed to existing sessions by mcp-session-id header.
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];

    // Detect initialize request (can be single message or batched)
    const body = req.body;
    const isInit = Array.isArray(body)
      ? body.some((msg) => isInitializeRequest(msg))
      : isInitializeRequest(body);

    if (isInit) {
      if (sessions.size >= MAX_SESSIONS) {
        res.status(503).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Max sessions reached. Try again later.' },
          id: null,
        });
        return;
      }

      try {
        const { transport, server } = await createSession(sessions, store);
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        console.error('[HTTP] Failed to create session:', err);
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error creating session' },
          id: null,
        });
      }
      return;
    }

    // Non-init request — route to existing session
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid or missing session ID' },
        id: null,
      });
      return;
    }

    const session = sessions.get(sessionId);
    resetIdleTimer(sessions, sessionId, session);

    try {
      await session.transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error(`[HTTP] Error handling request for session ${sessionId}:`, err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error' },
          id: null,
        });
      }
    }
  });

  // --- GET /mcp ---
  // SSE stream for server-to-client notifications.
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];

    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid or missing session ID' },
        id: null,
      });
      return;
    }

    const session = sessions.get(sessionId);
    resetIdleTimer(sessions, sessionId, session);

    try {
      await session.transport.handleRequest(req, res);
    } catch (err) {
      console.error(`[HTTP] Error handling SSE for session ${sessionId}:`, err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
  });

  // --- DELETE /mcp ---
  // Closes a session and frees resources.
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];

    if (!sessionId || !sessions.has(sessionId)) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Session not found' },
        id: null,
      });
      return;
    }

    const session = sessions.get(sessionId);

    try {
      // Let the transport handle the DELETE (it sends proper response)
      await session.transport.handleRequest(req, res);
    } catch (err) {
      console.error(`[HTTP] Error handling DELETE for session ${sessionId}:`, err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    }

    // Cleanup is handled by onsessionclosed callback (set in createSession)
  });

  return app;
}

/**
 * Creates a new MCP session: McpServer + StreamableHTTPServerTransport.
 * Registers all tools and connects.
 *
 * @param {Map} sessions - The sessions map
 * @param {*} store - Shared ProjectStore
 * @returns {Promise<{transport: StreamableHTTPServerTransport, server: McpServer}>}
 */
async function createSession(sessions, store) {
  const server = new McpServer({
    name: 'mockupmcp',
    version: '0.1.0',
  });

  await registerAllTools(server, store);
  await registerResources(server, store);
  registerPrompts(server, store);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      const timer = createIdleTimer(sessions, sessionId);
      sessions.set(sessionId, { transport, server, timer });
      console.error(`[HTTP] Session created: ${sessionId} (total: ${sessions.size})`);
    },
    onsessionclosed: (sessionId) => {
      cleanupSession(sessions, sessionId);
    },
  });

  transport.onerror = (err) => {
    console.error(`[HTTP] Transport error (session ${transport.sessionId}):`, err);
  };

  await server.connect(transport);

  return { transport, server };
}

/**
 * Creates an idle timeout that destroys the session after SESSION_IDLE_TIMEOUT_MS.
 */
function createIdleTimer(sessions, sessionId) {
  return setTimeout(() => {
    console.error(`[HTTP] Session ${sessionId} timed out after ${SESSION_IDLE_TIMEOUT_MS / 1000}s idle`);
    cleanupSession(sessions, sessionId);
  }, SESSION_IDLE_TIMEOUT_MS);
}

/**
 * Resets the idle timer for an active session.
 */
function resetIdleTimer(sessions, sessionId, session) {
  clearTimeout(session.timer);
  session.timer = createIdleTimer(sessions, sessionId);
}

/**
 * Cleans up a single session: clears timer, closes transport, removes from map.
 */
async function cleanupSession(sessions, sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  clearTimeout(session.timer);
  sessions.delete(sessionId);

  try {
    await session.transport.close();
  } catch (err) {
    console.error(`[HTTP] Error closing transport for session ${sessionId}:`, err);
  }

  console.error(`[HTTP] Session cleaned up: ${sessionId} (remaining: ${sessions.size})`);
}

/**
 * Cleans up all sessions. Used during graceful shutdown.
 */
async function cleanupAllSessions(sessions) {
  const ids = [...sessions.keys()];
  await Promise.allSettled(ids.map((id) => cleanupSession(sessions, id)));
  console.error('[HTTP] All sessions cleaned up');
}

/**
 * Starts the HTTP transport on the given port.
 *
 * @param {*} [store] - Shared ProjectStore instance
 * @param {number} [port=3200] - Port to listen on
 * @returns {Promise<import('http').Server>} The listening http.Server
 */
export async function startHttpTransport(store, port = 3200) {
  const app = createHttpTransportApp(store);

  return new Promise((resolve, reject) => {
    const httpServer = app.listen(port, '0.0.0.0', () => {
      console.error(`[HTTP] MCP HTTP transport listening on http://0.0.0.0:${port}/mcp`);
      resolve(httpServer);
    });

    httpServer.on('error', reject);

    // Attach cleanup to server close for graceful shutdown
    const originalClose = httpServer.close.bind(httpServer);
    httpServer.close = (callback) => {
      app._mcpCleanupAll().finally(() => originalClose(callback));
    };
  });
}
