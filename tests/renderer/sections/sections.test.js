import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSection,
  getAvailableSections,
} from '../../../src/renderer/sections/index.js';

describe('Section Generators', () => {
  describe('getAvailableSections', () => {
    it('returns all 10 section types', () => {
      const sections = getAvailableSections();
      assert.ok(Array.isArray(sections));
      assert.equal(sections.length, 10);
    });

    it('includes expected section types', () => {
      const sections = getAvailableSections();
      const expected = [
        'navbar',
        'hero_with_cta',
        'login_form',
        'card_grid_3',
        'card_grid_2',
        'settings_panel',
        'profile_header',
        'search_bar',
        'feature_list',
        'footer',
      ];
      for (const sec of expected) {
        assert.ok(sections.includes(sec), `Missing section: ${sec}`);
      }
    });
  });

  describe('getSection', () => {
    it('returns null for unknown section type', () => {
      const section = getSection('unknown_section');
      assert.equal(section, null);
    });

    it('returns section module with generate and defaults', () => {
      const section = getSection('navbar');
      assert.ok(section);
      assert.ok(typeof section.generate === 'function');
      assert.ok(typeof section.defaults === 'function');
    });
  });

  describe('navbar section', () => {
    it('generates valid navbar element structure', () => {
      const section = getSection('navbar');
      const { elements, height } = section.generate(1280, 0, {});

      assert.ok(Array.isArray(elements));
      assert.equal(height, 60);
      assert.ok(elements.length > 0);

      // Check element structure
      for (const el of elements) {
        assert.ok(el.type);
        assert.ok(typeof el.x === 'number');
        assert.ok(typeof el.y === 'number');
        assert.ok(typeof el.width === 'number');
        assert.ok(typeof el.height === 'number');
        assert.ok(el.properties);
        assert.ok(typeof el.z_index === 'number');
      }
    });

    it('uses custom props', () => {
      const section = getSection('navbar');
      const { elements } = section.generate(1280, 0, { title: 'Custom Title', links: ['A', 'B'] });

      const titleEl = elements.find(e => e.properties.content === 'Custom Title');
      assert.ok(titleEl, 'Custom title not found in elements');
    });

    it('defaults to expected title and links', () => {
      const section = getSection('navbar');
      const defaults = section.defaults();

      assert.equal(defaults.title, 'MyApp');
      assert.ok(Array.isArray(defaults.links));
      assert.equal(defaults.links.length, 3);
    });
  });

  describe('hero_with_cta section', () => {
    it('generates valid hero section structure', () => {
      const section = getSection('hero_with_cta');
      const { elements, height } = section.generate(1280, 0, {});

      assert.equal(height, 300);
      assert.ok(elements.length > 0);

      // Check all elements have required properties
      for (const el of elements) {
        assert.ok(el.type);
        assert.ok(typeof el.x === 'number');
        assert.ok(typeof el.y === 'number');
        assert.ok(typeof el.width === 'number');
        assert.ok(typeof el.height === 'number');
        assert.ok(el.properties);
      }
    });

    it('positions sections at correct y offset', () => {
      const section = getSection('hero_with_cta');
      const { elements } = section.generate(1280, 100, {});

      // All elements should have y >= 100
      for (const el of elements) {
        assert.ok(el.y >= 100, `Element y (${el.y}) should be >= 100`);
      }
    });
  });

  describe('card_grid_3 section', () => {
    it('generates 3 card layout', () => {
      const section = getSection('card_grid_3');
      const cards = [
        { title: 'Card 1', body: 'Body 1' },
        { title: 'Card 2', body: 'Body 2' },
        { title: 'Card 3', body: 'Body 3' },
      ];
      const { elements, height } = section.generate(1280, 0, { cards });

      assert.equal(height, 280);
      // Should have at least 3 card backgrounds
      const cardBgs = elements.filter(e => e.type === 'rect' && e.properties.stroke === '#ddd');
      assert.ok(cardBgs.length >= 3);
    });

    it('respects custom card data', () => {
      const section = getSection('card_grid_3');
      const cards = [
        { title: 'Custom 1', body: 'Description 1' },
        { title: 'Custom 2', body: 'Description 2' },
        { title: 'Custom 3', body: 'Description 3' },
      ];
      const { elements } = section.generate(1280, 0, { cards });

      assert.ok(elements.some(e => e.properties.content === 'Custom 1'));
      assert.ok(elements.some(e => e.properties.content === 'Custom 2'));
      assert.ok(elements.some(e => e.properties.content === 'Custom 3'));
    });
  });

  describe('login_form section', () => {
    it('generates valid form structure', () => {
      const section = getSection('login_form');
      const { elements, height } = section.generate(1280, 0, {});

      assert.equal(height, 400);
      assert.ok(elements.length > 0);

      // Check for form container
      const formContainer = elements.find(e => e.type === 'rect' && e.properties.stroke === '#ddd');
      assert.ok(formContainer, 'Form container not found');
    });
  });

  describe('settings_panel section', () => {
    it('generates panel with field inputs', () => {
      const section = getSection('settings_panel');
      const { elements, height } = section.generate(1280, 0, {});

      assert.equal(height, 350);
      // Should have multiple input fields (rects with border)
      const inputs = elements.filter(e => e.type === 'rect' && e.properties.stroke === '#ccc');
      assert.ok(inputs.length >= 3, 'Expected at least 3 input fields');
    });
  });

  describe('profile_header section', () => {
    it('generates avatar and user info', () => {
      const section = getSection('profile_header');
      const { elements, height } = section.generate(1280, 0, { name: 'John Doe', role: 'Designer' });

      assert.equal(height, 160);
      assert.ok(elements.some(e => e.properties.content === 'John Doe'));
      assert.ok(elements.some(e => e.properties.content === 'Designer'));
    });
  });

  describe('search_bar section', () => {
    it('generates search input and button', () => {
      const section = getSection('search_bar');
      const { elements, height } = section.generate(1280, 0, {});

      assert.equal(height, 80);
      // Should have input and button
      const input = elements.find(e => e.type === 'rect' && e.properties.stroke === '#ccc');
      const button = elements.find(e => e.type === 'rect' && e.properties.fill === '#0066cc');
      assert.ok(input, 'Search input not found');
      assert.ok(button, 'Search button not found');
    });
  });

  describe('feature_list section', () => {
    it('generates 3-row feature list', () => {
      const section = getSection('feature_list');
      const { elements, height } = section.generate(1280, 0, {});

      assert.equal(height, 250);
      // Should have multiple feature items
      assert.ok(elements.length > 0);
    });
  });

  describe('footer section', () => {
    it('generates footer with copyright and links', () => {
      const section = getSection('footer');
      const { elements, height } = section.generate(1280, 0, {});

      assert.equal(height, 80);
      assert.ok(elements.length > 0);

      // Background
      const bg = elements.find(e => e.type === 'rect' && e.properties.fill === '#1a1a2e');
      assert.ok(bg, 'Footer background not found');
    });
  });

  describe('element escaping', () => {
    it('escapes HTML in user content', () => {
      const section = getSection('navbar');
      const { elements } = section.generate(1280, 0, { title: '<script>alert("xss")</script>' });

      const titleEl = elements.find(e => e.properties.content && e.properties.content.includes('<'));
      // Should be escaped, not contain raw <script>
      assert.ok(!titleEl, 'Unescaped HTML found in output');
    });
  });
});
