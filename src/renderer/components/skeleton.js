const VARIANTS = ['text', 'circle', 'rectangle'];

export function defaults() {
  return { variant: 'text' };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const variant = VARIANTS.includes(p.variant) ? p.variant : 'text';
  return `<div class="mockup-skeleton mockup-skeleton--${variant}"></div>`;
}
