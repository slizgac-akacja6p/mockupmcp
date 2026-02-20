# M2b Implementation Plan — Templates, Auto-Layout, Export Formats

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add template engine (7 templates), auto-layout engine, and SVG/PDF export to MockupMCP.

**Architecture:** Templates are JS functions `generate(screenWidth, screenHeight, style)` returning element descriptor arrays. Layout engine is a pure function in `src/renderer/layout.js`. SVG/PDF extends existing Puppeteer screenshot module.

**Tech Stack:** Node.js 20, ESM modules, Node test runner, Zod validation, Puppeteer/Express.

**Design doc:** `docs/plans/2026-02-20-m2b-design.md`

---

## Sprint 1: Template System (7 tasks)

### Task 1: Template Registry + Storage Method

**Files:**
- Create: `src/renderer/templates/index.js`
- Modify: `src/storage/project-store.js`
- Create: `tests/renderer/templates.test.js`
- Modify: `tests/storage/project-store.test.js`

**Dependencies:** None

**Step 1: Write template registry tests**

Create `tests/renderer/templates.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTemplate, getAvailableTemplates } from '../../src/renderer/templates/index.js';

describe('template registry', () => {
  it('getAvailableTemplates returns array with all 7 templates', () => {
    const templates = getAvailableTemplates();
    assert.equal(templates.length, 7);
    assert.ok(templates.includes('login'));
    assert.ok(templates.includes('dashboard'));
    assert.ok(templates.includes('settings'));
    assert.ok(templates.includes('list'));
    assert.ok(templates.includes('form'));
    assert.ok(templates.includes('profile'));
    assert.ok(templates.includes('onboarding'));
  });

  it('getTemplate returns object with generate function for valid template', () => {
    const template = getTemplate('login');
    assert.ok(template !== null);
    assert.equal(typeof template.generate, 'function');
  });

  it('getTemplate returns null for unknown template', () => {
    const template = getTemplate('nonexistent');
    assert.equal(template, null);
  });

  it('getTemplate returns object with description for valid template', () => {
    const template = getTemplate('login');
    assert.equal(typeof template.description, 'string');
    assert.ok(template.description.length > 0);
  });

  for (const name of ['login', 'dashboard', 'settings', 'list', 'form', 'profile', 'onboarding']) {
    it(`${name}: generate returns non-empty array of element descriptors`, () => {
      const template = getTemplate(name);
      const elements = template.generate(393, 852, 'wireframe');
      assert.ok(Array.isArray(elements));
      assert.ok(elements.length >= 5, `Expected at least 5 elements, got ${elements.length}`);
    });

    it(`${name}: every element has required fields`, () => {
      const template = getTemplate(name);
      const elements = template.generate(393, 852, 'wireframe');
      for (const el of elements) {
        assert.equal(typeof el.type, 'string', `Missing type in ${name}`);
        assert.equal(typeof el.x, 'number', `Missing x in ${name}`);
        assert.equal(typeof el.y, 'number', `Missing y in ${name}`);
        assert.equal(typeof el.width, 'number', `Missing width in ${name}`);
        assert.equal(typeof el.height, 'number', `Missing height in ${name}`);
        assert.equal(typeof el.z_index, 'number', `Missing z_index in ${name}`);
        assert.ok(el.properties && typeof el.properties === 'object', `Missing properties in ${name}`);
      }
    });

    it(`${name}: all elements fit within screen bounds (393x852)`, () => {
      const template = getTemplate(name);
      const elements = template.generate(393, 852, 'wireframe');
      for (const el of elements) {
        assert.ok(el.x >= 0, `Element x=${el.x} is negative in ${name}`);
        assert.ok(el.y >= 0, `Element y=${el.y} is negative in ${name}`);
        assert.ok(el.x + el.width <= 393 + 1, `Element overflows right in ${name}: x=${el.x} + w=${el.width} > 393`);
        assert.ok(el.y + el.height <= 852 + 1, `Element overflows bottom in ${name}: y=${el.y} + h=${el.height} > 852`);
      }
    });

    it(`${name}: adapts to desktop viewport (1440x900)`, () => {
      const template = getTemplate(name);
      const elements = template.generate(1440, 900, 'wireframe');
      assert.ok(Array.isArray(elements));
      assert.ok(elements.length >= 5);
      for (const el of elements) {
        assert.ok(el.x + el.width <= 1440 + 1, `Element overflows right on desktop in ${name}`);
        assert.ok(el.y + el.height <= 900 + 1, `Element overflows bottom on desktop in ${name}`);
      }
    });
  }
});
```

**Step 2: Write storage method tests**

Add to `tests/storage/project-store.test.js`:

```javascript
describe('applyTemplate', () => {
  it('adds elements to screen from template array', async () => {
    const project = await store.createProject('Template Test');
    const screen = await store.addScreen(project.id, 'Login');

    const elements = [
      { type: 'navbar', x: 0, y: 0, width: 393, height: 56, z_index: 10, properties: { title: 'Sign In' } },
      { type: 'input', x: 24, y: 120, width: 345, height: 56, z_index: 0, properties: { label: 'Email' } },
    ];

    const result = await store.applyTemplate(project.id, screen.id, elements, true);

    assert.equal(result.elements.length, 2);
    assert.ok(result.elements[0].id.startsWith('el_'));
    assert.ok(result.elements[1].id.startsWith('el_'));
    assert.equal(result.elements[0].type, 'navbar');
    assert.equal(result.elements[1].type, 'input');
    assert.deepEqual(result.elements[0].properties, { title: 'Sign In' });
  });

  it('clears existing elements when clear=true', async () => {
    const project = await store.createProject('Template Clear Test');
    const screen = await store.addScreen(project.id, 'Home');
    await store.addElement(project.id, screen.id, 'button', 10, 20, 100, 40, { label: 'Old' });

    const newElements = [
      { type: 'text', x: 0, y: 0, width: 200, height: 30, z_index: 0, properties: { content: 'New' } },
    ];

    const result = await store.applyTemplate(project.id, screen.id, newElements, true);
    assert.equal(result.elements.length, 1);
    assert.equal(result.elements[0].type, 'text');
  });

  it('preserves existing elements when clear=false', async () => {
    const project = await store.createProject('Template Append Test');
    const screen = await store.addScreen(project.id, 'Home');
    await store.addElement(project.id, screen.id, 'button', 10, 20, 100, 40, { label: 'Keep' });

    const newElements = [
      { type: 'text', x: 0, y: 0, width: 200, height: 30, z_index: 0, properties: { content: 'Added' } },
    ];

    const result = await store.applyTemplate(project.id, screen.id, newElements, false);
    assert.equal(result.elements.length, 2);
    assert.equal(result.elements[0].type, 'button');
    assert.equal(result.elements[1].type, 'text');
  });

  it('throws for nonexistent screen', async () => {
    const project = await store.createProject('Template Error Test');
    await assert.rejects(
      () => store.applyTemplate(project.id, 'scr_nonexistent', [], true),
      /not found/i,
    );
  });

  it('generates unique IDs for each element', async () => {
    const project = await store.createProject('Template IDs Test');
    const screen = await store.addScreen(project.id, 'Screen');

    const elements = [
      { type: 'text', x: 0, y: 0, width: 100, height: 30, z_index: 0, properties: {} },
      { type: 'text', x: 0, y: 40, width: 100, height: 30, z_index: 0, properties: {} },
      { type: 'text', x: 0, y: 80, width: 100, height: 30, z_index: 0, properties: {} },
    ];

    const result = await store.applyTemplate(project.id, screen.id, elements, true);
    const ids = result.elements.map(e => e.id);
    const unique = new Set(ids);
    assert.equal(unique.size, ids.length, 'Element IDs must be unique');
  });
});
```

**Step 3: Implement storage method**

In `src/storage/project-store.js`, add after the `duplicateScreen` method (after line 183):

```javascript
async applyTemplate(projectId, screenId, elements, clear = true) {
  this._validateId(screenId);
  const project = await this.getProject(projectId);
  const screen = this._findScreen(project, screenId);

  if (clear) {
    screen.elements = [];
  }

  for (const el of elements) {
    screen.elements.push({
      ...el,
      id: generateId('el'),
    });
  }

  await this._save(project);
  return screen;
}
```

**Step 4: Create template registry (placeholder — no templates imported yet)**

Create `src/renderer/templates/index.js`:

```javascript
// Template registry — same pattern as component registry.
// Each template exports: generate(screenWidth, screenHeight, style) -> element[]
// and description: string.

const templates = {};

export function getTemplate(name) {
  return templates[name] || null;
}

export function getAvailableTemplates() {
  return Object.keys(templates);
}
```

NOTE: Templates will be imported and registered in Tasks 2-4. The registry test for count will fail until Task 5 (final registry update).

**Step 5: Run tests to verify storage method passes**

```bash
node --test tests/storage/project-store.test.js
```

Expected: New `applyTemplate` tests PASS. Registry tests FAIL (0 templates registered — expected).

**Step 6: Commit**

```bash
git add src/renderer/templates/index.js src/storage/project-store.js tests/renderer/templates.test.js tests/storage/project-store.test.js
git commit -m "feat: template registry skeleton + applyTemplate storage method"
```

---

### Task 2: Templates — login, form, onboarding

**Files:**
- Create: `src/renderer/templates/login.js`
- Create: `src/renderer/templates/form.js`
- Create: `src/renderer/templates/onboarding.js`

**Dependencies:** Task 1

**Step 1: Create login template**

Create `src/renderer/templates/login.js`:

