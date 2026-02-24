import { escapeHtml } from '../components/utils.js';

export function defaults() {
  return {
    name: 'John Doe',
    role: 'Product Designer',
  };
}

export function generate(screenWidth, sectionY, props) {
  const p = { ...defaults(), ...props };
  const centerX = screenWidth / 2;

  const elements = [
    // Avatar (square for simplicity, but styled as circle-like)
    {
      type: 'rect',
      x: centerX - 40,
      y: sectionY + 20,
      width: 80,
      height: 80,
      z_index: 2,
      properties: { fill: '#0066cc' },
    },
    // Name text
    {
      type: 'text',
      x: 40,
      y: sectionY + 110,
      width: screenWidth - 80,
      height: 28,
      z_index: 2,
      properties: {
        content: escapeHtml(p.name),
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
      },
    },
    // Role text
    {
      type: 'text',
      x: 40,
      y: sectionY + 135,
      width: screenWidth - 80,
      height: 20,
      z_index: 2,
      properties: {
        content: escapeHtml(p.role),
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
      },
    },
  ];

  return { elements, height: 160 };
}
