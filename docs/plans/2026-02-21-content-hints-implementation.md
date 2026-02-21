# Content Hints Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Templates adapt their content to user's description instead of showing hardcoded placeholders.

**Architecture:** Extract content phrases from description in `parseDescription()`, pass as 4th param to `template.generate()`, each template maps hints positionally to its content slots with fallback to current defaults.

**Tech Stack:** Node.js, built-in test runner, ESM modules

---

### Task 1: Extract contentHints in parseDescription

**Files:**
- Modify: `src/mcp/screen-generator.js:28-61`
- Test: `tests/mcp/screen-generator.test.js`

**Step 1: Write the failing tests**

Add to `tests/mcp/screen-generator.test.js` inside the `parseDescription` describe block:

```javascript
  it('extracts contentHints from comma-separated description', () => {
    const result = parseDescription('fitness dashboard with steps count, calories burned, active minutes');
    assert.ok(Array.isArray(result.contentHints));
    assert.ok(result.contentHints.length >= 3);
    assert.ok(result.contentHints.some(h => h.includes('Steps')));
    assert.ok(result.contentHints.some(h => h.includes('Calories')));
    assert.ok(result.contentHints.some(h => h.includes('Active')));
  });

  it('extracts contentHints from "and"-separated description', () => {
    const result = parseDescription('login page for gym members and trainers');
    assert.ok(result.contentHints.length >= 1);
  });

  it('returns empty contentHints for description with only keywords', () => {
    const result = parseDescription('login screen');
    assert.deepEqual(result.contentHints, []);
  });

  it('titleCases contentHints', () => {
    const result = parseDescription('dashboard with monthly revenue, user growth');
    for (const hint of result.contentHints) {
      assert.match(hint, /^[A-Z]/);
    }
  });

  it('removes stop words and known keywords from hints', () => {
    const result = parseDescription('dashboard with the total users');
    // "the" is a stop word, "dashboard" is a screen keyword — should be removed
    const joined = result.contentHints.join(' ').toLowerCase();
    assert.ok(!joined.includes('the '));
    assert.ok(!joined.includes('dashboard'));
  });
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: FAIL — `result.contentHints` is undefined

**Step 3: Implement contentHints extraction**

In `src/mcp/screen-generator.js`, add a `ALL_KNOWN_KEYWORDS` set after `STOP_WORDS` (line 32):

```javascript
const ALL_KNOWN_KEYWORDS = new Set([
  ...STOP_WORDS,
  ...SCREEN_KEYWORDS,
  ...COMPONENT_KEYWORDS,
  ...MODIFIER_KEYWORDS.flatMap(m => m.split(' ')),
]);
```

Then add contentHints extraction at the end of `parseDescription()`, before the return statement (around line 59):

```javascript
  // Extract content hints — semantic phrases from description segments.
  // Split on commas and " and ", remove known keywords/stop words, titleCase.
  const segments = description
    .split(/,|\band\b/)
    .map(seg => seg.trim())
    .filter(Boolean);

  const contentHints = segments
    .map(seg =>
      seg
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => !ALL_KNOWN_KEYWORDS.has(w.toLowerCase()))
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
        .trim()
    )
    .filter(h => h.length > 0);
```

Update the return statement to include `contentHints`:

```javascript
  return { screenKeywords, componentKeywords, modifierKeywords, nameHint, tokens, contentHints };
```

Update the JSDoc `@returns` to include `contentHints: string[]`.

**Step 4: Run tests to verify they pass**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/mcp/screen-generator.js tests/mcp/screen-generator.test.js
git commit -m "feat: extract contentHints in parseDescription"
```

---

### Task 2: Wire contentHints through pipeline

**Files:**
- Modify: `src/mcp/screen-generator.js:221-231`
- Modify: `src/renderer/templates/index.js:1-3` (comment only)
- Test: `tests/mcp/screen-generator.test.js`

**Step 1: Write the failing test**

Add to `tests/mcp/screen-generator.test.js` inside the `generateScreen` describe block:

```javascript
  it('passes contentHints to template — dashboard cards use hint content', () => {
    const result = generateScreen('fitness dashboard with steps, calories', 393, 852, 'wireframe');
    assert.equal(result.matchInfo.template, 'dashboard');
    const cards = result.elements.filter(el => el.type === 'card');
    assert.ok(cards.length >= 2);
    // First card should use first hint
    assert.ok(cards[0].properties.title.includes('Steps'));
  });
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: FAIL — card title is still "Total Users"

**Step 3: Wire contentHints in generateScreen**

In `src/mcp/screen-generator.js`, modify `generateScreen()` (line 231) to pass `parsed.contentHints`:

```javascript
    elements = template.generate(screenWidth, screenHeight, style, parsed.contentHints);
```

Also update the fallback path (line 237) — use hint for navbar if available:

```javascript
    elements = [
      {
        type: 'navbar', x: 0, y: 0,
        width: screenWidth, height: 56, z_index: 10,
        properties: { title: parsed.contentHints[0] || parsed.nameHint },
      },
      {
        type: 'text', x: pad, y: 80,
        width: screenWidth - pad * 2, height: 60, z_index: 0,
        properties: { content: description, fontSize: 16, align: 'center' },
      },
    ];
```

Update `src/renderer/templates/index.js` comment (line 2):

```javascript
// Each template exports: generate(screenWidth, screenHeight, style, contentHints) -> element[]
```

**Note:** The test from Step 1 will still fail until dashboard.js is updated in Task 3. That is expected — this task wires the plumbing, Task 3 makes the dashboard use hints.

**Step 4: Run full test suite to verify no regressions**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: All existing tests PASS. New test from step 1 still FAILS (dashboard.js not updated yet — that's OK, it proves the test is real).

**Step 5: Commit**

```bash
git add src/mcp/screen-generator.js src/renderer/templates/index.js
git commit -m "feat: wire contentHints through generateScreen pipeline"
```

---

### Task 3: Dashboard + Login templates use contentHints

**Files:**
- Modify: `src/renderer/templates/dashboard.js`
- Modify: `src/renderer/templates/login.js`
- Test: `tests/mcp/screen-generator.test.js`

**Step 1: Write failing tests**

Add to `tests/mcp/screen-generator.test.js` in the `generateScreen` describe block:

```javascript
  it('dashboard uses contentHints for card titles and chart label', () => {
    const result = generateScreen(
      'fitness dashboard with steps count, calories burned, weekly progress',
      393, 852, 'wireframe'
    );
    const cards = result.elements.filter(el => el.type === 'card');
    assert.ok(cards[0].properties.title.includes('Steps'));
    assert.ok(cards[1].properties.title.includes('Calories'));
    const chart = result.elements.find(el => el.type === 'chart_placeholder');
    assert.ok(chart.properties.label.includes('Weekly'));
  });

  it('dashboard falls back to defaults when no contentHints', () => {
    const result = generateScreen('dashboard', 393, 852, 'wireframe');
    const cards = result.elements.filter(el => el.type === 'card');
    assert.equal(cards[0].properties.title, 'Total Users');
  });

  it('login uses contentHints for heading and button', () => {
    const result = generateScreen('login for gym members, start workout', 393, 852, 'wireframe');
    const heading = result.elements.find(el => el.type === 'text' && el.properties.fontSize === 24);
    assert.ok(heading.properties.content.includes('Gym'));
    const button = result.elements.find(el => el.type === 'button' && el.properties.variant === 'primary');
    assert.ok(button.properties.label.includes('Start'));
  });

  it('login falls back to defaults when no contentHints', () => {
    const result = generateScreen('login screen', 393, 852, 'wireframe');
    const heading = result.elements.find(el => el.type === 'text' && el.properties.fontSize === 24);
    assert.equal(heading.properties.content, 'Welcome back');
  });
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: FAIL — templates still return hardcoded content

**Step 3: Update dashboard.js**

Replace `src/renderer/templates/dashboard.js`:

```javascript
export const description = 'Dashboard with stats cards, a chart placeholder, and a recent activity list.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;
  const isWide = screenWidth >= 768;
  const cardWidth = isWide ? Math.floor((contentWidth - pad) / 2) : contentWidth;
  const cardHeight = 80;

  // Content slots: [0] card1 title, [1] card2 title, [2] chart label, [3] activity title
  const card1Title = contentHints[0] || 'Total Users';
  const card2Title = contentHints[1] || 'Revenue';
  const chartLabel = contentHints[2] || 'Monthly Revenue';
  const activityTitle = contentHints[3] || 'Recent Activity';
  const listItems = contentHints.length > 4
    ? contentHints.slice(4)
    : ['User signed up', 'Payment received', 'Report exported'];

  const elements = [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: { title: 'Dashboard' },
    },
    {
      type: 'card',
      x: pad,
      y: 72,
      width: cardWidth,
      height: cardHeight,
      z_index: 0,
      properties: { title: card1Title, value: '1,240' },
    },
    {
      type: 'card',
      x: isWide ? pad + cardWidth + pad : pad,
      y: isWide ? 72 : 72 + cardHeight + pad,
      width: cardWidth,
      height: cardHeight,
      z_index: 0,
      properties: { title: card2Title, value: '$8,320' },
    },
    {
      type: 'chart_placeholder',
      x: pad,
      y: isWide ? 72 + cardHeight + pad : 72 + (cardHeight + pad) * 2,
      width: contentWidth,
      height: Math.min(200, screenHeight - 400),
      z_index: 0,
      properties: { label: chartLabel },
    },
    {
      type: 'text',
      x: pad,
      y: isWide ? 72 + cardHeight + pad + Math.min(200, screenHeight - 400) + pad : 72 + (cardHeight + pad) * 2 + Math.min(200, screenHeight - 400) + pad,
      width: contentWidth,
      height: 28,
      z_index: 0,
      properties: { content: activityTitle, fontSize: 16 },
    },
    {
      type: 'list',
      x: pad,
      y: isWide ? 72 + cardHeight + pad + Math.min(200, screenHeight - 400) + pad + 36 : 72 + (cardHeight + pad) * 2 + Math.min(200, screenHeight - 400) + pad + 36,
      width: contentWidth,
      height: Math.min(160, screenHeight - (isWide ? 72 + cardHeight + pad + Math.min(200, screenHeight - 400) + pad + 36 + 16 : 72 + (cardHeight + pad) * 2 + Math.min(200, screenHeight - 400) + pad + 36 + 16)),
      z_index: 0,
      properties: { items: listItems },
    },
  ];

  return elements.filter(el => el.y >= 0 && el.height > 0 && el.y + el.height <= screenHeight);
}
```

**Step 4: Update login.js**

Replace `src/renderer/templates/login.js`:

```javascript
export const description = 'Login screen with email/password fields and submit button.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 24;
  const fieldWidth = screenWidth - pad * 2;

  // Content slots: [0] heading, [1] button label
  const heading = contentHints[0] || 'Welcome back';
  const buttonLabel = contentHints[1] || 'Sign In';

  return [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: { title: 'Sign In' },
    },
    {
      type: 'text',
      x: pad,
      y: 80,
      width: fieldWidth,
      height: 40,
      z_index: 0,
      properties: { content: heading, fontSize: 24, align: 'center' },
    },
    {
      type: 'input',
      x: pad,
      y: 140,
      width: fieldWidth,
      height: 56,
      z_index: 0,
      properties: { label: 'Email', placeholder: 'you@example.com', inputType: 'email' },
    },
    {
      type: 'input',
      x: pad,
      y: 216,
      width: fieldWidth,
      height: 56,
      z_index: 0,
      properties: { label: 'Password', placeholder: '••••••••', inputType: 'password' },
    },
    {
      type: 'button',
      x: pad,
      y: 296,
      width: fieldWidth,
      height: 48,
      z_index: 0,
      properties: { label: buttonLabel, variant: 'primary' },
    },
    {
      type: 'text',
      x: pad,
      y: 360,
      width: fieldWidth,
      height: 24,
      z_index: 0,
      properties: { content: 'Forgot password?', align: 'center', fontSize: 14 },
    },
    {
      type: 'text',
      x: pad,
      y: 400,
      width: fieldWidth,
      height: 24,
      z_index: 0,
      properties: { content: "Don't have an account? Sign up", align: 'center', fontSize: 14 },
    },
  ].filter(el => el.y + el.height <= screenHeight);
}
```