```javascript
// Login screen template — classic sign-in page with email/password
export const description = 'Login screen with email/password inputs, sign-in button, and helper links';

export function generate(screenWidth, screenHeight, style) {
  const pad = 24;
  const contentWidth = Math.min(screenWidth - pad * 2, 400);
  const contentX = Math.round((screenWidth - contentWidth) / 2);
  const navH = 56;

  return [
    // Navbar — pinned
    {
      type: 'navbar',
      x: 0, y: 0,
      width: screenWidth, height: navH,
      z_index: 10,
      properties: { title: 'Sign In', leftIcon: 'arrow-left' },
    },
    // Welcome title
    {
      type: 'text',
      x: contentX, y: navH + 48,
      width: contentWidth, height: 36,
      z_index: 0,
      properties: { content: 'Welcome Back', fontSize: 28, fontWeight: 'bold', color: '#333333', align: 'center' },
    },
    // Email input
    {
      type: 'input',
      x: contentX, y: navH + 120,
      width: contentWidth, height: 56,
      z_index: 0,
      properties: { label: 'Email', placeholder: 'email@example.com', type: 'email' },
    },
    // Password input
    {
      type: 'input',
      x: contentX, y: navH + 196,
      width: contentWidth, height: 56,
      z_index: 0,
      properties: { label: 'Password', placeholder: '********', type: 'password' },
    },
    // Sign In button
    {
      type: 'button',
      x: contentX, y: navH + 280,
      width: contentWidth, height: 48,
      z_index: 0,
      properties: { label: 'Sign In', variant: 'primary', size: 'lg' },
    },
    // Forgot password link
    {
      type: 'text',
      x: contentX, y: navH + 344,
      width: contentWidth, height: 20,
      z_index: 0,
      properties: { content: 'Forgot password?', fontSize: 14, color: '#666666', align: 'center' },
    },
    // Divider
    {
      type: 'text',
      x: contentX, y: navH + 392,
      width: contentWidth, height: 20,
      z_index: 0,
      properties: { content: 'or', fontSize: 14, color: '#999999', align: 'center' },
    },
    // Sign up link
    {
      type: 'text',
      x: contentX, y: navH + 432,
      width: contentWidth, height: 20,
      z_index: 0,
      properties: { content: 'Don\'t have an account? Sign Up', fontSize: 14, color: '#666666', align: 'center' },
    },
  ];
}
```

**Step 2: Create form template**

Create `src/renderer/templates/form.js`:

```javascript
// Multi-field form template — data entry form with various input types
export const description = 'Data entry form with text inputs, select, textarea, and submit button';

export function generate(screenWidth, screenHeight, style) {
  const pad = 24;
  const contentWidth = Math.min(screenWidth - pad * 2, 500);
  const contentX = Math.round((screenWidth - contentWidth) / 2);
  const navH = 56;
  const fieldH = 56;
  const gap = 16;

  let y = navH + 24;

  const elements = [
    // Navbar — pinned
    {
      type: 'navbar',
      x: 0, y: 0,
      width: screenWidth, height: navH,
      z_index: 10,
      properties: { title: 'New Entry', leftIcon: 'arrow-left' },
    },
    // Form title
    {
      type: 'text',
      x: contentX, y,
      width: contentWidth, height: 30,
      z_index: 0,
      properties: { content: 'Create New Entry', fontSize: 20, fontWeight: 'bold', color: '#333333', align: 'left' },
    },
  ];
  y += 30 + gap;

  // Name input
  elements.push({
    type: 'input',
    x: contentX, y,
    width: contentWidth, height: fieldH,
    z_index: 0,
    properties: { label: 'Name', placeholder: 'Enter full name', type: 'text' },
  });
  y += fieldH + gap;

  // Email input
  elements.push({
    type: 'input',
    x: contentX, y,
    width: contentWidth, height: fieldH,
    z_index: 0,
    properties: { label: 'Email', placeholder: 'email@example.com', type: 'email' },
  });
  y += fieldH + gap;

  // Phone input
  elements.push({
    type: 'input',
    x: contentX, y,
    width: contentWidth, height: fieldH,
    z_index: 0,
    properties: { label: 'Phone', placeholder: '+1 (555) 000-0000', type: 'text' },
  });
  y += fieldH + gap;

  // Category select
  elements.push({
    type: 'select',
    x: contentX, y,
    width: contentWidth, height: fieldH,
    z_index: 0,
    properties: { label: 'Category', placeholder: 'Select category...', options: ['General', 'Business', 'Personal', 'Other'] },
  });
  y += fieldH + gap;

  // Description textarea
  elements.push({
    type: 'textarea',
    x: contentX, y,
    width: contentWidth, height: 100,
    z_index: 0,
    properties: { label: 'Description', placeholder: 'Enter description...' },
  });
  y += 100 + gap + 8;

  // Submit button
  elements.push({
    type: 'button',
    x: contentX, y,
    width: contentWidth, height: 48,
    z_index: 0,
    properties: { label: 'Submit', variant: 'primary', size: 'lg' },
  });

  return elements;
}
```

**Step 3: Create onboarding template**

Create `src/renderer/templates/onboarding.js`:

```javascript
// Onboarding/welcome slide template — first-run experience screen
export const description = 'Onboarding slide with illustration, title, description, progress indicator, and action buttons';

export function generate(screenWidth, screenHeight, style) {
  const pad = 32;
  const contentWidth = Math.min(screenWidth - pad * 2, 400);
  const contentX = Math.round((screenWidth - contentWidth) / 2);

  // Center content vertically in screen
  const imageH = Math.round(screenHeight * 0.3);
  const startY = Math.round(screenHeight * 0.08);

  return [
    // Illustration placeholder (large, centered)
    {
      type: 'image',
      x: contentX, y: startY,
      width: contentWidth, height: imageH,
      z_index: 0,
      properties: { placeholder: true },
    },
    // Title
    {
      type: 'text',
      x: contentX, y: startY + imageH + 32,
      width: contentWidth, height: 36,
      z_index: 0,
      properties: { content: 'Welcome to App', fontSize: 28, fontWeight: 'bold', color: '#333333', align: 'center' },
    },
    // Description paragraph
    {
      type: 'text',
      x: contentX, y: startY + imageH + 80,
      width: contentWidth, height: 60,
      z_index: 0,
      properties: { content: 'Discover powerful features that help you get things done faster and more efficiently.', fontSize: 16, color: '#666666', align: 'center' },
    },
    // Progress indicator (step 1 of 3)
    {
      type: 'progress',
      x: contentX + Math.round(contentWidth * 0.25), y: startY + imageH + 164,
      width: Math.round(contentWidth * 0.5), height: 8,
      z_index: 0,
      properties: { value: 33, max: 100 },
    },
    // Continue button
    {
      type: 'button',
      x: contentX, y: screenHeight - 120,
      width: contentWidth, height: 48,
      z_index: 0,
      properties: { label: 'Continue', variant: 'primary', size: 'lg' },
    },
    // Skip link
    {
      type: 'text',
      x: contentX, y: screenHeight - 60,
      width: contentWidth, height: 20,
      z_index: 0,
      properties: { content: 'Skip', fontSize: 14, color: '#999999', align: 'center' },
    },
    // Page dots (decorative text to indicate multi-step)
    {
      type: 'text',
      x: contentX, y: startY + imageH + 184,
      width: contentWidth, height: 20,
      z_index: 0,
      properties: { content: 'Step 1 of 3', fontSize: 12, color: '#999999', align: 'center' },
    },
  ];
}
```

**Step 4: Run template-specific tests (these will pass once registry is updated in Task 5)**

At this point templates are created but not registered. Verify file syntax:

```bash
node -e "import('./src/renderer/templates/login.js').then(m => console.error('login OK:', m.generate(393, 852, 'wireframe').length))"
node -e "import('./src/renderer/templates/form.js').then(m => console.error('form OK:', m.generate(393, 852, 'wireframe').length))"
node -e "import('./src/renderer/templates/onboarding.js').then(m => console.error('onboarding OK:', m.generate(393, 852, 'wireframe').length))"
```

Expected: Each prints element count to stderr without error.

**Step 5: Commit**

```bash
git add src/renderer/templates/login.js src/renderer/templates/form.js src/renderer/templates/onboarding.js
git commit -m "feat: login, form, onboarding templates"
```

---

### Task 3: Templates — dashboard, list

**Files:**
- Create: `src/renderer/templates/dashboard.js`
- Create: `src/renderer/templates/list.js`

**Dependencies:** Task 1

**Step 1: Create dashboard template**

Create `src/renderer/templates/dashboard.js`:

