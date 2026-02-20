import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getComponent } from './components/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wireframeCss = readFileSync(join(__dirname, 'styles', 'wireframe.css'), 'utf-8');

export function buildScreenHtml(screen) {
  const elementsHtml = (screen.elements || [])
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .map(el => {
      const component = getComponent(el.type);
      if (!component) return `<!-- unknown type: ${el.type} -->`;
      const innerHtml = component.render(el.properties || {});
      return `<div class="element" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.z_index || 0};overflow:hidden;">${innerHtml}</div>`;
    })
    .join('\n    ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    ${wireframeCss}
  </style>
</head>
<body>
  <div class="screen" style="position:relative;width:${screen.width}px;height:${screen.height}px;background:${screen.background || '#FFFFFF'};overflow:hidden;">
    ${elementsHtml}
  </div>
</body>
</html>`;
}
