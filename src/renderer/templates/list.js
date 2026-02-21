export const description = 'Content list screen with search bar and scrollable item rows.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;
  const itemH = 64;

  // Reserve space: navbar (56) + search_bar (48 + 8 margin) + tabbar (56)
  const reservedTop = 56 + 56;
  const reservedBottom = 56;
  const availableHeight = screenHeight - reservedTop - reservedBottom - pad;
  const itemCount = Math.max(3, Math.floor(availableHeight / (itemH + 8)));

  const elements = [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      // Structural nav title stays fixed — contentHints drive the list rows, not the chrome.
      properties: { title: 'Browse' },
    },
    {
      type: 'search_bar',
      x: pad,
      y: 64,
      width: contentWidth,
      height: 40,
      z_index: 0,
      properties: { placeholder: 'Search...' },
    },
  ];

  const defaultTitles = [
    'Getting Started Guide',
    'Advanced Configuration',
    'API Reference',
    'Troubleshooting',
    'Release Notes',
    'Community Forum',
    'Video Tutorials',
    'Best Practices',
  ];

  for (let i = 0; i < itemCount; i++) {
    const y = reservedTop + pad + i * (itemH + 8);
    if (y + itemH > screenHeight - reservedBottom) break;

    // Use hints as row titles only when 2+ hints are present — a single generic
    // word like "Product" from "product list" should not override defaults.
    const title = contentHints.length >= 2
      ? contentHints[i % contentHints.length]
      : defaultTitles[i % defaultTitles.length];

    elements.push({
      type: 'list',
      x: pad,
      y,
      width: contentWidth,
      height: itemH,
      z_index: 0,
      properties: { items: [title] },
    });
  }

  elements.push({
    type: 'tabbar',
    x: 0,
    y: screenHeight - 56,
    width: screenWidth,
    height: 56,
    z_index: 10,
    properties: { items: ['Home', 'Browse', 'Profile'] },
  });

  return elements;
}