**Step 5: Run tests**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: ALL PASS (including the test from Task 2 Step 1)

**Step 6: Run full test suite for regressions**

Run: `node --test`
Expected: ALL PASS — no regressions in template integration tests

**Step 7: Commit**

```bash
git add src/renderer/templates/dashboard.js src/renderer/templates/login.js tests/mcp/screen-generator.test.js
git commit -m "feat: dashboard + login templates use contentHints"
```

---

### Task 4: Settings + List + Form templates use contentHints

**Files:**
- Modify: `src/renderer/templates/settings.js`
- Modify: `src/renderer/templates/list.js`
- Modify: `src/renderer/templates/form.js`
- Test: `tests/mcp/screen-generator.test.js`

**Step 1: Write failing tests**

Add to `tests/mcp/screen-generator.test.js` in the `generateScreen` describe block:

```javascript
  it('settings uses contentHints for toggle labels', () => {
    const result = generateScreen(
      'settings with workout reminders, calorie tracking, GPS',
      393, 852, 'wireframe'
    );
    const toggles = result.elements.filter(el => el.type === 'toggle');
    assert.ok(toggles.length >= 3);
    assert.ok(toggles[0].properties.label.includes('Workout'));
  });

  it('settings falls back to defaults when no contentHints', () => {
    const result = generateScreen('settings page', 393, 852, 'wireframe');
    const toggles = result.elements.filter(el => el.type === 'toggle');
    assert.equal(toggles[0].properties.label, 'Notifications');
  });

  it('list uses contentHints for item titles', () => {
    const result = generateScreen(
      'list with running, cycling, yoga, swimming',
      393, 852, 'wireframe'
    );
    const lists = result.elements.filter(el => el.type === 'list');
    assert.ok(lists.length >= 3);
    assert.ok(lists[0].properties.items[0].includes('Running'));
  });

  it('list falls back to defaults when no contentHints', () => {
    const result = generateScreen('product list', 393, 852, 'wireframe');
    const lists = result.elements.filter(el => el.type === 'list');
    assert.ok(lists[0].properties.items[0].includes('Getting Started'));
  });

  it('form uses contentHints for field labels', () => {
    const result = generateScreen(
      'form with weight, height, age, submit',
      393, 852, 'wireframe'
    );
    const inputs = result.elements.filter(el => el.type === 'input');
    assert.ok(inputs[0].properties.label.includes('Weight'));
  });

  it('form falls back to defaults when no contentHints', () => {
    const result = generateScreen('contact form', 393, 852, 'wireframe');
    const inputs = result.elements.filter(el => el.type === 'input');
    assert.equal(inputs[0].properties.label, 'Full Name');
  });
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: FAIL — templates still return hardcoded content

**Step 3: Update settings.js**

Replace `src/renderer/templates/settings.js`:

```javascript
export const description = 'Settings screen with grouped toggle rows for app preferences.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;
  const rowH = 52;

  // Content slots: [0] section title, [1..] toggle labels
  const sectionTitle = contentHints[0] || 'Preferences';
  const toggleHints = contentHints.slice(1);

  const defaultRows = [
    { label: 'Notifications', hint: 'Push & email' },
    { label: 'Dark Mode', hint: 'Use dark theme' },
    { label: 'Location', hint: 'Allow location access' },
    { label: 'Analytics', hint: 'Share usage data' },
    { label: 'Auto-update', hint: 'Install updates automatically' },
  ];

  const rows = toggleHints.length > 0
    ? toggleHints.map((h, i) => ({
        label: h,
        hint: defaultRows[i]?.hint || '',
      }))
    : defaultRows;

  const elements = [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: { title: 'Settings' },
    },
    {
      type: 'text',
      x: pad,
      y: 68,
      width: contentWidth,
      height: 28,
      z_index: 0,
      properties: { content: sectionTitle, fontSize: 13 },
    },
  ];

  rows.forEach((row, i) => {
    const y = 104 + i * (rowH + 2);
    if (y + rowH > screenHeight) return;
    elements.push({
      type: 'toggle',
      x: pad,
      y,
      width: contentWidth,
      height: rowH,
      z_index: 0,
      properties: { label: row.label, hint: row.hint, checked: false },
    });
  });

  return elements;
}
```

**Step 4: Update list.js**

Replace `src/renderer/templates/list.js`:

```javascript
export const description = 'Content list screen with search bar and scrollable item rows.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;
  const itemH = 64;

  const reservedTop = 56 + 56;
  const reservedBottom = 56;
  const availableHeight = screenHeight - reservedTop - reservedBottom - pad;
  const itemCount = Math.max(3, Math.floor(availableHeight / (itemH + 8)));

  // Content slots: [0] navbar title, [1..] list item labels
  const navTitle = contentHints[0] || 'Browse';
  const itemHints = contentHints.slice(1);

  const elements = [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: { title: navTitle },
    },
    {
      type: 'search_bar',
      x: pad,
      y: 64,
      width: contentWidth,
      height: 40,
      z_index: 0,
      properties: { placeholder: 'Search...' },
    },
  ];

  const defaultTitles = [
    'Getting Started Guide',
    'Advanced Configuration',
    'API Reference',
    'Troubleshooting',
    'Release Notes',
    'Community Forum',
    'Video Tutorials',
    'Best Practices',
  ];

  for (let i = 0; i < itemCount; i++) {
    const y = reservedTop + pad + i * (itemH + 8);
    if (y + itemH > screenHeight - reservedBottom) break;

    const title = itemHints.length > 0
      ? itemHints[i % itemHints.length]
      : defaultTitles[i % defaultTitles.length];

    elements.push({
      type: 'list',
      x: pad,
      y,
      width: contentWidth,
      height: itemH,
      z_index: 0,
      properties: { items: [title] },
    });
  }

  elements.push({
    type: 'tabbar',
    x: 0,
    y: screenHeight - 56,
    width: screenWidth,
    height: 56,
    z_index: 10,
    properties: { items: ['Home', 'Browse', 'Profile'] },
  });

  return elements;
}
```

**Step 5: Update form.js**

Replace `src/renderer/templates/form.js`:

```javascript
export const description = 'Generic data-entry form with labelled fields and action buttons.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 24;
  const fieldWidth = screenWidth - pad * 2;
  const fieldH = 56;
  const gap = 8;

  // Content slots: [0..N-2] field labels, [N-1] submit button label
  // If only 1 hint, use it as submit label. If 2+, last is submit, rest are fields.
  let fieldHints = [];
  let submitLabel = 'Save Contact';
  if (contentHints.length === 1) {
    submitLabel = contentHints[0];
  } else if (contentHints.length >= 2) {
    fieldHints = contentHints.slice(0, -1);
    submitLabel = contentHints[contentHints.length - 1];
  }

  const defaultFields = [
    { label: 'Full Name', placeholder: 'Jane Doe', inputType: 'text' },
    { label: 'Email', placeholder: 'jane@example.com', inputType: 'email' },
    { label: 'Phone', placeholder: '+1 (555) 000-0000', inputType: 'tel' },
    { label: 'Company', placeholder: 'Acme Corp', inputType: 'text' },
    { label: 'Role', placeholder: 'Product Manager', inputType: 'text' },
  ];

  const fields = fieldHints.length > 0
    ? fieldHints.map((h, i) => ({
        label: h,
        placeholder: defaultFields[i]?.placeholder || '',
        inputType: defaultFields[i]?.inputType || 'text',
      }))
    : defaultFields;

  const elements = [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: { title: 'New Contact' },
    },
  ];

  let y = 72;

  for (const field of fields) {
    if (y + fieldH > screenHeight - 80) break;
    elements.push({
      type: 'input',
      x: pad,
      y,
      width: fieldWidth,
      height: fieldH,
      z_index: 0,
      properties: field,
    });
    y += fieldH + gap;
  }

  const btnY = y + gap;
  if (btnY + 48 <= screenHeight) {
    elements.push({
      type: 'button',
      x: pad,
      y: btnY,
      width: fieldWidth,
      height: 48,
      z_index: 0,
      properties: { label: submitLabel, variant: 'primary' },
    });
  }

  const cancelY = btnY + 56;
  if (cancelY + 40 <= screenHeight) {
    elements.push({
      type: 'button',
      x: pad,
      y: cancelY,
      width: fieldWidth,
      height: 40,
      z_index: 0,
      properties: { label: 'Cancel', variant: 'secondary' },
    });
  }

  return elements;
}
```

**Step 6: Run tests**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: ALL PASS

**Step 7: Run full test suite**

Run: `node --test`
Expected: ALL PASS

**Step 8: Commit**

```bash
git add src/renderer/templates/settings.js src/renderer/templates/list.js src/renderer/templates/form.js tests/mcp/screen-generator.test.js
git commit -m "feat: settings + list + form templates use contentHints"
```

---

### Task 5: Profile + Onboarding templates use contentHints

**Files:**
- Modify: `src/renderer/templates/profile.js`
- Modify: `src/renderer/templates/onboarding.js`
- Test: `tests/mcp/screen-generator.test.js`

**Step 1: Write failing tests**

Add to `tests/mcp/screen-generator.test.js` in the `generateScreen` describe block:

```javascript
  it('profile uses contentHints for name and stat labels', () => {
    const result = generateScreen(
      'profile for John Runner, marathons completed, total miles, best time',
      393, 852, 'wireframe'
    );
    const texts = result.elements.filter(el => el.type === 'text');
    const nameText = texts.find(t => t.properties.fontSize === 20);
    assert.ok(nameText.properties.content.includes('John'));
    const cards = result.elements.filter(el => el.type === 'card');
    assert.ok(cards[0].properties.title.includes('Marathons'));
  });

  it('profile falls back to defaults when no contentHints', () => {
    const result = generateScreen('user profile', 393, 852, 'wireframe');
    const texts = result.elements.filter(el => el.type === 'text');
    const nameText = texts.find(t => t.properties.fontSize === 20);
    assert.equal(nameText.properties.content, 'Jane Doe');
  });

  it('onboarding uses contentHints for headline and subtitle', () => {
    const result = generateScreen(
      'onboarding for fitness tracker, track your daily steps',
      393, 852, 'wireframe'
    );
    const texts = result.elements.filter(el => el.type === 'text');
    const headline = texts.find(t => t.properties.fontSize === 22);
    assert.ok(headline.properties.content.includes('Fitness'));
  });

  it('onboarding falls back to defaults when no contentHints', () => {
    const result = generateScreen('welcome onboarding', 393, 852, 'wireframe');
    const texts = result.elements.filter(el => el.type === 'text');
    const headline = texts.find(t => t.properties.fontSize === 22);
    assert.equal(headline.properties.content, 'Welcome to MockupMCP');
  });
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: FAIL

