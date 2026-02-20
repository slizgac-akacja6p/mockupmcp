# M2a Implementation Plan — Components + Styles

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend MockupMCP from 10 to 35 components, add material and iOS styles, add duplicate_screen tool.

**Architecture:** CSS-per-style files with shared HTML structure. Components are pure `render(props)->HTML` + `defaults()` functions. Composites import `render()` from primitives. Style resolved as `screen.style || project.style || 'wireframe'`.

**Tech Stack:** Node.js 20, ESM modules, Node test runner, Zod validation, Puppeteer/Express.

**Design doc:** `docs/plans/2026-02-20-m2a-design.md`

---

## Sprint 1: Style System + 19 Simple Components

### Task 1: Style Registry

**Files:**
- Create: `src/renderer/styles/index.js`

**Step 1: Write test**

Add to new file `tests/renderer/styles.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadStyle, getAvailableStyles } from '../../src/renderer/styles/index.js';

describe('style registry', () => {
  it('getAvailableStyles returns array with wireframe, material, ios', () => {
    const styles = getAvailableStyles();
    assert.ok(styles.includes('wireframe'));
    assert.ok(styles.includes('material'));
    assert.ok(styles.includes('ios'));
    assert.equal(styles.length, 3);
  });

  it('loadStyle returns non-empty CSS string for wireframe', () => {
    const css = loadStyle('wireframe');
    assert.equal(typeof css, 'string');
    assert.ok(css.length > 0);
    assert.ok(css.includes('.mockup-button'));
  });

  it('loadStyle returns non-empty CSS string for material', () => {
    const css = loadStyle('material');
    assert.equal(typeof css, 'string');
    assert.ok(css.length > 0);
  });

  it('loadStyle returns non-empty CSS string for ios', () => {
    const css = loadStyle('ios');
    assert.equal(typeof css, 'string');
    assert.ok(css.length > 0);
  });

  it('loadStyle falls back to wireframe for unknown style', () => {
    const css = loadStyle('unknown');
    const wireframe = loadStyle('wireframe');
    assert.equal(css, wireframe);
  });

  it('caches loaded CSS (same reference on second call)', () => {
    const a = loadStyle('wireframe');
    const b = loadStyle('wireframe');
    assert.equal(a, b);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
node --test tests/renderer/styles.test.js
```
Expected: FAIL — module not found.

**Step 3: Implement style registry**

Create `src/renderer/styles/index.js`:

```javascript
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cache = {};

const VALID_STYLES = ['wireframe', 'material', 'ios'];

export function loadStyle(name) {
  const styleName = VALID_STYLES.includes(name) ? name : 'wireframe';
  if (!cache[styleName]) {
    cache[styleName] = readFileSync(join(__dirname, `${styleName}.css`), 'utf-8');
  }
  return cache[styleName];
}

export function getAvailableStyles() {
  return [...VALID_STYLES];
}
```

**Step 4: Create placeholder CSS files so tests pass**

Create `src/renderer/styles/material.css` and `src/renderer/styles/ios.css` with minimal placeholder content:

```css
/* Material Design 3 style — placeholder */
.mockup-button { display: inline-flex; }
```

```css
/* iOS Human Interface style — placeholder */
.mockup-button { display: inline-flex; }
```

**Step 5: Run test to verify it passes**

```bash
node --test tests/renderer/styles.test.js
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/renderer/styles/index.js tests/renderer/styles.test.js src/renderer/styles/material.css src/renderer/styles/ios.css
git commit -m "feat: style registry with loadStyle and getAvailableStyles"
```

---

### Task 2: Refactor html-builder for Multi-Style Support

**Files:**
- Modify: `src/renderer/html-builder.js`
- Modify: `src/mcp/tools/export-tools.js`
- Modify: `src/preview/server.js`
- Modify: `tests/renderer/html-builder.test.js`

**Step 1: Update html-builder.js**

Replace hardcoded wireframe CSS import with dynamic style loading:

