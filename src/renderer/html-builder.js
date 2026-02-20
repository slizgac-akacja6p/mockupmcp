import { getComponent } from './components/index.js';
import { loadStyle } from './styles/index.js';

export function buildScreenHtml(screen, style = 'wireframe') {
  const css = loadStyle(style);

  const elementsHtml = (screen.elements || [])
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .map(el => {
      const component = getComponent(el.type);
      if (!component) return `<!-- unknown type: ${el.type} -->`;
      // Pass _style so components can render style-specific markup when needed
      const innerHtml = component.render({ ...el.properties, _style: style });

      // Build inline style for the element wrapper
      let inlineStyle = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.z_index || 0};overflow:hidden;`;

      // Opacity support — skip when undefined, null, or fully opaque (1)
      const opacity = el.properties?.opacity;
      if (opacity !== undefined && opacity !== null && opacity !== 1) {
        inlineStyle += `opacity:${opacity};`;
      }

      // Link support — data attributes enable navigation in the preview layer
      let linkAttrs = '';
      const linkTo = el.properties?.link_to;
      if (linkTo && linkTo.screen_id) {
        linkAttrs = ` data-link-to="${linkTo.screen_id}" data-transition="${linkTo.transition || 'push'}"`;
        inlineStyle += 'cursor:pointer;';
      }

      return `<div class="element" style="${inlineStyle}"${linkAttrs}>${innerHtml}</div>`;
    })
    .join('\n    ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    ${css}
  </style>
</head>
<body>
  <div class="screen" style="position:relative;width:${screen.width}px;height:${screen.height}px;background:${screen.background || '#FFFFFF'};overflow:hidden;">
    ${elementsHtml}
  </div>
</body>
</html>`;
}
