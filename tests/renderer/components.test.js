import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getComponent, getAvailableTypes } from '../../src/renderer/components/index.js';

// ── Registry ─────────────────────────────────────────────────────────────────

describe('component registry', () => {
  it('has exactly 10 registered types', () => {
    assert.strictEqual(getAvailableTypes().length, 10);
  });

  it('returns null for unknown type', () => {
    assert.strictEqual(getComponent('nonexistent'), null);
  });

  it('all registered types expose render and defaults functions', () => {
    for (const type of getAvailableTypes()) {
      const comp = getComponent(type);
      assert.strictEqual(typeof comp.render,   'function', `${type}.render must be a function`);
      assert.strictEqual(typeof comp.defaults, 'function', `${type}.defaults must be a function`);
    }
  });
});

// ── Generic contract (every component) ───────────────────────────────────────

describe('all components: default render contract', () => {
  for (const type of ['text', 'rectangle', 'button', 'input', 'image', 'icon', 'navbar', 'tabbar', 'card', 'list']) {
    it(`${type}: renders non-empty HTML string with default props`, () => {
      const comp = getComponent(type);
      const html = comp.render(comp.defaults());
      assert.strictEqual(typeof html, 'string');
      assert.ok(html.length > 0, `${type}: output must not be empty`);
    });
  }
});

// ── text ─────────────────────────────────────────────────────────────────────

describe('text component', () => {
  it('renders content inside a span', () => {
    const { render, defaults } = getComponent('text');
    const html = render({ ...defaults(), content: 'Hello' });
    assert.ok(html.includes('Hello'));
    assert.ok(html.includes('<span'));
  });

  it('escapes HTML in content to prevent XSS', () => {
    const { render, defaults } = getComponent('text');
    const html = render({ ...defaults(), content: '<script>alert(1)</script>' });
    assert.ok(!html.includes('<script>'), 'raw <script> tag must not appear');
    assert.ok(html.includes('&lt;script&gt;'), 'escaped form must appear');
  });

  it('applies fontSize and color as inline style', () => {
    const { render, defaults } = getComponent('text');
    const html = render({ ...defaults(), fontSize: 20, color: '#FF0000' });
    assert.ok(html.includes('20px'));
    assert.ok(html.includes('#FF0000'));
  });
});

// ── rectangle ────────────────────────────────────────────────────────────────

describe('rectangle component', () => {
  it('renders a div with background fill', () => {
    const { render, defaults } = getComponent('rectangle');
    const html = render({ ...defaults(), fill: '#ABCDEF' });
    assert.ok(html.includes('<div'));
    assert.ok(html.includes('#ABCDEF'));
  });

  it('applies cornerRadius', () => {
    const { render, defaults } = getComponent('rectangle');
    const html = render({ ...defaults(), cornerRadius: 8 });
    assert.ok(html.includes('8px'));
  });
});

// ── button ───────────────────────────────────────────────────────────────────

describe('button component', () => {
  it('renders a button element with label', () => {
    const { render, defaults } = getComponent('button');
    const html = render({ ...defaults(), label: 'Click Me' });
    assert.ok(html.includes('<button'));
    assert.ok(html.includes('Click Me'));
  });

  it('applies variant class', () => {
    const { render, defaults } = getComponent('button');
    assert.ok(render({ ...defaults(), variant: 'primary'   }).includes('mockup-button--primary'));
    assert.ok(render({ ...defaults(), variant: 'secondary' }).includes('mockup-button--secondary'));
    assert.ok(render({ ...defaults(), variant: 'outline'   }).includes('mockup-button--outline'));
    assert.ok(render({ ...defaults(), variant: 'ghost'     }).includes('mockup-button--ghost'));
  });

  it('applies size class', () => {
    const { render, defaults } = getComponent('button');
    assert.ok(render({ ...defaults(), size: 'sm' }).includes('mockup-button--sm'));
    assert.ok(render({ ...defaults(), size: 'lg' }).includes('mockup-button--lg'));
  });

  it('escapes HTML in label', () => {
    const { render, defaults } = getComponent('button');
    const html = render({ ...defaults(), label: '<b>bold</b>' });
    assert.ok(!html.includes('<b>'), 'raw tag must be escaped');
    assert.ok(html.includes('&lt;b&gt;'));
  });
});

