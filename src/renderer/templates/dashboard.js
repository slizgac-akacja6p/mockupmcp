export const description = 'Dashboard with stats cards, a chart placeholder, and a recent activity list.';

export function generate(screenWidth, screenHeight, _style) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;
  // Two-column card layout on wide screens, single column on narrow ones.
  const isWide = screenWidth >= 768;
  const cardWidth = isWide ? Math.floor((contentWidth - pad) / 2) : contentWidth;
  const cardHeight = 80;

  const elements = [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: { title: 'Dashboard' },
    },
    // Stat card 1
    {
      type: 'card',
      x: pad,
      y: 72,
      width: cardWidth,
      height: cardHeight,
      z_index: 0,
      properties: { title: 'Total Users', value: '1,240' },
    },
    // Stat card 2 — next to card 1 on wide, below on narrow
    {
      type: 'card',
      x: isWide ? pad + cardWidth + pad : pad,
      y: isWide ? 72 : 72 + cardHeight + pad,
      width: cardWidth,
      height: cardHeight,
      z_index: 0,
      properties: { title: 'Revenue', value: '$8,320' },
    },
    // Chart area
    {
      type: 'chart_placeholder',
      x: pad,
      y: isWide ? 72 + cardHeight + pad : 72 + (cardHeight + pad) * 2,
      width: contentWidth,
      height: Math.min(200, screenHeight - 400),
      z_index: 0,
      properties: { label: 'Monthly Revenue' },
    },
    // Recent activity header
    {
      type: 'text',
      x: pad,
      y: isWide ? 72 + cardHeight + pad + Math.min(200, screenHeight - 400) + pad : 72 + (cardHeight + pad) * 2 + Math.min(200, screenHeight - 400) + pad,
      width: contentWidth,
      height: 28,
      z_index: 0,
      properties: { content: 'Recent Activity', fontSize: 16 },
    },
    // Recent activity list
    {
      type: 'list',
      x: pad,
      y: isWide ? 72 + cardHeight + pad + Math.min(200, screenHeight - 400) + pad + 36 : 72 + (cardHeight + pad) * 2 + Math.min(200, screenHeight - 400) + pad + 36,
      width: contentWidth,
      height: Math.min(160, screenHeight - (isWide ? 72 + cardHeight + pad + Math.min(200, screenHeight - 400) + pad + 36 + 16 : 72 + (cardHeight + pad) * 2 + Math.min(200, screenHeight - 400) + pad + 36 + 16)),
      z_index: 0,
      properties: { items: ['User signed up', 'Payment received', 'Report exported'] },
    },
  ];

  return elements.filter(el => el.y >= 0 && el.height > 0 && el.y + el.height <= screenHeight);
}