```javascript
// Dashboard template — stats cards, data table, navigation
export const description = 'Dashboard with header, search bar, stats cards, data table, and tab bar';

export function generate(screenWidth, screenHeight, style) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;
  const headerH = 56;
  const tabbarH = 56;
  const searchH = 44;
  const cardH = 80;
  const cardGap = 12;

  // For grid of 3 stat cards
  const cardW = Math.round((contentWidth - cardGap * 2) / 3);

  let y = 0;

  const elements = [];

  // Header (logo + nav)
  elements.push({
    type: 'header',
    x: 0, y,
    width: screenWidth, height: headerH,
    z_index: 10,
    properties: { logo: 'Dashboard', nav: ['Home', 'Analytics'], rightIcon: 'bell' },
  });
  y += headerH + pad;

  // Search bar
  elements.push({
    type: 'search_bar',
    x: pad, y,
    width: contentWidth, height: searchH,
    z_index: 0,
    properties: { placeholder: 'Search...' },
  });
  y += searchH + pad;

  // Stat card 1: Users
  elements.push({
    type: 'card',
    x: pad, y,
    width: cardW, height: cardH,
    z_index: 0,
    properties: { title: '1,234', subtitle: 'Total Users' },
  });

  // Stat card 2: Revenue
  elements.push({
    type: 'card',
    x: pad + cardW + cardGap, y,
    width: cardW, height: cardH,
    z_index: 0,
    properties: { title: '$12,345', subtitle: 'Revenue' },
  });

  // Stat card 3: Orders
  elements.push({
    type: 'card',
    x: pad + (cardW + cardGap) * 2, y,
    width: cardW, height: cardH,
    z_index: 0,
    properties: { title: '567', subtitle: 'Orders' },
  });
  y += cardH + pad;

  // Data table — fills remaining space above tabbar
  const tableH = Math.max(200, screenHeight - y - tabbarH - pad);
  elements.push({
    type: 'data_table',
    x: pad, y,
    width: contentWidth, height: tableH,
    z_index: 0,
    properties: {
      headers: ['Name', 'Status', 'Date'],
      rows: [
        ['Project Alpha', 'Active', '2026-01-15'],
        ['Project Beta', 'Paused', '2026-02-01'],
        ['Project Gamma', 'Active', '2026-02-10'],
      ],
      showSearch: false,
      showPagination: true,
    },
  });

  // Tab bar — pinned at bottom
  elements.push({
    type: 'tabbar',
    x: 0, y: screenHeight - tabbarH,
    width: screenWidth, height: tabbarH,
    z_index: 10,
    properties: {
      tabs: [
        { icon: 'home', label: 'Home', active: true },
        { icon: 'search', label: 'Analytics' },
        { icon: 'settings', label: 'Settings' },
      ],
    },
  });

  return elements;
}
```

**Step 2: Create list template**

Create `src/renderer/templates/list.js`:

```javascript
// List template — scrollable content list with search
export const description = 'Content list with navbar, search bar, list items with cards, and navigation';

export function generate(screenWidth, screenHeight, style) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;
  const navH = 56;
  const searchH = 44;
  const cardH = 72;
  const cardGap = 12;

  let y = 0;

  const elements = [];

  // Navbar — pinned
  elements.push({
    type: 'navbar',
    x: 0, y,
    width: screenWidth, height: navH,
    z_index: 10,
    properties: { title: 'Items', rightIcons: ['search', 'plus'] },
  });
  y += navH + pad;

  // Search bar
  elements.push({
    type: 'search_bar',
    x: pad, y,
    width: contentWidth, height: searchH,
    z_index: 0,
    properties: { placeholder: 'Search items...' },
  });
  y += searchH + pad;

  // 5 list item cards
  const itemData = [
    { title: 'First Item', subtitle: 'Description for the first item' },
    { title: 'Second Item', subtitle: 'Description for the second item' },
    { title: 'Third Item', subtitle: 'Description for the third item' },
    { title: 'Fourth Item', subtitle: 'Description for the fourth item' },
    { title: 'Fifth Item', subtitle: 'Description for the fifth item' },
  ];

  for (const item of itemData) {
    elements.push({
      type: 'card',
      x: pad, y,
      width: contentWidth, height: cardH,
      z_index: 0,
      properties: { title: item.title, subtitle: item.subtitle },
    });
    y += cardH + cardGap;
  }

  return elements;
}
```

**Step 3: Verify file syntax**

```bash
node -e "import('./src/renderer/templates/dashboard.js').then(m => console.error('dashboard OK:', m.generate(393, 852, 'wireframe').length))"
node -e "import('./src/renderer/templates/list.js').then(m => console.error('list OK:', m.generate(393, 852, 'wireframe').length))"
```

**Step 4: Commit**

```bash
git add src/renderer/templates/dashboard.js src/renderer/templates/list.js
git commit -m "feat: dashboard, list templates"
```

---

### Task 4: Templates — settings, profile

**Files:**
- Create: `src/renderer/templates/settings.js`
- Create: `src/renderer/templates/profile.js`

**Dependencies:** Task 1

**Step 1: Create settings template**

Create `src/renderer/templates/settings.js`:

```javascript
// Settings template — iOS/Android-style settings page with toggles
export const description = 'Settings page with user avatar, settings list with toggles and chevrons, and sign-out button';

export function generate(screenWidth, screenHeight, style) {
  const pad = 24;
  const contentWidth = screenWidth - pad * 2;
  const navH = 56;

  let y = navH + 24;

  const elements = [];

  // Navbar — pinned
  elements.push({
    type: 'navbar',
    x: 0, y: 0,
    width: screenWidth, height: navH,
    z_index: 10,
    properties: { title: 'Settings', leftIcon: 'arrow-left' },
  });

  // User avatar (large, centered)
  const avatarSize = 72;
  elements.push({
    type: 'avatar',
    x: Math.round((screenWidth - avatarSize) / 2), y,
    width: avatarSize, height: avatarSize,
    z_index: 0,
    properties: { initials: 'JD', size: 'lg' },
  });
  y += avatarSize + 12;

  // User name (centered)
  elements.push({
    type: 'text',
    x: pad, y,
    width: contentWidth, height: 24,
    z_index: 0,
    properties: { content: 'John Doe', fontSize: 18, fontWeight: 'bold', color: '#333333', align: 'center' },
  });
  y += 24 + 24;

  // Settings list with toggle items
  const listH = 280;
  elements.push({
    type: 'list',
    x: pad, y,
    width: contentWidth, height: listH,
    z_index: 0,
    properties: {
      items: ['Notifications', 'Dark Mode', 'Location Services', 'Auto-Update', 'Analytics'],
      variant: 'simple',
    },
  });
  y += listH + 24;

  // Individual toggle overlays for first two items (visual hint)
  elements.push({
    type: 'toggle',
    x: screenWidth - pad - 52, y: y - listH + 6,
    width: 52, height: 28,
    z_index: 1,
    properties: { label: '', on: true },
  });

  elements.push({
    type: 'toggle',
    x: screenWidth - pad - 52, y: y - listH + 62,
    width: 52, height: 28,
    z_index: 1,
    properties: { label: '', on: false },
  });

  // Sign Out button
  elements.push({
    type: 'button',
    x: pad, y: Math.min(y + 16, screenHeight - 80),
    width: contentWidth, height: 48,
    z_index: 0,
    properties: { label: 'Sign Out', variant: 'outline', size: 'lg' },
  });

  return elements;
}
```

**Step 2: Create profile template**

Create `src/renderer/templates/profile.js`:

```javascript
// Profile template — user profile page with stats and activity
export const description = 'User profile with avatar, name, bio, stat badges, edit button, and recent activity list';

export function generate(screenWidth, screenHeight, style) {
  const pad = 24;
  const contentWidth = screenWidth - pad * 2;
  const navH = 56;

  let y = navH + 24;

  const elements = [];

  // Navbar — pinned
  elements.push({
    type: 'navbar',
    x: 0, y: 0,
    width: screenWidth, height: navH,
    z_index: 10,
    properties: { title: 'Profile', rightIcons: ['settings'] },
  });

  // Avatar (large, centered)
  const avatarSize = 80;
  elements.push({
    type: 'avatar',
    x: Math.round((screenWidth - avatarSize) / 2), y,
    width: avatarSize, height: avatarSize,
    z_index: 0,
    properties: { initials: 'JD', size: 'lg' },
  });
  y += avatarSize + 12;

  // User name (centered)
  elements.push({
    type: 'text',
    x: pad, y,
    width: contentWidth, height: 28,
    z_index: 0,
    properties: { content: 'John Doe', fontSize: 22, fontWeight: 'bold', color: '#333333', align: 'center' },
  });
  y += 28 + 8;

  // Bio/description
  elements.push({
    type: 'text',
    x: pad, y,
    width: contentWidth, height: 40,
    z_index: 0,
    properties: { content: 'Product designer & developer. Building great user experiences.', fontSize: 14, color: '#666666', align: 'center' },
  });
  y += 40 + 20;

  // 3 stat badges in a row
  const badgeW = Math.round((contentWidth - 16) / 3);
  const badgeH = 48;

  elements.push({
    type: 'badge',
    x: pad, y,
    width: badgeW, height: badgeH,
    z_index: 0,
    properties: { label: '128 Posts', color: 'blue' },
  });

  elements.push({
    type: 'badge',
    x: pad + badgeW + 8, y,
    width: badgeW, height: badgeH,
    z_index: 0,
    properties: { label: '1.2K Followers', color: 'green' },
  });

  elements.push({
    type: 'badge',
    x: pad + (badgeW + 8) * 2, y,
    width: badgeW, height: badgeH,
    z_index: 0,
    properties: { label: '340 Following', color: 'default' },
  });
  y += badgeH + 20;

  // Edit Profile button
  elements.push({
    type: 'button',
    x: pad, y,
    width: contentWidth, height: 44,
    z_index: 0,
    properties: { label: 'Edit Profile', variant: 'outline', size: 'md' },
  });
  y += 44 + 24;

  // Recent Activity list
  const listH = Math.max(150, screenHeight - y - 16);
  elements.push({
    type: 'list',
    x: pad, y,
    width: contentWidth, height: listH,
    z_index: 0,
    properties: {
      items: ['Liked a post by Jane', 'Commented on Project X', 'Shared an update', 'Followed Mike'],
      variant: 'detailed',
    },
  });

  return elements;
}
```

**Step 3: Verify file syntax**

```bash
node -e "import('./src/renderer/templates/settings.js').then(m => console.error('settings OK:', m.generate(393, 852, 'wireframe').length))"
node -e "import('./src/renderer/templates/profile.js').then(m => console.error('profile OK:', m.generate(393, 852, 'wireframe').length))"
```

**Step 4: Commit**

```bash
git add src/renderer/templates/settings.js src/renderer/templates/profile.js
git commit -m "feat: settings, profile templates"
```

---

### Task 5: Template MCP Tools + Registry Update

