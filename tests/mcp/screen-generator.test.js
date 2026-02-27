import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDescription, matchTemplate, augmentElements, generateScreen } from '../../src/mcp/screen-generator.js';

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
    const joined = result.contentHints.join(' ').toLowerCase();
    assert.ok(!joined.includes('the '));
    assert.ok(!joined.includes('dashboard'));
  });
});

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

  it('adds tabbar when keyword present and not already in elements', () => {
    const base = [
      { type: 'navbar', x: 0, y: 0, width: 393, height: 56, z_index: 10, properties: { title: 'Test' } },
    ];
    const parsed = {
      screenKeywords: ['dashboard'],
      componentKeywords: ['tabbar'],
      modifierKeywords: [],
      tokens: ['dashboard', 'tabbar'],
    };
    const result = augmentElements(base, parsed, 393, 852);
    const tabbar = result.find(el => el.type === 'tabbar');
    assert.ok(tabbar, 'should add tabbar element');
    assert.equal(tabbar.y, 852 - 56, 'tabbar at bottom of screen');
    assert.equal(tabbar.z_index, 10, 'tabbar is pinned');
    assert.equal(tabbar.width, 393, 'tabbar is full width');
  });

  it('does not add tabbar if already present', () => {
    const base = [
      { type: 'tabbar', x: 0, y: 796, width: 393, height: 56, z_index: 10, properties: { tabs: [] } },
    ];
    const parsed = {
      screenKeywords: [],
      componentKeywords: ['tabbar'],
      modifierKeywords: [],
      tokens: ['tabbar'],
    };
    const result = augmentElements(base, parsed, 393, 852);
    const tabbars = result.filter(el => el.type === 'tabbar');
    assert.equal(tabbars.length, 1, 'should not duplicate tabbar');
  });
});

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

  it('passes contentHints to template — dashboard cards use hint content', () => {
    const result = generateScreen('fitness dashboard with steps, calories', 393, 852, 'wireframe');
    assert.equal(result.matchInfo.template, 'dashboard');
    const cards = result.elements.filter(el => el.type === 'card');
    assert.ok(cards.length >= 2);
    // First card should use first hint
    assert.ok(cards[0].properties.title.includes('Steps'));
  });

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

  it('dashboard template includes tabbar by default', () => {
    const result = generateScreen('dashboard screen', 393, 852, 'wireframe');
    const tabbar = result.elements.find(el => el.type === 'tabbar');
    assert.ok(tabbar, 'dashboard should include tabbar');
    assert.equal(tabbar.y, 852 - 56);
    assert.equal(tabbar.z_index, 10);
  });

  it('dashboard desktop (1440px) generates at least 12 elements with sidebar', () => {
    const result = generateScreen('dashboard with stats', 1440, 800, 'wireframe');
    assert.ok(result.elements.length >= 12, `expected >=12 elements, got ${result.elements.length}`);
    // Sidebar nav present on desktop
    const sidebar = result.elements.find(el => el.type === 'list' && el.x === 0);
    assert.ok(sidebar, 'desktop dashboard should include sidebar nav');
    // No tabbar on desktop — sidebar replaces it
    const tabbar = result.elements.find(el => el.type === 'tabbar');
    assert.equal(tabbar, undefined, 'desktop dashboard should not include tabbar');
    // 4 stat cards in single row
    const cards = result.elements.filter(el => el.type === 'card');
    assert.equal(cards.length, 4, 'desktop dashboard should have 4 stat cards');
    // Two charts side by side
    const charts = result.elements.filter(el => el.type === 'chart_placeholder');
    assert.equal(charts.length, 2, 'desktop dashboard should have 2 chart placeholders');
  });
});
