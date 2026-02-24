import { escapeHtml } from '../components/utils.js';

export function defaults() {
  return {
    heading: 'Welcome to Our Platform',
    subheading: 'Build amazing mockups faster than ever',
    cta_text: 'Get Started',
  };
}

export function generate(screenWidth, sectionY, props) {
  const p = { ...defaults(), ...props };
  const centerX = screenWidth / 2;
  const contentPadding = 40;

  const elements = [
    // Background
    {
      type: 'rect',
      x: 0,
      y: sectionY,
      width: screenWidth,
      height: 300,
      z_index: 1,
      properties: { fill: '#0066cc' },
    },
    // Heading
    {
      type: 'text',
      x: contentPadding,
      y: sectionY + 60,
      width: screenWidth - contentPadding * 2,
      height: 60,
      z_index: 2,
      properties: {
        content: escapeHtml(p.heading),
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
      },
    },
    // Subheading
    {
      type: 'text',
      x: contentPadding,
      y: sectionY + 130,
      width: screenWidth - contentPadding * 2,
      height: 40,
      z_index: 2,
      properties: {
        content: escapeHtml(p.subheading),
        fontSize: 16,
        color: '#fff',
        textAlign: 'center',
      },
    },
    // CTA Button
    {
      type: 'rect',
      x: centerX - 60,
      y: sectionY + 190,
      width: 120,
      height: 44,
      z_index: 2,
      properties: { fill: '#ff6b35' },
    },
    {
      type: 'text',
      x: centerX - 60,
      y: sectionY + 198,
      width: 120,
      height: 28,
      z_index: 3,
      properties: {
        content: escapeHtml(p.cta_text),
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
      },
    },
  ];

  return { elements, height: 300 };
}
