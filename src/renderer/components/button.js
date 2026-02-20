import { escapeHtml } from './utils.js';

const VARIANTS = ['primary', 'secondary', 'outline', 'ghost'];
const SIZES = ['sm', 'md', 'lg'];

export function defaults() {
  return {
    label:   'Button',
    variant: 'primary',
    size:    'md',
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const variant = VARIANTS.includes(p.variant) ? p.variant : 'primary';
  const size = SIZES.includes(p.size) ? p.size : 'md';
  const cls = `mockup-button mockup-button--${variant} mockup-button--${size}`;
  return `<button class="${cls}">${escapeHtml(p.label)}</button>`;
}
