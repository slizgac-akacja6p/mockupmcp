import { escapeHtml } from '../components/utils.js';

export function defaults() {
  return {
    title: 'MyApp',
    links: ['Home', 'About', 'Contact'],
  };
}

export function generate(screenWidth, sectionY, props) {
  const p = { ...defaults(), ...props };
  const elements = [
    {
      type: 'rect',
      x: 0,
      y: sectionY,
      width: screenWidth,
      height: 60,
      z_index: 1,
      properties: { fill: '#1a1a2e' },
    },
    {
      type: 'text',
      x: 20,
      y: sectionY + 18,
      width: 120,
      height: 24,
      z_index: 2,
      properties: { content: escapeHtml(p.title), fontSize: 18, fontWeight: 'bold', color: '#fff' },
    },
  ];

  // Add nav links on the right
  const linkCount = p.links ? p.links.length : 0;
  const linkSpacing = 20;
  const linkWidth = 60;
  let rightX = screenWidth - 20 - linkCount * (linkWidth + linkSpacing);

  for (let i = 0; i < linkCount; i++) {
    elements.push({
      type: 'text',
      x: rightX + i * (linkWidth + linkSpacing),
      y: sectionY + 18,
      width: linkWidth,
      height: 24,
      z_index: 2,
      properties: { content: escapeHtml(p.links[i]), fontSize: 14, color: '#fff' },
    });
  }

  return { elements, height: 60 };
}
