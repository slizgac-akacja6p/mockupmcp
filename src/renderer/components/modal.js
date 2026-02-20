import { escapeHtml } from './utils.js';
import { render as renderButton } from './button.js';

export function defaults() {
  return {
    title:   'Modal Title',
    content: 'Modal content goes here.',
    actions: ['Cancel', 'Confirm'],
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const actions = Array.isArray(p.actions) ? p.actions : [];
  // Last action is primary (confirm), preceding ones are outline (cancel/secondary)
  const actionsHtml = actions.map((a, i) => {
    const variant = i === actions.length - 1 ? 'primary' : 'outline';
    return renderButton({ label: String(a), variant, size: 'md' });
  }).join('');

  return `<div class="mockup-modal__backdrop">
    <div class="mockup-modal">
      <div class="mockup-modal__header">${escapeHtml(String(p.title))}</div>
      <div class="mockup-modal__body">${escapeHtml(String(p.content))}</div>
      <div class="mockup-modal__footer">${actionsHtml}</div>
    </div>
  </div>`;
}
