export function defaults() {
  return { value: 50, max: 100 };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  // Clamp percentage to [0, 100] to prevent broken bar widths
  const pct = Math.max(0, Math.min(100, (p.value / p.max) * 100));
  return `<div class="mockup-progress">
    <div class="mockup-progress__bar" style="width:${pct}%"></div>
  </div>`;
}
