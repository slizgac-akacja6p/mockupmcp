import { escapeHtml } from './utils.js';

const SIZES = { sm: 32, md: 40, lg: 56 };

export function defaults() {
  return {
    initials: 'U',
    size:     'md',
    src:      null,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const px = SIZES[p.size] || SIZES.md;
  // Truncate to 2 chars so initials never overflow the circle
  const content = p.initials
    ? escapeHtml(String(p.initials).slice(0, 2).toUpperCase())
    : '';

  return `<div class="mockup-avatar" style="width:${px}px;height:${px}px;border-radius:50%;background:var(--color-bg-light,#F5F5F5);border:1px solid var(--color-border,#DDDDDD);display:flex;align-items:center;justify-content:center;font-size:${Math.round(px * 0.4)}px;font-weight:600;color:var(--color-text-secondary,#666666);">${content}</div>`;
}