```javascript
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getComponent } from './components/index.js';
import { loadStyle } from './styles/index.js';

export function buildScreenHtml(screen, style = 'wireframe') {
  const css = loadStyle(style);

  const elementsHtml = (screen.elements || [])
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .map(el => {
      const component = getComponent(el.type);
      if (!component) return `<!-- unknown type: ${el.type} -->`;
      const innerHtml = component.render({ ...el.properties, _style: style });
      return `<div class="element" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.z_index || 0};overflow:hidden;">${innerHtml}</div>`;
    })
    .join('\n    ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    ${css}
  </style>
</head>
<body>
  <div class="screen" style="position:relative;width:${screen.width}px;height:${screen.height}px;background:${screen.background || '#FFFFFF'};overflow:hidden;">
    ${elementsHtml}
  </div>
</body>
</html>`;
}
```

Key changes:
- Import `loadStyle` instead of `readFileSync`
- `buildScreenHtml` accepts `style` parameter (default: `'wireframe'`)
- Passes `{ ...el.properties, _style: style }` to component render
- Uses `loadStyle(style)` instead of hardcoded `wireframeCss`

**Step 2: Update export-tools.js**

In `src/mcp/tools/export-tools.js`, the `mockup_export` handler resolves style from project/screen and passes it to `buildScreenHtml`:

Change line 27 (`const html = buildScreenHtml(screen);`) to:

```javascript
const style = screen.style || project.style || 'wireframe';
const html = buildScreenHtml(screen, style);
```

**Step 3: Update preview server**

In `src/preview/server.js`, line 49 (`buildScreenHtml(screen)`) change to:

```javascript
const style = screen.style || project.style || 'wireframe';
const html = injectPreviewAssets(
  buildScreenHtml(screen, style),
  project.id,
  project.updated_at,
);
```

**Step 4: Update html-builder test**

In `tests/renderer/html-builder.test.js`, update the test that checks for wireframe CSS, and add a test for style parameter:

```javascript
it('uses wireframe style by default', () => {
  const html = buildScreenHtml({ width: 393, height: 852, elements: [] });
  assert.ok(html.includes('mockup-button'));
});

it('accepts a style parameter', () => {
  const html = buildScreenHtml({ width: 393, height: 852, elements: [] }, 'material');
  assert.ok(html.includes('mockup-button'));
});

it('passes _style to component render', () => {
  const html = buildScreenHtml({
    width: 393, height: 852,
    elements: [{ type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0, properties: { label: 'Test' } }],
  }, 'material');
  assert.ok(html.includes('Test'));
});
```

**Step 5: Run all tests**

```bash
node --test tests/**/*.test.js
```
Expected: All existing + new tests PASS.

**Step 6: Commit**

```bash
git add src/renderer/html-builder.js src/mcp/tools/export-tools.js src/preview/server.js tests/renderer/html-builder.test.js
git commit -m "refactor: html-builder accepts style parameter, dynamic CSS loading"
```

---

### Task 3: Storage + MCP Tool Schema Changes

**Files:**
- Modify: `src/storage/project-store.js`
- Modify: `src/mcp/tools/project-tools.js`
- Modify: `src/mcp/tools/screen-tools.js`
- Modify: `src/mcp/tools/element-tools.js`
- Modify: `src/mcp/tools/index.js`
- Modify: `tests/storage/project-store.test.js`

**Step 1: Add style to ProjectStore.createProject**

In `src/storage/project-store.js`, update `createProject` signature and body:

```javascript
async createProject(name, description = '', viewport = { width: 393, height: 852, preset: 'mobile' }, style = 'wireframe') {
  const id = generateId('proj');
  const now = new Date().toISOString();
  const project = {
    id,
    name,
    description,
    style,
    created_at: now,
    updated_at: now,
    viewport,
    screens: [],
  };
  await this._save(project);
  return project;
}
```

**Step 2: Add style to addScreen**

```javascript
async addScreen(projectId, name, width, height, background = '#FFFFFF', style = null) {
  const project = await this.getProject(projectId);
  const resolvedWidth = width ?? project.viewport.width;
  const resolvedHeight = height ?? project.viewport.height;
  const screen = {
    id: generateId('scr'),
    name,
    width: resolvedWidth,
    height: resolvedHeight,
    background,
    style,
    elements: [],
  };
  project.screens.push(screen);
  await this._save(project);
  return screen;
}
```

**Step 3: Add duplicateScreen method**

```javascript
async duplicateScreen(projectId, screenId, newName) {
  this._validateId(screenId);
  const project = await this.getProject(projectId);
  const source = this._findScreen(project, screenId);

  const newScreen = {
    ...structuredClone(source),
    id: generateId('scr'),
    name: newName || `${source.name} (copy)`,
    elements: source.elements.map(el => ({
      ...structuredClone(el),
      id: generateId('el'),
    })),
  };

  project.screens.push(newScreen);
  await this._save(project);
  return newScreen;
}
```

**Step 4: Update project-tools.js — add style param**

```javascript
server.tool(
  'mockup_create_project',
  'Create a new mockup project with a name, optional description, viewport preset, and style',
  {
    name: z.string().describe('Project name'),
    description: z.string().optional().describe('Project description'),
    viewport: z
      .enum(['mobile', 'tablet', 'desktop'])
      .optional()
      .default('mobile')
      .describe('Viewport preset: mobile (393x852), tablet (834x1194), desktop (1440x900)'),
    style: z
      .enum(['wireframe', 'material', 'ios'])
      .optional()
      .default('wireframe')
      .describe('Visual style: wireframe (grey/sketch), material (Material Design 3), ios (iOS HIG)'),
  },
  async ({ name, description, viewport, style }) => {
    try {
      const dims = config.viewportPresets[viewport];
      const project = await store.createProject(name, description || '', {
        width: dims.width,
        height: dims.height,
        preset: viewport,
      }, style);
      return {
        content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);
```

**Step 5: Update screen-tools.js — add style param + duplicate_screen tool**

Add `style` to `mockup_add_screen`:

```javascript
style: z
  .enum(['wireframe', 'material', 'ios'])
  .optional()
  .describe('Style override for this screen (defaults to project style)'),
```

Pass it through:
```javascript
const screen = await store.addScreen(project_id, name, width, height, background, style);
```

Add `mockup_duplicate_screen` tool:

```javascript
server.tool(
  'mockup_duplicate_screen',
  'Duplicate an existing screen with all its elements. All IDs are regenerated.',
  {
    project_id: z.string().describe('Project ID'),
    screen_id: z.string().describe('Screen ID to duplicate'),
    new_name: z.string().optional().describe('Name for the copy (defaults to "Original Name (copy)")'),
  },
  async ({ project_id, screen_id, new_name }) => {
    try {
      const screen = await store.duplicateScreen(project_id, screen_id, new_name);
      return {
        content: [{ type: 'text', text: JSON.stringify(screen, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);
```

**Step 6: Update element-tools.js — update type description**

Change line 7 description string to:

```javascript
'Add a UI element to a screen. Types: text, rectangle, circle, line, image, icon, avatar, badge, chip, skeleton, progress, tooltip, button, input, textarea, checkbox, radio, toggle, select, slider, navbar, tabbar, sidebar, breadcrumb, card, list, table, alert, modal, login_form, search_bar, header, footer, data_table, chart_placeholder'
```

Also update the `type` field description:

```javascript
type: z.string().describe('Element type — see tool description for available types'),
```

**Step 7: Update tools/index.js — tool count**

Change line 14:
```javascript
console.error('[MockupMCP] 14 tools registered');
```

**Step 8: Add storage tests**

Add to `tests/storage/project-store.test.js`:

```javascript
describe('Style support', () => {
  it('createProject stores style field', async () => {
    const project = await store.createProject('Styled', '', {
      width: 393, height: 852, preset: 'mobile',
    }, 'material');
    assert.equal(project.style, 'material');

    const retrieved = await store.getProject(project.id);
    assert.equal(retrieved.style, 'material');
  });

  it('createProject defaults style to wireframe', async () => {
    const project = await store.createProject('Default Style');
    assert.equal(project.style, 'wireframe');
  });

  it('addScreen stores style override', async () => {
    const project = await store.createProject('Screen Style Test');
    const screen = await store.addScreen(project.id, 'iOS Screen', null, null, '#FFFFFF', 'ios');
    assert.equal(screen.style, 'ios');
  });

  it('addScreen defaults style to null', async () => {
    const project = await store.createProject('Screen Null Style');
    const screen = await store.addScreen(project.id, 'Default Screen');
    assert.equal(screen.style, null);
  });
});

describe('duplicateScreen', () => {
  it('duplicates screen with new IDs', async () => {
    const project = await store.createProject('Dup Test');
    const screen = await store.addScreen(project.id, 'Original');
    await store.addElement(project.id, screen.id, 'button', 10, 20, 100, 40, { label: 'Click' });
    await store.addElement(project.id, screen.id, 'text', 10, 70, 200, 30, { content: 'Hello' });

    const copy = await store.duplicateScreen(project.id, screen.id, 'Copy');

    assert.notEqual(copy.id, screen.id);
    assert.equal(copy.name, 'Copy');
    assert.equal(copy.elements.length, 2);
    assert.notEqual(copy.elements[0].id, screen.elements?.[0]?.id);
    assert.equal(copy.elements[0].type, 'button');
    assert.deepEqual(copy.elements[0].properties, { label: 'Click' });
  });

  it('uses default name when new_name not provided', async () => {
    const project = await store.createProject('Dup Name Test');
    const screen = await store.addScreen(project.id, 'Main Screen');

    const copy = await store.duplicateScreen(project.id, screen.id);
    assert.equal(copy.name, 'Main Screen (copy)');
  });

  it('throws for nonexistent screen', async () => {
    const project = await store.createProject('Dup Error Test');
    await assert.rejects(
      () => store.duplicateScreen(project.id, 'scr_nonexistent'),
      /not found/i,
    );
  });
});
```

**Step 9: Run all tests**

```bash
node --test tests/**/*.test.js
```
Expected: All PASS.

**Step 10: Commit**

```bash
git add src/storage/project-store.js src/mcp/tools/project-tools.js src/mcp/tools/screen-tools.js src/mcp/tools/element-tools.js src/mcp/tools/index.js tests/storage/project-store.test.js
git commit -m "feat: style field in project/screen, duplicate_screen tool, schema updates"
```

---

### Task 4: Simple Components — Basic (circle, line)

**Files:**
- Create: `src/renderer/components/circle.js`
- Create: `src/renderer/components/line.js`

**circle.js:**

```javascript
export function defaults() {
  return { fill: '#DDDDDD', stroke: '#999999', strokeWidth: 1 };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
    <div style="width:100%;height:100%;border-radius:50%;background:${p.fill};border:${p.strokeWidth}px solid ${p.stroke};"></div>
  </div>`;
}
```

**line.js:**

```javascript
const STYLES = ['solid', 'dashed', 'dotted'];

export function defaults() {
  return { strokeWidth: 1, color: '#DDDDDD', style: 'solid' };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const lineStyle = STYLES.includes(p.style) ? p.style : 'solid';
  return `<div style="width:100%;height:100%;display:flex;align-items:center;">
    <div style="width:100%;border-top:${p.strokeWidth}px ${lineStyle} ${p.color};"></div>
  </div>`;
}
```

**Tests** — add to `tests/renderer/components.test.js`:

```javascript
describe('circle component', () => {
  it('renders with border-radius 50%', () => {
    const { render, defaults } = getComponent('circle');
    const html = render(defaults());
    assert.ok(html.includes('border-radius:50%'));
  });

  it('applies fill color', () => {
    const { render } = getComponent('circle');
    const html = render({ fill: '#FF0000' });
    assert.ok(html.includes('#FF0000'));
  });
});

