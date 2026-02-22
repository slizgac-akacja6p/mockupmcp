import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Warm cache on load to avoid repeated disk reads during rendering
const cache = {};

const VALID_STYLES = ['wireframe', 'material', 'ios', 'blueprint', 'flat', 'hand-drawn'];

export function loadStyle(name) {
  const styleName = VALID_STYLES.includes(name) ? name : 'wireframe';
  if (!cache[styleName]) {
    cache[styleName] = readFileSync(join(__dirname, `${styleName}.css`), 'utf-8');
  }
  return cache[styleName];
}

export function getAvailableStyles() {
  return [...VALID_STYLES];
}
