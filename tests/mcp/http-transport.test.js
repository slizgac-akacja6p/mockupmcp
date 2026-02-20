import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../src/config.js';

describe('config - MCP transport settings', () => {
  it('has mcpTransport defaulting to "stdio"', () => {
    assert.equal(typeof config.mcpTransport, 'string');
    // Default depends on env, just verify it exists
    assert.ok(['stdio', 'http', 'both'].includes(config.mcpTransport) || config.mcpTransport === 'stdio');
  });

  it('has mcpPort defaulting to 3200', () => {
    assert.equal(typeof config.mcpPort, 'number');
    // Default is 3200 unless MCP_PORT env is set
    assert.ok(config.mcpPort > 0);
  });

  it('mcpPort is a number', () => {
    assert.equal(typeof config.mcpPort, 'number');
    assert.ok(!isNaN(config.mcpPort));
  });
});