describe('line component', () => {
  it('renders border-top for line', () => {
    const { render, defaults } = getComponent('line');
    const html = render(defaults());
    assert.ok(html.includes('border-top'));
  });

  it('applies dashed style', () => {
    const { render } = getComponent('line');
    const html = render({ style: 'dashed' });
    assert.ok(html.includes('dashed'));
  });

  it('falls back to solid for unknown style', () => {
    const { render } = getComponent('line');
    const html = render({ style: 'evil"><script>' });
    assert.ok(html.includes('solid'));
    assert.ok(!html.includes('evil'));
  });
});
```

NOTE: Do NOT register in `index.js` yet — that happens in Task 11 (Component Registry Update) after all components are created.

---

### Task 5: Simple Components — Forms (textarea, checkbox, radio, toggle, select, slider)

**Files:**
- Create: `src/renderer/components/textarea.js`
- Create: `src/renderer/components/checkbox.js`
- Create: `src/renderer/components/radio.js`
- Create: `src/renderer/components/toggle.js`
- Create: `src/renderer/components/select.js`
- Create: `src/renderer/components/slider.js`

**textarea.js:**

```javascript
import { escapeHtml } from './utils.js';

export function defaults() {
  return { placeholder: 'Enter text...', rows: 4, label: null };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const labelHtml = p.label
    ? `<label class="mockup-input-label">${escapeHtml(p.label)}</label>`
    : '';
  return `${labelHtml}<div class="mockup-textarea" style="width:100%;height:100%;padding:8px 12px;border:1px solid var(--color-border,#DDD);border-radius:4px;font-size:14px;color:var(--color-text-placeholder,#999);font-family:inherit;overflow:auto;">${escapeHtml(p.placeholder)}</div>`;
}
```

**checkbox.js:**

```javascript
import { escapeHtml } from './utils.js';

export function defaults() {
  return { label: 'Checkbox', checked: false };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const checkmark = p.checked ? '&#10003;' : '';
  return `<label class="mockup-checkbox">
    <span class="mockup-checkbox__box">${checkmark}</span>
    <span class="mockup-checkbox__label">${escapeHtml(p.label)}</span>
  </label>`;
}
```

**radio.js:**

```javascript
import { escapeHtml } from './utils.js';

export function defaults() {
  return { label: 'Option', selected: false, group: 'default' };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const dot = p.selected ? '<span class="mockup-radio__dot"></span>' : '';
  return `<label class="mockup-radio">
    <span class="mockup-radio__circle">${dot}</span>
    <span class="mockup-radio__label">${escapeHtml(p.label)}</span>
  </label>`;
}
```

**toggle.js:**

```javascript
import { escapeHtml } from './utils.js';

export function defaults() {
  return { label: 'Toggle', on: false };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const cls = p.on ? 'mockup-toggle mockup-toggle--on' : 'mockup-toggle';
  const labelHtml = p.label
    ? `<span class="mockup-toggle__label">${escapeHtml(p.label)}</span>`
    : '';
  return `<label class="${cls}">
    <span class="mockup-toggle__track"><span class="mockup-toggle__thumb"></span></span>
    ${labelHtml}
  </label>`;
}
```

**select.js:**

```javascript
import { escapeHtml } from './utils.js';

