// Screen generator — rule-based NLP parser for mockup_generate_screen tool.
// Pure functions: no side effects, no storage access.
import { getTemplate, getAvailableTemplates } from '../renderer/templates/index.js';

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

// Union of all known domain vocabulary — used to isolate content-specific phrases.
// Words that survive this filter are semantic data hints, not structural keywords.
const ALL_KNOWN_KEYWORDS = new Set([
  ...STOP_WORDS,
  ...SCREEN_KEYWORDS,
  ...COMPONENT_KEYWORDS,
  ...MODIFIER_KEYWORDS.flatMap(m => m.split(' ')),
]);

/**
 * Parse a natural language description into categorized keywords.
 * @param {string} description - Free-text screen description.
 * @returns {{ screenKeywords: string[], componentKeywords: string[], modifierKeywords: string[], nameHint: string, tokens: string[], contentHints: string[] }}
 */
export function parseDescription(description) {
  const lower = description.toLowerCase();

  // Match multi-word modifiers first
  const modifierKeywords = MODIFIER_KEYWORDS.filter(kw => lower.includes(kw));

  // Tokenize for single-word matching
  const tokens = lower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const screenKeywords = SCREEN_KEYWORDS.filter(kw => tokens.includes(kw));
  const componentKeywords = COMPONENT_KEYWORDS.filter(kw => tokens.includes(kw));

  // Derive a name hint from the first 2 meaningful non-component words.
  // Components (search, avatar, etc.) add noise — keep only semantic screen-type words.
  const HINT_STOP = new Set([...STOP_WORDS, ...COMPONENT_KEYWORDS]);
  const nameWords = description
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => !HINT_STOP.has(w.toLowerCase()))
    .slice(0, 2);
  const nameHint = nameWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Generated Screen';

  // Extract content hints — semantic phrases from description segments.
  // Split on commas and "and" conjunctions to isolate per-metric phrases,
  // then strip all known structural vocabulary to surface data-specific words.
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

  return { screenKeywords, componentKeywords, modifierKeywords, nameHint, tokens, contentHints };
}

// Template keyword profiles with weights.
// Primary keywords uniquely identify the screen type — any single match is sufficient.
// Secondary keywords boost confidence when primary already matched.
// Scoring: normalize against a fixed scale (1 primary + best secondary) so a single
// primary hit always reaches the "high" threshold regardless of how many primaries exist.
const TEMPLATE_PROFILES = {
  login:      { primary: ['login', 'signin', 'signup', 'register'], secondary: ['password', 'email', 'auth'] },
  dashboard:  { primary: ['dashboard', 'home'], secondary: ['chart', 'stats', 'card', 'analytics'] },
  settings:   { primary: ['settings', 'preferences'], secondary: ['toggle', 'notification', 'dark mode'] },
  profile:    { primary: ['profile', 'account'], secondary: ['avatar', 'image', 'photo', 'user'] },
  list:       { primary: ['list', 'feed', 'catalog'], secondary: ['card', 'cards', 'search', 'table'] },
  form:       { primary: ['form', 'contact', 'checkout'], secondary: ['input', 'textarea', 'select'] },
  onboarding: { primary: ['onboarding', 'welcome', 'intro'], secondary: ['button', 'image'] },
};

// Fixed denominator: 1 primary match + 1 secondary match = 1.0 + 0.4 = 1.4.
// This ensures a single primary hit produces score = 1.0/1.4 ≈ 0.71 (high confidence).
const SCORE_DENOMINATOR = 1.4;

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
    let primaryHits = 0;
    let secondaryHits = 0;
    for (const kw of profile.primary) {
      if (allKeywords.includes(kw)) primaryHits += 1;
    }
    for (const kw of profile.secondary) {
      if (allKeywords.includes(kw)) secondaryHits += 1;
    }
    // Cap at 1 primary and 1 secondary to keep a stable denominator.
    const score = (Math.min(primaryHits, 1) * 1.0 + Math.min(secondaryHits, 1) * 0.4) / SCORE_DENOMINATOR;
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = name;
    }
  }

  let confidence;
  if (bestScore >= 0.5) confidence = 'high';
  else if (bestScore >= 0.2) confidence = 'medium';
  else confidence = 'low';

  return {
    template: confidence === 'low' ? null : bestTemplate,
    confidence,
    score: Math.round(bestScore * 100) / 100,
  };
}

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

  // Tabbar is pinned at the bottom — skip addIfFits height check since z_index >= 10 elements
  // are excluded from auto-layout and always render at their absolute position.
  if (parsed.componentKeywords.includes('tabbar') && !existingTypes.has('tabbar')) {
    result.push({
      type: 'tabbar',
      x: 0,
      y: screenHeight - 56,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: {
        tabs: [
          { icon: 'home', label: 'Home', active: true },
          { icon: 'search', label: 'Search' },
          { icon: 'user', label: 'Profile' },
        ],
      },
    });
  }

  return result;
}

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
    elements = template.generate(screenWidth, screenHeight, style, parsed.contentHints);
  } else {
    // Fallback: basic screen with navbar + description text so the user sees
    // something meaningful instead of an empty canvas.
    const pad = 24;
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
  }

  // Apply augmentations based on keywords found in the description
  const augmented = augmentElements(elements, parsed, screenWidth, screenHeight);
  if (augmented.length > elements.length) {
    const added = augmented.slice(elements.length);
    for (const el of added) {
      augmentations.push(`added ${el.type}${el.properties?.label ? ` "${el.properties.label}"` : ''}`);
    }
  }
  elements = augmented;

  // Discard elements that overflow screen height after augmentation
  // Fallback: if filtering removes all elements, keep the original array to avoid empty screens
  const filtered = elements.filter(el => el.y + el.height <= screenHeight);
  elements = filtered.length > 0 ? filtered : elements;

  // Layout and component guidelines returned to the LLM alongside the generated screen.
  // These steer follow-up element additions (mockup_add_element / mockup_bulk_add_elements)
  // so the AI respects spacing rules and uses proper component types instead of primitives.
  const guidelines = [
    'Elements MUST NOT overlap each other. Use adequate spacing (minimum 8px gap between elements).',
    'Plan element positions carefully: calculate that no two elements share the same coordinates area.',
    'ALWAYS use the `button` component type for clickable actions. NEVER simulate a button using rectangle + text combination.',
    'Available interactive components: button, input, checkbox, select. Use them instead of combining primitives.',
    "text elements use 'content' field (NOT 'text', NOT 'label')",
    "button elements use 'label' field (NOT 'text')",
    "card/badge/chip/checkbox/toggle/radio use 'label' for display text",
  ];

  const matchInfo = {
    template: match.template,
    confidence: match.confidence,
    score: match.score,
    augmentations,
    guidelines,
  };
  if (match.confidence === 'low') {
    matchInfo.suggestions = getAvailableTemplates();
  }

  return { elements, matchInfo, nameHint: parsed.nameHint };
}
