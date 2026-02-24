import puppeteer from 'puppeteer-core';
import { config } from '../config.js';

let _browser = null;

// Page pool: pre-created pages ready for reuse (avoids ~50-150ms newPage() per render)
const _pagePool = [];
const POOL_SIZE = 3;

async function getBrowser() {
  if (_browser && _browser.connected) return _browser;

  // Previous browser disconnected or never started — launch fresh
  if (_browser) {
    try { await _browser.close(); } catch (_) {}
  }
  _browser = await puppeteer.launch({
    headless: true,
    executablePath: config.chromiumPath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  // Browser crash handler: clear pool and nullify reference
  _browser.on('disconnected', () => {
    _browser = null;
    _pagePool.length = 0;
  });

  return _browser;
}

async function acquirePage() {
  const browser = await getBrowser();
  if (_pagePool.length > 0) {
    const page = _pagePool.pop();
    // Verify page is still usable (browser may have restarted)
    if (!page.isClosed()) return page;
  }
  return browser.newPage();
}

function releasePage(page) {
  if (!page || page.isClosed()) return;
  if (_pagePool.length < POOL_SIZE) {
    _pagePool.push(page);
  } else {
    page.close().catch(() => {});
  }
}

/**
 * Pre-warm browser and page pool at startup to eliminate cold-start latency.
 */
export async function warmUp() {
  const browser = await getBrowser();
  const promises = [];
  for (let i = _pagePool.length; i < POOL_SIZE; i++) {
    promises.push(browser.newPage().then(p => _pagePool.push(p)));
  }
  await Promise.all(promises);
  console.error(`[screenshot] Browser warmed up, pool size: ${_pagePool.length}`);
}

/** @deprecated Use getBrowser() lazy init instead */
export async function initBrowser() {
  await getBrowser();
}

export async function takeScreenshot(html, width, height, scale = config.screenshotScale) {
  const page = await acquirePage();
  let failed = false;
  try {
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    return buffer;
  } catch (err) {
    failed = true;
    throw err;
  } finally {
    if (failed) {
      // Page may be broken after error -- don't return to pool
      try { await page.close(); } catch (_) {}
    } else {
      releasePage(page);
    }
  }
}

/**
 * Generate PDF from HTML using Puppeteer.
 * Returns a Buffer containing the PDF data.
 */
export async function takePdfExport(html, width, height) {
  const page = await acquirePage();
  let failed = false;
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      pageRanges: '1',
    });
    return Buffer.from(buffer);
  } catch (err) {
    failed = true;
    throw err;
  } finally {
    if (failed) {
      try { await page.close(); } catch (_) {}
    } else {
      releasePage(page);
    }
  }
}

/**
 * Convert full HTML document to SVG by wrapping in foreignObject.
 * Pure function -- no Puppeteer dependency.
 */
export function htmlToSvg(html, width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="100%" height="100%">
    ${html}
  </foreignObject>
</svg>`;
}

export async function closeBrowser() {
  _pagePool.length = 0;
  if (_browser) {
    try { await _browser.close(); } catch (_) {}
    _browser = null;
  }
}