export function defaults() {
  return { options: ['Option 1', 'Option 2', 'Option 3'], placeholder: 'Select...', selected: null, label: null };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const opts = Array.isArray(p.options) ? p.options : [];
  const display = p.selected || p.placeholder;
  const labelHtml = p.label
    ? `<label class="mockup-input-label">${escapeHtml(p.label)}</label>`
    : '';
  const optionsHtml = opts.map(o =>
    `<div class="mockup-select__option">${escapeHtml(String(o))}</div>`
  ).join('');
  return `${labelHtml}<div class="mockup-select">
    <div class="mockup-select__trigger">${escapeHtml(String(display))}<span class="mockup-select__arrow">&#9662;</span></div>
  </div>`;
}
```

**slider.js:**

```javascript
export function defaults() {
  return { min: 0, max: 100, value: 50, label: null };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const pct = Math.max(0, Math.min(100, ((p.value - p.min) / (p.max - p.min)) * 100));
  const labelHtml = p.label
    ? `<label class="mockup-input-label">${String(p.label).replace(/</g, '&lt;')}</label>`
    : '';
  return `${labelHtml}<div class="mockup-slider">
    <div class="mockup-slider__track">
      <div class="mockup-slider__fill" style="width:${pct}%"></div>
      <div class="mockup-slider__thumb" style="left:${pct}%"></div>
    </div>
  </div>`;
}
```

**Tests** — add describe blocks per component to `tests/renderer/components.test.js`. Each component needs:
1. Default render returns non-empty HTML (covered by generic contract test after registry update)
2. Component-specific behavior test
3. XSS test for all text props

Example tests to add:

```javascript
describe('textarea component', () => {
  it('renders placeholder text', () => {
    const { render, defaults } = getComponent('textarea');
    const html = render({ ...defaults(), placeholder: 'Type here' });
    assert.ok(html.includes('Type here'));
  });
  it('renders label when provided', () => {
    const { render } = getComponent('textarea');
    const html = render({ placeholder: 'x', label: 'Bio' });
    assert.ok(html.includes('Bio'));
    assert.ok(html.includes('mockup-input-label'));
  });
  it('escapes HTML in placeholder', () => {
    const { render } = getComponent('textarea');
    const html = render({ placeholder: '<script>xss</script>' });
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});

describe('checkbox component', () => {
  it('renders label text', () => {
    const { render, defaults } = getComponent('checkbox');
    const html = render({ ...defaults(), label: 'Accept Terms' });
    assert.ok(html.includes('Accept Terms'));
    assert.ok(html.includes('mockup-checkbox'));
  });
  it('shows checkmark when checked', () => {
    const { render } = getComponent('checkbox');
    const html = render({ label: 'Check', checked: true });
    assert.ok(html.includes('&#10003;'));
  });
  it('escapes HTML in label', () => {
    const { render } = getComponent('checkbox');
    const html = render({ label: '<img src=x>' });
    assert.ok(!html.includes('<img'));
  });
});

describe('radio component', () => {
  it('renders label text', () => {
    const { render, defaults } = getComponent('radio');
    const html = render({ ...defaults(), label: 'Option A' });
    assert.ok(html.includes('Option A'));
    assert.ok(html.includes('mockup-radio'));
  });
  it('shows dot when selected', () => {
    const { render } = getComponent('radio');
    const html = render({ label: 'Opt', selected: true });
    assert.ok(html.includes('mockup-radio__dot'));
  });
});

describe('toggle component', () => {
  it('renders toggle track and thumb', () => {
    const { render, defaults } = getComponent('toggle');
    const html = render(defaults());
    assert.ok(html.includes('mockup-toggle__track'));
    assert.ok(html.includes('mockup-toggle__thumb'));
  });
  it('adds on class when on is true', () => {
    const { render } = getComponent('toggle');
    const html = render({ label: 'Dark mode', on: true });
    assert.ok(html.includes('mockup-toggle--on'));
  });
  it('escapes label', () => {
    const { render } = getComponent('toggle');
    const html = render({ label: '<script>x</script>' });
    assert.ok(!html.includes('<script>'));
  });
});

describe('select component', () => {
  it('renders trigger with placeholder', () => {
    const { render, defaults } = getComponent('select');
    const html = render(defaults());
    assert.ok(html.includes('Select...'));
    assert.ok(html.includes('mockup-select'));
  });
  it('renders selected value in trigger', () => {
    const { render } = getComponent('select');
    const html = render({ options: ['A', 'B'], selected: 'B', placeholder: 'Pick' });
    assert.ok(html.includes('B'));
  });
  it('escapes HTML in options', () => {
    const { render } = getComponent('select');
    const html = render({ selected: '<img src=x>' });
    assert.ok(!html.includes('<img'));
  });
});

describe('slider component', () => {
  it('renders slider track and thumb', () => {
    const { render, defaults } = getComponent('slider');
    const html = render(defaults());
    assert.ok(html.includes('mockup-slider__track'));
    assert.ok(html.includes('mockup-slider__thumb'));
  });
  it('calculates fill percentage correctly', () => {
    const { render } = getComponent('slider');
    const html = render({ min: 0, max: 100, value: 75 });
    assert.ok(html.includes('width:75%'));
  });
  it('clamps fill to 0-100%', () => {
    const { render } = getComponent('slider');
    const html = render({ min: 0, max: 100, value: 200 });
    assert.ok(html.includes('width:100%'));
  });
});
```

---

### Task 6: Simple Components — Navigation (sidebar, breadcrumb)

**Files:**
- Create: `src/renderer/components/sidebar.js`
- Create: `src/renderer/components/breadcrumb.js`

**sidebar.js:**

```javascript
import { render as renderIcon } from './icon.js';
import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    items: [
      { icon: 'home', label: 'Home', active: true },
      { icon: 'search', label: 'Search' },
      { icon: 'settings', label: 'Settings' },
    ],
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const items = Array.isArray(p.items) ? p.items : [];
  const itemsHtml = items.map(item => {
    const cls = item.active ? 'mockup-sidebar__item mockup-sidebar__item--active' : 'mockup-sidebar__item';
    const iconHtml = item.icon ? renderIcon({ name: item.icon, size: 20, color: item.active ? '#333333' : '#666666' }) : '';
    return `<div class="${cls}">${iconHtml}<span>${escapeHtml(String(item.label || ''))}</span></div>`;
  }).join('');
  return `<nav class="mockup-sidebar">${itemsHtml}</nav>`;
}
```

**breadcrumb.js:**

```javascript
import { escapeHtml } from './utils.js';

export function defaults() {
  return { items: ['Home', 'Products', 'Detail'] };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const items = Array.isArray(p.items) ? p.items : [];
  const html = items.map((item, i) => {
    const isLast = i === items.length - 1;
    const sep = isLast ? '' : '<span class="mockup-breadcrumb__sep">/</span>';
    const cls = isLast ? 'mockup-breadcrumb__item mockup-breadcrumb__item--current' : 'mockup-breadcrumb__item';
    return `<span class="${cls}">${escapeHtml(String(item))}</span>${sep}`;
  }).join('');
  return `<nav class="mockup-breadcrumb">${html}</nav>`;
}
```

**Tests** — add to `tests/renderer/components.test.js`:

```javascript
describe('sidebar component', () => {
  it('renders sidebar items', () => {
    const { render, defaults } = getComponent('sidebar');
    const html = render(defaults());
    assert.ok(html.includes('Home'));
    assert.ok(html.includes('mockup-sidebar'));
  });
  it('applies active class', () => {
    const { render } = getComponent('sidebar');
    const html = render({ items: [{ label: 'Home', active: true }] });
    assert.ok(html.includes('mockup-sidebar__item--active'));
  });
  it('escapes item labels', () => {
    const { render } = getComponent('sidebar');
    const html = render({ items: [{ label: '<script>x</script>' }] });
    assert.ok(!html.includes('<script>'));
  });
});

describe('breadcrumb component', () => {
  it('renders breadcrumb items with separators', () => {
    const { render, defaults } = getComponent('breadcrumb');
    const html = render(defaults());
    assert.ok(html.includes('Home'));
    assert.ok(html.includes('/'));
    assert.ok(html.includes('mockup-breadcrumb'));
  });
  it('marks last item as current', () => {
    const { render } = getComponent('breadcrumb');
    const html = render({ items: ['A', 'B'] });
    assert.ok(html.includes('mockup-breadcrumb__item--current'));
  });
  it('escapes items', () => {
    const { render } = getComponent('breadcrumb');
    const html = render({ items: ['<img src=x>'] });
    assert.ok(!html.includes('<img'));
  });
});
```

---

### Task 7: Simple Components — Data (table, avatar, badge, chip)

**Files:**
- Create: `src/renderer/components/table.js`
- Create: `src/renderer/components/avatar.js`
- Create: `src/renderer/components/badge.js`
- Create: `src/renderer/components/chip.js`

**table.js:**

```javascript
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

  const thHtml = headers.map(h => `<th class="mockup-table__th">${escapeHtml(String(h))}</th>`).join('');
  const trHtml = rows.map((row, i) => {
    const cells = Array.isArray(row) ? row : [];
    const cls = p.striped && i % 2 === 1 ? 'mockup-table__row mockup-table__row--striped' : 'mockup-table__row';
    return `<tr class="${cls}">${cells.map(c => `<td class="mockup-table__td">${escapeHtml(String(c))}</td>`).join('')}</tr>`;
  }).join('');

  return `<table class="mockup-table"><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table>`;
}
```

**avatar.js:**

```javascript
import { escapeHtml } from './utils.js';

const SIZES = { sm: 32, md: 40, lg: 56 };

export function defaults() {
  return { initials: 'U', size: 'md', src: null };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const px = SIZES[p.size] || SIZES.md;
  const content = p.initials ? escapeHtml(String(p.initials).slice(0, 2).toUpperCase()) : '';
  return `<div class="mockup-avatar" style="width:${px}px;height:${px}px;border-radius:50%;background:var(--color-bg-light,#F5F5F5);border:1px solid var(--color-border,#DDD);display:flex;align-items:center;justify-content:center;font-size:${Math.round(px * 0.4)}px;font-weight:600;color:var(--color-text-secondary,#666);">${content}</div>`;
}
```

**badge.js:**

```javascript
import { escapeHtml } from './utils.js';

const COLORS = {
  default: { bg: '#F5F5F5', fg: '#666666', border: '#DDDDDD' },
  blue:    { bg: '#E3F2FD', fg: '#1565C0', border: '#90CAF9' },
  green:   { bg: '#E8F5E9', fg: '#2E7D32', border: '#A5D6A7' },
  red:     { bg: '#FFEBEE', fg: '#C62828', border: '#EF9A9A' },
  yellow:  { bg: '#FFF8E1', fg: '#F57F17', border: '#FFE082' },
};

export function defaults() {
  return { label: 'Badge', color: 'default' };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const c = COLORS[p.color] || COLORS.default;
  return `<span class="mockup-badge" style="background:${c.bg};color:${c.fg};border-color:${c.border};">${escapeHtml(String(p.label))}</span>`;
}
```

**chip.js:**

```javascript
import { escapeHtml } from './utils.js';

export function defaults() {
  return { label: 'Chip', removable: false, selected: false };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const cls = p.selected ? 'mockup-chip mockup-chip--selected' : 'mockup-chip';
  const removeHtml = p.removable ? '<span class="mockup-chip__remove">&times;</span>' : '';
  return `<span class="${cls}">${escapeHtml(String(p.label))}${removeHtml}</span>`;
}
```

**Tests** — add to `tests/renderer/components.test.js`:

```javascript
describe('table component', () => {
  it('renders headers and rows', () => {
    const { render, defaults } = getComponent('table');
    const html = render(defaults());
    assert.ok(html.includes('Name'));
    assert.ok(html.includes('john@example.com'));
    assert.ok(html.includes('mockup-table'));
  });
  it('applies striped class on odd rows', () => {
    const { render } = getComponent('table');
    const html = render({ headers: ['A'], rows: [['1'], ['2']], striped: true });
    assert.ok(html.includes('mockup-table__row--striped'));
  });
  it('escapes cell content', () => {
    const { render } = getComponent('table');
    const html = render({ headers: ['<script>'], rows: [['<img src=x>']] });
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img'));
  });
});

