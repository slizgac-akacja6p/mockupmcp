# mockup_generate_screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an MCP tool that generates a complete UI screen from a natural language description using rule-based template matching + keyword augmentation.

**Architecture:** Rule-based parser extracts keywords from description, scores them against 7 template keyword profiles, picks the best match, generates elements via template, then augments with additional elements based on remaining keywords. Falls back to a basic layout when no template matches well enough.

**Tech Stack:** Node.js ESM, zod validation, node:test runner. No new dependencies.

---

### Task 1: Screen Generator — parseDescription()

**Files:**
- Create: `src/mcp/screen-generator.js`
- Create: `tests/mcp/screen-generator.test.js`

**Step 1: Write the failing tests**

In `tests/mcp/screen-generator.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDescription } from '../../src/mcp/screen-generator.js';

describe('parseDescription', () => {
  it('extracts screen type keywords', () => {
    const result = parseDescription('login screen with email and password');
    assert.ok(result.screenKeywords.includes('login'));
  });

  it('extracts component keywords', () => {
    const result = parseDescription('a page with toggle switches and a search bar');
    assert.ok(result.componentKeywords.includes('toggle'));
    assert.ok(result.componentKeywords.includes('search'));
  });

  it('extracts modifier keywords', () => {
    const result = parseDescription('login screen with social auth buttons');
    assert.ok(result.modifierKeywords.includes('social'));
  });

  it('handles case insensitivity', () => {
    const result = parseDescription('Dashboard Screen With Charts');
    assert.ok(result.screenKeywords.includes('dashboard'));
  });

  it('returns empty arrays for unrecognized description', () => {
    const result = parseDescription('a 3D rotating globe animation');
    assert.deepEqual(result.screenKeywords, []);
  });

  it('extracts name hint from description', () => {
    const result = parseDescription('user profile screen with avatar');
    assert.equal(result.nameHint, 'User Profile');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

In `src/mcp/screen-generator.js`:

```javascript
// Screen generator — rule-based NLP parser for mockup_generate_screen tool.
// Pure functions: no side effects, no storage access.

const SCREEN_KEYWORDS = [
  'login', 'signin', 'signup', 'register',
  'dashboard', 'home',
  'settings', 'preferences',
  'profile', 'account',
  'list', 'feed', 'catalog',
  'form', 'contact', 'checkout',
  'onboarding', 'welcome', 'intro',
];

const COMPONENT_KEYWORDS = [
  'button', 'input', 'navbar', 'tabbar', 'sidebar',
  'card', 'table', 'toggle', 'checkbox', 'radio',
  'search', 'avatar', 'image', 'photo',
  'chart', 'alert', 'modal', 'badge', 'slider',
  'select', 'dropdown', 'textarea',
];

const MODIFIER_KEYWORDS = [
  'social', 'dark mode', 'grid', 'horizontal',
  'notification', 'with image', 'with avatar',
];

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'with', 'and', 'or', 'for', 'in', 'on', 'to',
  'of', 'is', 'has', 'have', 'that', 'this', 'from', 'by', 'at',
  'screen', 'page', 'view', 'app', 'application', 'ui',
]);

/**
 * Parse a natural language description into categorized keywords.
 * @param {string} description - Free-text screen description.
 * @returns {{ screenKeywords: string[], componentKeywords: string[], modifierKeywords: string[], nameHint: string, tokens: string[] }}
 */
export function parseDescription(description) {
  const lower = description.toLowerCase();

  // Match multi-word modifiers first
  const modifierKeywords = MODIFIER_KEYWORDS.filter(kw => lower.includes(kw));

  // Tokenize for single-word matching
  const tokens = lower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const screenKeywords = SCREEN_KEYWORDS.filter(kw => tokens.includes(kw));
  const componentKeywords = COMPONENT_KEYWORDS.filter(kw => tokens.includes(kw));

  // Derive a name hint from the first meaningful words
  const nameWords = description
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 3);
  const nameHint = nameWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Generated Screen';

  return { screenKeywords, componentKeywords, modifierKeywords, nameHint, tokens };
}
```

**Step 4: Run tests to verify they pass**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: all 6 PASS

**Step 5: Commit**

```bash
git add src/mcp/screen-generator.js tests/mcp/screen-generator.test.js
git commit -m "feat: screen-generator parseDescription — keyword extraction"
```

---

### Task 2: Screen Generator — matchTemplate()

**Files:**
- Modify: `src/mcp/screen-generator.js`
- Modify: `tests/mcp/screen-generator.test.js`

**Step 1: Write the failing tests**

Append to `tests/mcp/screen-generator.test.js`:

```javascript
import { matchTemplate } from '../../src/mcp/screen-generator.js';

