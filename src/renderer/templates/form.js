export const description = 'Generic data-entry form with labelled fields and action buttons.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 24;
  const fieldWidth = screenWidth - pad * 2;
  const fieldH = 56;
  const gap = 8;

  // Content slots: [0..N-2] field labels, [N-1] submit button label
  let fieldHints = [];
  let submitLabel = 'Save Contact';
  if (contentHints.length === 1) {
    submitLabel = contentHints[0];
  } else if (contentHints.length >= 2) {
    fieldHints = contentHints.slice(0, -1);
    submitLabel = contentHints[contentHints.length - 1];
  }

  const defaultFields = [
    { label: 'Full Name', placeholder: 'Jane Doe', inputType: 'text' },
    { label: 'Email', placeholder: 'jane@example.com', inputType: 'email' },
    { label: 'Phone', placeholder: '+1 (555) 000-0000', inputType: 'tel' },
    { label: 'Company', placeholder: 'Acme Corp', inputType: 'text' },
    { label: 'Role', placeholder: 'Product Manager', inputType: 'text' },
  ];

  const fields = fieldHints.length > 0
    ? fieldHints.map((h, i) => ({
        label: h,
        placeholder: defaultFields[i]?.placeholder || '',
        inputType: defaultFields[i]?.inputType || 'text',
      }))
    : defaultFields;

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
      properties: { label: submitLabel, variant: 'primary' },
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