describe('avatar component', () => {
  it('renders initials', () => {
    const { render } = getComponent('avatar');
    const html = render({ initials: 'JD' });
    assert.ok(html.includes('JD'));
    assert.ok(html.includes('mockup-avatar'));
  });
  it('truncates initials to 2 chars', () => {
    const { render } = getComponent('avatar');
    const html = render({ initials: 'ABCD' });
    assert.ok(html.includes('AB'));
    assert.ok(!html.includes('ABCD'));
  });
});

describe('badge component', () => {
  it('renders label with default color', () => {
    const { render, defaults } = getComponent('badge');
    const html = render(defaults());
    assert.ok(html.includes('Badge'));
    assert.ok(html.includes('mockup-badge'));
  });
  it('applies color scheme', () => {
    const { render } = getComponent('badge');
    const html = render({ label: 'Error', color: 'red' });
    assert.ok(html.includes('#C62828'));
  });
  it('escapes label', () => {
    const { render } = getComponent('badge');
    const html = render({ label: '<script>x</script>' });
    assert.ok(!html.includes('<script>'));
  });
});

describe('chip component', () => {
  it('renders label', () => {
    const { render, defaults } = getComponent('chip');
    const html = render(defaults());
    assert.ok(html.includes('Chip'));
    assert.ok(html.includes('mockup-chip'));
  });
  it('shows remove button when removable', () => {
    const { render } = getComponent('chip');
    const html = render({ label: 'Tag', removable: true });
    assert.ok(html.includes('mockup-chip__remove'));
  });
  it('applies selected class', () => {
    const { render } = getComponent('chip');
    const html = render({ label: 'Tag', selected: true });
    assert.ok(html.includes('mockup-chip--selected'));
  });
});
```

---

### Task 8: Simple Components — Feedback (alert, modal, skeleton, progress, tooltip)

**Files:**
- Create: `src/renderer/components/alert.js`
- Create: `src/renderer/components/modal.js`
- Create: `src/renderer/components/skeleton.js`
- Create: `src/renderer/components/progress.js`
- Create: `src/renderer/components/tooltip.js`

**alert.js:**

```javascript
import { escapeHtml } from './utils.js';

const TYPES = ['info', 'success', 'warning', 'error'];

export function defaults() {
  return { message: 'This is an alert message.', type: 'info' };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const alertType = TYPES.includes(p.type) ? p.type : 'info';
  return `<div class="mockup-alert mockup-alert--${alertType}">${escapeHtml(String(p.message))}</div>`;
}
```

**modal.js:**

```javascript
import { escapeHtml } from './utils.js';
import { render as renderButton } from './button.js';

export function defaults() {
  return {
    title: 'Modal Title',
    content: 'Modal content goes here.',
    actions: ['Cancel', 'Confirm'],
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const actions = Array.isArray(p.actions) ? p.actions : [];
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
```

**skeleton.js:**

```javascript
const VARIANTS = ['text', 'circle', 'rectangle'];

export function defaults() {
  return { variant: 'text' };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const variant = VARIANTS.includes(p.variant) ? p.variant : 'text';
  return `<div class="mockup-skeleton mockup-skeleton--${variant}"></div>`;
}
```

**progress.js:**

```javascript
export function defaults() {
  return { value: 50, max: 100 };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const pct = Math.max(0, Math.min(100, (p.value / p.max) * 100));
  return `<div class="mockup-progress">
    <div class="mockup-progress__bar" style="width:${pct}%"></div>
  </div>`;
}
```

**tooltip.js:**

```javascript
import { escapeHtml } from './utils.js';

const POSITIONS = ['top', 'bottom', 'left', 'right'];

export function defaults() {
  return { content: 'Tooltip text', position: 'top' };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const pos = POSITIONS.includes(p.position) ? p.position : 'top';
  return `<div class="mockup-tooltip mockup-tooltip--${pos}">
    <div class="mockup-tooltip__content">${escapeHtml(String(p.content))}</div>
  </div>`;
}
```

**Tests** — add to `tests/renderer/components.test.js`:

```javascript
describe('alert component', () => {
  it('renders message with type class', () => {
    const { render, defaults } = getComponent('alert');
    const html = render(defaults());
    assert.ok(html.includes('alert message'));
    assert.ok(html.includes('mockup-alert--info'));
  });
  it('falls back to info for unknown type', () => {
    const { render } = getComponent('alert');
    const html = render({ message: 'test', type: 'evil' });
    assert.ok(html.includes('mockup-alert--info'));
    assert.ok(!html.includes('evil'));
  });
  it('escapes message', () => {
    const { render } = getComponent('alert');
    const html = render({ message: '<script>x</script>' });
    assert.ok(!html.includes('<script>'));
  });
});

describe('modal component', () => {
  it('renders title, content, and action buttons', () => {
    const { render, defaults } = getComponent('modal');
    const html = render(defaults());
    assert.ok(html.includes('Modal Title'));
    assert.ok(html.includes('Modal content'));
    assert.ok(html.includes('Cancel'));
    assert.ok(html.includes('Confirm'));
    assert.ok(html.includes('mockup-modal'));
  });
  it('escapes title and content', () => {
    const { render } = getComponent('modal');
    const html = render({ title: '<img src=x>', content: '<script>x</script>' });
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('<script>'));
  });
});

describe('skeleton component', () => {
  it('renders skeleton with variant class', () => {
    const { render, defaults } = getComponent('skeleton');
    const html = render(defaults());
    assert.ok(html.includes('mockup-skeleton--text'));
  });
  it('applies circle variant', () => {
    const { render } = getComponent('skeleton');
    const html = render({ variant: 'circle' });
    assert.ok(html.includes('mockup-skeleton--circle'));
  });
  it('falls back to text for unknown variant', () => {
    const { render } = getComponent('skeleton');
    const html = render({ variant: 'evil' });
    assert.ok(html.includes('mockup-skeleton--text'));
  });
});

describe('progress component', () => {
  it('renders progress bar with percentage', () => {
    const { render } = getComponent('progress');
    const html = render({ value: 75, max: 100 });
    assert.ok(html.includes('width:75%'));
    assert.ok(html.includes('mockup-progress'));
  });
  it('clamps to 100%', () => {
    const { render } = getComponent('progress');
    const html = render({ value: 150, max: 100 });
    assert.ok(html.includes('width:100%'));
  });
});

describe('tooltip component', () => {
  it('renders tooltip content with position', () => {
    const { render, defaults } = getComponent('tooltip');
    const html = render(defaults());
    assert.ok(html.includes('Tooltip text'));
    assert.ok(html.includes('mockup-tooltip--top'));
  });
  it('escapes content', () => {
    const { render } = getComponent('tooltip');
    const html = render({ content: '<script>x</script>' });
    assert.ok(!html.includes('<script>'));
  });
});
```

---

### Task 9: Composite Components (login_form, search_bar, header, footer, data_table, chart_placeholder)

**Files:**
- Create: `src/renderer/components/login_form.js`
- Create: `src/renderer/components/search_bar.js`
- Create: `src/renderer/components/header.js`
- Create: `src/renderer/components/footer.js`
- Create: `src/renderer/components/data_table.js`
- Create: `src/renderer/components/chart_placeholder.js`

**login_form.js:**

```javascript
import { render as renderInput } from './input.js';
import { render as renderButton } from './button.js';
import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    title: 'Sign In',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    buttonLabel: 'Sign In',
    showForgotPassword: true,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const forgotHtml = p.showForgotPassword
    ? `<div class="mockup-login__forgot">Forgot password?</div>`
    : '';

  return `<div class="mockup-login">
    <h2 class="mockup-login__title">${escapeHtml(String(p.title))}</h2>
    <div class="mockup-login__field">${renderInput({ label: p.emailLabel, placeholder: 'email@example.com', type: 'email', _style: p._style })}</div>
    <div class="mockup-login__field">${renderInput({ label: p.passwordLabel, placeholder: '********', type: 'password', _style: p._style })}</div>
    ${forgotHtml}
    <div class="mockup-login__action">${renderButton({ label: p.buttonLabel, variant: 'primary', size: 'lg', _style: p._style })}</div>
  </div>`;
}
```

**search_bar.js:**

```javascript
import { render as renderIcon } from './icon.js';
import { escapeHtml } from './utils.js';