**Files:**
- Modify: `src/renderer/templates/index.js` (add all 7 template imports)
- Create: `src/mcp/tools/template-tools.js`
- Modify: `src/mcp/tools/index.js`

**Dependencies:** Tasks 1, 2, 3, 4

**Step 1: Update template registry with all imports**

Replace `src/renderer/templates/index.js` entirely:

```javascript
// Template registry — same pattern as component registry.
// Each template exports: generate(screenWidth, screenHeight, style) -> element[]
// and description: string.

import * as login from './login.js';
import * as dashboard from './dashboard.js';
import * as settings from './settings.js';
import * as list from './list.js';
import * as form from './form.js';
import * as profile from './profile.js';
import * as onboarding from './onboarding.js';

const templates = { login, dashboard, settings, list, form, profile, onboarding };

export function getTemplate(name) {
  return templates[name] || null;
}

export function getAvailableTemplates() {
  return Object.keys(templates);
}
```

**Step 2: Create template MCP tools**

Create `src/mcp/tools/template-tools.js`:

```javascript
import { z } from 'zod';
import { getTemplate, getAvailableTemplates } from '../../renderer/templates/index.js';

export function registerTemplateTools(server, store) {
  server.tool(
    'mockup_apply_template',
    'Apply a preset template to a screen. Replaces all existing elements by default. Templates: login, dashboard, settings, list, form, profile, onboarding',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID to apply template to'),
      template: z.enum(['login', 'dashboard', 'settings', 'list', 'form', 'profile', 'onboarding'])
        .describe('Template name'),
      clear: z.boolean().optional().default(true)
        .describe('Whether to clear existing elements before applying (default: true)'),
    },
    async ({ project_id, screen_id, template, clear }) => {
      try {
        const tmpl = getTemplate(template);
        if (!tmpl) {
          throw new Error(`Unknown template: "${template}". Available: ${getAvailableTemplates().join(', ')}`);
        }

        const project = await store.getProject(project_id);
        const screen = project.screens.find(s => s.id === screen_id);
        if (!screen) {
          throw new Error(`Screen ${screen_id} not found in project ${project_id}`);
        }

        const style = screen.style || project.style || 'wireframe';
        const elements = tmpl.generate(screen.width, screen.height, style);
        const updatedScreen = await store.applyTemplate(project_id, screen_id, elements, clear);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(updatedScreen, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'mockup_list_templates',
    'List available templates with their descriptions and expected element counts',
    {},
    async () => {
      try {
        const templates = getAvailableTemplates().map(name => {
          const tmpl = getTemplate(name);
          const sampleElements = tmpl.generate(393, 852, 'wireframe');
          return {
            name,
            description: tmpl.description,
            elementCount: sampleElements.length,
          };
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(templates, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
```

**Step 3: Register template tools in index.js**

Replace `src/mcp/tools/index.js` entirely:

```javascript
import { ProjectStore } from '../../storage/project-store.js';
import { config } from '../../config.js';
import { registerProjectTools } from './project-tools.js';
import { registerScreenTools } from './screen-tools.js';
import { registerElementTools } from './element-tools.js';
import { registerExportTools } from './export-tools.js';
import { registerTemplateTools } from './template-tools.js';

export function registerAllTools(server) {
  const store = new ProjectStore(config.dataDir);
  registerProjectTools(server, store);
  registerScreenTools(server, store);
  registerElementTools(server, store);
  registerExportTools(server, store);
  registerTemplateTools(server, store);
  console.error('[MockupMCP] 16 tools registered');
}
```

**Step 4: Run template registry tests**

```bash
node --test tests/renderer/templates.test.js
```

Expected: All PASS (7 templates x 4 tests each = 28+ tests).

**Step 5: Commit**

```bash
git add src/renderer/templates/index.js src/mcp/tools/template-tools.js src/mcp/tools/index.js
git commit -m "feat: template MCP tools (apply_template + list_templates), registry update"
```

---

### Task 6: Template Integration Tests

**Files:**
- Create: `tests/renderer/templates-integration.test.js`

**Dependencies:** Task 5

**Step 1: Create integration test file**

Create `tests/renderer/templates-integration.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTemplate, getAvailableTemplates } from '../../src/renderer/templates/index.js';
import { getComponent } from '../../src/renderer/components/index.js';
import { buildScreenHtml } from '../../src/renderer/html-builder.js';
import { getAvailableStyles } from '../../src/renderer/styles/index.js';

const VIEWPORTS = [
  { name: 'mobile', width: 393, height: 852 },
  { name: 'tablet', width: 834, height: 1194 },
  { name: 'desktop', width: 1440, height: 900 },
];

describe('template integration', () => {
  // Test each template x each viewport
  for (const templateName of getAvailableTemplates()) {
    for (const vp of VIEWPORTS) {
      it(`${templateName}/${vp.name}: elements fit within ${vp.width}x${vp.height}`, () => {
        const tmpl = getTemplate(templateName);
        const elements = tmpl.generate(vp.width, vp.height, 'wireframe');

        for (const el of elements) {
          assert.ok(el.x >= 0, `${templateName}/${vp.name}: x=${el.x} < 0`);
          assert.ok(el.y >= 0, `${templateName}/${vp.name}: y=${el.y} < 0`);
          assert.ok(
            el.x + el.width <= vp.width + 1,
            `${templateName}/${vp.name}: element overflows right (x=${el.x}, w=${el.width}, screen=${vp.width})`
          );
          assert.ok(
            el.y + el.height <= vp.height + 1,
            `${templateName}/${vp.name}: element overflows bottom (y=${el.y}, h=${el.height}, screen=${vp.height})`
          );
        }
      });
    }
  }

  // Test each template x each style renders via buildScreenHtml
  for (const templateName of getAvailableTemplates()) {
    for (const styleName of getAvailableStyles()) {
      it(`${templateName}/${styleName}: renders via buildScreenHtml without error`, () => {
        const tmpl = getTemplate(templateName);
        const elements = tmpl.generate(393, 852, styleName);

        const screen = {
          width: 393,
          height: 852,
          background: '#FFFFFF',
          elements,
        };

        const html = buildScreenHtml(screen, styleName);
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.length > 500);
        // Should NOT contain "unknown type" comments
        assert.ok(!html.includes('<!-- unknown type'), `${templateName}/${styleName}: contains unknown component type`);
      });
    }
  }

  // Test all template elements reference valid component types
  for (const templateName of getAvailableTemplates()) {
    it(`${templateName}: all element types are valid registered components`, () => {
      const tmpl = getTemplate(templateName);
      const elements = tmpl.generate(393, 852, 'wireframe');

      for (const el of elements) {
        const component = getComponent(el.type);
        assert.ok(component !== null, `${templateName}: unknown component type "${el.type}"`);
      }
    });
  }

  // Test clear=true/false behavior via template application
  describe('clear behavior', () => {
    it('template generates no elements with id field (IDs assigned by storage)', () => {
      for (const templateName of getAvailableTemplates()) {
        const tmpl = getTemplate(templateName);
        const elements = tmpl.generate(393, 852, 'wireframe');
        for (const el of elements) {
          assert.equal(el.id, undefined, `${templateName}: element should not have id field`);
        }
      }
    });
  });

  // Test element descriptors have valid property objects
  for (const templateName of getAvailableTemplates()) {
    it(`${templateName}: all elements have non-null properties objects`, () => {
      const tmpl = getTemplate(templateName);
      const elements = tmpl.generate(393, 852, 'wireframe');
      for (const el of elements) {
        assert.ok(el.properties !== null && typeof el.properties === 'object');
      }
    });
  }
});
```

**Step 2: Run integration tests**

```bash
node --test tests/renderer/templates-integration.test.js
```

Expected: All PASS. Count: 7 templates x 3 viewports + 7 x 3 styles + 7 type checks + 1 clear test + 7 property tests = 21 + 21 + 7 + 1 + 7 = 57 tests.

**Step 3: Commit**

```bash
git add tests/renderer/templates-integration.test.js
git commit -m "test: template integration tests — viewports, styles, component validation"
```

---

### Task 7: Sprint 1 Commit + Full Test Run

**Files:** None new

**Dependencies:** Tasks 1-6

**Step 1: Run full test suite**

```bash
node --test tests/**/*.test.js
```

Expected: All existing tests + new template tests PASS.

**Step 2: Fix any failures**

If test failures occur, fix them before proceeding.

**Step 3: Commit sprint 1**

```bash
git add -A
git commit -m "feat: M2b Sprint 1 — template system with 7 templates, 2 MCP tools"
```

---

## Sprint 2: Auto-Layout + Export Formats (5 tasks)

### Task 8: Layout Engine

**Files:**
- Create: `src/renderer/layout.js`
- Create: `tests/renderer/layout.test.js`

**Dependencies:** None (independent of Sprint 1)

**Step 1: Write layout engine tests**