// ── input ─────────────────────────────────────────────────────────────────────

describe('input component', () => {
  it('renders placeholder text', () => {
    const { render, defaults } = getComponent('input');
    const html = render({ ...defaults(), placeholder: 'Search...' });
    assert.ok(html.includes('Search...'));
  });

  it('renders label element when label prop is provided', () => {
    const { render, defaults } = getComponent('input');
    const html = render({ ...defaults(), label: 'Email' });
    assert.ok(html.includes('Email'));
    assert.ok(html.includes('mockup-input-label'));
  });

  it('omits label element when label prop is not provided', () => {
    const { render, defaults } = getComponent('input');
    const html = render(defaults());
    assert.ok(!html.includes('mockup-input-label'));
  });
});

// ── image ─────────────────────────────────────────────────────────────────────

describe('image component', () => {
  it('renders image placeholder div', () => {
    const { render, defaults } = getComponent('image');
    const html = render(defaults());
    assert.ok(html.includes('mockup-image-placeholder'));
  });

  it('includes SVG diagonal lines', () => {
    const { render, defaults } = getComponent('image');
    const html = render(defaults());
    assert.ok(html.includes('<svg'));
    assert.ok(html.includes('<line'));
  });
});

// ── icon ─────────────────────────────────────────────────────────────────────

describe('icon component', () => {
  it('renders SVG for a known icon name', () => {
    const { render, defaults } = getComponent('icon');
    const html = render({ ...defaults(), name: 'home' });
    assert.ok(html.includes('<svg'));
    // home icon uses a path element
    assert.ok(html.includes('<path') || html.includes('<polyline'));
  });

  it('renders fallback circle for an unknown icon name', () => {
    const { render, defaults } = getComponent('icon');
    const html = render({ ...defaults(), name: 'totally-unknown-icon-xyz' });
    assert.ok(html.includes('<svg'));
    assert.ok(html.includes('<circle'));
  });

  it('applies size and color to SVG attributes', () => {
    const { render, defaults } = getComponent('icon');
    const html = render({ ...defaults(), size: 32, color: '#FF5500' });
    assert.ok(html.includes('width="32"'));
    assert.ok(html.includes('height="32"'));
    assert.ok(html.includes('#FF5500'));
  });

  it('renders all 20 named icons without error', () => {
    const { render, defaults } = getComponent('icon');
    const names = ['home','search','user','menu','settings','bell','plus','x',
      'chevron-left','chevron-right','heart','star','share','send','trash',
      'edit','camera','image','check','more-horizontal'];
    for (const name of names) {
      const html = render({ ...defaults(), name });
      assert.ok(html.includes('<svg'), `icon "${name}" should produce SVG`);
    }
  });

  it('resolves "notifications" alias to the bell icon', () => {
    const { render, defaults } = getComponent('icon');
    const html = render({ ...defaults(), name: 'notifications' });
    assert.ok(html.includes('<svg'), 'notifications alias should produce SVG');
    assert.ok(!html.includes('<circle'), 'should not fall back to circle');
  });
});

// ── navbar ───────────────────────────────────────────────────────────────────

describe('navbar component', () => {
  it('renders title text', () => {
    const { render, defaults } = getComponent('navbar');
    const html = render({ ...defaults(), title: 'My App' });
    assert.ok(html.includes('My App'));
  });

  it('includes mockup-navbar class', () => {
    const { render, defaults } = getComponent('navbar');
    const html = render(defaults());
    assert.ok(html.includes('mockup-navbar'));
  });

  it('renders left icon SVG when leftIcon is provided', () => {
    const { render, defaults } = getComponent('navbar');
    const html = render({ ...defaults(), leftIcon: 'chevron-left' });
    assert.ok(html.includes('<svg'));
  });

  it('renders right icons when rightIcons array is provided', () => {
    const { render, defaults } = getComponent('navbar');
    const html = render({ ...defaults(), rightIcons: ['bell', 'search'] });
    // Two SVGs should be present (one for each right icon)
    const svgCount = (html.match(/<svg/g) || []).length;
    assert.ok(svgCount >= 2, 'should render at least 2 SVGs for 2 right icons');
  });
});

