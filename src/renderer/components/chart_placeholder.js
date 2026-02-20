import { escapeHtml } from './utils.js';

const CHART_TYPES = ['bar', 'line', 'pie', 'donut'];

// Static SVG shapes per chart type — no external assets needed for wireframe fidelity.
const CHART_ICONS = {
  pie:   `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="#CCC" stroke-width="2"/><path d="M24 4 A20 20 0 0 1 44 24 L24 24 Z" fill="#DDD"/></svg>`,
  donut: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="#CCC" stroke-width="2"/><path d="M24 4 A20 20 0 0 1 44 24 L24 24 Z" fill="#DDD"/><circle cx="24" cy="24" r="10" fill="white" stroke="#CCC" stroke-width="2"/></svg>`,
  line:  `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><polyline points="4,40 16,20 28,30 44,8" stroke="#CCC" stroke-width="2" fill="none"/></svg>`,
  bar:   `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="4" y="24" width="8" height="20" fill="#DDD"/><rect x="16" y="16" width="8" height="28" fill="#CCC"/><rect x="28" y="8" width="8" height="36" fill="#DDD"/><rect x="40" y="20" width="4" height="24" fill="#CCC"/></svg>`,
};

export function defaults() {
  return {
    type:  'bar',
    title: null,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const chartType = CHART_TYPES.includes(p.type) ? p.type : 'bar';
  const titleHtml = p.title
    ? `<div class="mockup-chart__title">${escapeHtml(String(p.title))}</div>`
    : '';

  return `<div class="mockup-chart">
    ${titleHtml}
    <div class="mockup-chart__body">${CHART_ICONS[chartType]}<div class="mockup-chart__label">${escapeHtml(chartType)} chart</div></div>
  </div>`;
}