Create `tests/renderer/layout.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { autoLayout } from '../../src/renderer/layout.js';

// Helper to create element stubs
function el(id, x, y, width, height, zIndex = 0) {
  return { id, type: 'rectangle', x, y, width, height, z_index: zIndex, properties: {} };
}

describe('autoLayout', () => {
  describe('vertical direction', () => {
    it('stacks elements top-to-bottom with default spacing and padding', () => {
      const elements = [
        el('el_1', 50, 50, 100, 40),
        el('el_2', 70, 200, 80, 60),
        el('el_3', 30, 300, 120, 30),
      ];

      const result = autoLayout(elements, 393, 852, { direction: 'vertical' });

      assert.equal(result.length, 3);
      // First element starts at padding.top
      assert.equal(result[0].y, 16);
      assert.equal(result[0].x, 16);
      // Second element starts after first + spacing
      assert.equal(result[1].y, 16 + 40 + 16);
      // Third element starts after second + spacing
      assert.equal(result[2].y, 16 + 40 + 16 + 60 + 16);
    });

    it('stretch alignment sets width to available width', () => {
      const elements = [el('el_1', 50, 50, 100, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical', align: 'stretch', padding: 24 });

      assert.equal(result[0].width, 393 - 24 - 24);
      assert.equal(result[0].x, 24);
    });

    it('center alignment centers elements horizontally', () => {
      const elements = [el('el_1', 0, 0, 100, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical', align: 'center', padding: 16 });

      // Centered: x = padding + (available - elementWidth) / 2
      const available = 393 - 16 - 16;
      const expectedX = 16 + Math.round((available - 100) / 2);
      assert.equal(result[0].x, expectedX);
      assert.equal(result[0].width, 100); // width preserved
    });

    it('start alignment left-aligns elements', () => {
      const elements = [el('el_1', 100, 100, 80, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical', align: 'start', padding: 16 });

      assert.equal(result[0].x, 16);
      assert.equal(result[0].width, 80); // width preserved
    });

    it('respects custom spacing', () => {
      const elements = [
        el('el_1', 0, 0, 100, 40),
        el('el_2', 0, 0, 100, 40),
      ];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical', spacing: 32, padding: 0 });

      assert.equal(result[0].y, 0);
      assert.equal(result[1].y, 40 + 32);
    });

    it('respects start_y offset', () => {
      const elements = [el('el_1', 0, 0, 100, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical', start_y: 56 });

      assert.equal(result[0].y, 56 + 16); // start_y + padding.top
    });
  });

  describe('horizontal direction', () => {
    it('arranges elements left-to-right', () => {
      const elements = [
        el('el_1', 0, 0, 80, 40),
        el('el_2', 0, 0, 100, 60),
        el('el_3', 0, 0, 60, 30),
      ];

      const result = autoLayout(elements, 393, 852, { direction: 'horizontal', padding: 16 });

      assert.equal(result[0].x, 16);
      assert.equal(result[1].x, 16 + 80 + 16);
      assert.equal(result[2].x, 16 + 80 + 16 + 100 + 16);
    });

    it('stretch alignment sets height to available height', () => {
      const elements = [el('el_1', 0, 0, 80, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'horizontal', align: 'stretch', padding: 16 });

      assert.equal(result[0].height, 852 - 16 - 16);
      assert.equal(result[0].y, 16);
    });

    it('center alignment centers elements vertically', () => {
      const elements = [el('el_1', 0, 0, 80, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'horizontal', align: 'center', padding: 16 });

      const available = 852 - 16 - 16;
      const expectedY = 16 + Math.round((available - 40) / 2);
      assert.equal(result[0].y, expectedY);
      assert.equal(result[0].height, 40); // preserved
    });

    it('start alignment top-aligns elements', () => {
      const elements = [el('el_1', 0, 0, 80, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'horizontal', align: 'start', padding: 16 });

      assert.equal(result[0].y, 16);
      assert.equal(result[0].height, 40); // preserved
    });
  });

  describe('grid direction', () => {
    it('arranges elements in 2-column grid by default', () => {
      const elements = [
        el('el_1', 0, 0, 100, 80),
        el('el_2', 0, 0, 100, 80),
        el('el_3', 0, 0, 100, 80),
        el('el_4', 0, 0, 100, 80),
      ];

      const result = autoLayout(elements, 393, 852, { direction: 'grid', padding: 16, spacing: 16 });

      const cellW = Math.round((393 - 16 - 16 - 16) / 2); // (screen - padL - padR - gap) / 2

      // Row 0
      assert.equal(result[0].x, 16);
      assert.equal(result[0].y, 16);
      assert.equal(result[0].width, cellW);
      assert.equal(result[1].x, 16 + cellW + 16);
      assert.equal(result[1].y, 16);
      assert.equal(result[1].width, cellW);

      // Row 1
      assert.equal(result[2].x, 16);
      assert.equal(result[2].y, 16 + 80 + 16);
      assert.equal(result[3].x, 16 + cellW + 16);
      assert.equal(result[3].y, 16 + 80 + 16);
    });

    it('respects custom column count', () => {
      const elements = [
        el('el_1', 0, 0, 100, 60),
        el('el_2', 0, 0, 100, 60),
        el('el_3', 0, 0, 100, 60),
      ];

      const result = autoLayout(elements, 393, 852, { direction: 'grid', columns: 3, padding: 16, spacing: 8 });

      const cellW = Math.round((393 - 16 - 16 - 8 * 2) / 3);

      assert.equal(result[0].x, 16);
      assert.equal(result[1].x, 16 + cellW + 8);
      assert.equal(result[2].x, 16 + (cellW + 8) * 2);
      // All same row
      assert.equal(result[0].y, result[1].y);
      assert.equal(result[1].y, result[2].y);
    });
  });

  describe('z_index pinning', () => {
    it('excludes elements with z_index >= 10 from layout', () => {
      const elements = [
        el('el_nav', 0, 0, 393, 56, 10),   // pinned navbar
        el('el_1', 50, 100, 100, 40, 0),
        el('el_2', 50, 200, 100, 40, 0),
      ];

      const result = autoLayout(elements, 393, 852, { direction: 'vertical' });

      // Pinned element unchanged
      const nav = result.find(e => e.id === 'el_nav');
      assert.equal(nav.x, 0);
      assert.equal(nav.y, 0);
      assert.equal(nav.width, 393);

      // Non-pinned elements are laid out
      const el1 = result.find(e => e.id === 'el_1');
      const el2 = result.find(e => e.id === 'el_2');
      assert.equal(el1.y, 16);
      assert.equal(el2.y, 16 + 40 + 16);
    });
  });

  describe('element_ids filter', () => {
    it('only layouts specified element IDs', () => {
      const elements = [
        el('el_1', 10, 10, 100, 40),
        el('el_2', 20, 20, 100, 40),
        el('el_3', 30, 30, 100, 40),
      ];

      const result = autoLayout(elements, 393, 852, {
        direction: 'vertical',
        element_ids: ['el_1', 'el_3'],
      });

      // el_1 and el_3 are laid out
      const r1 = result.find(e => e.id === 'el_1');
      const r3 = result.find(e => e.id === 'el_3');
      assert.equal(r1.y, 16);
      assert.equal(r3.y, 16 + 40 + 16);

      // el_2 is untouched
      const r2 = result.find(e => e.id === 'el_2');
      assert.equal(r2.x, 20);
      assert.equal(r2.y, 20);
    });

    it('ignores nonexistent element IDs silently', () => {
      const elements = [el('el_1', 10, 10, 100, 40)];

      const result = autoLayout(elements, 393, 852, {
        direction: 'vertical',
        element_ids: ['el_1', 'el_nonexistent'],
      });

      assert.equal(result.length, 1);
      assert.equal(result[0].y, 16);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = autoLayout([], 393, 852, { direction: 'vertical' });
      assert.deepEqual(result, []);
    });

    it('handles single element', () => {
      const elements = [el('el_1', 50, 50, 100, 40)];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical' });
      assert.equal(result.length, 1);
      assert.equal(result[0].y, 16);
    });

    it('handles all elements pinned (z_index >= 10)', () => {
      const elements = [
        el('el_1', 0, 0, 393, 56, 10),
        el('el_2', 0, 800, 393, 52, 10),
      ];
      const result = autoLayout(elements, 393, 852, { direction: 'vertical' });
      // All returned unchanged
      assert.equal(result[0].x, 0);
      assert.equal(result[0].y, 0);
      assert.equal(result[1].y, 800);
    });

    it('does not mutate input array', () => {
      const original = [el('el_1', 50, 50, 100, 40)];
      const originalY = original[0].y;
      autoLayout(original, 393, 852, { direction: 'vertical' });
      assert.equal(original[0].y, originalY, 'Input should not be mutated');
    });
  });
});
```

**Step 2: Implement layout engine**

Create `src/renderer/layout.js`:

```javascript
/**
 * Auto-layout engine — repositions elements according to layout rules.
 * Pure function: takes elements array + options, returns new array with updated positions.
 * Does NOT mutate input.
 *
 * @param {Array} elements - Array of element objects with {id, x, y, width, height, z_index}
 * @param {number} screenWidth - Screen width in pixels
 * @param {number} screenHeight - Screen height in pixels
 * @param {Object} options - Layout options
 * @returns {Array} New array with updated element positions
 */
export function autoLayout(elements, screenWidth, screenHeight, options = {}) {
  if (elements.length === 0) return [];

  const {
    direction = 'vertical',
    spacing = 16,
    padding = 16,
    align = 'stretch',
    columns = 2,
    element_ids = null,
    start_y = null,
  } = options;

  // Normalize padding to object
  const pad = typeof padding === 'number'
    ? { top: padding, right: padding, bottom: padding, left: padding }
    : { top: 16, right: 16, bottom: 16, left: 16, ...padding };

  // Deep clone so we never mutate input
  const result = elements.map(el => ({ ...el }));

  // Separate pinned (z_index >= 10) from layoutable elements
  const pinned = new Set();
  const layoutable = [];

  for (let i = 0; i < result.length; i++) {
    const el = result[i];

    // Skip pinned elements
    if (el.z_index >= 10) {
      pinned.add(i);
      continue;
    }

    // Skip elements not in element_ids filter (if provided)
    if (element_ids !== null && !element_ids.includes(el.id)) {
      continue;
    }

    layoutable.push({ index: i, el });
  }

  if (layoutable.length === 0) return result;

  const startOffset = start_y !== null ? start_y + pad.top : pad.top;
  const availableWidth = screenWidth - pad.left - pad.right;
  const availableHeight = screenHeight - pad.top - pad.bottom;

  if (direction === 'vertical') {
    layoutVertical(layoutable, result, pad, spacing, availableWidth, startOffset, align);
  } else if (direction === 'horizontal') {
    layoutHorizontal(layoutable, result, pad, spacing, availableHeight, startOffset, align, screenHeight);
  } else if (direction === 'grid') {
    layoutGrid(layoutable, result, pad, spacing, availableWidth, startOffset, columns);
  }

  return result;
}

function layoutVertical(layoutable, result, pad, spacing, availableWidth, startY, align) {
  let currentY = startY;

  for (const { index, el } of layoutable) {
    result[index].y = currentY;

    if (align === 'stretch') {
      result[index].x = pad.left;
      result[index].width = availableWidth;
    } else if (align === 'center') {
      result[index].x = pad.left + Math.round((availableWidth - el.width) / 2);
    } else {
      // start (left-aligned)
      result[index].x = pad.left;
    }

    currentY += el.height + spacing;
  }
}

function layoutHorizontal(layoutable, result, pad, spacing, availableHeight, startY, align, screenHeight) {
  let currentX = pad.left;

  for (const { index, el } of layoutable) {
    result[index].x = currentX;

    if (align === 'stretch') {
      result[index].y = pad.top;
      result[index].height = availableHeight;
    } else if (align === 'center') {
      result[index].y = pad.top + Math.round((availableHeight - el.height) / 2);
    } else {
      // start (top-aligned)
      result[index].y = pad.top;
    }

    currentX += el.width + spacing;
  }
}

function layoutGrid(layoutable, result, pad, spacing, availableWidth, startY, columns) {
  const cellWidth = Math.round((availableWidth - spacing * (columns - 1)) / columns);
  let currentY = startY;
  let col = 0;
  let maxRowHeight = 0;

  for (const { index, el } of layoutable) {
    result[index].x = pad.left + col * (cellWidth + spacing);
    result[index].y = currentY;
    result[index].width = cellWidth;

    maxRowHeight = Math.max(maxRowHeight, el.height);

    col++;
    if (col >= columns) {
      col = 0;
      currentY += maxRowHeight + spacing;
      maxRowHeight = 0;
    }
  }
}
```

**Step 3: Run layout tests**

```bash
node --test tests/renderer/layout.test.js
```

Expected: All PASS.

**Step 4: Commit**

```bash
git add src/renderer/layout.js tests/renderer/layout.test.js
git commit -m "feat: auto-layout engine with vertical/horizontal/grid modes"
```

---

### Task 9: Auto-Layout MCP Tool + Storage Method

**Files:**
- Create: `src/mcp/tools/layout-tools.js`
- Modify: `src/storage/project-store.js`
- Modify: `src/mcp/tools/index.js`
- Modify: `tests/storage/project-store.test.js`

**Dependencies:** Task 8

**Step 1: Add bulkMoveElements storage method tests**

Add to `tests/storage/project-store.test.js`:

```javascript
describe('bulkMoveElements', () => {
  it('updates positions of multiple elements', async () => {
    const project = await store.createProject('Bulk Move Test');
    const screen = await store.addScreen(project.id, 'Main');
    const el1 = await store.addElement(project.id, screen.id, 'text', 10, 20, 100, 30, {});
    const el2 = await store.addElement(project.id, screen.id, 'button', 50, 60, 120, 40, {});

    const updates = [
      { id: el1.id, x: 0, y: 0, width: 393, height: 30 },
      { id: el2.id, x: 0, y: 46, width: 393, height: 40 },
    ];

    const result = await store.bulkMoveElements(project.id, screen.id, updates);

    const updatedEl1 = result.elements.find(e => e.id === el1.id);
    const updatedEl2 = result.elements.find(e => e.id === el2.id);

    assert.equal(updatedEl1.x, 0);
    assert.equal(updatedEl1.y, 0);
    assert.equal(updatedEl1.width, 393);
    assert.equal(updatedEl2.x, 0);
    assert.equal(updatedEl2.y, 46);
  });

  it('skips nonexistent element IDs silently', async () => {
    const project = await store.createProject('Bulk Skip Test');
    const screen = await store.addScreen(project.id, 'Main');
    const el1 = await store.addElement(project.id, screen.id, 'text', 10, 20, 100, 30, {});

    const updates = [
      { id: el1.id, x: 0, y: 0 },
      { id: 'el_nonexistent', x: 50, y: 50 },
    ];

    const result = await store.bulkMoveElements(project.id, screen.id, updates);
    assert.equal(result.elements.length, 1);
    assert.equal(result.elements[0].x, 0);
  });

  it('only updates provided fields', async () => {
    const project = await store.createProject('Bulk Partial Test');
    const screen = await store.addScreen(project.id, 'Main');
    const el1 = await store.addElement(project.id, screen.id, 'text', 10, 20, 100, 30, {});

    const updates = [
      { id: el1.id, x: 50 }, // only x, keep y/width/height
    ];

    const result = await store.bulkMoveElements(project.id, screen.id, updates);
    const updated = result.elements.find(e => e.id === el1.id);

    assert.equal(updated.x, 50);
    assert.equal(updated.y, 20);  // unchanged
    assert.equal(updated.width, 100);  // unchanged
    assert.equal(updated.height, 30);  // unchanged
  });

  it('throws for nonexistent screen', async () => {
    const project = await store.createProject('Bulk Error Test');
    await assert.rejects(
      () => store.bulkMoveElements(project.id, 'scr_nonexistent', []),
      /not found/i,
    );
  });
});
```

**Step 2: Implement bulkMoveElements storage method**

In `src/storage/project-store.js`, add after the `applyTemplate` method:

```javascript
async bulkMoveElements(projectId, screenId, updates) {
  this._validateId(screenId);
  const project = await this.getProject(projectId);
  const screen = this._findScreen(project, screenId);

  for (const update of updates) {
    const el = screen.elements.find(e => e.id === update.id);
    if (!el) continue;
    if (update.x !== undefined) el.x = update.x;
    if (update.y !== undefined) el.y = update.y;
    if (update.width !== undefined) el.width = update.width;
    if (update.height !== undefined) el.height = update.height;
  }

  await this._save(project);
  return screen;
}
```

**Step 3: Create layout MCP tool**

Create `src/mcp/tools/layout-tools.js`:

```javascript
import { z } from 'zod';
import { autoLayout } from '../../renderer/layout.js';

export function registerLayoutTools(server, store) {
  server.tool(
    'mockup_auto_layout',
    'Automatically reposition elements on a screen using vertical, horizontal, or grid layout. Elements with z_index >= 10 (nav bars) are excluded from layout.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      direction: z.enum(['vertical', 'horizontal', 'grid'])
        .describe('Layout direction'),
      spacing: z.number().optional().default(16)
        .describe('Space between elements in pixels (default: 16)'),
      padding: z.number().optional().default(16)
        .describe('Padding from screen edges in pixels (default: 16)'),
      columns: z.number().optional().default(2)
        .describe('Number of columns for grid layout (default: 2, ignored for vertical/horizontal)'),
      align: z.enum(['start', 'center', 'stretch']).optional().default('stretch')
        .describe('Cross-axis alignment: start (left/top), center, stretch (full width/height)'),
      element_ids: z.array(z.string()).optional()
        .describe('Specific element IDs to include in layout (default: all non-pinned elements)'),
      start_y: z.number().optional()
        .describe('Y offset to start layout from (useful when navbar occupies top area, e.g. start_y: 56)'),
    },
    async ({ project_id, screen_id, direction, spacing, padding, columns, align, element_ids, start_y }) => {
      try {
        const project = await store.getProject(project_id);
        const screen = project.screens.find(s => s.id === screen_id);
        if (!screen) {
          throw new Error(`Screen ${screen_id} not found in project ${project_id}`);
        }

        const layoutOptions = {
          direction,
          spacing,
          padding,
          columns,
          align,
          element_ids: element_ids || null,
          start_y: start_y !== undefined ? start_y : null,
        };

        const updatedElements = autoLayout(screen.elements, screen.width, screen.height, layoutOptions);

        // Build updates array for persistence
        const updates = updatedElements.map(el => ({
          id: el.id,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
        }));

        const updatedScreen = await store.bulkMoveElements(project_id, screen_id, updates);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(updatedScreen, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
```

**Step 4: Register layout tools in index.js**

Replace `src/mcp/tools/index.js` entirely:

```javascript
import { ProjectStore } from '../../storage/project-store.js';
import { config } from '../../config.js';
import { registerProjectTools } from './project-tools.js';
import { registerScreenTools } from './screen-tools.js';
import { registerElementTools } from './element-tools.js';
import { registerExportTools } from './export-tools.js';
import { registerTemplateTools } from './template-tools.js';
import { registerLayoutTools } from './layout-tools.js';

export function registerAllTools(server) {
  const store = new ProjectStore(config.dataDir);
  registerProjectTools(server, store);
  registerScreenTools(server, store);
  registerElementTools(server, store);
  registerExportTools(server, store);
  registerTemplateTools(server, store);
  registerLayoutTools(server, store);
  console.error('[MockupMCP] 17 tools registered');
}
```

**Step 5: Run tests**

```bash
node --test tests/storage/project-store.test.js
node --test tests/renderer/layout.test.js
```

Expected: All PASS.

**Step 6: Commit**

```bash
git add src/mcp/tools/layout-tools.js src/storage/project-store.js src/mcp/tools/index.js tests/storage/project-store.test.js
git commit -m "feat: auto-layout MCP tool + bulkMoveElements storage method"
```

---

### Task 10: SVG/PDF Export

**Files:**
- Modify: `src/renderer/screenshot.js`
- Modify: `src/mcp/tools/export-tools.js`
- Modify: `src/storage/project-store.js`
- Create: `tests/renderer/screenshot-formats.test.js`