// ── tabbar ───────────────────────────────────────────────────────────────────

describe('tabbar component', () => {
  it('renders tab labels', () => {
    const { render, defaults } = getComponent('tabbar');
    const html = render(defaults());
    assert.ok(html.includes('Home'));
    assert.ok(html.includes('Search'));
    assert.ok(html.includes('Profile'));
  });

  it('includes mockup-tabbar class', () => {
    const { render, defaults } = getComponent('tabbar');
    const html = render(defaults());
    assert.ok(html.includes('mockup-tabbar'));
  });

  it('applies active class to the active tab', () => {
    const { render } = getComponent('tabbar');
    const html = render({
      tabs: [
        { icon: 'home', label: 'Home', active: true },
        { icon: 'search', label: 'Search' },
      ],
    });
    assert.ok(html.includes('mockup-tabbar-item--active'));
  });

  it('renders custom tabs', () => {
    const { render } = getComponent('tabbar');
    const html = render({
      tabs: [
        { icon: 'heart',  label: 'Likes' },
        { icon: 'star',   label: 'Saved' },
      ],
    });
    assert.ok(html.includes('Likes'));
    assert.ok(html.includes('Saved'));
  });
});

// ── card ─────────────────────────────────────────────────────────────────────

describe('card component', () => {
  it('renders card title', () => {
    const { render, defaults } = getComponent('card');
    const html = render({ ...defaults(), title: 'My Card' });
    assert.ok(html.includes('My Card'));
    assert.ok(html.includes('mockup-card'));
  });

  it('renders subtitle when provided', () => {
    const { render, defaults } = getComponent('card');
    const html = render({ ...defaults(), subtitle: 'A subtitle' });
    assert.ok(html.includes('A subtitle'));
    assert.ok(html.includes('mockup-card__subtitle'));
  });

  it('renders image placeholder when image is true', () => {
    const { render, defaults } = getComponent('card');
    const html = render({ ...defaults(), image: true });
    assert.ok(html.includes('<svg'));
  });

  it('renders action buttons when actions provided', () => {
    const { render, defaults } = getComponent('card');
    const html = render({ ...defaults(), actions: ['Save', 'Cancel'] });
    assert.ok(html.includes('Save'));
    assert.ok(html.includes('Cancel'));
    assert.ok(html.includes('mockup-card__actions'));
  });
});

// ── list ─────────────────────────────────────────────────────────────────────

describe('list component', () => {
  it('renders list items', () => {
    const { render, defaults } = getComponent('list');
    const html = render(defaults());
    assert.ok(html.includes('Item 1'));
    assert.ok(html.includes('Item 2'));
    assert.ok(html.includes('Item 3'));
  });

  it('simple variant includes mockup-list class', () => {
    const { render, defaults } = getComponent('list');
    const html = render({ ...defaults(), variant: 'simple' });
    assert.ok(html.includes('mockup-list'));
  });

  it('detailed variant renders avatar placeholders', () => {
    const { render, defaults } = getComponent('list');
    const html = render({ ...defaults(), variant: 'detailed' });
    assert.ok(html.includes('mockup-list-item__avatar'));
  });

  it('card variant renders bordered item containers', () => {
    const { render } = getComponent('list');
    const html = render({ items: ['Alpha', 'Beta'], variant: 'card' });
    assert.ok(html.includes('Alpha'));
    assert.ok(html.includes('Beta'));
    // Card variant wraps each item in its own bordered div
    assert.ok(html.includes('border:1px solid'));
  });

  it('renders custom items', () => {
    const { render, defaults } = getComponent('list');
    const html = render({ ...defaults(), items: ['Foo', 'Bar'] });
    assert.ok(html.includes('Foo'));
    assert.ok(html.includes('Bar'));
  });
});

