# M3a Implementation Plan — Code Export, Navigation, Flow, Grouping

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add code generation (HTML/React/Flutter/SwiftUI), screen navigation with clickable links, Mermaid flow export, element grouping, and opacity support.

**Architecture:** Codegen modules in `src/codegen/` follow same plugin pattern as components — pure functions `generate(screen) → string`. Navigation uses `element.properties.link_to`. Groups stored in `screen.groups[]`. Flow export uses Mermaid.js for diagram rendering.

**Tech Stack:** Node.js 20, ESM, Node test runner, Zod, Puppeteer, Mermaid.js

**Design doc:** `docs/plans/2026-02-20-m3a-design.md`

---

## Sprint 1: Foundations (4 parallel tasks)

### Task 1: Codegen Registry + HTML Generator

**Files:**
- Create: `src/codegen/index.js`
- Create: `src/codegen/html.js`
- Create: `tests/codegen/codegen.test.js`

**Dependencies:** None

**Step 1: Write failing tests**

Create `tests/codegen/codegen.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getGenerator, getAvailableFrameworks } from '../../src/codegen/index.js';

describe('codegen registry', () => {
  it('getAvailableFrameworks returns array with html', () => {
    const frameworks = getAvailableFrameworks();
    assert.ok(frameworks.includes('html'));
  });

  it('getGenerator returns object with generate function', () => {
    const gen = getGenerator('html');
    assert.ok(gen !== null);
    assert.equal(typeof gen.generate, 'function');
  });

  it('getGenerator returns null for unknown framework', () => {
    assert.equal(getGenerator('cobol'), null);
  });
});

describe('html codegen', () => {
  const screen = {
    id: 'scr_test', name: 'Test', width: 393, height: 852,
    background: '#FFFFFF',
    elements: [
      { id: 'el_1', type: 'text', x: 20, y: 20, width: 200, height: 40, z_index: 0,
        properties: { content: 'Hello World', fontSize: 24 } },
      { id: 'el_2', type: 'button', x: 20, y: 80, width: 200, height: 48, z_index: 0,
        properties: { label: 'Click Me', variant: 'primary' } },
    ],
  };

  it('generate returns valid HTML string', () => {
    const gen = getGenerator('html');
    const code = gen.generate(screen);
    assert.ok(code.includes('<!DOCTYPE html>'));
    assert.ok(code.includes('Hello World'));
    assert.ok(code.includes('Click Me'));
  });

  it('generate includes absolute positioning styles', () => {
    const gen = getGenerator('html');
    const code = gen.generate(screen);
    assert.ok(code.includes('position: absolute'));
    assert.ok(code.includes('left: 20px'));
  });

  it('generate handles empty elements', () => {
    const gen = getGenerator('html');
    const code = gen.generate({ ...screen, elements: [] });
    assert.ok(code.includes('<!DOCTYPE html>'));
  });

  it('mapComponent returns HTML for known types', () => {
    const gen = getGenerator('html');
    const html = gen.mapComponent(screen.elements[1]);
    assert.ok(html.includes('button'));
    assert.ok(html.includes('Click Me'));
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
node --test tests/codegen/codegen.test.js
```

**Step 3: Implement codegen registry**

Create `src/codegen/index.js`:

```javascript
import * as html from './html.js';

const generators = { html };

export function getGenerator(framework) {
  return generators[framework] || null;
}

export function getAvailableFrameworks() {
  return Object.keys(generators);
}
```

**Step 4: Implement HTML generator**

Create `src/codegen/html.js`:

Each element maps to semantic HTML with inline absolute positioning. The generator iterates screen.elements, calls mapComponent per element, wraps in full HTML document.

Component type mapping:
- `text` → `<p>` or `<h1>`-`<h6>` based on fontSize
- `button` → `<button class="...">`
- `input` → `<label>` + `<input>`
- `image` → `<img>` or `<div>` placeholder
- `navbar` → `<nav>` with title
- `card` → `<div class="card">` with children
- `rectangle` → `<div>` with background
- Other types → `<div>` with type as comment

Pattern:
```javascript
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
  <title>${screen.name || 'Screen'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .screen { position: relative; width: ${screen.width}px; height: ${screen.height}px; background: ${screen.background || '#FFFFFF'}; }
  </style>
</head>
<body>
<div class="screen">
${elements}
</div>
</body>
</html>`;
}