**Dependencies:** None (independent of Tasks 8-9)

**Step 1: Write export format tests**

Create `tests/renderer/screenshot-formats.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToSvg } from '../../src/renderer/screenshot.js';

describe('htmlToSvg', () => {
  it('wraps HTML in SVG foreignObject', () => {
    const html = '<!DOCTYPE html><html><body><div>Hello</div></body></html>';
    const svg = htmlToSvg(html, 393, 852);

    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.includes('width="393"'));
    assert.ok(svg.includes('height="852"'));
    assert.ok(svg.includes('<foreignObject'));
    assert.ok(svg.includes('Hello'));
    assert.ok(svg.endsWith('</svg>'));
  });

  it('includes viewBox attribute', () => {
    const svg = htmlToSvg('<html></html>', 400, 800);
    assert.ok(svg.includes('viewBox="0 0 400 800"'));
  });

  it('preserves HTML content intact', () => {
    const html = '<!DOCTYPE html><html><head><style>.test { color: red; }</style></head><body><div class="test">Styled</div></body></html>';
    const svg = htmlToSvg(html, 393, 852);
    assert.ok(svg.includes('color: red'));
    assert.ok(svg.includes('class="test"'));
  });
});
```

**Step 2: Add htmlToSvg to screenshot.js**

In `src/renderer/screenshot.js`, add the following function after the existing `takeScreenshot` function and before `closeBrowser`:

```javascript
/**
 * Generate PDF from HTML using Puppeteer.
 * Returns a Buffer containing the PDF data.
 */
export async function takePdfExport(html, width, height) {
  if (!browser) await initBrowser();

  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      pageRanges: '1',
    });
    return Buffer.from(buffer);
  } catch (err) {
    try { await browser.close(); } catch (_) {}
    browser = null;
    throw err;
  } finally {
    if (page) try { await page.close(); } catch (_) {}
  }
}

/**
 * Convert full HTML document to SVG by wrapping in foreignObject.
 * Pure function — no Puppeteer dependency.
 */
export function htmlToSvg(html, width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="100%" height="100%">
    ${html}
  </foreignObject>
</svg>`;
}
```

**Step 3: Update saveExport to handle format parameter**

In `src/storage/project-store.js`, replace the existing `saveExport` method:

```javascript
async saveExport(projectId, screenId, buffer, format = 'png') {
  this._validateId(projectId);
  this._validateId(screenId);

  const exportDir = join(this.exportsDir, projectId);
  await mkdir(exportDir, { recursive: true });

  const filePath = join(exportDir, `${screenId}.${format}`);
  await writeFile(filePath, buffer);
  return filePath;
}
```

**Step 4: Update export-tools.js to support format parameter**

Replace `src/mcp/tools/export-tools.js` entirely:

```javascript
import { z } from 'zod';
import { buildScreenHtml } from '../../renderer/html-builder.js';
import { takeScreenshot, takePdfExport, htmlToSvg } from '../../renderer/screenshot.js';
import { config } from '../../config.js';

export function registerExportTools(server, store) {
  server.tool(
    'mockup_export',
    'Export a screen as PNG, SVG, or PDF. Returns the file path and inline content.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID to export'),
      format: z.enum(['png', 'svg', 'pdf']).optional().default('png')
        .describe('Export format: png (raster), svg (vector), pdf (document). Default: png'),
      scale: z
        .number()
        .optional()
        .default(config.screenshotScale)
        .describe('Scale factor for PNG screenshots (ignored for SVG/PDF). Default: 2x'),
    },
    async ({ project_id, screen_id, format, scale }) => {
      try {
        const project = await store.getProject(project_id);
        const screen = project.screens.find((s) => s.id === screen_id);
        if (!screen) {
          throw new Error(`Screen ${screen_id} not found in project ${project_id}`);
        }

        const style = screen.style || project.style || 'wireframe';
        const html = buildScreenHtml(screen, style);

        if (format === 'svg') {
          const svgContent = htmlToSvg(html, screen.width, screen.height);
          const filePath = await store.saveExport(project_id, screen_id, svgContent, 'svg');

          return {
            content: [
              {
                type: 'text',
                text: `Exported SVG to ${filePath} (${screen.width}x${screen.height})`,
              },
              {
                type: 'text',
                text: svgContent,
              },
            ],
          };
        }

        if (format === 'pdf') {
          const pdfBuffer = await takePdfExport(html, screen.width, screen.height);
          const filePath = await store.saveExport(project_id, screen_id, pdfBuffer, 'pdf');

          return {
            content: [
              {
                type: 'text',
                text: `Exported PDF to ${filePath} (${screen.width}x${screen.height})`,
              },
            ],
          };
        }

        // Default: PNG
        const buffer = await takeScreenshot(html, screen.width, screen.height, scale);
        const filePath = await store.saveExport(project_id, screen_id, buffer, 'png');

        return {
          content: [
            {
              type: 'text',
              text: `Exported to ${filePath} (${screen.width}x${screen.height} @${scale}x)`,
            },
            {
              type: 'image',
              data: buffer.toString('base64'),
              mimeType: 'image/png',
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'mockup_get_preview_url',
    'Get the live preview URL for a screen (opens in browser via the preview server)',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
    },
    async ({ project_id, screen_id }) => {
      try {
        const project = await store.getProject(project_id);
        const screen = project.screens.find((s) => s.id === screen_id);
        if (!screen) {
          throw new Error(`Screen ${screen_id} not found in project ${project_id}`);
        }

        const url = `http://localhost:${config.previewPort}/preview/${project_id}/${screen_id}`;
        return {
          content: [{ type: 'text', text: url }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
```

**Step 5: Run tests**

```bash
node --test tests/renderer/screenshot-formats.test.js
```

Expected: All PASS.

**Step 6: Commit**

```bash
git add src/renderer/screenshot.js src/mcp/tools/export-tools.js src/storage/project-store.js tests/renderer/screenshot-formats.test.js
git commit -m "feat: SVG/PDF export formats + format param on mockup_export"
```

---

### Task 11: Full Integration Tests

**Files:**
- Create: `tests/integration/m2b-integration.test.js`

**Dependencies:** Tasks 7, 9, 10

**Step 1: Create integration test file**

Create `tests/integration/m2b-integration.test.js`:

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { z } from 'zod';
import { ProjectStore } from '../../src/storage/project-store.js';
import { registerProjectTools } from '../../src/mcp/tools/project-tools.js';
import { registerScreenTools } from '../../src/mcp/tools/screen-tools.js';
import { registerElementTools } from '../../src/mcp/tools/element-tools.js';
import { registerTemplateTools } from '../../src/mcp/tools/template-tools.js';
import { registerLayoutTools } from '../../src/mcp/tools/layout-tools.js';

// MockServer — same pattern as tools.integration.test.js
class MockServer {
  constructor() {
    this.tools = new Map();
  }
  tool(name, desc, schema, handler) {
    this.tools.set(name, { desc, schema, handler });
  }
  async callTool(name, params) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" not registered`);
    const zodSchema = z.object(tool.schema);
    const parsed = zodSchema.parse(params);
    return tool.handler(parsed);
  }
}

function parseResult(response) {
  return JSON.parse(response.content[0].text);
}

describe('M2b Integration Tests', () => {
  let server;
  let store;
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mockupmcp-m2b-test-'));
    store = new ProjectStore(tmpDir);
    await store.init();

    server = new MockServer();
    registerProjectTools(server, store);
    registerScreenTools(server, store);
    registerElementTools(server, store);
    registerTemplateTools(server, store);
    registerLayoutTools(server, store);
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -- Template + Layout workflow --

  describe('apply template then auto-layout', () => {
    it('applies login template and then re-layouts vertically', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Template+Layout' });
      const projectId = parseResult(projRes).id;

      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Login',
      });
      const screenId = parseResult(scrRes).id;

      // Apply template
      const tmplRes = await server.callTool('mockup_apply_template', {
        project_id: projectId,
        screen_id: screenId,
        template: 'login',
      });
      const screen = parseResult(tmplRes);

      assert.ok(screen.elements.length >= 5, 'Login template should create at least 5 elements');
      assert.ok(screen.elements.every(e => e.id.startsWith('el_')));

      // Auto-layout the non-pinned elements
      const layoutRes = await server.callTool('mockup_auto_layout', {
        project_id: projectId,
        screen_id: screenId,
        direction: 'vertical',
        spacing: 16,
        padding: 24,
        start_y: 56, // skip navbar
      });
      const layoutScreen = parseResult(layoutRes);

      // Verify navbar stayed pinned (z_index >= 10)
      const navbar = layoutScreen.elements.find(e => e.type === 'navbar');
      assert.equal(navbar.y, 0, 'Navbar should remain at y=0 (pinned)');

      // Non-pinned elements should be stacked
      const nonPinned = layoutScreen.elements.filter(e => e.z_index < 10);
      for (let i = 1; i < nonPinned.length; i++) {
        assert.ok(
          nonPinned[i].y > nonPinned[i - 1].y,
          `Element ${i} should be below element ${i - 1}`
        );
      }
    });
  });

  describe('apply template then modify elements', () => {
    it('applies dashboard template and updates a card title', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Template+Edit' });
      const projectId = parseResult(projRes).id;

      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Dashboard',
      });
      const screenId = parseResult(scrRes).id;

      // Apply template
      const tmplRes = await server.callTool('mockup_apply_template', {
        project_id: projectId,
        screen_id: screenId,
        template: 'dashboard',
      });
      const screen = parseResult(tmplRes);

      // Find first card element
      const card = screen.elements.find(e => e.type === 'card');
      assert.ok(card, 'Dashboard should contain a card element');

      // Update the card title
      const updateRes = await server.callTool('mockup_update_element', {
        project_id: projectId,
        screen_id: screenId,
        element_id: card.id,
        properties: { title: 'Custom Title' },
      });
      const updatedCard = parseResult(updateRes);
      assert.equal(updatedCard.properties.title, 'Custom Title');
    });
  });

  describe('list templates tool', () => {
    it('returns all 7 templates with descriptions', async () => {
      const res = await server.callTool('mockup_list_templates', {});
      const templates = parseResult(res);

      assert.equal(templates.length, 7);
      for (const tmpl of templates) {
        assert.equal(typeof tmpl.name, 'string');
        assert.equal(typeof tmpl.description, 'string');
        assert.equal(typeof tmpl.elementCount, 'number');
        assert.ok(tmpl.elementCount >= 5);
      }
    });
  });

  describe('auto-layout with element_ids filter', () => {
    it('layouts only specified elements', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Layout Filter' });
      const projectId = parseResult(projRes).id;

      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Test',
      });
      const screenId = parseResult(scrRes).id;

      // Add 3 elements
      const el1Res = await server.callTool('mockup_add_element', {
        project_id: projectId, screen_id: screenId,
        type: 'text', x: 100, y: 100, width: 200, height: 30,
        properties: { content: 'A' },
      });
      const el1 = parseResult(el1Res);

      const el2Res = await server.callTool('mockup_add_element', {
        project_id: projectId, screen_id: screenId,
        type: 'text', x: 100, y: 200, width: 200, height: 30,
        properties: { content: 'B' },
      });
      const el2 = parseResult(el2Res);

      const el3Res = await server.callTool('mockup_add_element', {
        project_id: projectId, screen_id: screenId,
        type: 'text', x: 100, y: 300, width: 200, height: 30,
        properties: { content: 'C' },
      });
      const el3 = parseResult(el3Res);

      // Layout only el1 and el3
      const layoutRes = await server.callTool('mockup_auto_layout', {
        project_id: projectId,
        screen_id: screenId,
        direction: 'vertical',
        element_ids: [el1.id, el3.id],
      });
      const screen = parseResult(layoutRes);

      const updatedEl2 = screen.elements.find(e => e.id === el2.id);
      // el2 should remain at original position
      assert.equal(updatedEl2.x, 100);
      assert.equal(updatedEl2.y, 200);
    });
  });

  describe('auto-layout grid mode', () => {
    it('arranges elements in grid columns', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Grid Layout' });
      const projectId = parseResult(projRes).id;

      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Grid',
      });
      const screenId = parseResult(scrRes).id;

      // Add 4 cards
      const ids = [];
      for (let i = 0; i < 4; i++) {
        const elRes = await server.callTool('mockup_add_element', {
          project_id: projectId, screen_id: screenId,
          type: 'card', x: 0, y: 0, width: 100, height: 80,
          properties: { title: `Card ${i + 1}` },
        });
        ids.push(parseResult(elRes).id);
      }

      const layoutRes = await server.callTool('mockup_auto_layout', {
        project_id: projectId,
        screen_id: screenId,
        direction: 'grid',
        columns: 2,
        spacing: 16,
        padding: 16,
      });
      const screen = parseResult(layoutRes);

      // Row 0: elements 0, 1 at same y
      assert.equal(screen.elements[0].y, screen.elements[1].y);
      // Row 1: elements 2, 3 at same y, below row 0
      assert.equal(screen.elements[2].y, screen.elements[3].y);
      assert.ok(screen.elements[2].y > screen.elements[0].y);
      // Column check: element 1 is to the right of element 0
      assert.ok(screen.elements[1].x > screen.elements[0].x);
    });
  });

  describe('template clear=false preserves existing elements', () => {
    it('adds template elements after existing ones', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Clear False' });
      const projectId = parseResult(projRes).id;

      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId,
        name: 'Mixed',
      });
      const screenId = parseResult(scrRes).id;

      // Add a manual element
      await server.callTool('mockup_add_element', {
        project_id: projectId, screen_id: screenId,
        type: 'text', x: 0, y: 0, width: 100, height: 30,
        properties: { content: 'Manual' },
      });

      // Apply template without clearing
      const tmplRes = await server.callTool('mockup_apply_template', {
        project_id: projectId,
        screen_id: screenId,
        template: 'login',
        clear: false,
      });
      const screen = parseResult(tmplRes);

      // Should have manual element + all template elements
      const manualEl = screen.elements.find(e => e.properties.content === 'Manual');
      assert.ok(manualEl, 'Manual element should still exist');
      assert.ok(screen.elements.length >= 6, 'Should have manual + template elements');
    });
  });

  describe('error handling', () => {
    it('returns error for nonexistent template', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Err Template' });
      const projectId = parseResult(projRes).id;
      const scrRes = await server.callTool('mockup_add_screen', {
        project_id: projectId, name: 'X',
      });
      const screenId = parseResult(scrRes).id;

      // z.enum validation will throw before handler — test via zod
      await assert.rejects(
        () => server.callTool('mockup_apply_template', {
          project_id: projectId,
          screen_id: screenId,
          template: 'nonexistent',
        }),
        /Invalid enum/i,
      );
    });

    it('returns error for nonexistent screen in auto_layout', async () => {
      const projRes = await server.callTool('mockup_create_project', { name: 'Err Layout' });
      const projectId = parseResult(projRes).id;

      const res = await server.callTool('mockup_auto_layout', {
        project_id: projectId,
        screen_id: 'scr_nonexistent',
        direction: 'vertical',
      });
      assert.equal(res.isError, true);
      assert.ok(res.content[0].text.includes('Error'));
    });
  });
});
```

**Step 2: Run integration tests**

```bash
node --test tests/integration/m2b-integration.test.js
```

Expected: All PASS.

**Step 3: Commit**

```bash
git add tests/integration/m2b-integration.test.js
git commit -m "test: M2b integration tests — template+layout workflows, error handling"
```

---

### Task 12: PM Updates + Final Commit

**Files:**
- Create: `PM/tasks/M2b.md`
- Modify: `PM/milestones.md`

**Dependencies:** Task 11

**Step 1: Run full test suite**

```bash
node --test tests/**/*.test.js
```

Expected: All tests PASS.

**Step 2: Create M2b task tracking file**

Create `PM/tasks/M2b.md`:

```markdown
# M2b — Templates, Auto-Layout, Export Formats