describe('matchTemplate', () => {
  it('matches "login screen" to login template with high confidence', () => {
    const parsed = parseDescription('login screen with email and password');
    const result = matchTemplate(parsed);
    assert.equal(result.template, 'login');
    assert.equal(result.confidence, 'high');
  });

  it('matches "dashboard with charts" to dashboard template', () => {
    const parsed = parseDescription('dashboard with charts and stats');
    const result = matchTemplate(parsed);
    assert.equal(result.template, 'dashboard');
  });

  it('matches "settings page" to settings template', () => {
    const parsed = parseDescription('settings page with toggles');
    const result = matchTemplate(parsed);
    assert.equal(result.template, 'settings');
  });

  it('matches "signup" and "register" to login template', () => {
    for (const desc of ['signup form', 'register screen']) {
      const parsed = parseDescription(desc);
      const result = matchTemplate(parsed);
      assert.equal(result.template, 'login', `Failed for: ${desc}`);
    }
  });

  it('matches "user profile" to profile template', () => {
    const parsed = parseDescription('user profile with avatar');
    const result = matchTemplate(parsed);
    assert.equal(result.template, 'profile');
  });

  it('matches "product list" to list template', () => {
    const parsed = parseDescription('product list with cards');
    const result = matchTemplate(parsed);
    assert.equal(result.template, 'list');
  });

  it('matches "contact form" to form template', () => {
    const parsed = parseDescription('contact form with name and email');
    const result = matchTemplate(parsed);
    assert.equal(result.template, 'form');
  });

  it('returns low confidence for unrecognized description', () => {
    const parsed = parseDescription('a 3D rotating globe');
    const result = matchTemplate(parsed);
    assert.equal(result.confidence, 'low');
    assert.equal(result.template, null);
  });

  it('returns score as a number between 0 and 1', () => {
    const parsed = parseDescription('dashboard screen');
    const result = matchTemplate(parsed);
    assert.ok(result.score >= 0 && result.score <= 1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: FAIL — matchTemplate not exported

**Step 3: Write implementation**

Append to `src/mcp/screen-generator.js`:

```javascript
// Template keyword profiles with weights.
// Each template has primary keywords (weight 1.0) and secondary (weight 0.4).
const TEMPLATE_PROFILES = {
  login:      { primary: ['login', 'signin', 'signup', 'register'], secondary: ['password', 'email', 'auth'] },
  dashboard:  { primary: ['dashboard', 'home'], secondary: ['chart', 'stats', 'card', 'analytics'] },
  settings:   { primary: ['settings', 'preferences'], secondary: ['toggle', 'notification', 'dark mode'] },
  profile:    { primary: ['profile', 'account'], secondary: ['avatar', 'image', 'photo', 'user'] },
  list:       { primary: ['list', 'feed', 'catalog'], secondary: ['card', 'search', 'table'] },
  form:       { primary: ['form', 'contact', 'checkout'], secondary: ['input', 'textarea', 'select'] },
  onboarding: { primary: ['onboarding', 'welcome', 'intro'], secondary: ['button', 'image'] },
};

/**
 * Score parsed keywords against template profiles and pick the best match.
 * @param {{ screenKeywords: string[], componentKeywords: string[], modifierKeywords: string[], tokens: string[] }} parsed
 * @returns {{ template: string|null, confidence: 'high'|'medium'|'low', score: number }}
 */
export function matchTemplate(parsed) {
  const allKeywords = [...parsed.screenKeywords, ...parsed.componentKeywords, ...parsed.modifierKeywords, ...parsed.tokens];

  let bestTemplate = null;
  let bestScore = 0;

  for (const [name, profile] of Object.entries(TEMPLATE_PROFILES)) {
    const maxPossible = profile.primary.length * 1.0 + profile.secondary.length * 0.4;
    let score = 0;
    for (const kw of profile.primary) {
      if (allKeywords.includes(kw)) score += 1.0;
    }
    for (const kw of profile.secondary) {
      if (allKeywords.includes(kw)) score += 0.4;
    }
    const normalized = score / maxPossible;
    if (normalized > bestScore) {
      bestScore = normalized;
      bestTemplate = name;
    }
  }

  let confidence;
  if (bestScore >= 0.5) confidence = 'high';
  else if (bestScore >= 0.3) confidence = 'medium';
  else confidence = 'low';

  return {
    template: confidence === 'low' ? null : bestTemplate,
    confidence,
    score: Math.round(bestScore * 100) / 100,
  };
}
```

**Step 4: Run tests**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/mcp/screen-generator.js tests/mcp/screen-generator.test.js
git commit -m "feat: screen-generator matchTemplate — template scoring engine"
```

---

### Task 3: Screen Generator — augmentElements()

**Files:**
- Modify: `src/mcp/screen-generator.js`
- Modify: `tests/mcp/screen-generator.test.js`

**Step 1: Write the failing tests**

Append to test file:

```javascript
import { augmentElements } from '../../src/mcp/screen-generator.js';

describe('augmentElements', () => {
  const baseElements = [
    { type: 'navbar', x: 0, y: 0, width: 393, height: 56, z_index: 10, properties: { title: 'Test' } },
    { type: 'button', x: 24, y: 200, width: 345, height: 48, z_index: 0, properties: { label: 'Submit', variant: 'primary' } },
  ];

  it('adds social buttons for "social" modifier', () => {
    const result = augmentElements(baseElements, { modifierKeywords: ['social'], componentKeywords: [], screenKeywords: [] }, 393, 852);
    const buttons = result.filter(el => el.properties?.label?.includes('Google') || el.properties?.label?.includes('Apple'));
    assert.equal(buttons.length, 2);
  });

  it('adds search_bar for "search" component keyword', () => {
    const result = augmentElements(baseElements, { modifierKeywords: [], componentKeywords: ['search'], screenKeywords: [] }, 393, 852);
    const searchBars = result.filter(el => el.type === 'search_bar');
    assert.equal(searchBars.length, 1);
  });

  it('adds chart_placeholder for "chart" component keyword', () => {
    const result = augmentElements(baseElements, { modifierKeywords: [], componentKeywords: ['chart'], screenKeywords: [] }, 393, 852);
    const charts = result.filter(el => el.type === 'chart_placeholder');
    assert.equal(charts.length, 1);
  });

  it('adds toggle for "toggle" component keyword if none exist', () => {
    const result = augmentElements(baseElements, { modifierKeywords: [], componentKeywords: ['toggle'], screenKeywords: [] }, 393, 852);
    const toggles = result.filter(el => el.type === 'toggle');
    assert.equal(toggles.length, 1);
  });

  it('does not duplicate component types already present', () => {
    const withSearch = [...baseElements, { type: 'search_bar', x: 24, y: 60, width: 345, height: 48, z_index: 0, properties: {} }];
    const result = augmentElements(withSearch, { modifierKeywords: [], componentKeywords: ['search'], screenKeywords: [] }, 393, 852);
    const searchBars = result.filter(el => el.type === 'search_bar');
    assert.equal(searchBars.length, 1);
  });

  it('returns original elements unchanged when no augmentations apply', () => {
    const result = augmentElements(baseElements, { modifierKeywords: [], componentKeywords: [], screenKeywords: [] }, 393, 852);
    assert.equal(result.length, baseElements.length);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: FAIL — augmentElements not exported

**Step 3: Write implementation**

Append to `src/mcp/screen-generator.js`:

```javascript
/**
 * Augment template-generated elements with extra components based on parsed keywords.
 * @param {object[]} elements - Base elements from template.
 * @param {{ modifierKeywords: string[], componentKeywords: string[], screenKeywords: string[] }} parsed
 * @param {number} screenWidth
 * @param {number} screenHeight
 * @returns {object[]} Augmented element array (new array, does not mutate input).
 */
export function augmentElements(elements, parsed, screenWidth, screenHeight) {
  const result = [...elements];
  const existingTypes = new Set(elements.map(el => el.type));
  const pad = 24;
  const contentWidth = screenWidth - pad * 2;

  // Find the lowest Y position to append new elements below existing ones.
  let maxY = Math.max(...elements.map(el => el.y + el.height), 0);

  function addIfFits(element) {
    if (element.y + element.height <= screenHeight) {
      result.push(element);
      maxY = Math.max(maxY, element.y + element.height);
    }
  }

  // --- Modifier-based augmentations ---

  if (parsed.modifierKeywords.includes('social')) {
    addIfFits({
      type: 'button', x: pad, y: maxY + 16,
      width: contentWidth, height: 44, z_index: 0,
      properties: { label: 'Continue with Google', variant: 'outline' },
    });
    addIfFits({
      type: 'button', x: pad, y: maxY + 16,
      width: contentWidth, height: 44, z_index: 0,
      properties: { label: 'Continue with Apple', variant: 'outline' },
    });
  }

  // --- Component-based augmentations (only if type not already present) ---

  if (parsed.componentKeywords.includes('search') && !existingTypes.has('search_bar')) {
    // Insert search bar right after navbar (y=60)
    addIfFits({
      type: 'search_bar', x: pad, y: 60,
      width: contentWidth, height: 48, z_index: 0, properties: {},
    });
  }

  if (parsed.componentKeywords.includes('chart') && !existingTypes.has('chart_placeholder')) {
    addIfFits({
      type: 'chart_placeholder', x: pad, y: maxY + 16,
      width: contentWidth, height: 180, z_index: 0,
      properties: { label: 'Chart' },
    });
  }

  if (parsed.componentKeywords.includes('toggle') && !existingTypes.has('toggle')) {
    addIfFits({
      type: 'toggle', x: pad, y: maxY + 16,
      width: contentWidth, height: 52, z_index: 0,
      properties: { label: 'Toggle', checked: false },
    });
  }

  if (parsed.componentKeywords.includes('avatar') && !existingTypes.has('avatar')) {
    addIfFits({
      type: 'avatar', x: Math.floor(screenWidth / 2) - 32, y: maxY + 16,
      width: 64, height: 64, z_index: 0,
      properties: { size: 'lg' },
    });
  }

  if (parsed.componentKeywords.includes('table') && !existingTypes.has('data_table')) {
    addIfFits({
      type: 'data_table', x: pad, y: maxY + 16,
      width: contentWidth, height: 200, z_index: 0,
      properties: { headers: ['Name', 'Value', 'Status'], rows: [['Item 1', '100', 'Active']] },
    });
  }

  if ((parsed.componentKeywords.includes('alert') || parsed.modifierKeywords.includes('notification')) && !existingTypes.has('alert')) {
    addIfFits({
      type: 'alert', x: pad, y: maxY + 16,
      width: contentWidth, height: 48, z_index: 0,
      properties: { message: 'Notification message', type: 'info' },
    });
  }

  return result;
}
```

**Step 4: Run tests**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/mcp/screen-generator.js tests/mcp/screen-generator.test.js
git commit -m "feat: screen-generator augmentElements — keyword-based element injection"
```

---

### Task 4: Screen Generator — generateScreen() orchestrator + fallback

**Files:**
- Modify: `src/mcp/screen-generator.js`
- Modify: `tests/mcp/screen-generator.test.js`

**Step 1: Write the failing tests**

Append to test file:

```javascript
import { generateScreen } from '../../src/mcp/screen-generator.js';

describe('generateScreen', () => {
  it('generates login screen from description', () => {
    const result = generateScreen('login screen with email and password', 393, 852, 'wireframe');
    assert.equal(result.matchInfo.template, 'login');
    assert.equal(result.matchInfo.confidence, 'high');
    assert.ok(result.elements.length >= 5);
    assert.ok(result.elements.some(el => el.type === 'input'));
    assert.ok(result.elements.some(el => el.type === 'button'));
  });

  it('generates dashboard screen', () => {
    const result = generateScreen('dashboard with stats', 393, 852, 'wireframe');
    assert.equal(result.matchInfo.template, 'dashboard');
    assert.ok(result.elements.some(el => el.type === 'card'));
  });

  it('generates fallback for unknown description', () => {
    const result = generateScreen('a 3D rotating globe', 393, 852, 'wireframe');
    assert.equal(result.matchInfo.confidence, 'low');
    assert.ok(result.elements.some(el => el.type === 'navbar'));
    assert.ok(result.elements.some(el => el.type === 'text'));
    assert.ok(result.matchInfo.suggestions.length > 0);
  });

  it('applies augmentations for "social" modifier', () => {
    const result = generateScreen('login screen with social auth', 393, 852, 'wireframe');
    const socialButtons = result.elements.filter(
      el => el.type === 'button' && (el.properties?.label?.includes('Google') || el.properties?.label?.includes('Apple'))
    );
    assert.equal(socialButtons.length, 2);
    assert.ok(result.matchInfo.augmentations.length > 0);
  });

  it('returns nameHint', () => {
    const result = generateScreen('user profile screen', 393, 852, 'wireframe');
    assert.ok(result.nameHint.length > 0);
  });

  it('respects screenHeight bounds — no elements overflow', () => {
    const result = generateScreen('login with social buttons', 393, 400, 'wireframe');
    for (const el of result.elements) {
      assert.ok(el.y + el.height <= 400, `Element at y=${el.y} h=${el.height} overflows 400px`);
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: FAIL — generateScreen not exported

**Step 3: Write implementation**

Append to `src/mcp/screen-generator.js`:

```javascript
import { getTemplate, getAvailableTemplates } from '../renderer/templates/index.js';

/**
 * Generate a full screen element array from a natural language description.
 * @param {string} description
 * @param {number} screenWidth
 * @param {number} screenHeight
 * @param {string} style
 * @returns {{ elements: object[], matchInfo: { template: string|null, confidence: string, score: number, augmentations: string[], suggestions?: string[] }, nameHint: string }}
 */
export function generateScreen(description, screenWidth, screenHeight, style) {
  const parsed = parseDescription(description);
  const match = matchTemplate(parsed);
  const augmentations = [];

  let elements;

  if (match.template) {
    // Use matched template
    const template = getTemplate(match.template);
    elements = template.generate(screenWidth, screenHeight, style);
  } else {
    // Fallback: basic screen with navbar + description text
    const pad = 24;
    elements = [
      {
        type: 'navbar', x: 0, y: 0,
        width: screenWidth, height: 56, z_index: 10,
        properties: { title: parsed.nameHint },
      },
      {
        type: 'text', x: pad, y: 80,
        width: screenWidth - pad * 2, height: 60, z_index: 0,
        properties: { content: description, fontSize: 16, align: 'center' },
      },
    ];
  }

  // Apply augmentations
  const augmented = augmentElements(elements, parsed, screenWidth, screenHeight);
  if (augmented.length > elements.length) {
    const added = augmented.slice(elements.length);
    for (const el of added) {
      augmentations.push(`added ${el.type}${el.properties?.label ? ` "${el.properties.label}"` : ''}`);
    }
  }
  elements = augmented;

  // Filter out any elements that overflow screen height
  elements = elements.filter(el => el.y + el.height <= screenHeight);

  const matchInfo = {
    template: match.template,
    confidence: match.confidence,
    score: match.score,
    augmentations,
  };
  if (match.confidence === 'low') {
    matchInfo.suggestions = getAvailableTemplates();
  }

  return { elements, matchInfo, nameHint: parsed.nameHint };
}
```

**Step 4: Run tests**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/mcp/screen-generator.js tests/mcp/screen-generator.test.js
git commit -m "feat: screen-generator generateScreen — orchestrator with fallback"
```

---

### Task 5: MCP Tool Registration + Integration

**Files:**
- Modify: `src/mcp/tools/screen-tools.js` (add mockup_generate_screen tool)
- Modify: `src/mcp/tools/index.js` (update tool count 24 -> 25)
- Create: `tests/mcp/generate-screen.integration.test.js`

**Step 1: Write integration test**

In `tests/mcp/generate-screen.integration.test.js`:

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProjectStore } from '../../src/storage/project-store.js';

describe('mockup_generate_screen integration', () => {
  let store;
  let tmpDir;
  let projectId;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gen-screen-'));
    store = new ProjectStore(tmpDir);
    await store.init();
    const project = await store.createProject('Test Project', '', undefined, 'wireframe');
    projectId = project.id;
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('generates screen with elements from "login screen with email and password"', async () => {
    // Import the generateScreen function and simulate the tool flow
    const { generateScreen } = await import('../../src/mcp/screen-generator.js');
    const project = await store.getProject(projectId);
    const { elements, matchInfo, nameHint } = generateScreen(
      'login screen with email and password',
      project.viewport.width, project.viewport.height, project.style
    );

    // Simulate what the tool does: addScreen + applyTemplate
    const screen = await store.addScreen(projectId, nameHint);
    const populated = await store.applyTemplate(projectId, screen.id, elements, true);

    assert.ok(populated.elements.length >= 5);
    assert.ok(populated.elements.every(el => el.id.startsWith('el_')));
    assert.equal(matchInfo.template, 'login');
    assert.equal(matchInfo.confidence, 'high');
  });

  it('generates fallback screen for unrecognized description', async () => {
    const { generateScreen } = await import('../../src/mcp/screen-generator.js');
    const project = await store.getProject(projectId);
    const { elements, matchInfo } = generateScreen(
      'alien spaceship cockpit',
      project.viewport.width, project.viewport.height, project.style
    );

    const screen = await store.addScreen(projectId, 'Test');
    const populated = await store.applyTemplate(projectId, screen.id, elements, true);

    assert.ok(populated.elements.length >= 2);
    assert.equal(matchInfo.confidence, 'low');
    assert.ok(matchInfo.suggestions.includes('login'));
  });

  it('generates all 7 template-matched screens without errors', async () => {
    const { generateScreen } = await import('../../src/mcp/screen-generator.js');
    const descriptions = [
      'login page', 'dashboard overview', 'app settings',
      'product list', 'contact form', 'user profile', 'welcome onboarding'
    ];
    for (const desc of descriptions) {
      const { elements, matchInfo } = generateScreen(desc, 393, 852, 'wireframe');
      assert.ok(elements.length >= 2, `Too few elements for "${desc}"`);
      assert.notEqual(matchInfo.confidence, 'low', `Should match a template for "${desc}"`);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/mcp/generate-screen.integration.test.js`
Expected: PASS (all logic already implemented — this validates the storage flow)

**Step 3: Register the MCP tool**

At the bottom of `src/mcp/tools/screen-tools.js`, inside `registerScreenTools()`, append:

```javascript
  // --- Screen generator (NLP -> template-based) ---

  const { generateScreen } = await import('../screen-generator.js');

  server.tool(
    'mockup_generate_screen',
    'Generate a complete UI screen from a natural language description. Matches to the closest template (login, dashboard, settings, list, form, profile, onboarding) and augments with additional elements based on keywords. Example: "login screen with social auth buttons".',
    {
      project_id: z.string().describe('Project ID'),
      description: z.string().describe('Natural language screen description, e.g. "login screen with email and password fields"'),
      name: z.string().optional().describe('Screen name (auto-derived from description if omitted)'),
      style: z
        .enum(['wireframe', 'material', 'ios'])
        .optional()
        .describe('Style override (defaults to project style)'),
    },
    async ({ project_id, description, name, style }) => {
      try {
        const project = await store.getProject(project_id);
        const resolvedStyle = style || project.style || 'wireframe';
        const { width, height } = project.viewport;

        const { elements, matchInfo, nameHint } = generateScreen(description, width, height, resolvedStyle);

        const screenName = name || nameHint;
        const screen = await store.addScreen(project_id, screenName, width, height, '#FFFFFF', resolvedStyle !== project.style ? resolvedStyle : null);
        const populated = await store.applyTemplate(project_id, screen.id, elements, true);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              screen: {
                id: populated.id,
                name: populated.name,
                width: populated.width,
                height: populated.height,
                elements: populated.elements.length,
              },
              match_info: matchInfo,
            }, null, 2),
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
```

**Important:** The `registerScreenTools` function signature must change from sync to async:
- Change `export function registerScreenTools(server, store)` to `export async function registerScreenTools(server, store)`
- In `src/mcp/tools/index.js`, add `await` before `registerScreenTools(server, store)`
- Make `registerAllTools` async: `export async function registerAllTools(server, store)`
- Update tool count comment from 24 to 25

**Step 4: Run full test suite**

Run: `node --test tests/mcp/screen-generator.test.js tests/mcp/generate-screen.integration.test.js`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/mcp/tools/screen-tools.js src/mcp/tools/index.js tests/mcp/generate-screen.integration.test.js
git commit -m "feat: mockup_generate_screen MCP tool — 25 tools total"
```

---

### Task 6: Update PM docs + final regression

**Files:**
- Modify: `PM/milestones.md` (add M4 section)
- Modify: `PM/tasks/` (create M4.md if needed)

**Step 1: Run full test suite**

Run: `node --test --recursive tests/`
Expected: 550+ tests PASS, 0 FAIL

**Step 2: Verify tool count**

Run: `grep -c "server.tool(" src/mcp/tools/*.js`
Expected: total 25

**Step 3: Update milestones.md**

Add M4 entry to `PM/milestones.md` with generate_screen status.

**Step 4: Commit**

```bash
git add PM/
git commit -m "docs: M4 milestone — generate_screen"
```
