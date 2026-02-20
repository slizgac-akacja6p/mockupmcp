import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    label:    'Option',
    selected: false,
    group:    'default',
  };
}

export function render(props) {
  const p   = { ...defaults(), ...props };
  const cls = p.selected
    ? 'mockup-radio mockup-radio--selected'
    : 'mockup-radio';
  // Inner dot rendered only when selected — purely visual for wireframe
  const dot = p.selected ? '<span class="mockup-radio__dot"></span>' : '';
  return `<label class="${cls}">
  <span class="mockup-radio__circle">${dot}</span>
  <span class="mockup-radio__label">${escapeHtml(p.label)}</span>
</label>`;
}