## Sprint 1: Template System

| # | Task | Status | Files |
|---|------|--------|-------|
| 1 | Template registry + storage method | DONE | templates/index.js, project-store.js |
| 2 | Templates: login, form, onboarding | DONE | templates/login.js, form.js, onboarding.js |
| 3 | Templates: dashboard, list | DONE | templates/dashboard.js, list.js |
| 4 | Templates: settings, profile | DONE | templates/settings.js, profile.js |
| 5 | Template MCP tools + registry update | DONE | template-tools.js, tools/index.js |
| 6 | Template integration tests | DONE | templates-integration.test.js |
| 7 | Sprint 1 commit + test run | DONE | — |

## Sprint 2: Auto-Layout + Export

| # | Task | Status | Files |
|---|------|--------|-------|
| 8 | Layout engine | DONE | layout.js, layout.test.js |
| 9 | Auto-layout MCP tool + storage | DONE | layout-tools.js, project-store.js |
| 10 | SVG/PDF export | DONE | screenshot.js, export-tools.js |
| 11 | Full integration tests | DONE | m2b-integration.test.js |
| 12 | PM updates + final commit | DONE | M2b.md, milestones.md |
```

**Step 3: Update milestones.md**

Add M2b entry to `PM/milestones.md`.

**Step 4: Final commit**

```bash
git add PM/
git commit -m "docs: M2b task statuses and milestones"
```

---

## Summary

| Sprint | Tasks | New Files | Modified Files | Est. Tests |
|--------|-------|-----------|----------------|------------|
| Sprint 1 | 1-7 | 10 (7 templates, registry, tool, integration test) | 3 (project-store, tools/index, storage test) | ~90 |
| Sprint 2 | 8-12 | 4 (layout.js, layout-tools.js, screenshot-formats test, integration test) | 4 (project-store, screenshot, export-tools, tools/index) | ~60 |
| **Total** | 12 | 14 | 7 | ~150 new |

## Parallelization Opportunities

```
Task 1 (registry+storage)
  |-- Task 2 (login, form, onboarding)   --\
  |-- Task 3 (dashboard, list)            -- can run parallel
  |-- Task 4 (settings, profile)          --/
        \-- Task 5 (MCP tools + registry update)
              \-- Task 6 (integration tests)
                    \-- Task 7 (sprint 1 commit)

Task 8 (layout engine)     -- parallel with Sprint 1
  \-- Task 9 (layout MCP tool)

Task 10 (SVG/PDF export)   -- parallel with Sprint 1

Tasks 7, 9, 10
  \-- Task 11 (full integration)
        \-- Task 12 (PM + commit)
```

**Sprint 1:** Tasks 2, 3, 4 are fully independent (different template files, no overlap).
**Sprint 2:** Tasks 8+9 (layout) and Task 10 (export) are fully independent.
**Cross-sprint:** Task 8 can start before Sprint 1 finishes (no file overlap).

## Team Composition

**Sprint 1 (templates):**
- dev-1: Tasks 2 + 3 (login, form, onboarding, dashboard, list)
- dev-2: Task 4 (settings, profile)
- dev-3: Task 5 (MCP tools)
- reviewer: Task 6 (integration tests) + review

**Sprint 2 (layout + export):**
- dev-1: Tasks 8 + 9 (layout engine + MCP tool)
- dev-2: Task 10 (SVG/PDF export)
- reviewer: Task 11 (integration tests) + review
