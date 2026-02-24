import { escapeHtml } from '../components/utils.js';

export function defaults() {
  return {
    copyright: '© 2026 MyApp. All rights reserved.',
    links: ['Privacy', 'Terms', 'Contact'],
  };
}

export function generate(screenWidth, sectionY, props) {
  const p = { ...defaults(), ...props };

  const elements = [
    // Background
    {
      type: 'rect',
      x: 0,
      y: sectionY,
      width: screenWidth,
      height: 80,
      z_index: 1,
      properties: { fill: '#1a1a2e' },
    },
    // Copyright text
    {
      type: 'text',
      x: 40,
      y: sectionY + 15,
      width: screenWidth - 80,
      height: 16,
      z_index: 2,
      properties: {
        content: escapeHtml(p.copyright),
        fontSize: 12,
        color: '#ccc',
      },
    },
  ];

  // Add footer links on the right
  const linkCount = p.links ? p.links.length : 0;
  const linkSpacing = 15;
  const linkWidth = 50;
  let rightX = screenWidth - 40 - linkCount * (linkWidth + linkSpacing);

  for (let i = 0; i < linkCount; i++) {
    elements.push({
      type: 'text',
      x: rightX + i * (linkWidth + linkSpacing),
      y: sectionY + 45,
      width: linkWidth,
      height: 16,
      z_index: 2,
      properties: {
        content: escapeHtml(p.links[i]),
        fontSize: 12,
        color: '#aaa',
      },
    });
  }

  return { elements, height: 80 };
}