export function defaults() {
  return { placeholder: 'Search...', icon: 'search' };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  return `<div class="mockup-search-bar">
    <span class="mockup-search-bar__icon">${renderIcon({ name: p.icon, size: 18, color: '#999999' })}</span>
    <span class="mockup-search-bar__input">${escapeHtml(String(p.placeholder))}</span>
  </div>`;
}
```

**header.js:**

```javascript
import { render as renderIcon } from './icon.js';
import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    logo: 'App',
    nav: ['Home', 'About', 'Contact'],
    rightIcon: 'user',
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const navItems = Array.isArray(p.nav) ? p.nav : [];
  const navHtml = navItems.map(item => `<span class="mockup-header__nav-item">${escapeHtml(String(item))}</span>`).join('');
  const rightHtml = p.rightIcon
    ? `<span class="mockup-header__right">${renderIcon({ name: p.rightIcon, size: 20, color: '#333333' })}</span>`
    : '';

  return `<header class="mockup-header">
    <span class="mockup-header__logo">${escapeHtml(String(p.logo))}</span>
    <nav class="mockup-header__nav">${navHtml}</nav>
    ${rightHtml}
  </header>`;
}
```

**footer.js:**

```javascript
import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    text: '2026 App Inc. All rights reserved.',
    links: ['Privacy', 'Terms', 'Contact'],
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const links = Array.isArray(p.links) ? p.links : [];
  const linksHtml = links.map(l => `<span class="mockup-footer__link">${escapeHtml(String(l))}</span>`).join('');

  return `<footer class="mockup-footer">
    <div class="mockup-footer__links">${linksHtml}</div>
    <div class="mockup-footer__text">${escapeHtml(String(p.text))}</div>
  </footer>`;
}
```

**data_table.js:**

```javascript
import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    headers: ['Name', 'Status', 'Date', 'Actions'],
    rows: [
      ['Project Alpha', 'Active', '2026-01-15', 'Edit'],
      ['Project Beta', 'Paused', '2026-02-01', 'Edit'],
    ],
    showSearch: true,
    showPagination: true,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const headers = Array.isArray(p.headers) ? p.headers : [];
  const rows = Array.isArray(p.rows) ? p.rows : [];

  const searchHtml = p.showSearch
    ? `<div class="mockup-data-table__toolbar"><div class="mockup-data-table__search">Search...</div></div>`
    : '';

  const thHtml = headers.map(h =>
    `<th class="mockup-data-table__th">${escapeHtml(String(h))}<span class="mockup-data-table__sort">&#9650;</span></th>`
  ).join('');

  const trHtml = rows.map(row => {
    const cells = Array.isArray(row) ? row : [];
    return `<tr class="mockup-data-table__row">${cells.map(c => `<td class="mockup-data-table__td">${escapeHtml(String(c))}</td>`).join('')}</tr>`;
  }).join('');

  const paginationHtml = p.showPagination
    ? `<div class="mockup-data-table__pagination"><span>1-${rows.length} of ${rows.length}</span><span class="mockup-data-table__page-btn">&lt;</span><span class="mockup-data-table__page-btn">&gt;</span></div>`
    : '';

  return `<div class="mockup-data-table">
    ${searchHtml}
    <table class="mockup-table"><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table>
    ${paginationHtml}
  </div>`;
}
```

**chart_placeholder.js:**

```javascript
import { escapeHtml } from './utils.js';

const CHART_TYPES = ['bar', 'line', 'pie', 'donut'];

export function defaults() {
  return { type: 'bar', title: null };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const chartType = CHART_TYPES.includes(p.type) ? p.type : 'bar';
  const titleHtml = p.title
    ? `<div class="mockup-chart__title">${escapeHtml(String(p.title))}</div>`
    : '';

  const icon = chartType === 'pie' || chartType === 'donut'
    ? `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="#CCC" stroke-width="2"/><path d="M24 4 A20 20 0 0 1 44 24 L24 24 Z" fill="#DDD"/></svg>`
    : chartType === 'line'
    ? `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><polyline points="4,40 16,20 28,30 44,8" stroke="#CCC" stroke-width="2" fill="none"/></svg>`
    : `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="4" y="24" width="8" height="20" fill="#DDD"/><rect x="16" y="16" width="8" height="28" fill="#CCC"/><rect x="28" y="8" width="8" height="36" fill="#DDD"/><rect x="40" y="20" width="4" height="24" fill="#CCC"/></svg>`;

  return `<div class="mockup-chart">
    ${titleHtml}
    <div class="mockup-chart__body">${icon}<div class="mockup-chart__label">${escapeHtml(chartType)} chart</div></div>
  </div>`;
}
```

**Tests** — add to `tests/renderer/components.test.js`:

```javascript
describe('login_form component', () => {
  it('renders title, inputs, and button', () => {
    const { render, defaults } = getComponent('login_form');
    const html = render(defaults());
    assert.ok(html.includes('Sign In'));
    assert.ok(html.includes('mockup-login'));
    assert.ok(html.includes('mockup-input'));
    assert.ok(html.includes('mockup-button'));
  });
  it('renders forgot password link by default', () => {
    const { render, defaults } = getComponent('login_form');
    const html = render(defaults());
    assert.ok(html.includes('Forgot password'));
  });
  it('hides forgot password when disabled', () => {
    const { render } = getComponent('login_form');
    const html = render({ showForgotPassword: false });
    assert.ok(!html.includes('Forgot password'));
  });
  it('escapes title', () => {
    const { render } = getComponent('login_form');
    const html = render({ title: '<script>x</script>' });
    assert.ok(!html.includes('<script>'));
  });
});

describe('search_bar component', () => {
  it('renders search input with icon', () => {
    const { render, defaults } = getComponent('search_bar');
    const html = render(defaults());
    assert.ok(html.includes('Search...'));
    assert.ok(html.includes('mockup-search-bar'));
    assert.ok(html.includes('<svg'));
  });
  it('escapes placeholder', () => {
    const { render } = getComponent('search_bar');
    const html = render({ placeholder: '<img src=x>' });
    assert.ok(!html.includes('<img'));
  });
});

describe('header component', () => {
  it('renders logo and nav items', () => {
    const { render, defaults } = getComponent('header');
    const html = render(defaults());
    assert.ok(html.includes('App'));
    assert.ok(html.includes('Home'));
    assert.ok(html.includes('mockup-header'));
  });
  it('escapes nav items', () => {
    const { render } = getComponent('header');
    const html = render({ logo: 'X', nav: ['<script>x</script>'] });
    assert.ok(!html.includes('<script>'));
  });
});

describe('footer component', () => {
  it('renders text and links', () => {
    const { render, defaults } = getComponent('footer');
    const html = render(defaults());
    assert.ok(html.includes('2026'));
    assert.ok(html.includes('Privacy'));
    assert.ok(html.includes('mockup-footer'));
  });
  it('escapes text', () => {
    const { render } = getComponent('footer');
    const html = render({ text: '<script>x</script>' });
    assert.ok(!html.includes('<script>'));
  });
});

