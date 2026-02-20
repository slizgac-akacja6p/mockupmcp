const DEFAULT_ITEMS = ['Item 1', 'Item 2', 'Item 3'];

export function defaults() {
  return {
    items:   DEFAULT_ITEMS,
    variant: 'simple',
  };
}

function renderSimple(items) {
  return items.map(item => `<div class="mockup-list-item">${item}</div>`).join('');
}

function renderDetailed(items) {
  // Circle placeholder communicates avatar slot without requiring real content.
  return items.map(item =>
    `<div class="mockup-list-item"><div class="mockup-list-item__avatar"></div><span>${item}</span></div>`
  ).join('');
}

function renderCard(items) {
  return items.map(item =>
    `<div style="border:1px solid #DDDDDD;border-radius:4px;padding:12px 16px;margin-bottom:8px;background:#FFFFFF;font-size:14px;color:#333333;">${item}</div>`
  ).join('');
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const items = Array.isArray(p.items) ? p.items : DEFAULT_ITEMS;

  if (p.variant === 'card') {
    return `<div>${renderCard(items)}</div>`;
  }

  const innerHtml = p.variant === 'detailed' ? renderDetailed(items) : renderSimple(items);
  return `<div class="mockup-list">${innerHtml}</div>`;
}
