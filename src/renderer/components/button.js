// Label is user-supplied — escape to prevent XSS in rendered HTML.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function defaults() {
  return {
    label:   'Button',
    variant: 'primary',
    size:    'md',
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const cls = `mockup-button mockup-button--${p.variant} mockup-button--${p.size}`;
  return `<button class="${cls}">${escapeHtml(p.label)}</button>`;
}
