import { escapeHtml } from './utils.js';

// Color variants use inline styles so the wireframe.css base class (.mockup-badge)
// handles layout/typography while each variant overrides only bg/fg/border.
const COLORS = {
  default: { bg: '#F5F5F5', fg: '#666666', border: '#DDDDDD' },
  blue:    { bg: '#E3F2FD', fg: '#1565C0', border: '#90CAF9' },
  green:   { bg: '#E8F5E9', fg: '#2E7D32', border: '#A5D6A7' },
  red:     { bg: '#FFEBEE', fg: '#C62828', border: '#EF9A9A' },
  yellow:  { bg: '#FFF8E1', fg: '#F57F17', border: '#FFE082' },
};

export function defaults() {
  return {
    label: 'Badge',
    color: 'default',
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const c = COLORS[p.color] || COLORS.default;
  return `<span class="mockup-badge" style="background:${c.bg};color:${c.fg};border-color:${c.border};">${escapeHtml(String(p.label))}</span>`;
}
