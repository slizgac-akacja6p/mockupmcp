export const description = 'Dashboard with stats cards, a chart placeholder, and a recent activity list.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;
  // Two-column card layout on wide screens, single column on narrow ones.
  const isWide = screenWidth >= 768;
  const cardWidth = isWide ? Math.floor((contentWidth - pad) / 2) : contentWidth;
  const cardHeight = 80;

  // Content slots: [0] card1 title, [1] card2 title, [2] chart label, [3] activity title
  const card1Title = contentHints[0] || 'Total Users';
  const card2Title = contentHints[1] || 'Revenue';
  const chartLabel = contentHints[2] || 'Monthly Revenue';
  const activityTitle = contentHints[3] || 'Recent Activity';
  const listItems = contentHints.length > 4
    ? contentHints.slice(4)
    : ['User signed up', 'Payment received', 'Report exported'];

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
    {
      type: 'card',
      x: pad,
      y: 72,
      width: cardWidth,
      height: cardHeight,
      z_index: 0,
      properties: { title: card1Title, value: '1,240' },
    },
    // Stat card 2 — next to card 1 on wide, below on narrow
    {
      type: 'card',
      x: isWide ? pad + cardWidth + pad : pad,
      y: isWide ? 72 : 72 + cardHeight + pad,
      width: cardWidth,
      height: cardHeight,
      z_index: 0,
      properties: { title: card2Title, value: '$8,320' },
    },
    // Chart area
    {
      type: 'chart_placeholder',
      x: pad,
      y: isWide ? 72 + cardHeight + pad : 72 + (cardHeight + pad) * 2,
      width: contentWidth,
      height: Math.min(200, screenHeight - 400),
      z_index: 0,
      properties: { label: chartLabel },
    },
    // Recent activity header
    {
      type: 'text',
      x: pad,
      y: isWide ? 72 + cardHeight + pad + Math.min(200, screenHeight - 400) + pad : 72 + (cardHeight + pad) * 2 + Math.min(200, screenHeight - 400) + pad,
      width: contentWidth,
      height: 28,
      z_index: 0,
      properties: { content: activityTitle, fontSize: 16 },
    },
    // Recent activity list — max height reduced by tabbar height to avoid overlap
    {
      type: 'list',
      x: pad,
      y: isWide ? 72 + cardHeight + pad + Math.min(200, screenHeight - 400) + pad + 36 : 72 + (cardHeight + pad) * 2 + Math.min(200, screenHeight - 400) + pad + 36,
      width: contentWidth,
      height: Math.min(160, screenHeight - 56 - (isWide ? 72 + cardHeight + pad + Math.min(200, screenHeight - 400) + pad + 36 + 16 : 72 + (cardHeight + pad) * 2 + Math.min(200, screenHeight - 400) + pad + 36 + 16)),
      z_index: 0,
      properties: { items: listItems },
    },
    // Tabbar — pinned at bottom
    {
      type: 'tabbar',
      x: 0,
      y: screenHeight - 56,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: {
        tabs: [
          { icon: 'home', label: 'Home', active: true },
          { icon: 'bar-chart-2', label: 'Analytics' },
          { icon: 'settings', label: 'Settings' },
        ],
      },
    },
  ];

  return elements.filter(el => el.y >= 0 && el.height > 0 && el.y + el.height <= screenHeight);
}
