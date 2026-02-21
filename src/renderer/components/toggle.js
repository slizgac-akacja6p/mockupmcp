import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    label: 'Toggle',
    on:    false,
  };
}

export function render(props) {
  const p   = { ...defaults(), ...props };
  const cls = p.on ? 'mockup-toggle mockup-toggle--on' : 'mockup-toggle';
  const labelHtml = p.label
    ? `<span class="mockup-toggle__label">${escapeHtml(p.label)}</span>`
    : '';
  return `<label class="${cls}">
  <span class="mockup-toggle__track"><span class="mockup-toggle__thumb"></span></span>
  ${labelHtml}
</label>`;
}
