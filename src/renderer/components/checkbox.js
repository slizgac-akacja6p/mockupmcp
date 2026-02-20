import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    label:   'Checkbox',
    checked: false,
  };
}

export function render(props) {
  const p   = { ...defaults(), ...props };
  const cls = p.checked
    ? 'mockup-checkbox mockup-checkbox--checked'
    : 'mockup-checkbox';
  // Checkmark is a visual indicator only — no interactive state in wireframe
  const checkmark = p.checked ? '&#10003;' : '';
  return `<label class="${cls}">
  <span class="mockup-checkbox__box">${checkmark}</span>
  <span class="mockup-checkbox__label">${escapeHtml(p.label)}</span>
</label>`;
}