// ── XSS escaping across ALL components with user-supplied text ──────────────

describe('XSS escaping: all components escape user-supplied text', () => {
  const XSS = '<img src=x onerror=alert(1)>';

  it('input: escapes label', () => {
    const { render, defaults } = getComponent('input');
    const html = render({ ...defaults(), label: XSS });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in input label');
    assert.ok(html.includes('&lt;img'));
  });

  it('input: escapes placeholder', () => {
    const { render, defaults } = getComponent('input');
    const html = render({ ...defaults(), placeholder: XSS });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in input placeholder');
    assert.ok(html.includes('&lt;img'));
  });

  it('navbar: escapes title', () => {
    const { render, defaults } = getComponent('navbar');
    const html = render({ ...defaults(), title: XSS });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in navbar title');
    assert.ok(html.includes('&lt;img'));
  });

  it('card: escapes title', () => {
    const { render, defaults } = getComponent('card');
    const html = render({ ...defaults(), title: XSS });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in card title');
    assert.ok(html.includes('&lt;img'));
  });

  it('card: escapes subtitle', () => {
    const { render, defaults } = getComponent('card');
    const html = render({ ...defaults(), subtitle: XSS });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in card subtitle');
    assert.ok(html.includes('&lt;img'));
  });

  it('card: escapes action labels', () => {
    const { render, defaults } = getComponent('card');
    const html = render({ ...defaults(), actions: [XSS] });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in card actions');
    assert.ok(html.includes('&lt;img'));
  });

  it('list: escapes items in simple variant', () => {
    const { render, defaults } = getComponent('list');
    const html = render({ ...defaults(), items: [XSS], variant: 'simple' });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in simple list');
    assert.ok(html.includes('&lt;img'));
  });

  it('list: escapes items in detailed variant', () => {
    const { render, defaults } = getComponent('list');
    const html = render({ ...defaults(), items: [XSS], variant: 'detailed' });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in detailed list');
    assert.ok(html.includes('&lt;img'));
  });

  it('list: escapes items in card variant', () => {
    const { render, defaults } = getComponent('list');
    const html = render({ ...defaults(), items: [XSS], variant: 'card' });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in card list');
    assert.ok(html.includes('&lt;img'));
  });

  it('tabbar: escapes tab labels', () => {
    const { render } = getComponent('tabbar');
    const html = render({ tabs: [{ icon: 'home', label: XSS }] });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in tabbar label');
    assert.ok(html.includes('&lt;img'));
  });

  it('text: escapes content (existing coverage confirmation)', () => {
    const { render, defaults } = getComponent('text');
    const html = render({ ...defaults(), content: XSS });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in text content');
    assert.ok(html.includes('&lt;img'));
  });

  it('button: escapes label (existing coverage confirmation)', () => {
    const { render, defaults } = getComponent('button');
    const html = render({ ...defaults(), label: XSS });
    assert.ok(!html.includes('<img'), 'raw <img> must not appear in button label');
    assert.ok(html.includes('&lt;img'));
  });
});

// ── button: variant and size validation ─────────────────────────────────────

describe('button: variant and size allowlist validation', () => {
  it('falls back to primary for unknown variant', () => {
    const { render, defaults } = getComponent('button');
    const html = render({ ...defaults(), variant: 'evil"><script>' });
    assert.ok(html.includes('mockup-button--primary'), 'should fall back to primary');
    assert.ok(!html.includes('evil'), 'injected variant must not appear');
  });

  it('falls back to md for unknown size', () => {
    const { render, defaults } = getComponent('button');
    const html = render({ ...defaults(), size: 'xxl' });
    assert.ok(html.includes('mockup-button--md'), 'should fall back to md');
    assert.ok(!html.includes('xxl'), 'unknown size must not appear');
  });
});
