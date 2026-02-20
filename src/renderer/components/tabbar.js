import { render as renderIcon } from './icon.js';
import { escapeHtml } from './utils.js';

const DEFAULT_TABS = [
  { icon: 'home',   label: 'Home',    active: true },
  { icon: 'search', label: 'Search' },
  { icon: 'user',   label: 'Profile' },
];

export function defaults() {
  return {
    tabs: DEFAULT_TABS,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const tabs = Array.isArray(p.tabs) ? p.tabs : DEFAULT_TABS;

  const tabsHtml = tabs.map(tab => {
    const isActive = Boolean(tab.active);
    const itemCls = `mockup-tabbar-item${isActive ? ' mockup-tabbar-item--active' : ''}`;
    // Active tab uses darker icon color to indicate selection.
    const iconColor = isActive ? '#333333' : '#999999';
    return `<div class="${itemCls}">${renderIcon({ name: tab.icon, size: 22, color: iconColor })}<span>${escapeHtml(tab.label)}</span></div>`;
  }).join('');

  return `<div class="mockup-tabbar">${tabsHtml}</div>`;
}
