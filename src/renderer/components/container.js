export function defaults() {
  return {
    fill:         'transparent',
    stroke:       null,
    cornerRadius: 0,
    opacity:      1,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };

  // When _style is null (inheritStyle:false), the wrapper div already carries
  // background-color from buildPropertyStyles. Rendering our own background here
  // would cover the wrapper's inline style, so we let it show through instead.
  // Use backgroundColor from properties if provided, otherwise transparent.
  const bg = p._style === null
    ? (p.backgroundColor ?? 'transparent')
    : p.fill;

  const border = p.stroke ? `border:1px solid ${p.stroke};` : '';
  const radius = p.cornerRadius ? `border-radius:${p.cornerRadius}px;` : '';

  return `<div style="width:100%;height:100%;background:${bg};${border}${radius}opacity:${p.opacity};"></div>`;
}
