export function defaults() {
  return {
    placeholder: true,
    aspectRatio: null,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  // Diagonal cross lines (X pattern) communicate "image slot" in wireframe convention.
  const svg = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;">
    <line x1="0" y1="0" x2="100%" y2="100%" stroke="#CCCCCC" stroke-width="1"/>
    <line x1="100%" y1="0" x2="0" y2="100%" stroke="#CCCCCC" stroke-width="1"/>
  </svg>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:1;">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>`;
  const styleAttr = p.aspectRatio
    ? `style="aspect-ratio:${p.aspectRatio};"`
    : '';
  return `<div class="mockup-image-placeholder" ${styleAttr}>${svg}</div>`;
}
