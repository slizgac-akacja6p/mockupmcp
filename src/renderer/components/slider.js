import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    min:   0,
    max:   100,
    value: 50,
    label: null,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  // Clamp percentage to [0, 100] regardless of out-of-range value input
  const range = p.max - p.min || 1;
  const pct   = Math.max(0, Math.min(100, ((p.value - p.min) / range) * 100));
  const labelHtml = p.label
    ? `<span class="mockup-input-label">${escapeHtml(p.label)}</span>`
    : '';
  return `<div>${labelHtml}<div class="mockup-slider">
  <div class="mockup-slider__track">
    <div class="mockup-slider__fill" style="width:${pct}%"></div>
    <div class="mockup-slider__thumb" style="left:${pct}%"></div>
  </div>
</div></div>`;
}
