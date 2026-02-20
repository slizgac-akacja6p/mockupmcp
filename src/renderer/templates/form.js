export const description = 'Generic data-entry form with labelled fields and action buttons.';

export function generate(screenWidth, screenHeight, _style) {
  const pad = 24;
  const fieldWidth = screenWidth - pad * 2;
  const fieldH = 56;
  const gap = 8;

  const fields = [
    { label: 'Full Name', placeholder: 'Jane Doe', inputType: 'text' },
    { label: 'Email', placeholder: 'jane@example.com', inputType: 'email' },
    { label: 'Phone', placeholder: '+1 (555) 000-0000', inputType: 'tel' },
    { label: 'Company', placeholder: 'Acme Corp', inputType: 'text' },
    { label: 'Role', placeholder: 'Product Manager', inputType: 'text' },
  ];

  const elements = [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: { title: 'New Contact' },
    },
  ];

  let y = 72;

  for (const field of fields) {
    if (y + fieldH > screenHeight - 80) break;
    elements.push({
      type: 'input',
      x: pad,
      y,
      width: fieldWidth,
      height: fieldH,
      z_index: 0,
      properties: field,
    });
    y += fieldH + gap;
  }

  // Submit button — only add if it fits
  const btnY = y + gap;
  if (btnY + 48 <= screenHeight) {
    elements.push({
      type: 'button',
      x: pad,
      y: btnY,
      width: fieldWidth,
      height: 48,
      z_index: 0,
      properties: { label: 'Save Contact', variant: 'primary' },
    });
  }

  // Cancel button — only add if it fits
  const cancelY = btnY + 56;
  if (cancelY + 40 <= screenHeight) {
    elements.push({
      type: 'button',
      x: pad,
      y: cancelY,
      width: fieldWidth,
      height: 40,
      z_index: 0,
      properties: { label: 'Cancel', variant: 'secondary' },
    });
  }

  return elements;
}
