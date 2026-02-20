const STYLES = ['solid', 'dashed', 'dotted'];

export function defaults() {
  return {
    strokeWidth: 1,
    color:       '#DDDDDD',
    style:       'solid',
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const lineStyle = STYLES.includes(p.style) ? p.style : 'solid';
  return `<div style="width:100%;height:100%;display:flex;align-items:center;">
    <div style="width:100%;border-top:${p.strokeWidth}px ${lineStyle} ${p.color};"></div>
  </div>`;
}
