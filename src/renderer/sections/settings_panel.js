import { escapeHtml } from '../components/utils.js';

export function defaults() {
  return {
    title: 'Settings',
    fields: [
      { label: 'Username', placeholder: 'john_doe' },
      { label: 'Email', placeholder: 'john@example.com' },
      { label: 'Timezone', placeholder: 'UTC' },
    ],
  };
}

export function generate(screenWidth, sectionY, props) {
  const p = { ...defaults(), ...props };
  // Defensive check: ensure array props are actually arrays
  if (!Array.isArray(p.fields)) p.fields = defaults().fields;
  const padding = 40;
  const contentWidth = screenWidth - padding * 2;
  const fieldHeight = 60;

  const elements = [
    // Title
    {
      type: 'text',
      x: padding,
      y: sectionY + 20,
      width: contentWidth,
      height: 28,
      z_index: 2,
      properties: {
        content: escapeHtml(p.title),
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
      },
    },
  ];

  // Add fields
  for (let i = 0; i < Math.min(3, p.fields.length); i++) {
    const field = p.fields[i];
    const fieldY = sectionY + 70 + i * fieldHeight;

    // Field label
    elements.push({
      type: 'text',
      x: padding,
      y: fieldY,
      width: 100,
      height: 16,
      z_index: 2,
      properties: { content: escapeHtml(field.label), fontSize: 12, color: '#666' },
    });

    // Input field
    elements.push({
      type: 'rect',
      x: padding,
      y: fieldY + 20,
      width: contentWidth,
      height: 36,
      z_index: 2,
      properties: { fill: '#fff', stroke: '#ccc' },
    });

    // Placeholder
    elements.push({
      type: 'text',
      x: padding + 10,
      y: fieldY + 26,
      width: contentWidth - 20,
      height: 20,
      z_index: 3,
      properties: {
        content: escapeHtml(field.placeholder),
        fontSize: 12,
        color: '#999',
      },
    });
  }

  // Save button
  const buttonY = sectionY + 70 + 3 * fieldHeight;
  elements.push({
    type: 'rect',
    x: padding,
    y: buttonY,
    width: 120,
    height: 40,
    z_index: 2,
    properties: { fill: '#0066cc' },
  });

  elements.push({
    type: 'text',
    x: padding,
    y: buttonY + 8,
    width: 120,
    height: 24,
    z_index: 3,
    properties: {
      content: 'Save',
      fontSize: 14,
      fontWeight: 'bold',
      color: '#fff',
      textAlign: 'center',
    },
  });

  return { elements, height: 350 };
}
