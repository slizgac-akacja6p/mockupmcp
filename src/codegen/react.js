import { escapeHtml } from '../renderer/components/utils.js';

// Converts a screen name to PascalCase for use as a React component identifier.
function toPascalCase(name) {
  return (name || 'Screen')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

// Produces a React functional component from a screen definition.
// Elements are positioned absolutely to match the mockup layout exactly.
export function generate(screen) {
  const componentName = toPascalCase(screen.name) + 'Screen';

  const elements = (screen.elements || [])
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .map(el => {
      const inner = mapComponent(el);
      return `        <div style={{ position: "absolute", left: ${el.x}, top: ${el.y}, width: ${el.width}, height: ${el.height} }}>
          ${inner}
        </div>`;
    }).join('\n');

  return `import React from 'react';

function ${componentName}() {
  return (
    <div style={{ position: "relative", width: ${screen.width}, height: ${screen.height}, background: "${screen.background || '#FFFFFF'}", overflow: "hidden" }}>
${elements}
    </div>
  );
}

export default ${componentName};
`;
}

// Maps a single element to its JSX equivalent.
// Style values for layout properties are numbers (React expects unitless values for inline styles).
// String properties (colors, font families) remain as strings.
export function mapComponent(el) {
  const p = el.properties || {};
  switch (el.type) {
    case 'text': {
      // Choose heading level based on font size so screen readers get structure
      const fs = p.fontSize || 16;
      const tag = fs >= 32 ? 'h1' : fs >= 24 ? 'h2' : fs >= 20 ? 'h3' : 'p';
      return `<${tag} style={{ fontSize: ${fs}, fontWeight: "${p.fontWeight || 'normal'}", color: "${p.color || '#333'}", textAlign: "${p.align || 'left'}", margin: 0 }}>${escapeHtml(p.content || '')}</${tag}>`;
    }
    case 'button': {
      const variant = p.variant || 'primary';
      const bg = variant === 'primary' ? '#007AFF' : variant === 'outline' ? 'transparent' : '#E5E5EA';
      const color = variant === 'primary' ? '#FFF' : variant === 'outline' ? '#007AFF' : '#333';
      const border = variant === 'outline' ? '"1px solid #007AFF"' : '"none"';
      return `<button style={{ background: "${bg}", color: "${color}", border: ${border}, padding: "8px 16px", borderRadius: 8, fontSize: 16, cursor: "pointer", width: "100%", height: "100%" }} onClick={() => {}}>${escapeHtml(p.label || 'Button')}</button>`;
    }
    case 'input': {
      const labelJsx = p.label
        ? `<label style={{ display: "block", marginBottom: 4, fontSize: 14, color: "#666" }}>${escapeHtml(p.label)}</label>`
        : '';
      return `${labelJsx}<input type="${escapeHtml(p.type || 'text')}" placeholder="${escapeHtml(p.placeholder || '')}" style={{ width: "100%", padding: "8px 12px", border: "1px solid #CCC", borderRadius: 6, fontSize: 16 }} />`;
    }
    case 'textarea':
      return `<textarea placeholder="${escapeHtml(p.placeholder || '')}" style={{ width: "100%", height: "100%", padding: "8px 12px", border: "1px solid #CCC", borderRadius: 6, fontSize: 16, resize: "none" }}>{${JSON.stringify(escapeHtml(p.content || ''))}}</textarea>`;
    case 'image':
      return p.src
        ? `<img src="${escapeHtml(p.src)}" alt="${escapeHtml(p.alt || '')}" style={{ width: "100%", height: "100%", objectFit: "cover" }} />`
        : `<div style={{ width: "100%", height: "100%", background: "#F0F0F0", display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>Image</div>`;
    case 'icon':
      return `<span style={{ fontSize: ${p.size || 24}, color: "${p.color || '#333'}" }}>${escapeHtml(p.name || 'icon')}</span>`;
    case 'rectangle':
      return `<div style={{ width: "100%", height: "100%", background: "${p.fill || p.background || '#E0E0E0'}", borderRadius: ${p.borderRadius || 0} }}></div>`;
    case 'circle':
      return `<div style={{ width: "100%", height: "100%", background: "${p.fill || '#E0E0E0'}", borderRadius: "50%" }}></div>`;
    case 'line':
      return `<hr style={{ border: "none", borderTop: "${p.strokeWidth || 1}px solid ${p.stroke || '#CCC'}", margin: 0 }} />`;
    case 'navbar':
      return `<nav style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 16px", background: "${p.background || '#F8F8F8'}", borderBottom: "1px solid #E0E0E0" }}><span style={{ fontWeight: 600, fontSize: 17 }}>${escapeHtml(p.title || 'Screen')}</span></nav>`;
    case 'tabbar': {
      const tabs = (p.tabs || ['Tab 1', 'Tab 2', 'Tab 3'])
        .map((t, i) => `<span style={{ fontSize: 12, color: ${i === (p.activeIndex || 0) ? '"#007AFF"' : '"#999"'} }}>${escapeHtml(t)}</span>`)
        .join('');
      return `<nav style={{ display: "flex", alignItems: "center", justifyContent: "space-around", height: "100%", borderTop: "1px solid #E0E0E0", background: "#F8F8F8" }}>${tabs}</nav>`;
    }
    case 'sidebar': {
      const items = (p.items || ['Item 1', 'Item 2'])
        .map(item => `<div style={{ padding: "8px 0", cursor: "pointer" }}>${escapeHtml(item)}</div>`)
        .join('');
      return `<aside style={{ width: "100%", height: "100%", background: "${p.background || '#F5F5F5'}", padding: 16, borderRight: "1px solid #E0E0E0" }}>${items}</aside>`;
    }
    case 'breadcrumb': {
      const items = (p.items || ['Home']);
      const crumbs = items.map((item, i) => `<span>${escapeHtml(item)}${i < items.length - 1 ? ' /' : ''}</span>`).join('');
      return `<nav style={{ display: "flex", gap: 8, fontSize: 14, color: "#666" }}>${crumbs}</nav>`;
    }
    case 'card':
      return `<div style={{ background: "#FFF", border: "1px solid #E0E0E0", borderRadius: 8, padding: 16, overflow: "hidden" }}><h3 style={{ fontSize: 16, marginBottom: 8 }}>${escapeHtml(p.title || 'Card')}</h3>${p.subtitle ? `<p style={{ fontSize: 14, color: "#666" }}>${escapeHtml(p.subtitle)}</p>` : ''}</div>`;
    case 'list': {
      const items = (p.items || ['Item 1', 'Item 2', 'Item 3'])
        .map(item => `<li style={{ padding: "12px 16px", borderBottom: "1px solid #F0F0F0" }}>${escapeHtml(typeof item === 'string' ? item : item.title || '')}</li>`)
        .join('');
      return `<ul style={{ listStyle: "none", padding: 0, margin: 0 }}>${items}</ul>`;
    }
    case 'table': {
      const cols = (p.columns || ['Col 1', 'Col 2'])
        .map(c => `<th style={{ padding: 8, borderBottom: "2px solid #E0E0E0", textAlign: "left", fontSize: 14 }}>${escapeHtml(c)}</th>`)
        .join('');
      const rows = (p.rows || [])
        .map(row => `<tr>${row.map(cell => `<td style={{ padding: 8, borderBottom: "1px solid #F0F0F0", fontSize: 14 }}>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('');
      return `<table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>${cols}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    case 'avatar': {
      const initials = escapeHtml(p.initials || p.name?.[0] || '?');
      const fontSize = (p.size || 40) * 0.4;
      return `<div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "${p.background || '#007AFF'}", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontWeight: 600, fontSize: ${fontSize} }}>${initials}</div>`;
    }
    case 'badge':
      return `<span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 12, background: "${p.color || '#FF3B30'}", color: "#FFF", fontSize: 12, fontWeight: 600 }}>${escapeHtml(p.text || p.count?.toString() || '0')}</span>`;
    case 'chip':
      return `<span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 16, background: "#F0F0F0", fontSize: 14, color: "#333" }}>${escapeHtml(p.label || 'Chip')}</span>`;
    case 'checkbox':
      return `<label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}><input type="checkbox" ${p.checked ? 'defaultChecked' : ''} />${escapeHtml(p.label || 'Checkbox')}</label>`;
    case 'radio':
      return `<label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}><input type="radio" ${p.checked ? 'defaultChecked' : ''} />${escapeHtml(p.label || 'Radio')}</label>`;
    case 'toggle':
      return `<label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}><input type="checkbox" ${p.checked || p.on ? 'defaultChecked' : ''} style={{ width: 40, height: 20 }} />${p.label ? escapeHtml(p.label) : ''}</label>`;
    case 'select': {
      const opts = (p.options || ['Option 1', 'Option 2'])
        .map(o => `<option>${escapeHtml(o)}</option>`)
        .join('');
      return `<select style={{ width: "100%", padding: "8px 12px", border: "1px solid #CCC", borderRadius: 6, fontSize: 16 }}>${opts}</select>`;
    }
    case 'slider':
      return `<input type="range" min={${p.min || 0}} max={${p.max || 100}} defaultValue={${p.value || 50}} style={{ width: "100%" }} />`;
    case 'alert': {
      const bg = p.variant === 'error' ? '#FEE2E2' : p.variant === 'warning' ? '#FEF3C7' : p.variant === 'success' ? '#D1FAE5' : '#DBEAFE';
      return `<div style={{ padding: "12px 16px", borderRadius: 8, background: "${bg}", fontSize: 14 }}>${escapeHtml(p.message || p.content || 'Alert message')}</div>`;
    }
    case 'modal':
      return `<div style={{ background: "#FFF", borderRadius: 12, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.15)", maxWidth: "100%" }}><h2 style={{ fontSize: 18, marginBottom: 12 }}>${escapeHtml(p.title || 'Modal')}</h2><p style={{ fontSize: 14, color: "#666" }}>${escapeHtml(p.content || '')}</p></div>`;
    case 'skeleton':
      return `<div style={{ width: "100%", height: "100%", background: "linear-gradient(90deg, #F0F0F0 25%, #E0E0E0 50%, #F0F0F0 75%)", borderRadius: ${p.borderRadius || 4} }}></div>`;
    case 'progress':
      return `<div style={{ width: "100%", height: "100%", background: "#F0F0F0", borderRadius: 4, overflow: "hidden" }}><div style={{ width: "${p.value || 50}%", height: "100%", background: "${p.color || '#007AFF'}", borderRadius: 4 }}></div></div>`;
    case 'tooltip':
      return `<div style={{ background: "#333", color: "#FFF", padding: "6px 12px", borderRadius: 6, fontSize: 13 }}>${escapeHtml(p.text || p.content || 'Tooltip')}</div>`;
    case 'login_form':
      return `<form style={{ display: "flex", flexDirection: "column", gap: 12 }}><input type="email" placeholder="${escapeHtml(p.emailPlaceholder || 'Email')}" style={{ padding: "8px 12px", border: "1px solid #CCC", borderRadius: 6 }} /><input type="password" placeholder="${escapeHtml(p.passwordPlaceholder || 'Password')}" style={{ padding: "8px 12px", border: "1px solid #CCC", borderRadius: 6 }} /><button style={{ background: "#007AFF", color: "#FFF", border: "none", padding: 12, borderRadius: 8, fontSize: 16 }} onClick={() => {}}>${escapeHtml(p.buttonLabel || 'Sign In')}</button></form>`;
    case 'search_bar':
      return `<div style={{ display: "flex", alignItems: "center", border: "1px solid #CCC", borderRadius: 8, padding: "8px 12px" }}><input type="search" placeholder="${escapeHtml(p.placeholder || 'Search...')}" style={{ flex: 1, border: "none", outline: "none", fontSize: 16 }} /></div>`;
    case 'header':
      return `<header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%", padding: "0 16px" }}><h1 style={{ fontSize: 20 }}>${escapeHtml(p.title || 'Header')}</h1></header>`;
    case 'footer':
      return `<footer style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 16px", fontSize: 14, color: "#999" }}>${escapeHtml(p.text || p.content || 'Footer')}</footer>`;
    case 'data_table': {
      const cols = (p.columns || ['Name', 'Value'])
        .map(c => `<th style={{ padding: 10, textAlign: "left", borderBottom: "2px solid #E0E0E0", fontSize: 14 }}>${escapeHtml(c)}</th>`)
        .join('');
      const rows = (p.rows || [])
        .map(row => `<tr>${row.map(cell => `<td style={{ padding: 10, borderBottom: "1px solid #F0F0F0", fontSize: 14 }}>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('');
      return `<table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>${cols}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    case 'chart_placeholder':
      return `<div style={{ width: "100%", height: "100%", background: "#F8F8F8", border: "1px dashed #CCC", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 14 }}>${escapeHtml(p.chartType || 'Chart')} Placeholder</div>`;
    default:
      // Unknown types render as an empty fragment so the component stays valid JSX
      return `{/* ${escapeHtml(el.type)} */}`;
  }
}
