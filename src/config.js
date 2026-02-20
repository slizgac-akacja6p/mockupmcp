export const config = {
  dataDir: process.env.DATA_DIR || './mockups',
  previewPort: parseInt(process.env.PREVIEW_PORT || '3100', 10),
  chromiumPath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
  defaultStyle: process.env.DEFAULT_STYLE || 'wireframe',
  defaultViewport: { width: 393, height: 852, preset: 'mobile' },
  screenshotScale: 2,
  viewportPresets: {
    mobile: { width: 393, height: 852 },
    tablet: { width: 834, height: 1194 },
    desktop: { width: 1440, height: 900 },
  },
};