**Step 3: Update profile.js**

Replace `src/renderer/templates/profile.js`:

```javascript
export const description = 'User profile page with avatar, stats, bio, and action buttons.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;

  // Content slots: [0] user name, [1] bio, [2..4] stat labels
  const userName = contentHints[0] || 'Jane Doe';
  const bio = contentHints[1] || 'Product designer & coffee enthusiast';
  const statLabels = contentHints.length > 2
    ? contentHints.slice(2, 5)
    : ['Posts', 'Followers', 'Following'];
  const statValues = ['48', '1.2k', '305'];

  const elements = [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: { title: 'Profile' },
    },
    {
      type: 'avatar',
      x: Math.floor((screenWidth - 80) / 2),
      y: 72,
      width: 80,
      height: 80,
      z_index: 0,
      properties: { name: userName },
    },
    {
      type: 'text',
      x: pad,
      y: 164,
      width: contentWidth,
      height: 32,
      z_index: 0,
      properties: { content: userName, fontSize: 20, align: 'center' },
    },
    {
      type: 'text',
      x: pad,
      y: 200,
      width: contentWidth,
      height: 40,
      z_index: 0,
      properties: { content: bio, fontSize: 14, align: 'center' },
    },
    {
      type: 'button',
      x: Math.floor((screenWidth - 160) / 2),
      y: 252,
      width: 160,
      height: 40,
      z_index: 0,
      properties: { label: 'Edit Profile', variant: 'secondary' },
    },
  ];

  // Stats row — up to 3 cards side by side
  const statWidth = Math.floor((contentWidth - pad * 2) / 3);
  for (let i = 0; i < Math.min(statLabels.length, 3); i++) {
    elements.push({
      type: 'card',
      x: pad + i * (statWidth + pad),
      y: 308,
      width: statWidth,
      height: 64,
      z_index: 0,
      properties: { title: statLabels[i], value: statValues[i] || '0' },
    });
  }

  return elements.filter(el => el.x >= 0 && el.y + el.height <= screenHeight);
}
```

