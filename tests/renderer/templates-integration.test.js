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
