import { escapeHtml } from '../components/utils.js';

export function defaults() {
  return {
    placeholder: 'Search...',
    button_text: 'Search',
  };
}

export function generate(screenWidth, sectionY, props) {
  const p = { ...defaults(), ...props };
  const padding = 40;
  const contentWidth = screenWidth - padding * 2;
  const inputWidth = contentWidth - 100;

  const elements = [
    // Background
    {
      type: 'rect',
      x: 0,
      y: sectionY,
      width: screenWidth,
      height: 80,
      z_index: 1,
      properties: { fill: '#f9f9f9' },
    },
    // Search input
    {
      type: 'rect',
      x: padding,
      y: sectionY + 18,
      width: inputWidth,
      height: 40,
      z_index: 2,
      properties: { fill: '#fff', stroke: '#ccc' },
    },
    {
      type: 'text',
      x: padding + 10,
      y: sectionY + 26,
      width: inputWidth - 20,
      height: 20,
      z_index: 3,
      properties: {
        content: escapeHtml(p.placeholder),
        fontSize: 12,
        color: '#999',
      },
    },
    // Search button
    {
      type: 'rect',
      x: padding + inputWidth + 10,
      y: sectionY + 18,
      width: 80,
      height: 40,
      z_index: 2,
      properties: { fill: '#0066cc' },
    },
    {
      type: 'text',
      x: padding + inputWidth + 10,
      y: sectionY + 26,
      width: 80,
      height: 24,
      z_index: 3,
      properties: {
        content: escapeHtml(p.button_text),
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
      },
    },
  ];

  return { elements, height: 80 };
}