**Step 4: Update onboarding.js**

Replace `src/renderer/templates/onboarding.js`:

```javascript
export const description = 'Onboarding welcome screen with illustration placeholder, headline, and CTA.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 24;
  const contentWidth = screenWidth - pad * 2;

  // Content slots: [0] headline, [1] subtitle
  const headline = contentHints[0] || 'Welcome to MockupMCP';
  const subtitle = contentHints[1] || 'Design faster with AI-powered UI mockups';

  const illustrationH = Math.floor(screenHeight * 0.35);
  const illustrationY = Math.floor(screenHeight * 0.1);

  const headlineY = illustrationY + illustrationH + 24;
  const subY = headlineY + 48;
  const dotsY = subY + 56;
  const ctaY = dotsY + 32;
  const skipY = ctaY + 56;

  const elements = [
    {
      type: 'image',
      x: pad,
      y: illustrationY,
      width: contentWidth,
      height: illustrationH,
      z_index: 0,
      properties: { src: '', alt: 'Welcome illustration' },
    },
    {
      type: 'text',
      x: pad,
      y: headlineY,
      width: contentWidth,
      height: 40,
      z_index: 0,
      properties: { content: headline, fontSize: 22, align: 'center' },
    },
    {
      type: 'text',
      x: pad,
      y: subY,
      width: contentWidth,
      height: 48,
      z_index: 0,
      properties: { content: subtitle, fontSize: 15, align: 'center' },
    },
    {
      type: 'text',
      x: pad,
      y: dotsY,
      width: contentWidth,
      height: 24,
      z_index: 0,
      properties: { content: '• • •', align: 'center', fontSize: 12 },
    },
    {
      type: 'button',
      x: pad,
      y: ctaY,
      width: contentWidth,
      height: 48,
      z_index: 0,
      properties: { label: 'Get Started', variant: 'primary' },
    },
    {
      type: 'text',
      x: pad,
      y: skipY,
      width: contentWidth,
      height: 32,
      z_index: 0,
      properties: { content: 'Skip', align: 'center', fontSize: 14 },
    },
  ];

  return elements.filter(el => el.y + el.height <= screenHeight);
}
```

