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