export function mapComponent(el) {
  // switch on el.type, return semantic HTML
}
```

Implement mapComponent with switch/case for all 35 component types. Each case returns clean semantic HTML. Use `escapeHtml` from `../renderer/components/utils.js` for user content.

**Step 5: Run tests — expect PASS**

```bash
node --test tests/codegen/codegen.test.js
```

**Step 6: Commit**

```bash
git add src/codegen/index.js src/codegen/html.js tests/codegen/codegen.test.js
git commit -m "feat: codegen registry + HTML generator"
```

---

### Task 2: Navigation Storage + Link MCP Tools

**Files:**
- Modify: `src/storage/project-store.js` (add addLink, removeLink, getLinksForProject)
- Modify: `src/mcp/tools/element-tools.js` (add mockup_add_link, mockup_remove_link)
- Modify: `src/mcp/tools/index.js` (update tool count)
- Create: `tests/storage/links.test.js`
- Create: `tests/mcp/link-tools.test.js`

**Dependencies:** None

**Step 1: Write storage tests**

Create `tests/storage/links.test.js`:

```javascript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore } from '../../src/storage/project-store.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('link storage', () => {
  let store, projectId, screenId1, screenId2, elementId;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'links-'));
    store = new ProjectStore(dir);
    await store.init();
    const project = await store.createProject('Nav Test');
    projectId = project.id;
    const s1 = await store.addScreen(projectId, 'Login');
    const s2 = await store.addScreen(projectId, 'Dashboard');
    screenId1 = s1.id;
    screenId2 = s2.id;
    const el = await store.addElement(projectId, screenId1, 'button', 10, 10, 100, 40, { label: 'Go' });
    elementId = el.id;
  });

  it('addLink sets link_to on element properties', async () => {
    await store.addLink(projectId, screenId1, elementId, screenId2, 'push');
    const els = await store.listElements(projectId, screenId1);
    const el = els.find(e => e.id === elementId);
    assert.deepStrictEqual(el.properties.link_to, { screen_id: screenId2, transition: 'push' });
  });

  it('addLink validates target screen exists', async () => {
    await assert.rejects(
      () => store.addLink(projectId, screenId1, elementId, 'scr_nonexistent', 'push'),
      /not found/
    );
  });

  it('addLink defaults transition to push', async () => {
    await store.addLink(projectId, screenId1, elementId, screenId2);
    const els = await store.listElements(projectId, screenId1);
    const el = els.find(e => e.id === elementId);
    assert.equal(el.properties.link_to.transition, 'push');
  });

  it('removeLink clears link_to from element', async () => {
    await store.addLink(projectId, screenId1, elementId, screenId2, 'push');
    await store.removeLink(projectId, screenId1, elementId);
    const els = await store.listElements(projectId, screenId1);
    const el = els.find(e => e.id === elementId);
    assert.equal(el.properties.link_to, undefined);
  });

  it('getLinksForProject returns all links across screens', async () => {
    await store.addLink(projectId, screenId1, elementId, screenId2, 'fade');
    const links = await store.getLinksForProject(projectId);
    assert.equal(links.length, 1);
    assert.equal(links[0].from_screen, screenId1);
    assert.equal(links[0].from_element, elementId);
    assert.equal(links[0].to_screen, screenId2);
    assert.equal(links[0].transition, 'fade');
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
node --test tests/storage/links.test.js
```

**Step 3: Implement storage methods**

Add to `src/storage/project-store.js`:

```javascript
async addLink(projectId, screenId, elementId, targetScreenId, transition = 'push') {
  this._validateId(screenId);
  this._validateId(elementId);
  this._validateId(targetScreenId);
  const project = await this.getProject(projectId);
  const screen = this._findScreen(project, screenId);

  // Validate target screen exists in same project
  const targetExists = project.screens.some(s => s.id === targetScreenId);
  if (!targetExists) {
    throw new Error(`Target screen ${targetScreenId} not found in project ${projectId}`);
  }

  const element = screen.elements.find(e => e.id === elementId);
  if (!element) {
    throw new Error(`Element ${elementId} not found in screen ${screenId}`);
  }

  element.properties.link_to = { screen_id: targetScreenId, transition };
  await this._save(project);
  return element;
}

async removeLink(projectId, screenId, elementId) {
  this._validateId(screenId);
  this._validateId(elementId);
  const project = await this.getProject(projectId);
  const screen = this._findScreen(project, screenId);
  const element = screen.elements.find(e => e.id === elementId);
  if (!element) {
    throw new Error(`Element ${elementId} not found in screen ${screenId}`);
  }
  delete element.properties.link_to;
  await this._save(project);
  return element;
}

async getLinksForProject(projectId) {
  const project = await this.getProject(projectId);
  const links = [];
  for (const screen of project.screens) {
    for (const el of screen.elements) {
      if (el.properties.link_to) {
        links.push({
          from_screen: screen.id,
          from_screen_name: screen.name,
          from_element: el.id,
          from_element_type: el.type,
          to_screen: el.properties.link_to.screen_id,
          to_screen_name: project.screens.find(s => s.id === el.properties.link_to.screen_id)?.name || 'Unknown',
          transition: el.properties.link_to.transition,
        });
      }
    }
  }
  return links;
}
```

**Step 4: Run storage tests — expect PASS**

```bash
node --test tests/storage/links.test.js
```

**Step 5: Write MCP tool tests**

Create `tests/mcp/link-tools.test.js` — test that mockup_add_link and mockup_remove_link register correctly and handle valid/invalid inputs. Pattern: same as existing `tests/mcp/tools.integration.test.js`.

**Step 6: Implement MCP tools**

Add to `src/mcp/tools/element-tools.js` — two new `server.tool()` registrations:
- `mockup_add_link(project_id, screen_id, element_id, target_screen_id, transition?)` — calls `store.addLink()`
- `mockup_remove_link(project_id, screen_id, element_id)` — calls `store.removeLink()`

Follow exact same pattern as existing tools (Zod schema, try/catch, error response format).

**Step 7: Update tool count in index.js**

Update `src/mcp/tools/index.js` tool count comment from 17 to 19.

**Step 8: Run all tests — expect PASS**

```bash
node --test tests/storage/links.test.js tests/mcp/link-tools.test.js
```

**Step 9: Commit**

```bash
git add src/storage/project-store.js src/mcp/tools/element-tools.js src/mcp/tools/index.js tests/storage/links.test.js tests/mcp/link-tools.test.js
git commit -m "feat: navigation links — storage + MCP tools (add_link, remove_link)"
```

---

### Task 3: Grouping Storage + MCP Tools

**Files:**
- Modify: `src/storage/project-store.js` (add groupElements, ungroupElements, moveGroup)
- Create: `src/mcp/tools/group-tools.js`
- Modify: `src/mcp/tools/index.js` (register group tools)
- Create: `tests/storage/groups.test.js`
- Create: `tests/mcp/group-tools.test.js`

**Dependencies:** None

**Step 1: Write storage tests**

Create `tests/storage/groups.test.js`:

```javascript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore } from '../../src/storage/project-store.js';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('group storage', () => {
  let store, projectId, screenId, el1Id, el2Id, el3Id;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'groups-'));
    store = new ProjectStore(dir);
    await store.init();
    const p = await store.createProject('Group Test');
    projectId = p.id;
    const s = await store.addScreen(projectId, 'Main');
    screenId = s.id;
    const e1 = await store.addElement(projectId, screenId, 'text', 10, 10, 100, 30, { content: 'A' });
    const e2 = await store.addElement(projectId, screenId, 'text', 10, 50, 100, 30, { content: 'B' });
    const e3 = await store.addElement(projectId, screenId, 'button', 10, 90, 100, 40, { label: 'C' });
    el1Id = e1.id; el2Id = e2.id; el3Id = e3.id;
  });

  it('groupElements creates group with grp_ prefix ID', async () => {
    const group = await store.groupElements(projectId, screenId, [el1Id, el2Id], 'Header');
    assert.ok(group.id.startsWith('grp_'));
    assert.equal(group.name, 'Header');
    assert.deepStrictEqual(group.element_ids, [el1Id, el2Id]);
  });

  it('groupElements adds groups array to screen', async () => {
    await store.groupElements(projectId, screenId, [el1Id, el2Id]);
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === screenId);
    assert.equal(screen.groups.length, 1);
  });

  it('groupElements validates all element IDs exist', async () => {
    await assert.rejects(
      () => store.groupElements(projectId, screenId, [el1Id, 'el_fake']),
      /not found/
    );
  });

  it('groupElements requires at least 2 elements', async () => {
    await assert.rejects(
      () => store.groupElements(projectId, screenId, [el1Id]),
      /at least 2/
    );
  });

  it('ungroupElements removes group, keeps elements', async () => {
    const group = await store.groupElements(projectId, screenId, [el1Id, el2Id]);
    await store.ungroupElements(projectId, screenId, group.id);
    const project = await store.getProject(projectId);
    const screen = project.screens.find(s => s.id === screenId);
    assert.equal(screen.groups.length, 0);
    assert.equal(screen.elements.length, 3); // all 3 elements still exist
  });

  it('moveGroup shifts all elements by delta', async () => {
    const group = await store.groupElements(projectId, screenId, [el1Id, el2Id]);
    await store.moveGroup(projectId, screenId, group.id, 50, 100);
    const els = await store.listElements(projectId, screenId);
    const e1 = els.find(e => e.id === el1Id);
    const e2 = els.find(e => e.id === el2Id);
    const e3 = els.find(e => e.id === el3Id);
    assert.equal(e1.x, 60); assert.equal(e1.y, 110); // 10+50, 10+100
    assert.equal(e2.x, 60); assert.equal(e2.y, 150); // 10+50, 50+100
    assert.equal(e3.x, 10); assert.equal(e3.y, 90);  // unchanged
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
node --test tests/storage/groups.test.js
```

**Step 3: Implement storage methods**

Add to `src/storage/project-store.js`:

```javascript
async groupElements(projectId, screenId, elementIds, name = 'Group') {
  this._validateId(screenId);
  const project = await this.getProject(projectId);
  const screen = this._findScreen(project, screenId);

  if (elementIds.length < 2) {
    throw new Error('Group requires at least 2 elements');
  }

  // Validate all elements exist
  for (const elId of elementIds) {
    if (!screen.elements.find(e => e.id === elId)) {
      throw new Error(`Element ${elId} not found in screen ${screenId}`);
    }
  }

  if (!screen.groups) screen.groups = [];

  const group = {
    id: generateId('grp'),
    name,
    element_ids: [...elementIds],
  };
  screen.groups.push(group);
  await this._save(project);
  return group;
}

async ungroupElements(projectId, screenId, groupId) {
  this._validateId(screenId);
  const project = await this.getProject(projectId);
  const screen = this._findScreen(project, screenId);
  if (!screen.groups) throw new Error(`Group ${groupId} not found`);

  const idx = screen.groups.findIndex(g => g.id === groupId);
  if (idx === -1) throw new Error(`Group ${groupId} not found in screen ${screenId}`);

  screen.groups.splice(idx, 1);
  await this._save(project);
}

async moveGroup(projectId, screenId, groupId, deltaX, deltaY) {
  this._validateId(screenId);
  const project = await this.getProject(projectId);
  const screen = this._findScreen(project, screenId);
  if (!screen.groups) throw new Error(`Group ${groupId} not found`);

  const group = screen.groups.find(g => g.id === groupId);
  if (!group) throw new Error(`Group ${groupId} not found in screen ${screenId}`);

  for (const elId of group.element_ids) {
    const el = screen.elements.find(e => e.id === elId);
    if (el) {
      el.x += deltaX;
      el.y += deltaY;
    }
  }
  await this._save(project);
  return screen;
}
```

**Step 4: Run storage tests — expect PASS**

```bash
node --test tests/storage/groups.test.js
```

**Step 5: Write and implement MCP tools**

Create `src/mcp/tools/group-tools.js`:

```javascript
import { z } from 'zod';

export function registerGroupTools(server, store) {
  server.tool(
    'mockup_group_elements',
    'Group multiple elements together. Groups can be moved as a unit.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      element_ids: z.array(z.string()).min(2).describe('Element IDs to group (minimum 2)'),
      group_name: z.string().optional().default('Group').describe('Name for the group'),
    },
    async ({ project_id, screen_id, element_ids, group_name }) => {
      // try/catch, call store.groupElements, return JSON
    }
  );

  server.tool(
    'mockup_ungroup_elements',
    'Remove a group. Elements remain in place.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      group_id: z.string().describe('Group ID to remove'),
    },
    async ({ project_id, screen_id, group_id }) => {
      // try/catch, call store.ungroupElements
    }
  );

  server.tool(
    'mockup_move_group',
    'Move all elements in a group by delta X/Y offset.',
    {
      project_id: z.string().describe('Project ID'),
      screen_id: z.string().describe('Screen ID'),
      group_id: z.string().describe('Group ID'),
      delta_x: z.number().describe('Horizontal offset (positive = right)'),
      delta_y: z.number().describe('Vertical offset (positive = down)'),
    },
    async ({ project_id, screen_id, group_id, delta_x, delta_y }) => {
      // try/catch, call store.moveGroup
    }
  );
}
```

Update `src/mcp/tools/index.js` — import and register group tools.

**Step 6: Run all tests — expect PASS**

```bash
node --test tests/storage/groups.test.js tests/mcp/group-tools.test.js
```

**Step 7: Commit**

```bash
git add src/storage/project-store.js src/mcp/tools/group-tools.js src/mcp/tools/index.js tests/storage/groups.test.js tests/mcp/group-tools.test.js
git commit -m "feat: element grouping — storage + MCP tools (group, ungroup, move_group)"
```

---

### Task 4: html-builder Updates (Opacity + Link Data Attributes)

**Files:**
- Modify: `src/renderer/html-builder.js`
- Modify: `tests/renderer/html-builder.test.js`

**Dependencies:** None

**Step 1: Write failing tests**

Add to `tests/renderer/html-builder.test.js`:

```javascript
describe('opacity support', () => {
  it('applies opacity style when element has opacity property', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'text', x: 0, y: 0, width: 100, height: 30, z_index: 0,
          properties: { content: 'Faded', opacity: 0.5 } },
      ],
    };
    const html = buildScreenHtml(screen);
    assert.ok(html.includes('opacity:0.5'));
  });

  it('omits opacity when not set or 1.0', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'text', x: 0, y: 0, width: 100, height: 30, z_index: 0,
          properties: { content: 'Solid' } },
      ],
    };
    const html = buildScreenHtml(screen);
    assert.ok(!html.includes('opacity:'));
  });
});

