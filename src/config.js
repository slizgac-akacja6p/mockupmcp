export const config = {
  dataDir: process.env.DATA_DIR || './mockups',
  previewPort: parseInt(process.env.PREVIEW_PORT || '3100', 10),
  mcpPort: parseInt(process.env.MCP_PORT || '3200', 10),
  mcpTransport: process.env.MCP_TRANSPORT || 'stdio',
  chromiumPath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
  defaultStyle: process.env.DEFAULT_STYLE || 'wireframe',
  browserPoolSize: parseInt(process.env.BROWSER_POOL_SIZE || '3', 10),
  defaultViewport: { width: 393, height: 852, preset: 'mobile' },
  screenshotScale: 2,
  viewportPresets: {
    mobile: { width: 393, height: 852 },
    tablet: { width: 834, height: 1194 },
    desktop: { width: 1440, height: 900 },
  },
};
