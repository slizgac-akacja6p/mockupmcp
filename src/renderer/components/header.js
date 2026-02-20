import { render as renderIcon } from './icon.js';
import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    logo:      'App',
    nav:       ['Home', 'About', 'Contact'],
    rightIcon: 'user',
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const navItems = Array.isArray(p.nav) ? p.nav : [];
  const navHtml = navItems
    .map(item => `<span class="mockup-header__nav-item">${escapeHtml(String(item))}</span>`)
    .join('');
  const rightHtml = p.rightIcon
    ? `<span class="mockup-header__right">${renderIcon({ name: p.rightIcon, size: 20, color: '#333333' })}</span>`
    : '';

  return `<header class="mockup-header">
    <span class="mockup-header__logo">${escapeHtml(String(p.logo))}</span>
    <nav class="mockup-header__nav">${navHtml}</nav>
    ${rightHtml}
  </header>`;
}
