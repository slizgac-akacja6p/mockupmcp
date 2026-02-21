import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    headers: ['Name', 'Email', 'Role'],
    rows: [
      ['John Doe', 'john@example.com', 'Admin'],
      ['Jane Smith', 'jane@example.com', 'User'],
    ],
    striped: false,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const headers = Array.isArray(p.headers) ? p.headers : [];
  const rows = Array.isArray(p.rows) ? p.rows : [];

  const thHtml = headers
    .map(h => `<th class="mockup-table__th">${escapeHtml(String(h))}</th>`)
    .join('');

  const trHtml = rows
    .map((row, i) => {
      const cells = Array.isArray(row) ? row : [];
      // Alternate row shading when striped is enabled
      const cls = p.striped && i % 2 === 1
        ? 'mockup-table__row mockup-table__row--striped'
        : 'mockup-table__row';
      const tdHtml = cells
        .map(c => `<td class="mockup-table__td">${escapeHtml(String(c))}</td>`)
        .join('');
      return `<tr class="${cls}">${tdHtml}</tr>`;
    })
    .join('');

  return `<table class="mockup-table"><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table>`;
}
