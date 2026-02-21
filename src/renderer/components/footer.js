import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    text:  '2026 App Inc. All rights reserved.',
    links: ['Privacy', 'Terms', 'Contact'],
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const links = Array.isArray(p.links) ? p.links : [];
  const linksHtml = links
    .map(l => `<span class="mockup-footer__link">${escapeHtml(String(l))}</span>`)
    .join('');

  return `<footer class="mockup-footer">
    <div class="mockup-footer__links">${linksHtml}</div>
    <div class="mockup-footer__text">${escapeHtml(String(p.text))}</div>
  </footer>`;
}
