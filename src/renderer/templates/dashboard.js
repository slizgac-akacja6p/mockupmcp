export const description = 'Dashboard with stats cards, a chart placeholder, and a recent activity list.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 16;
  // Desktop (>= 1024px) gets a sidebar nav — content is indented accordingly.
  const isDesktop = screenWidth >= 1024;
  const isWide = screenWidth >= 768;
  const sidebarWidth = isDesktop ? 220 : 0;
  const contentX = sidebarWidth + pad;
  const contentWidth = screenWidth - contentX - pad;

  // Two-column card layout on wide/desktop screens, single column on narrow.
  const cardColumns = isDesktop ? 4 : (isWide ? 2 : 1);
  const cardGap = pad;
  const cardWidth = Math.floor((contentWidth - cardGap * (cardColumns - 1)) / cardColumns);
  const cardHeight = 80;

  // Content slots: [0]-[3] card titles, [4] chart label, [5] activity title
  const card1Title = contentHints[0] || 'Total Users';
  const card2Title = contentHints[1] || 'Revenue';
  const card3Title = contentHints[2] || 'Active Sessions';
  const card4Title = contentHints[3] || 'Conversion Rate';
  const chartLabel = contentHints[4] || contentHints[2] || 'Monthly Revenue';
  const activityTitle = contentHints[5] || contentHints[3] || 'Recent Activity';
  const listItems = contentHints.length > 6
    ? contentHints.slice(6)
    : ['User signed up', 'Payment received', 'Report exported'];

  // Desktop adds a page title row between navbar and stat cards.
  const cardRowY = isDesktop ? 100 : 72;
  // On desktop all 4 cards are in one row; on wide 2 columns means 2 rows.
  const cardRowsHeight = isDesktop ? cardHeight : (isWide ? (cardHeight + pad) * 2 - pad : (cardHeight + pad) * 4 - pad);
  const chartY = cardRowY + cardRowsHeight + pad;
  const chartHeight = Math.min(200, screenHeight - 400);
  const activityHeaderY = chartY + chartHeight + pad;
  const listY = activityHeaderY + 36;
  const listHeight = Math.min(160, screenHeight - 56 - listY - pad);

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
  ];

  // Sidebar nav — desktop only. z_index < 10 so auto-layout can still account for it,
  // but positioned absolutely on the left below the navbar.
  if (isDesktop) {
    elements.push({
      type: 'list',
      x: 0,
      y: 56,
      width: sidebarWidth,
      height: screenHeight - 56,
      z_index: 0,
      properties: {
        items: ['Dashboard', 'Analytics', 'Reports', 'Users', 'Settings'],
      },
    });
    // Page section heading — only rendered on desktop (mobile navbar title is sufficient).
    elements.push({
      type: 'text',
      x: contentX,
      y: 68,
      width: contentWidth,
      height: 24,
      z_index: 0,
      properties: { content: 'Overview', fontSize: 18 },
    });
  }

  // Stat cards — 4 on desktop (single row), 2x2 on wide, stacked on mobile.
  const cardDefs = [
    { title: card1Title, value: '1,240' },
    { title: card2Title, value: '$8,320' },
    { title: card3Title, value: '342' },
    { title: card4Title, value: '4.7%' },
  ];

  // On narrow screens only show 2 cards to avoid excessive scrolling.
  const visibleCards = isDesktop ? 4 : (isWide ? 4 : 2);
  for (let i = 0; i < visibleCards; i++) {
    const col = i % cardColumns;
    const row = Math.floor(i / cardColumns);
    elements.push({
      type: 'card',
      x: contentX + col * (cardWidth + cardGap),
      y: cardRowY + row * (cardHeight + cardGap),
      width: cardWidth,
      height: cardHeight,
      z_index: 0,
      properties: { title: cardDefs[i].title, value: cardDefs[i].value },
    });
  }

  // Chart area
  elements.push({
    type: 'chart_placeholder',
    x: contentX,
    y: chartY,
    width: contentWidth,
    height: chartHeight,
    z_index: 0,
    properties: { label: chartLabel },
  });

  // On desktop add a secondary narrow chart next to the main one.
  if (isDesktop) {
    const secondaryChartWidth = Math.floor(contentWidth * 0.35);
    const primaryChartWidth = contentWidth - secondaryChartWidth - pad;
    // Adjust primary chart width retroactively by updating the last pushed element.
    elements[elements.length - 1].width = primaryChartWidth;
    elements.push({
      type: 'chart_placeholder',
      x: contentX + primaryChartWidth + pad,
      y: chartY,
      width: secondaryChartWidth,
      height: chartHeight,
      z_index: 0,
      properties: { label: contentHints[5] || 'Top Sources' },
    });
  }

  // Recent activity section
  elements.push({
    type: 'text',
    x: contentX,
    y: activityHeaderY,
    width: contentWidth,
    height: 28,
    z_index: 0,
    properties: { content: activityTitle, fontSize: 16 },
  });

  elements.push({
    type: 'list',
    x: contentX,
    y: listY,
    width: contentWidth,
    height: listHeight,
    z_index: 0,
    properties: { items: listItems },
  });

  // Data table — desktop only, shows structured data below the activity feed.
  if (isDesktop) {
    const tableY = listY + listHeight + pad;
    const tableHeight = Math.min(120, screenHeight - tableY - pad);
    if (tableHeight >= 60) {
      elements.push({
        type: 'data_table',
        x: contentX,
        y: tableY,
        width: contentWidth,
        height: tableHeight,
        z_index: 0,
        properties: {
          headers: ['Name', 'Value', 'Status', 'Date'],
          rows: [
            ['Item 1', '100', 'Active', 'Today'],
            ['Item 2', '240', 'Pending', 'Yesterday'],
          ],
        },
      });
    }
  }

  // Tabbar — pinned at bottom (mobile/tablet only; desktop has sidebar nav)
  if (!isDesktop) {
    elements.push({
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
    });
  }

  return elements.filter(el => el.y >= 0 && el.height > 0 && el.y + el.height <= screenHeight);
}
