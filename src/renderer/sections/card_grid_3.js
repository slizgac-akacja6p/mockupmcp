import { escapeHtml } from '../components/utils.js';

export function defaults() {
  return {
    cards: [
      { title: 'Card 1', description: 'Description here' },
      { title: 'Card 2', description: 'Description here' },
      { title: 'Card 3', description: 'Description here' },
    ],
  };
}

export function generate(screenWidth, sectionY, props) {
  const p = { ...defaults(), ...props };
  // Defensive check: ensure array props are actually arrays
  if (!Array.isArray(p.cards)) p.cards = defaults().cards;
  const padding = 40;
  const contentWidth = screenWidth - padding * 2;
  const cardWidth = Math.floor((contentWidth - 20) / 3); // 10px gap between cards
  const cardHeight = 180;

  const elements = [];

  for (let i = 0; i < Math.min(3, p.cards.length); i++) {
    const card = p.cards[i];
    const cardX = padding + i * (cardWidth + 10);

    // Card background
    elements.push({
      type: 'rect',
      x: cardX,
      y: sectionY + 20,
      width: cardWidth,
      height: cardHeight,
      z_index: 1,
      properties: { fill: '#fff', stroke: '#ddd' },
    });

    // Card title
    elements.push({
      type: 'text',
      x: cardX + 12,
      y: sectionY + 30,
      width: cardWidth - 24,
      height: 24,
      z_index: 2,
      properties: {
        content: escapeHtml(card.title),
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
      },
    });

    // Card description
    elements.push({
      type: 'text',
      x: cardX + 12,
      y: sectionY + 65,
      width: cardWidth - 24,
      height: 100,
      z_index: 2,
      properties: {
        content: escapeHtml(card.description),
        fontSize: 12,
        color: '#666',
      },
    });
  }

  return { elements, height: 280 };
}
