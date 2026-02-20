import { escapeHtml } from './utils.js';

const POSITIONS = ['top', 'bottom', 'left', 'right'];

export function defaults() {
  return { content: 'Tooltip text', position: 'top' };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const pos = POSITIONS.includes(p.position) ? p.position : 'top';
  return `<div class="mockup-tooltip mockup-tooltip--${pos}">
    <div class="mockup-tooltip__content">${escapeHtml(String(p.content))}</div>
  </div>`;
}
