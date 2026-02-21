import { escapeHtml } from './utils.js';

const TYPES = ['info', 'success', 'warning', 'error'];

export function defaults() {
  return { message: 'This is an alert message.', type: 'info' };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const alertType = TYPES.includes(p.type) ? p.type : 'info';
  return `<div class="mockup-alert mockup-alert--${alertType}">${escapeHtml(String(p.message))}</div>`;
}
