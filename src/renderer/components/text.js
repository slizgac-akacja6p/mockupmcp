// Escaping is required here — content comes from user-supplied JSON, never trust it.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function defaults() {
  return {
    content:    'Text',
    fontSize:   16,
    fontWeight: 'normal',
    color:      '#333333',
    align:      'left',
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  return `<span style="font-size:${p.fontSize}px;font-weight:${p.fontWeight};color:${p.color};text-align:${p.align};display:block;">${escapeHtml(p.content)}</span>`;
}
