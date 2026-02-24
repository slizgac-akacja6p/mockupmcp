import { escapeHtml } from '../components/utils.js';

export function defaults() {
  return {
    features: [
      { title: 'Feature 1', description: 'Fast and reliable' },
      { title: 'Feature 2', description: 'Easy to use' },
      { title: 'Feature 3', description: 'Fully customizable' },
    ],
  };
}

export function generate(screenWidth, sectionY, props) {
  const p = { ...defaults(), ...props };
  const padding = 40;
  const contentWidth = screenWidth - padding * 2;
  const rowHeight = 70;

  const elements = [];

  for (let i = 0; i < Math.min(3, p.features.length); i++) {
    const feature = p.features[i];
    const rowY = sectionY + 20 + i * rowHeight;

    // Icon rect (left side)
    elements.push({
      type: 'rect',
      x: padding,
      y: rowY,
      width: 50,
      height: 50,
      z_index: 2,
      properties: { fill: '#0066cc' },
    });

    // Feature title
    elements.push({
      type: 'text',
      x: padding + 70,
      y: rowY,
      width: contentWidth - 70,
      height: 20,
      z_index: 2,
      properties: {
        content: escapeHtml(feature.title),
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
      },
    });

    // Feature description
    elements.push({
      type: 'text',
      x: padding + 70,
      y: rowY + 25,
      width: contentWidth - 70,
      height: 25,
      z_index: 2,
      properties: {
        content: escapeHtml(feature.description),
        fontSize: 12,
        color: '#666',
      },
    });
  }

  return { elements, height: 250 };
}
