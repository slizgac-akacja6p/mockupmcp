import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableTypes, getComponent } from '../../src/renderer/components/index.js';
import { buildScreenHtml } from '../../src/renderer/html-builder.js';
import { getAvailableStyles } from '../../src/renderer/styles/index.js';

describe('all styles x all components integration', () => {
  for (const style of getAvailableStyles()) {
    for (const type of getAvailableTypes()) {
      it(`${style}/${type}: renders in buildScreenHtml without error`, () => {
        const comp = getComponent(type);
        const screen = {
          width: 393,
          height: 852,
          background: '#FFFFFF',
          elements: [{
            type,
            x: 10, y: 10, width: 200, height: 100, z_index: 0,
            properties: comp.defaults(),
          }],
        };
        const html = buildScreenHtml(screen, style);
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.length > 500);
      });
    }
  }
});