**Step 5: Run tests**

Run: `node --test tests/mcp/screen-generator.test.js`
Expected: ALL PASS

**Step 6: Run full test suite**

Run: `node --test`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add src/renderer/templates/profile.js src/renderer/templates/onboarding.js tests/mcp/screen-generator.test.js
git commit -m "feat: profile + onboarding templates use contentHints"
```

---

### Task 6: Integration tests — end-to-end content adaptation

**Files:**
- Modify: `tests/mcp/generate-screen.integration.test.js`

**Step 1: Write integration tests**

Add a new describe block in `tests/mcp/generate-screen.integration.test.js`:

```javascript
describe('content hints integration', () => {
  it('fitness dashboard with steps shows "Steps" in card title, not "Total Users"', async () => {
    const { generateScreen } = await import('../../src/mcp/screen-generator.js');
    const { elements } = generateScreen(
      'fitness dashboard with steps count, calories burned, active minutes, and weekly bar chart',
      393, 852, 'wireframe'
    );
    const cards = elements.filter(el => el.type === 'card');
    assert.ok(cards.length >= 2);
    assert.ok(cards[0].properties.title.includes('Steps'));
    assert.ok(cards[1].properties.title.includes('Calories'));
  });

  it('empty description still produces valid screen (regression)', async () => {
    const { generateScreen } = await import('../../src/mcp/screen-generator.js');
    const { elements, matchInfo } = generateScreen('', 393, 852, 'wireframe');
    assert.ok(elements.length >= 1);
    assert.equal(matchInfo.confidence, 'low');
  });

  it('all 7 templates with contentHints produce valid elements', async () => {
    const { generateScreen } = await import('../../src/mcp/screen-generator.js');
    const cases = [
      'login for gym members, start workout',
      'dashboard with steps, calories, weekly chart',
      'settings with workout reminders, calorie tracking, GPS',
      'list with running, cycling, yoga, swimming',
      'form with weight, height, age, submit',
      'profile for John Runner, marathons completed, total miles',
      'onboarding for fitness tracker, track your daily steps',
    ];
    for (const desc of cases) {
      const { elements, matchInfo } = generateScreen(desc, 393, 852, 'wireframe');
      assert.ok(elements.length >= 2, `Too few elements for "${desc}"`);
      assert.notEqual(matchInfo.confidence, 'low', `Should match template for "${desc}"`);
    }
  });

  it('contentHints stored correctly when saved to project store', async () => {
    const { generateScreen } = await import('../../src/mcp/screen-generator.js');
    const { elements, nameHint } = generateScreen(
      'fitness dashboard with steps count, calories burned',
      393, 852, 'wireframe'
    );

    const screen = await store.addScreen(projectId, nameHint);
    const populated = await store.applyTemplate(projectId, screen.id, elements, true);

    const cards = populated.elements.filter(el => el.type === 'card');
    assert.ok(cards[0].properties.title.includes('Steps'));
    assert.ok(cards[1].properties.title.includes('Calories'));
  });
});
```

**Step 2: Run integration tests**

Run: `node --test tests/mcp/generate-screen.integration.test.js`
Expected: ALL PASS

**Step 3: Run full test suite**

Run: `node --test`
Expected: ALL PASS — no regressions anywhere

**Step 4: Commit**

```bash
git add tests/mcp/generate-screen.integration.test.js
git commit -m "test: content hints integration tests"
```

---

## Task Dependencies

```
Task 1 (parseDescription) ──→ Task 2 (pipeline wiring) ──→ Task 3 (dashboard + login)
                                                        ──→ Task 4 (settings + list + form)
                                                        ──→ Task 5 (profile + onboarding)
                                               Tasks 3,4,5 ──→ Task 6 (integration tests)
```

Tasks 3, 4, 5 are **independent** and can run in parallel after Task 2 is complete.

## Sprint Composition

| Task | Agent | Model | Parallel |
|------|-------|-------|----------|
| 1 | dev-1 | sonnet | sequential (first) |
| 2 | dev-1 | sonnet | sequential (after 1) |
| 3 | dev-1 | sonnet | parallel with 4, 5 |
| 4 | dev-2 | sonnet | parallel with 3, 5 |
| 5 | dev-3 | sonnet | parallel with 3, 4 |
| 6 | dev-1 | sonnet | sequential (after 3,4,5) |
| review | reviewer | sonnet | after 6 |
