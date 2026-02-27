import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getComponent, getAvailableTypes } from '../../src/renderer/components/index.js';

// ── Registry ─────────────────────────────────────────────────────────────────

describe('component registry', () => {
  it('has exactly 37 registered types (36 + rect alias)', () => {
    assert.strictEqual(getAvailableTypes().length, 37);
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
  for (const type of getAvailableTypes()) {
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

// ── circle ──────────────────────────────────────────────────────────────────

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

// ── line ────────────────────────────────────────────────────────────────────

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

// ── textarea ────────────────────────────────────────────────────────────────

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

// ── checkbox ────────────────────────────────────────────────────────────────

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

// ── radio ───────────────────────────────────────────────────────────────────

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

// ── toggle ──────────────────────────────────────────────────────────────────

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

// ── select ──────────────────────────────────────────────────────────────────

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

// ── slider ──────────────────────────────────────────────────────────────────

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

// ── sidebar ─────────────────────────────────────────────────────────────────

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

// ── breadcrumb ──────────────────────────────────────────────────────────────

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

// ── table ───────────────────────────────────────────────────────────────────

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

// ── avatar ──────────────────────────────────────────────────────────────────

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

// ── badge ───────────────────────────────────────────────────────────────────

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

// ── chip ────────────────────────────────────────────────────────────────────

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

// ── alert ───────────────────────────────────────────────────────────────────

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

// ── modal ───────────────────────────────────────────────────────────────────

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

// ── skeleton ────────────────────────────────────────────────────────────────

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

// ── progress ────────────────────────────────────────────────────────────────

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

// ── tooltip ─────────────────────────────────────────────────────────────────

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

// ── login_form ──────────────────────────────────────────────────────────────

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

// ── search_bar ──────────────────────────────────────────────────────────────

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

// ── header ──────────────────────────────────────────────────────────────────

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

// ── footer ──────────────────────────────────────────────────────────────────

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

// ── data_table ──────────────────────────────────────────────────────────────

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

// ── chart_placeholder ───────────────────────────────────────────────────────

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
