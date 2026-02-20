import { render as renderIcon } from './icon.js';
import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    items: [
      { icon: 'home',     label: 'Home',     active: true },
      { icon: 'search',   label: 'Search' },
      { icon: 'settings', label: 'Settings' },
    ],
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const items = Array.isArray(p.items) ? p.items : [];

  const itemsHtml = items.map(item => {
    const cls = item.active
      ? 'mockup-sidebar__item mockup-sidebar__item--active'
      : 'mockup-sidebar__item';
    // Icon color mirrors the active state so it visually matches the label.
    const iconColor = item.active ? '#333333' : '#666666';
    const iconHtml = item.icon
      ? renderIcon({ name: item.icon, size: 20, color: iconColor })
      : '';
    return `<div class="${cls}">${iconHtml}<span>${escapeHtml(String(item.label || ''))}</span></div>`;
  }).join('');

  return `<nav class="mockup-sidebar">${itemsHtml}</nav>`;
}
