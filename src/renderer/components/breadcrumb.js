import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    items: ['Home', 'Products', 'Detail'],
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const items = Array.isArray(p.items) ? p.items : [];

  const html = items.map((item, i) => {
    const isLast = i === items.length - 1;
    // Separator is omitted after the last (current) crumb.
    const sep = isLast ? '' : '<span class="mockup-breadcrumb__sep">/</span>';
    const cls = isLast
      ? 'mockup-breadcrumb__item mockup-breadcrumb__item--current'
      : 'mockup-breadcrumb__item';
    return `<span class="${cls}">${escapeHtml(String(item))}</span>${sep}`;
  }).join('');

  return `<nav class="mockup-breadcrumb">${html}</nav>`;
}