describe('link data attributes', () => {
  it('adds data-link-to attribute when element has link_to', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0,
          properties: { label: 'Go', link_to: { screen_id: 'scr_abc', transition: 'push' } } },
      ],
    };
    const html = buildScreenHtml(screen);
    assert.ok(html.includes('data-link-to="scr_abc"'));
    assert.ok(html.includes('data-transition="push"'));
    assert.ok(html.includes('cursor:pointer'));
  });

  it('does not add link attributes when no link_to', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0,
          properties: { label: 'Stay' } },
      ],
    };
    const html = buildScreenHtml(screen);
    assert.ok(!html.includes('data-link-to'));
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
node --test tests/renderer/html-builder.test.js
```

**Step 3: Modify html-builder.js**

Update the element wrapper div generation in `buildScreenHtml`:

```javascript
.map(el => {
  const component = getComponent(el.type);
  if (!component) return `<!-- unknown type: ${el.type} -->`;
  const innerHtml = component.render({ ...el.properties, _style: style });

  // Build inline style
  let inlineStyle = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.z_index || 0};overflow:hidden;`;

  // Opacity support
  const opacity = el.properties?.opacity;
  if (opacity !== undefined && opacity !== null && opacity !== 1) {
    inlineStyle += `opacity:${opacity};`;
  }

  // Link support
  let linkAttrs = '';
  const linkTo = el.properties?.link_to;
  if (linkTo && linkTo.screen_id) {
    linkAttrs = ` data-link-to="${linkTo.screen_id}" data-transition="${linkTo.transition || 'push'}"`;
    inlineStyle += 'cursor:pointer;';
  }

  return `<div class="element" style="${inlineStyle}"${linkAttrs}>${innerHtml}</div>`;
})
```

**Step 4: Run tests — expect PASS**

```bash
node --test tests/renderer/html-builder.test.js
```

**Step 5: Run full test suite — no regressions**

```bash
node --test
```

**Step 6: Commit**

```bash
git add src/renderer/html-builder.js tests/renderer/html-builder.test.js
git commit -m "feat: html-builder — opacity CSS + link data attributes"
```

---

## Sprint 2: Codegen Modules + Flow Export (4 parallel tasks)

### Task 5: React Codegen Module

**Files:**
- Create: `src/codegen/react.js`
- Create: `tests/codegen/react.test.js`

**Dependencies:** Task 1 (registry)

**Step 1: Write failing tests**

Create `tests/codegen/react.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generate, mapComponent } from '../../src/codegen/react.js';

const screen = {
  id: 'scr_test', name: 'Login', width: 393, height: 852,
  background: '#FFFFFF',
  elements: [
    { id: 'el_1', type: 'text', x: 20, y: 20, width: 200, height: 40, z_index: 0,
      properties: { content: 'Welcome', fontSize: 24 } },
    { id: 'el_2', type: 'button', x: 20, y: 80, width: 200, height: 48, z_index: 0,
      properties: { label: 'Sign In', variant: 'primary' } },
    { id: 'el_3', type: 'input', x: 20, y: 140, width: 350, height: 44, z_index: 0,
      properties: { placeholder: 'Email', type: 'email' } },
  ],
};

describe('react codegen', () => {
  it('generate returns functional component string', () => {
    const code = generate(screen);
    assert.ok(code.includes('function LoginScreen'));
    assert.ok(code.includes('return ('));
    assert.ok(code.includes('export default'));
  });

  it('generate includes imports', () => {
    const code = generate(screen);
    assert.ok(code.includes("import React from 'react'"));
  });

  it('generate uses absolute positioning', () => {
    const code = generate(screen);
    assert.ok(code.includes('position: "absolute"'));
  });

  it('mapComponent returns JSX for button', () => {
    const jsx = mapComponent(screen.elements[1]);
    assert.ok(jsx.includes('<button'));
    assert.ok(jsx.includes('Sign In'));
  });

  it('mapComponent returns JSX for input', () => {
    const jsx = mapComponent(screen.elements[2]);
    assert.ok(jsx.includes('<input'));
    assert.ok(jsx.includes('placeholder="Email"'));
  });

  it('handles screen name with spaces in component name', () => {
    const code = generate({ ...screen, name: 'My Login Screen' });
    assert.ok(code.includes('function MyLoginScreen'));
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement React generator**

Pattern: Generate functional React component with inline styles (absolute positioning). Screen name → PascalCase component name. Each element → JSX element positioned absolutely.

Mapping:
- `text` → `<p style={...}>` or `<h1>`-`<h6>`
- `button` → `<button style={...} onClick={() => {}}>`
- `input` → `<input style={...} />`
- `image` → `<img />` or `<div>` placeholder
- `navbar` → `<nav style={...}>`
- `card` → `<div style={...}>`

**Step 4: Register in codegen index.js**

Add `import * as react from './react.js'` and add to generators object.

**Step 5: Run tests — expect PASS**

**Step 6: Commit**

```bash
git add src/codegen/react.js tests/codegen/react.test.js src/codegen/index.js
git commit -m "feat: React codegen module"
```

---

### Task 6: Flutter Codegen Module

**Files:**
- Create: `src/codegen/flutter.js`
- Create: `tests/codegen/flutter.test.js`

**Dependencies:** Task 1 (registry)

**Step 1: Write failing tests**

```javascript
describe('flutter codegen', () => {
  it('generate returns StatelessWidget class', () => {
    const code = generate(screen);
    assert.ok(code.includes('class LoginScreen extends StatelessWidget'));
    assert.ok(code.includes('@override'));
    assert.ok(code.includes('Widget build'));
  });

  it('generate uses Stack + Positioned widgets', () => {
    const code = generate(screen);
    assert.ok(code.includes('Stack('));
    assert.ok(code.includes('Positioned('));
  });

  it('mapComponent returns Text widget for text type', () => {
    const dart = mapComponent(screen.elements[0]);
    assert.ok(dart.includes("Text('Welcome'"));
  });

  it('mapComponent returns ElevatedButton for primary button', () => {
    const dart = mapComponent(screen.elements[1]);
    assert.ok(dart.includes('ElevatedButton'));
    assert.ok(dart.includes('Sign In'));
  });
});
```

**Step 2-5:** Same flow: implement `src/codegen/flutter.js`, register in index.js, run tests.

Pattern: Generate Dart StatelessWidget. Container → Stack with Positioned children. Each element maps to Flutter widget.

Mapping:
- `text` → `Text('content', style: TextStyle(fontSize: N))`
- `button` → `ElevatedButton` / `OutlinedButton` / `TextButton`
- `input` → `TextField(decoration: InputDecoration(...))`
- `image` → `Image.network()` or `Placeholder()`
- `navbar` → `AppBar(title: Text(...))`
- `card` → `Card(child: ...)`

**Step 6: Commit**

```bash
git add src/codegen/flutter.js tests/codegen/flutter.test.js src/codegen/index.js
git commit -m "feat: Flutter codegen module"
```

---

### Task 7: SwiftUI Codegen Module

**Files:**
- Create: `src/codegen/swiftui.js`
- Create: `tests/codegen/swiftui.test.js`

**Dependencies:** Task 1 (registry)

**Step 1: Write failing tests**

```javascript
describe('swiftui codegen', () => {
  it('generate returns SwiftUI View struct', () => {
    const code = generate(screen);
    assert.ok(code.includes('struct LoginScreen: View'));
    assert.ok(code.includes('var body: some View'));
  });

  it('generate uses ZStack + positioned elements', () => {
    const code = generate(screen);
    assert.ok(code.includes('ZStack'));
    assert.ok(code.includes('.position('));
  });

  it('mapComponent returns Text view for text type', () => {
    const swift = mapComponent(screen.elements[0]);
    assert.ok(swift.includes('Text("Welcome")'));
  });

  it('mapComponent returns Button for button type', () => {
    const swift = mapComponent(screen.elements[1]);
    assert.ok(swift.includes('Button'));
    assert.ok(swift.includes('Sign In'));
  });
});
```

**Step 2-5:** Implement `src/codegen/swiftui.js`, register, test.

Pattern: Generate SwiftUI View struct. ZStack for absolute positioning, each element gets `.position(x:y:)` and `.frame(width:height:)`.

Mapping:
- `text` → `Text("content").font(.system(size: N))`
- `button` → `Button("label") { }.buttonStyle(.borderedProminent)`
- `input` → `TextField("placeholder", text: $binding)`
- `image` → `Image(systemName:)` or `AsyncImage`
- `navbar` → `NavigationStack { ... .navigationTitle("title") }`
- `card` → `VStack { }.background(RoundedRectangle(...))`

**Step 6: Commit**

```bash
git add src/codegen/swiftui.js tests/codegen/swiftui.test.js src/codegen/index.js
git commit -m "feat: SwiftUI codegen module"
```

---

### Task 8: Flow Export (Mermaid + Rendering)

**Files:**
- Create: `src/codegen/flow.js`
- Create: `tests/codegen/flow.test.js`
- Modify: `src/mcp/tools/export-tools.js` (add mockup_export_flow)

**Dependencies:** Task 2 (links storage)

**Step 1: Write failing tests**

Create `tests/codegen/flow.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateMermaid } from '../../src/codegen/flow.js';