describe('data_table component', () => {
  it('renders headers, rows, search, and pagination', () => {
    const { render, defaults } = getComponent('data_table');
    const html = render(defaults());
    assert.ok(html.includes('Name'));
    assert.ok(html.includes('Project Alpha'));
    assert.ok(html.includes('mockup-data-table'));
    assert.ok(html.includes('Search...'));
  });
  it('escapes cell content', () => {
    const { render } = getComponent('data_table');
    const html = render({ headers: ['<img>'], rows: [['<script>']] });
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img>'));
  });
});

describe('chart_placeholder component', () => {
  it('renders chart placeholder with type', () => {
    const { render, defaults } = getComponent('chart_placeholder');
    const html = render(defaults());
    assert.ok(html.includes('bar chart'));
    assert.ok(html.includes('mockup-chart'));
    assert.ok(html.includes('<svg'));
  });
  it('renders pie chart SVG', () => {
    const { render } = getComponent('chart_placeholder');
    const html = render({ type: 'pie' });
    assert.ok(html.includes('pie chart'));
  });
  it('falls back to bar for unknown type', () => {
    const { render } = getComponent('chart_placeholder');
    const html = render({ type: 'evil' });
    assert.ok(html.includes('bar chart'));
  });
  it('escapes title', () => {
    const { render } = getComponent('chart_placeholder');
    const html = render({ title: '<script>x</script>' });
    assert.ok(!html.includes('<script>'));
  });
});
```

---

### Task 10: Component Registry Update

**Files:**
- Modify: `src/renderer/components/index.js`

Update the registry to include all 35 components:

```javascript
// Basic
import * as text from './text.js';
import * as rectangle from './rectangle.js';
import * as circle from './circle.js';
import * as line from './line.js';
import * as image from './image.js';
import * as icon from './icon.js';

// Forms
import * as button from './button.js';
import * as input from './input.js';
import * as textarea from './textarea.js';
import * as checkbox from './checkbox.js';
import * as radio from './radio.js';
import * as toggle from './toggle.js';
import * as select from './select.js';
import * as slider from './slider.js';

// Navigation
import * as navbar from './navbar.js';
import * as tabbar from './tabbar.js';
import * as sidebar from './sidebar.js';
import * as breadcrumb from './breadcrumb.js';

// Data
import * as card from './card.js';
import * as list from './list.js';
import * as table from './table.js';
import * as avatar from './avatar.js';
import * as badge from './badge.js';
import * as chip from './chip.js';

// Feedback
import * as alert from './alert.js';
import * as modal from './modal.js';
import * as skeleton from './skeleton.js';
import * as progress from './progress.js';
import * as tooltip from './tooltip.js';

// Composite
import * as login_form from './login_form.js';
import * as search_bar from './search_bar.js';
import * as header from './header.js';
import * as footer from './footer.js';
import * as data_table from './data_table.js';
import * as chart_placeholder from './chart_placeholder.js';

const components = {
  text, rectangle, circle, line, image, icon,
  button, input, textarea, checkbox, radio, toggle, select, slider,
  navbar, tabbar, sidebar, breadcrumb,
  card, list, table, avatar, badge, chip,
  alert, modal, skeleton, progress, tooltip,
  login_form, search_bar, header, footer, data_table, chart_placeholder,
};

export function getComponent(type) {
  return components[type] || null;
}

export function getAvailableTypes() {
  return Object.keys(components);
}
```

Update `tests/renderer/components.test.js`:
- Change registry count test: `assert.strictEqual(getAvailableTypes().length, 35);`
- Update generic contract test to loop over all 35 types: `for (const type of getAvailableTypes())`

---

### Task 11: wireframe.css Extension

**Files:**
- Modify: `src/renderer/styles/wireframe.css`

Add CSS rules for all 25 new components. Append to existing wireframe.css:

```css
/* ── Textarea ──────────────────────────────────────────────────────────── */

.mockup-textarea {
  font-family: inherit;
  line-height: 1.4;
}

/* ── Checkbox ──────────────────────────────────────────────────────────── */

.mockup-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.mockup-checkbox__box {
  width: 18px;
  height: 18px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-text-primary);
  background: var(--color-bg-white);
  flex-shrink: 0;
}

.mockup-checkbox__label {
  color: var(--color-text-primary);
}

/* ── Radio ─────────────────────────────────────────────────────────────── */

.mockup-radio {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.mockup-radio__circle {
  width: 18px;
  height: 18px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-white);
  flex-shrink: 0;
}

.mockup-radio__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-primary);
}

.mockup-radio__label {
  color: var(--color-text-primary);
}

/* ── Toggle ────────────────────────────────────────────────────────────── */

.mockup-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.mockup-toggle__track {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--color-disabled);
  position: relative;
  flex-shrink: 0;
}

.mockup-toggle--on .mockup-toggle__track {
  background: var(--color-text-primary);
}

.mockup-toggle__thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-bg-white);
  position: absolute;
  top: 2px;
  left: 2px;
  transition: left 0.15s;
}

.mockup-toggle--on .mockup-toggle__thumb {
  left: 20px;
}

.mockup-toggle__label {
  color: var(--color-text-primary);
}

/* ── Select ────────────────────────────────────────────────────────────── */

.mockup-select {
  width: 100%;
}

.mockup-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
  color: var(--color-text-placeholder);
  background: var(--color-bg-white);
  cursor: pointer;
}

.mockup-select__arrow {
  font-size: 10px;
  color: var(--color-text-secondary);
}

/* ── Slider ────────────────────────────────────────────────────────────── */

.mockup-slider {
  width: 100%;
  padding: 8px 0;
}

.mockup-slider__track {
  width: 100%;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  position: relative;
}

.mockup-slider__fill {
  height: 100%;
  background: var(--color-text-primary);
  border-radius: 2px;
}

.mockup-slider__thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-text-primary);
  border: 2px solid var(--color-bg-white);
  position: absolute;
  top: -6px;
  transform: translateX(-50%);
}

/* ── Sidebar ───────────────────────────────────────────────────────────── */

.mockup-sidebar {
  width: 100%;
  height: 100%;
  background: var(--color-bg-white);
  border-right: 1px solid var(--color-border);
  padding: 8px 0;
}

.mockup-sidebar__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.mockup-sidebar__item--active {
  color: var(--color-text-primary);
  font-weight: 600;
  background: var(--color-bg-light);
}

/* ── Breadcrumb ────────────────────────────────────────────────────────── */

.mockup-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.mockup-breadcrumb__item {
  color: var(--color-text-secondary);
  cursor: pointer;
}

.mockup-breadcrumb__item--current {
  color: var(--color-text-primary);
  font-weight: 500;
  cursor: default;
}

.mockup-breadcrumb__sep {
  color: var(--color-text-placeholder);
  margin: 0 2px;
}

/* ── Table ─────────────────────────────────────────────────────────────── */

.mockup-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.mockup-table__th {
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  color: var(--color-text-primary);
  border-bottom: 2px solid var(--color-border);
  background: var(--color-bg-light);
}

.mockup-table__td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
}

.mockup-table__row--striped {
  background: var(--color-bg-light);
}

/* ── Avatar ────────────────────────────────────────────────────────────── */

.mockup-avatar {
  flex-shrink: 0;
}

/* ── Chip ──────────────────────────────────────────────────────────────── */

.mockup-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 13px;
  background: var(--color-bg-light);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.mockup-chip--selected {
  background: var(--color-text-primary);
  color: var(--color-bg-white);
  border-color: var(--color-text-primary);
}

.mockup-chip__remove {
  font-size: 14px;
  cursor: pointer;
  color: var(--color-text-secondary);
  line-height: 1;
}

