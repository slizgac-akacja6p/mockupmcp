import { escapeHtml } from '../renderer/components/utils.js';

// Produces a self-contained HTML5 document from a screen definition.
// Elements are positioned absolutely to match the mockup layout exactly.
export function generate(screen) {
  const elements = (screen.elements || [])
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .map(el => {
      const inner = mapComponent(el);
      return `  <div style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; height: ${el.height}px;">\n    ${inner}\n  </div>`;
    }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(screen.name || 'Screen')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .screen { position: relative; width: ${screen.width}px; height: ${screen.height}px; background: ${screen.background || '#FFFFFF'}; overflow: hidden; }
  </style>
</head>
<body>
<div class="screen">
${elements}
</div>
</body>
</html>`;
}

// Maps a single element to its semantic HTML equivalent.
// Inline styles preserve visual intent without requiring a CSS framework.
export function mapComponent(el) {
  const p = el.properties || {};
  switch (el.type) {
    case 'text': {
      // Choose heading level based on font size so screen readers get structure
      const fs = p.fontSize || 16;
      const tag = fs >= 32 ? 'h1' : fs >= 24 ? 'h2' : fs >= 20 ? 'h3' : 'p';
      return `<${tag} style="font-size: ${fs}px; font-weight: ${p.fontWeight || 'normal'}; color: ${p.color || '#333'}; text-align: ${p.align || 'left'};">${escapeHtml(p.content || '')}</${tag}>`;
    }
    case 'button': {
      const variant = p.variant || 'primary';
      const styles = variant === 'primary'
        ? 'background: #007AFF; color: #FFF; border: none;'
        : variant === 'outline'
        ? 'background: transparent; color: #007AFF; border: 1px solid #007AFF;'
        : 'background: #E5E5EA; color: #333; border: none;';
      return `<button style="${styles} padding: 8px 16px; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%; height: 100%;">${escapeHtml(p.label || 'Button')}</button>`;
    }
    case 'input': {
      const labelHtml = p.label ? `<label style="display: block; margin-bottom: 4px; font-size: 14px; color: #666;">${escapeHtml(p.label)}</label>` : '';
      return `${labelHtml}<input type="${escapeHtml(p.type || 'text')}" placeholder="${escapeHtml(p.placeholder || '')}" style="width: 100%; padding: 8px 12px; border: 1px solid #CCC; border-radius: 6px; font-size: 16px;" />`;
    }
    case 'textarea':
      return `<textarea placeholder="${escapeHtml(p.placeholder || '')}" style="width: 100%; height: 100%; padding: 8px 12px; border: 1px solid #CCC; border-radius: 6px; font-size: 16px; resize: none;">${escapeHtml(p.content || '')}</textarea>`;
    case 'image':
      return p.src
        ? `<img src="${escapeHtml(p.src)}" alt="${escapeHtml(p.alt || '')}" style="width: 100%; height: 100%; object-fit: cover;" />`
        : `<div style="width: 100%; height: 100%; background: #F0F0F0; display: flex; align-items: center; justify-content: center; color: #999;">Image</div>`;
    case 'icon':
      return `<span style="font-size: ${p.size || 24}px; color: ${p.color || '#333'};">${escapeHtml(p.name || 'icon')}</span>`;
    case 'rectangle':
      return `<div style="width: 100%; height: 100%; background: ${p.fill || p.background || '#E0E0E0'}; border-radius: ${p.borderRadius || 0}px;"></div>`;
    case 'circle':
      return `<div style="width: 100%; height: 100%; background: ${p.fill || '#E0E0E0'}; border-radius: 50%;"></div>`;
    case 'line':
      return `<hr style="border: none; border-top: ${p.strokeWidth || 1}px solid ${p.stroke || '#CCC'}; margin: 0;" />`;
    case 'navbar':
      return `<nav style="display: flex; align-items: center; justify-content: center; height: 100%; padding: 0 16px; background: ${p.background || '#F8F8F8'}; border-bottom: 1px solid #E0E0E0;"><span style="font-weight: 600; font-size: 17px;">${escapeHtml(p.title || 'Screen')}</span></nav>`;
    case 'tabbar':
      return `<nav style="display: flex; align-items: center; justify-content: space-around; height: 100%; border-top: 1px solid #E0E0E0; background: #F8F8F8;">${(p.tabs || ['Tab 1', 'Tab 2', 'Tab 3']).map((t, i) => `<span style="font-size: 12px; color: ${i === (p.activeIndex || 0) ? '#007AFF' : '#999'};">${escapeHtml(t)}</span>`).join('')}</nav>`;
    case 'sidebar':
      return `<aside style="width: 100%; height: 100%; background: ${p.background || '#F5F5F5'}; padding: 16px; border-right: 1px solid #E0E0E0;">${(p.items || ['Item 1', 'Item 2']).map(item => `<div style="padding: 8px 0; cursor: pointer;">${escapeHtml(item)}</div>`).join('')}</aside>`;
    case 'breadcrumb':
      return `<nav style="display: flex; gap: 8px; font-size: 14px; color: #666;">${(p.items || ['Home']).map((item, i, arr) => `<span>${escapeHtml(item)}${i < arr.length - 1 ? ' /' : ''}</span>`).join('')}</nav>`;
    case 'card':
      return `<div class="card" style="background: #FFF; border: 1px solid #E0E0E0; border-radius: 8px; padding: 16px; overflow: hidden;"><h3 style="font-size: 16px; margin-bottom: 8px;">${escapeHtml(p.title || 'Card')}</h3>${p.subtitle ? `<p style="font-size: 14px; color: #666;">${escapeHtml(p.subtitle)}</p>` : ''}</div>`;
    case 'list':
      return `<ul style="list-style: none; padding: 0;">${(p.items || ['Item 1', 'Item 2', 'Item 3']).map(item => `<li style="padding: 12px 16px; border-bottom: 1px solid #F0F0F0;">${escapeHtml(typeof item === 'string' ? item : item.title || '')}</li>`).join('')}</ul>`;
    case 'table':
      return `<table style="width: 100%; border-collapse: collapse;"><thead><tr>${(p.columns || ['Col 1', 'Col 2']).map(c => `<th style="padding: 8px; border-bottom: 2px solid #E0E0E0; text-align: left; font-size: 14px;">${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${(p.rows || []).map(row => `<tr>${row.map(cell => `<td style="padding: 8px; border-bottom: 1px solid #F0F0F0; font-size: 14px;">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    case 'avatar':
      return `<div style="width: 100%; height: 100%; border-radius: 50%; background: ${p.background || '#007AFF'}; display: flex; align-items: center; justify-content: center; color: #FFF; font-weight: 600; font-size: ${(p.size || 40) * 0.4}px;">${escapeHtml(p.initials || p.name?.[0] || '?')}</div>`;
    case 'badge':
      return `<span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; background: ${p.color || '#FF3B30'}; color: #FFF; font-size: 12px; font-weight: 600;">${escapeHtml(p.text || p.count?.toString() || '0')}</span>`;
    case 'chip':
      return `<span style="display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 16px; background: #F0F0F0; font-size: 14px; color: #333;">${escapeHtml(p.label || 'Chip')}</span>`;
    case 'checkbox':
      return `<label style="display: flex; align-items: center; gap: 8px; font-size: 16px;"><input type="checkbox" ${p.checked ? 'checked' : ''} />${escapeHtml(p.label || 'Checkbox')}</label>`;
    case 'radio':
      return `<label style="display: flex; align-items: center; gap: 8px; font-size: 16px;"><input type="radio" ${p.checked ? 'checked' : ''} />${escapeHtml(p.label || 'Radio')}</label>`;
    case 'toggle':
      return `<label style="display: flex; align-items: center; gap: 8px; font-size: 16px;"><input type="checkbox" ${p.checked || p.on ? 'checked' : ''} style="width: 40px; height: 20px;" />${p.label ? escapeHtml(p.label) : ''}</label>`;
    case 'select':
      return `<select style="width: 100%; padding: 8px 12px; border: 1px solid #CCC; border-radius: 6px; font-size: 16px;">${(p.options || ['Option 1', 'Option 2']).map(o => `<option>${escapeHtml(o)}</option>`).join('')}</select>`;
    case 'slider':
      return `<input type="range" min="${p.min || 0}" max="${p.max || 100}" value="${p.value || 50}" style="width: 100%;" />`;
    case 'alert':
      return `<div style="padding: 12px 16px; border-radius: 8px; background: ${p.variant === 'error' ? '#FEE2E2' : p.variant === 'warning' ? '#FEF3C7' : p.variant === 'success' ? '#D1FAE5' : '#DBEAFE'}; font-size: 14px;">${escapeHtml(p.message || p.content || 'Alert message')}</div>`;
    case 'modal':
      return `<div style="background: #FFF; border-radius: 12px; padding: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); max-width: 100%;"><h2 style="font-size: 18px; margin-bottom: 12px;">${escapeHtml(p.title || 'Modal')}</h2><p style="font-size: 14px; color: #666;">${escapeHtml(p.content || '')}</p></div>`;
    case 'skeleton':
      return `<div style="width: 100%; height: 100%; background: linear-gradient(90deg, #F0F0F0 25%, #E0E0E0 50%, #F0F0F0 75%); border-radius: ${p.borderRadius || 4}px;"></div>`;
    case 'progress':
      return `<div style="width: 100%; height: 100%; background: #F0F0F0; border-radius: 4px; overflow: hidden;"><div style="width: ${p.value || 50}%; height: 100%; background: ${p.color || '#007AFF'}; border-radius: 4px;"></div></div>`;
    case 'tooltip':
      return `<div style="background: #333; color: #FFF; padding: 6px 12px; border-radius: 6px; font-size: 13px;">${escapeHtml(p.text || p.content || 'Tooltip')}</div>`;
    case 'login_form':
      return `<form style="display: flex; flex-direction: column; gap: 12px;"><input type="email" placeholder="${escapeHtml(p.emailPlaceholder || 'Email')}" style="padding: 8px 12px; border: 1px solid #CCC; border-radius: 6px;" /><input type="password" placeholder="${escapeHtml(p.passwordPlaceholder || 'Password')}" style="padding: 8px 12px; border: 1px solid #CCC; border-radius: 6px;" /><button style="background: #007AFF; color: #FFF; border: none; padding: 12px; border-radius: 8px; font-size: 16px;">${escapeHtml(p.buttonLabel || 'Sign In')}</button></form>`;
    case 'search_bar':
      return `<div style="display: flex; align-items: center; border: 1px solid #CCC; border-radius: 8px; padding: 8px 12px;"><input type="search" placeholder="${escapeHtml(p.placeholder || 'Search...')}" style="flex: 1; border: none; outline: none; font-size: 16px;" /></div>`;
    case 'header':
      return `<header style="display: flex; align-items: center; justify-content: space-between; height: 100%; padding: 0 16px;"><h1 style="font-size: 20px;">${escapeHtml(p.title || 'Header')}</h1></header>`;
    case 'footer':
      return `<footer style="display: flex; align-items: center; justify-content: center; height: 100%; padding: 0 16px; font-size: 14px; color: #999;">${escapeHtml(p.text || p.content || 'Footer')}</footer>`;
    case 'data_table':
      return `<table style="width: 100%; border-collapse: collapse;"><thead><tr>${(p.columns || ['Name', 'Value']).map(c => `<th style="padding: 10px; text-align: left; border-bottom: 2px solid #E0E0E0; font-size: 14px;">${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${(p.rows || []).map(row => `<tr>${row.map(cell => `<td style="padding: 10px; border-bottom: 1px solid #F0F0F0; font-size: 14px;">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    case 'chart_placeholder':
      return `<div style="width: 100%; height: 100%; background: #F8F8F8; border: 1px dashed #CCC; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 14px;">${escapeHtml(p.chartType || 'Chart')} Placeholder</div>`;
    default:
      // Unknown types render as an HTML comment so the document stays valid
      return `<!-- ${escapeHtml(el.type)} -->`;
  }
}
