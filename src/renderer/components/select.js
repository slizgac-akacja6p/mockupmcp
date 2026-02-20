import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    options:     ['Option 1', 'Option 2', 'Option 3'],
    placeholder: 'Select...',
    selected:    null,
    label:       null,
  };
}

export function render(props) {
  const p    = { ...defaults(), ...props };
  const opts = Array.isArray(p.options) ? p.options : [];
  // Display selected value or fallback to placeholder
  const display = p.selected !== null ? p.selected : p.placeholder;
  const labelHtml = p.label
    ? `<span class="mockup-input-label">${escapeHtml(p.label)}</span>`
    : '';
  return `<div>${labelHtml}<div class="mockup-select">
  <div class="mockup-select__trigger">${escapeHtml(String(display))}<span class="mockup-select__arrow">&#9662;</span></div>
</div></div>`;
}
