import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    label:    'Chip',
    removable: false,
    selected:  false,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const cls = p.selected ? 'mockup-chip mockup-chip--selected' : 'mockup-chip';
  // &times; renders the × glyph without depending on any icon library
  const removeHtml = p.removable
    ? '<span class="mockup-chip__remove">&times;</span>'
    : '';
  return `<span class="${cls}">${escapeHtml(String(p.label))}${removeHtml}</span>`;
}
