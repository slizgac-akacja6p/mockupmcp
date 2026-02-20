export const description = 'Settings screen with grouped toggle rows for app preferences.';

export function generate(screenWidth, screenHeight, _style) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;
  const rowH = 52;

  const rows = [
    { label: 'Notifications', hint: 'Push & email' },
    { label: 'Dark Mode', hint: 'Use dark theme' },
    { label: 'Location', hint: 'Allow location access' },
    { label: 'Analytics', hint: 'Share usage data' },
    { label: 'Auto-update', hint: 'Install updates automatically' },
  ];

  const elements = [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: { title: 'Settings' },
    },
    {
      type: 'text',
      x: pad,
      y: 68,
      width: contentWidth,
      height: 28,
      z_index: 0,
      properties: { content: 'Preferences', fontSize: 13 },
    },
  ];

  rows.forEach((row, i) => {
    const y = 104 + i * (rowH + 2);
    if (y + rowH > screenHeight) return;
    elements.push({
      type: 'toggle',
      x: pad,
      y,
      width: contentWidth,
      height: rowH,
      z_index: 0,
      properties: { label: row.label, hint: row.hint, checked: false },
    });
  });

  return elements;
}
