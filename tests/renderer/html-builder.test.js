import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildScreenHtml } from '../../src/renderer/html-builder.js';

describe('buildScreenHtml', () => {
  it('renders empty screen with doctype and dimensions', () => {
    const html = buildScreenHtml({ width: 393, height: 852, background: '#FFF', elements: [] });
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('393px'));
    assert.ok(html.includes('852px'));
  });

  it('renders screen with button element', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{ id: 'el_1', type: 'button', x: 10, y: 20, width: 100, height: 40, z_index: 0, properties: { label: 'OK' } }],
    });
    assert.ok(html.includes('OK'));
    assert.ok(html.includes('left:10px'));
    assert.ok(html.includes('top:20px'));
  });

  it('skips unknown element types with comment', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{ id: 'el_1', type: 'unknown_type', x: 0, y: 0, width: 50, height: 50, properties: {} }],
    });
    assert.ok(html.includes('<!-- unknown type: unknown_type -->'));
  });

  it('sorts elements by z_index (low first in DOM)', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'text', x: 0, y: 0, width: 100, height: 20, z_index: 10, properties: { content: 'TOP' } },
        { id: 'el_2', type: 'text', x: 0, y: 0, width: 100, height: 20, z_index: 1, properties: { content: 'BOTTOM' } },
      ],
    });
    const topIdx = html.indexOf('TOP');
    const bottomIdx = html.indexOf('BOTTOM');
    assert.ok(bottomIdx < topIdx, 'Lower z_index should appear first in HTML');
  });

  it('inlines wireframe CSS', () => {
    const html = buildScreenHtml({ width: 393, height: 852, background: '#FFF', elements: [] });
    assert.ok(html.includes('.mockup-button'));
  });

  it('handles missing elements array', () => {
    const html = buildScreenHtml({ width: 393, height: 852, background: '#FFF' });
    assert.ok(html.includes('<!DOCTYPE html>'));
  });

  it('uses wireframe style by default', () => {
    const html = buildScreenHtml({ width: 393, height: 852, elements: [] });
    assert.ok(html.includes('mockup-button'));
  });

  it('accepts a style parameter', () => {
    const html = buildScreenHtml({ width: 393, height: 852, elements: [] }, 'material');
    assert.ok(html.includes('mockup-button'));
  });

  it('passes _style to component render', () => {
    const html = buildScreenHtml({
      width: 393, height: 852,
      elements: [{ type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0, properties: { label: 'Test' } }],
    }, 'material');
    assert.ok(html.includes('Test'));
  });

  it('applies overflow hidden on screen and elements', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{ id: 'el_1', type: 'text', x: 0, y: 0, width: 100, height: 20, z_index: 0, properties: { content: 'Test' } }],
    });
    assert.ok((html.match(/overflow:hidden/g) || []).length >= 2, 'Should have overflow:hidden on screen and element');
  });
});
