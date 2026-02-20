export function defaults() {
  return {
    fill:         '#F5F5F5',
    stroke:       '#DDDDDD',
    cornerRadius: 4,
    opacity:      1,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  return `<div style="width:100%;height:100%;background:${p.fill};border:1px solid ${p.stroke};border-radius:${p.cornerRadius}px;opacity:${p.opacity};"></div>`;
}
