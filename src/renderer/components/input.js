export function defaults() {
  return {
    placeholder: 'Enter text...',
    label:       null,
    type:        'text',
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const labelHtml = p.label
    ? `<span class="mockup-input-label">${p.label}</span>`
    : '';
  return `<div>${labelHtml}<div class="mockup-input">${p.placeholder}</div></div>`;
}
