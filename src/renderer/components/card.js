export function defaults() {
  return {
    title:    'Card Title',
    subtitle: null,
    image:    false,
    actions:  [],
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };

  const imageHtml = p.image
    ? `<div style="width:100%;height:120px;background:#F5F5F5;border-bottom:1px solid #DDDDDD;display:flex;align-items:center;justify-content:center;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CCCCCC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
       </div>`
    : '';

  const subtitleHtml = p.subtitle
    ? `<p class="mockup-card__subtitle">${p.subtitle}</p>`
    : '';

  const actions = Array.isArray(p.actions) ? p.actions : [];
  const actionsHtml = actions.length > 0
    ? `<div class="mockup-card__actions">${actions.map(a => `<button class="mockup-button mockup-button--secondary mockup-button--sm">${a}</button>`).join('')}</div>`
    : '';

  return `<div class="mockup-card">${imageHtml}<div class="mockup-card__body"><p class="mockup-card__title">${p.title}</p>${subtitleHtml}</div>${actionsHtml}</div>`;
}
