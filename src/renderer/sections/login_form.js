import { escapeHtml } from '../components/utils.js';

export function defaults() {
  return {
    title: 'Sign In',
    email_placeholder: 'Email',
    password_placeholder: 'Password',
    button_text: 'Sign In',
  };
}

export function generate(screenWidth, sectionY, props) {
  const p = { ...defaults(), ...props };
  const centerX = screenWidth / 2;
  const formWidth = 320;
  const formLeft = centerX - formWidth / 2;
  const padding = 20;

  const elements = [
    // Background
    {
      type: 'rect',
      x: 0,
      y: sectionY,
      width: screenWidth,
      height: 400,
      z_index: 1,
      properties: { fill: '#f5f5f5' },
    },
    // Form container
    {
      type: 'rect',
      x: formLeft,
      y: sectionY + 50,
      width: formWidth,
      height: 300,
      z_index: 2,
      properties: { fill: '#fff', stroke: '#ddd' },
    },
    // Title
    {
      type: 'text',
      x: formLeft + padding,
      y: sectionY + 70,
      width: formWidth - padding * 2,
      height: 30,
      z_index: 3,
      properties: {
        content: escapeHtml(p.title),
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
      },
    },
    // Email label
    {
      type: 'text',
      x: formLeft + padding,
      y: sectionY + 120,
      width: 60,
      height: 16,
      z_index: 3,
      properties: { content: 'Email', fontSize: 12, color: '#666' },
    },
    // Email input
    {
      type: 'rect',
      x: formLeft + padding,
      y: sectionY + 140,
      width: formWidth - padding * 2,
      height: 40,
      z_index: 3,
      properties: { fill: '#fff', stroke: '#ccc' },
    },
    {
      type: 'text',
      x: formLeft + padding + 10,
      y: sectionY + 150,
      width: formWidth - padding * 2 - 20,
      height: 20,
      z_index: 4,
      properties: { content: escapeHtml(p.email_placeholder), fontSize: 12, color: '#999' },
    },
    // Password label
    {
      type: 'text',
      x: formLeft + padding,
      y: sectionY + 195,
      width: 80,
      height: 16,
      z_index: 3,
      properties: { content: 'Password', fontSize: 12, color: '#666' },
    },
    // Password input
    {
      type: 'rect',
      x: formLeft + padding,
      y: sectionY + 215,
      width: formWidth - padding * 2,
      height: 40,
      z_index: 3,
      properties: { fill: '#fff', stroke: '#ccc' },
    },
    {
      type: 'text',
      x: formLeft + padding + 10,
      y: sectionY + 225,
      width: formWidth - padding * 2 - 20,
      height: 20,
      z_index: 4,
      properties: { content: escapeHtml(p.password_placeholder), fontSize: 12, color: '#999' },
    },
    // Submit button
    {
      type: 'rect',
      x: formLeft + padding,
      y: sectionY + 270,
      width: formWidth - padding * 2,
      height: 40,
      z_index: 3,
      properties: { fill: '#0066cc' },
    },
    {
      type: 'text',
      x: formLeft + padding,
      y: sectionY + 278,
      width: formWidth - padding * 2,
      height: 24,
      z_index: 4,
      properties: {
        content: escapeHtml(p.button_text),
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
      },
    },
  ];

  return { elements, height: 400 };
}
