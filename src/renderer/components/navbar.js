import { render as renderIcon } from './icon.js';
import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    title:      'Screen',
    leftIcon:   null,
    rightIcons: [],
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };

  const leftHtml = p.leftIcon
    ? `<div class="mockup-navbar__side">${renderIcon({ name: p.leftIcon, size: 20, color: '#333333' })}</div>`
    : `<div class="mockup-navbar__side"></div>`;

  const rightIcons = Array.isArray(p.rightIcons) ? p.rightIcons : [];
  const rightHtml = `<div class="mockup-navbar__side">${rightIcons.map(name => renderIcon({ name, size: 20, color: '#333333' })).join('')}</div>`;

  return `<div class="mockup-navbar">${leftHtml}<span class="mockup-navbar__title">${escapeHtml(p.title)}</span>${rightHtml}</div>`;
}
