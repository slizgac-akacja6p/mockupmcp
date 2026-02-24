import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Warm cache on load to avoid repeated disk reads during rendering
const cache = {};

const VALID_STYLES = [
  // Original 6 styles
  'wireframe', 'material', 'ios', 'blueprint', 'flat', 'hand-drawn',
  // M18: 12 new design system styles (CSS files added separately)
  'material3', 'hig', 'fluent2', 'antd', 'carbon',
  'neubrutalism', 'glassmorphism', 'neumorphic', 'claymorphism',
  'dark-minimal', 'aurora', 'skeuomorphic',
];

export function loadStyle(name) {
  const styleName = VALID_STYLES.includes(name) ? name : 'wireframe';
  if (!cache[styleName]) {
    try {
      cache[styleName] = readFileSync(join(__dirname, `${styleName}.css`), 'utf-8');
    } catch {
      // CSS file not yet created for this style — fall back to wireframe
      if (styleName !== 'wireframe') {
        return loadStyle('wireframe');
      }
      throw new Error(`Wireframe CSS file missing: ${join(__dirname, 'wireframe.css')}`);
    }
  }
  return cache[styleName];
}

export function getAvailableStyles() {
  return [...VALID_STYLES];
}