/* ── Modal ─────────────────────────────────────────────────────────────── */

.mockup-modal__backdrop {
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.mockup-modal {
  background: var(--color-bg-white);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  width: 100%;
  max-width: 400px;
  overflow: hidden;
}

.mockup-modal__header {
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border);
}

.mockup-modal__body {
  padding: 16px 20px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.mockup-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
}

/* ── Skeleton ──────────────────────────────────────────────────────────── */

.mockup-skeleton {
  background: var(--color-bg-light);
  border-radius: 4px;
  width: 100%;
  height: 100%;
  animation: mockup-pulse 1.5s ease-in-out infinite;
}

.mockup-skeleton--circle {
  border-radius: 50%;
}

.mockup-skeleton--text {
  height: 16px;
  border-radius: 4px;
}

@keyframes mockup-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Progress ──────────────────────────────────────────────────────────── */

.mockup-progress {
  width: 100%;
  height: 8px;
  background: var(--color-bg-light);
  border-radius: 4px;
  overflow: hidden;
}

.mockup-progress__bar {
  height: 100%;
  background: var(--color-text-primary);
  border-radius: 4px;
}

/* ── Tooltip ───────────────────────────────────────────────────────────── */

.mockup-tooltip {
  position: relative;
  display: inline-block;
}

.mockup-tooltip__content {
  background: var(--color-text-primary);
  color: var(--color-bg-white);
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
}

/* ── Search Bar ────────────────────────────────────────────────────────── */

.mockup-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: var(--color-bg-light);
  width: 100%;
}

.mockup-search-bar__icon {
  display: flex;
  flex-shrink: 0;
}

.mockup-search-bar__input {
  font-size: 14px;
  color: var(--color-text-placeholder);
}

/* ── Login Form ────────────────────────────────────────────────────────── */

.mockup-login {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  width: 100%;
}

.mockup-login__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
  margin-bottom: 8px;
}

.mockup-login__field {
  width: 100%;
}

.mockup-login__forgot {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: right;
}

.mockup-login__action {
  margin-top: 8px;
}

.mockup-login__action .mockup-button {
  width: 100%;
}

/* ── Header ────────────────────────────────────────────────────────────── */

.mockup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-white);
  width: 100%;
}

.mockup-header__logo {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.mockup-header__nav {
  display: flex;
  gap: 16px;
}

.mockup-header__nav-item {
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.mockup-header__right {
  display: flex;
  align-items: center;
}

/* ── Footer ────────────────────────────────────────────────────────────── */

.mockup-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-light);
  width: 100%;
}

.mockup-footer__links {
  display: flex;
  gap: 16px;
}

.mockup-footer__link {
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.mockup-footer__text {
  font-size: 12px;
  color: var(--color-text-placeholder);
}

/* ── Data Table ────────────────────────────────────────────────────────── */

.mockup-data-table {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

.mockup-data-table__toolbar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.mockup-data-table__search {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  color: var(--color-text-placeholder);
}

.mockup-data-table__th {
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-primary);
  border-bottom: 2px solid var(--color-border);
  background: var(--color-bg-light);
}

.mockup-data-table__sort {
  font-size: 8px;
  margin-left: 4px;
  color: var(--color-text-placeholder);
}

.mockup-data-table__td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
}

.mockup-data-table__row:last-child .mockup-data-table__td {
  border-bottom: none;
}

.mockup-data-table__pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-border);
}

.mockup-data-table__page-btn {
  cursor: pointer;
  padding: 2px 6px;
}

/* ── Chart Placeholder ─────────────────────────────────────────────────── */

.mockup-chart {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-white);
  overflow: hidden;
}

.mockup-chart__title {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border);
}

.mockup-chart__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
}

.mockup-chart__label {
  font-size: 12px;
  color: var(--color-text-placeholder);
  text-transform: capitalize;
}
```

---

### Task 12: material.css

**Files:**
- Modify: `src/renderer/styles/material.css`

Full Material Design 3 stylesheet covering all 35 component types. Uses same CSS class names as wireframe but with Material Design visual properties: blue primary (#1976D2), elevated shadows, 4-12px border-radius, Roboto font stack.

Structure: copy wireframe.css variable block, override values, then copy all component rules and adapt colors/radius/shadows per Material Design 3 spec.

Key differences from wireframe:
- `:root` variables: `--color-primary: #1976D2; --color-btn-primary-bg: #1976D2;`
- Buttons: `border-radius: 20px;` (M3 full-rounded)
- Cards: `box-shadow: 0 1px 3px rgba(0,0,0,0.12);` instead of border
- Inputs: `border-radius: 4px;` with bottom-border emphasis
- Toggle: `--color-primary` for on state
- Font: Roboto fallback to system

---

### Task 13: ios.css

**Files:**
- Modify: `src/renderer/styles/ios.css`

Full iOS HIG stylesheet. Same CSS class names, iOS visual properties: system blue (#007AFF), subtle shadows, 8-12px border-radius, SF Pro fallback font stack.

Key differences from wireframe:
- `:root` variables: `--color-primary: #007AFF; --color-btn-primary-bg: #007AFF;`
- Buttons: `border-radius: 8px;`
- Cards: Grouped inset style (no border, light bg, large radius)
- Inputs: `border-radius: 8px; background: #F2F2F7;`
- Toggle: iOS pill shape with #34C759 green for on state
- Font: `-apple-system, 'SF Pro Display'` fallback

---

### Task 14: Run All Tests + Commit Sprint 1

```bash
node --test tests/**/*.test.js
```

Expected: All tests PASS (original 108 + ~60 new = ~168).

```bash
git add -A
git commit -m "feat: M2a Sprint 1 — 25 new components, material/ios styles, style system"
```

---

## Sprint 2: Integration + Polish

### Task 15: Integration Test — All Styles Render All Components

**Files:**
- Create: `tests/renderer/styles-integration.test.js`

Test that every component renders valid HTML under each of the 3 styles (wireframe, material, ios):

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableTypes, getComponent } from '../../src/renderer/components/index.js';
import { buildScreenHtml } from '../../src/renderer/html-builder.js';
import { getAvailableStyles } from '../../src/renderer/styles/index.js';

describe('all styles x all components integration', () => {
  for (const style of getAvailableStyles()) {
    for (const type of getAvailableTypes()) {
      it(`${style}/${type}: renders in buildScreenHtml without error`, () => {
        const comp = getComponent(type);
        const screen = {
          width: 393,
          height: 852,
          background: '#FFFFFF',
          elements: [{
            type,
            x: 10, y: 10, width: 200, height: 100, z_index: 0,
            properties: comp.defaults(),
          }],
        };
        const html = buildScreenHtml(screen, style);
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.length > 500);
      });
    }
  }
});
```

**Run:**
```bash
node --test tests/renderer/styles-integration.test.js
```
Expected: 105 tests PASS (3 styles x 35 components).

**Commit:**
```bash
git add tests/renderer/styles-integration.test.js
git commit -m "test: integration tests — all styles x all components"
```

---

### Task 16: Update PM Files + Final Commit

**Files:**
- Modify: `PM/tasks/M2.md` (create if not exists)
- Modify: `PM/milestones.md`

Update milestone status and create task tracking file for M2.

**Commit:**
```bash
git add PM/
git commit -m "docs: update M2 task statuses and milestones"
```

---

## Summary

| Sprint | Tasks | New Files | Modified Files | Est. Tests |
|--------|-------|-----------|----------------|------------|
| Sprint 1 | 1-14 | 28 component/style files | 9 existing files | ~60 new |
| Sprint 2 | 15-16 | 1 integration test | 2 PM files | ~105 integration |
| **Total** | 16 | 29 | 11 | ~165 new |
