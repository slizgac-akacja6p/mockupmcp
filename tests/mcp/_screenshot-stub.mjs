// Stub replacement for src/renderer/screenshot.js in unit tests.
// Returns a predictable fake PNG buffer without Puppeteer.
const fakeBuffer = Buffer.from('fake-png-data');
export const takeScreenshot = async () => fakeBuffer;
export const initBrowser = async () => {};
export const closeBrowser = async () => {};
export const htmlToSvg = () => '<svg></svg>';
export const takePdfExport = async () => fakeBuffer;
