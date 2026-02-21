import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    headers:        ['Name', 'Status', 'Date', 'Actions'],
    rows: [
      ['Project Alpha', 'Active', '2026-01-15', 'Edit'],
      ['Project Beta',  'Paused', '2026-02-01', 'Edit'],
    ],
    showSearch:     true,
    showPagination: true,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const headers = Array.isArray(p.headers) ? p.headers : [];
  const rows    = Array.isArray(p.rows)    ? p.rows    : [];

  const searchHtml = p.showSearch
    ? `<div class="mockup-data-table__toolbar"><div class="mockup-data-table__search">Search...</div></div>`
    : '';

  const thHtml = headers
    .map(h => `<th class="mockup-data-table__th">${escapeHtml(String(h))}<span class="mockup-data-table__sort">&#9650;</span></th>`)
    .join('');

  const trHtml = rows
    .map(row => {
      const cells = Array.isArray(row) ? row : [];
      const tdHtml = cells
        .map(c => `<td class="mockup-data-table__td">${escapeHtml(String(c))}</td>`)
        .join('');
      return `<tr class="mockup-data-table__row">${tdHtml}</tr>`;
    })
    .join('');

  const paginationHtml = p.showPagination
    ? `<div class="mockup-data-table__pagination"><span>1-${rows.length} of ${rows.length}</span><span class="mockup-data-table__page-btn">&lt;</span><span class="mockup-data-table__page-btn">&gt;</span></div>`
    : '';

  return `<div class="mockup-data-table">
    ${searchHtml}
    <table class="mockup-table"><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table>
    ${paginationHtml}
  </div>`;
}
