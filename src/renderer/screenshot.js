import puppeteer from 'puppeteer-core';
import { config } from '../config.js';

let browser = null;

export async function initBrowser() {
  if (browser) return;
  browser = await puppeteer.launch({
    headless: true,
    executablePath: config.chromiumPath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

export async function takeScreenshot(html, width, height, scale = config.screenshotScale) {
  if (!browser) await initBrowser();

  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    return buffer;
  } catch (err) {
    // If browser crashed, close browser (page is handled by finally).
    try { await browser.close(); } catch (_) {}
    browser = null;
    throw err;
  } finally {
    if (page) try { await page.close(); } catch (_) {}
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
