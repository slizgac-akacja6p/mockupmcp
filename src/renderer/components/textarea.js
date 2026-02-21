import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    placeholder: 'Enter text...',
    rows:        4,
    label:       null,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const labelHtml = p.label
    ? `<span class="mockup-input-label">${escapeHtml(p.label)}</span>`
    : '';
  return `<div>${labelHtml}<div class="mockup-textarea mockup-textarea--rows-${p.rows}">${escapeHtml(p.placeholder)}</div></div>`;
}
