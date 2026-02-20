export function defaults() {
  return {
    fill:        '#DDDDDD',
    stroke:      '#999999',
    strokeWidth: 1,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
    <div style="width:100%;height:100%;border-radius:50%;background:${p.fill};border:${p.strokeWidth}px solid ${p.stroke};"></div>
  </div>`;
}