const project = {
  id: 'proj_test',
  screens: [
    {
      id: 'scr_1', name: 'Login',
      elements: [
        { id: 'el_1', type: 'button', properties: { label: 'Sign In', link_to: { screen_id: 'scr_2', transition: 'push' } } },
      ],
    },
    {
      id: 'scr_2', name: 'Dashboard',
      elements: [
        { id: 'el_2', type: 'tabbar', properties: { link_to: { screen_id: 'scr_3', transition: 'fade' } } },
      ],
    },
    { id: 'scr_3', name: 'Settings', elements: [] },
  ],
};

describe('mermaid flow generation', () => {
  it('generates valid mermaid graph', () => {
    const mermaid = generateMermaid(project);
    assert.ok(mermaid.startsWith('graph LR'));
  });

  it('includes screen nodes', () => {
    const mermaid = generateMermaid(project);
    assert.ok(mermaid.includes('scr_1[Login]'));
    assert.ok(mermaid.includes('scr_2[Dashboard]'));
    assert.ok(mermaid.includes('scr_3[Settings]'));
  });

  it('includes edges with labels', () => {
    const mermaid = generateMermaid(project);
    assert.ok(mermaid.includes('scr_1 -->|button: Sign In| scr_2'));
    assert.ok(mermaid.includes('scr_2 -->'));
  });

  it('handles project with no links', () => {
    const empty = { id: 'proj_x', screens: [{ id: 'scr_1', name: 'Home', elements: [] }] };
    const mermaid = generateMermaid(empty);
    assert.ok(mermaid.includes('graph LR'));
    assert.ok(mermaid.includes('scr_1[Home]'));
  });
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement flow.js**

```javascript
export function generateMermaid(project) {
  const lines = ['graph LR'];

  // Add all screen nodes
  for (const screen of project.screens) {
    lines.push(`  ${screen.id}[${screen.name}]`);
  }

  // Add edges from elements with link_to
  for (const screen of project.screens) {
    for (const el of (screen.elements || [])) {
      if (el.properties?.link_to?.screen_id) {
        const label = el.properties.label || el.type;
        const target = el.properties.link_to.screen_id;
        lines.push(`  ${screen.id} -->|${el.type}: ${label}| ${target}`);
      }
    }
  }

  return lines.join('\n');
}
```

**Step 4: Run — expect PASS**

**Step 5: Add mockup_export_flow MCP tool**

Add to `src/mcp/tools/export-tools.js`:

```javascript
server.tool(
  'mockup_export_flow',
  'Export the navigation flow diagram for a project. Mermaid format returns text, PNG/SVG renders the diagram.',
  {
    project_id: z.string().describe('Project ID'),
    format: z.enum(['mermaid', 'svg', 'png']).optional().default('mermaid')
      .describe('Export format: mermaid (text), svg (vector), png (raster)'),
  },
  async ({ project_id, format }) => {
    // Get project, call generateMermaid, return text or render via Puppeteer
  }
);
```

For SVG/PNG rendering: load Mermaid.js in Puppeteer page, render diagram, screenshot.

**Note on Mermaid.js:** Download `mermaid.min.js` (v11.x) from CDN and place in `src/codegen/vendor/`. Read the file and inject into Puppeteer page via `page.addScriptTag({ content: mermaidCode })`. This avoids network dependency at runtime.

**Step 6: Run all tests — expect PASS**

**Step 7: Commit**

```bash
git add src/codegen/flow.js tests/codegen/flow.test.js src/mcp/tools/export-tools.js src/codegen/vendor/
git commit -m "feat: flow export — Mermaid generation + mockup_export_flow tool"
```

---

## Sprint 3: Integration (3 parallel tasks)

### Task 9: mockup_to_code MCP Tool + Tool Registry

**Files:**
- Modify: `src/mcp/tools/export-tools.js` (add mockup_to_code)
- Modify: `src/mcp/tools/index.js` (final tool count)
- Create: `tests/mcp/codegen-tools.test.js`

**Dependencies:** Tasks 1, 5, 6, 7

**Step 1: Write failing tests**

Test that `mockup_to_code` tool calls the correct generator and returns code string.

**Step 2: Implement MCP tool**

```javascript
server.tool(
  'mockup_to_code',
  'Generate framework code from a screen mockup. Supports html, react, flutter, swiftui.',
  {
    project_id: z.string().describe('Project ID'),
    screen_id: z.string().describe('Screen ID'),
    framework: z.enum(['html', 'react', 'flutter', 'swiftui']).describe('Target framework'),
  },
  async ({ project_id, screen_id, framework }) => {
    const project = await store.getProject(project_id);
    const screen = project.screens.find(s => s.id === screen_id);
    if (!screen) throw new Error(`Screen ${screen_id} not found`);
    const gen = getGenerator(framework);
    if (!gen) throw new Error(`Unknown framework: ${framework}`);
    const code = gen.generate(screen);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          code,
          framework,
          component_count: (screen.elements || []).length,
          screen_name: screen.name,
        }, null, 2),
      }],
    };
  }
);
```

**Step 3: Update tool registry**

Final `src/mcp/tools/index.js` — import registerGroupTools, update count to 23:
- 4 project + 4 screen + 7 element (5 + add_link + remove_link) + 4 export (2 + to_code + export_flow) + 2 template + 1 layout + 3 group = **25 tools**

Wait — let me recount:
- project-tools: 3 (create, list, delete)
- screen-tools: 4 (add, list, delete, duplicate)
- element-tools: 5+2 = 7 (add, update, delete, move, list + add_link, remove_link)
- export-tools: 2+2 = 4 (export, get_preview_url + to_code, export_flow)
- template-tools: 2 (apply, list)
- layout-tools: 1 (auto_layout)
- group-tools: 3 (group, ungroup, move_group)

Total: 3+4+7+4+2+1+3 = **24 tools**

Update console.error message to `[MockupMCP] 24 tools registered`.

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add src/mcp/tools/export-tools.js src/mcp/tools/index.js tests/mcp/codegen-tools.test.js
git commit -m "feat: mockup_to_code MCP tool + tool registry update (24 tools)"
```

---

### Task 10: Preview Clickable Links + Back Navigation

**Files:**
- Modify: `src/preview/server.js` (link click handler, back button)
- Create: `tests/preview/links-preview.test.js`

**Dependencies:** Tasks 2, 4

**Step 1: Write tests**

Test that preview HTML includes JavaScript click handler and back button.

**Step 2: Update preview server**

Modify `injectPreviewAssets` in `src/preview/server.js` to inject:

```javascript
const LINK_SCRIPT = `
<script>
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-link-to]');
    if (el) {
      e.preventDefault();
      const screenId = el.dataset.linkTo;
      const transition = el.dataset.transition || 'push';
      const currentPath = window.location.pathname;
      const projectId = currentPath.split('/')[2]; // /preview/{projectId}/{screenId}
      window.location.href = '/preview/' + projectId + '/' + screenId;
    }
  });
</script>`;

const BACK_BUTTON = `
<div style="position:fixed;top:10px;left:10px;z-index:9999;">
  <button onclick="history.back()" style="padding:4px 12px;font-size:12px;border:1px solid #999;border-radius:4px;background:#fff;cursor:pointer;">
    ← Back
  </button>
</div>`;
```

Inject both into preview HTML via `injectPreviewAssets`.

**Step 3: Run tests — expect PASS**

**Step 4: Commit**

```bash
git add src/preview/server.js tests/preview/links-preview.test.js
git commit -m "feat: preview clickable links + back navigation"
```

---

### Task 11: Integration Tests + M3a Workflow

**Files:**
- Create: `tests/integration/m3a-integration.test.js`
- Modify: `PM/tasks/M3a.md` (status updates)
- Modify: `PM/milestones.md` (M3a status)

**Dependencies:** All previous tasks

**Step 1: Write integration tests**

Test the full M3a workflow:
1. Create project + screens + elements
2. Add links between screens → verify link_to stored
3. Group elements → verify groups array
4. Set opacity → verify rendering
5. Generate code (all 4 frameworks) → verify output
6. Export flow (Mermaid) → verify diagram text
7. Run full existing test suite → no regressions

```javascript
describe('M3a integration', () => {
  it('full workflow: project → links → groups → codegen → flow', async () => {
    // Create project with 2 screens
    // Add elements to both screens
    // Add link from button on screen 1 to screen 2
    // Group some elements on screen 1
    // Set opacity on one element
    // Generate HTML/React/Flutter/SwiftUI code for screen 1
    // Export Mermaid flow diagram
    // Verify all outputs
  });

  it('codegen produces valid output for all 4 frameworks', async () => {
    // For each framework, generate code and verify basic structure
  });

  it('flow diagram includes all navigation links', async () => {
    // Multi-screen project with multiple links
  });
});
```

**Step 2: Run full test suite**

```bash
node --test
```

Expected: all 449 existing + ~80-100 new M3a tests pass.

**Step 3: Update PM docs**

- Update `PM/milestones.md` M3a status to DONE
- Create `PM/tasks/M3a.md` with task statuses

**Step 4: Commit**

```bash
git add tests/integration/m3a-integration.test.js PM/
git commit -m "test: M3a integration tests + milestone status update"
```

---

## Sprint Composition (Agent Teams)

### Sprint 1 — Foundations
| Task | Agent | Role | Model |
|------|-------|------|-------|
| T1: Codegen registry + HTML | dev-1 | dev | sonnet |
| T2: Navigation storage + tools | dev-2 | dev | sonnet |
| T3: Grouping storage + tools | dev-3 | dev | sonnet |
| T4: html-builder updates | dev-4 | dev | sonnet |

### Sprint 2 — Codegen + Flow
| Task | Agent | Role | Model |
|------|-------|------|-------|
| T5: React codegen | dev-1 | dev | sonnet |
| T6: Flutter codegen | dev-2 | dev | sonnet |
| T7: SwiftUI codegen | dev-3 | dev | sonnet |
| T8: Flow export | dev-4 | dev | sonnet |

### Sprint 3 — Integration
| Task | Agent | Role | Model |
|------|-------|------|-------|
| T9: mockup_to_code tool | dev-1 | dev | sonnet |
| T10: Preview links | dev-2 | dev | sonnet |
| T11: Integration tests | reviewer | reviewer | sonnet |

**Post-sprint:** Code review by reviewer agent after each sprint commit.
