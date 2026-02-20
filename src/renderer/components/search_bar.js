import { render as renderIcon } from './icon.js';
import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    placeholder: 'Search...',
    icon:        'search',
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  return `<div class="mockup-search-bar">
    <span class="mockup-search-bar__icon">${renderIcon({ name: p.icon, size: 18, color: '#999999' })}</span>
    <span class="mockup-search-bar__input">${escapeHtml(String(p.placeholder))}</span>
  </div>`;
}
