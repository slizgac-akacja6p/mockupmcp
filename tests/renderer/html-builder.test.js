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

describe('opacity support', () => {
  it('applies opacity style when element has opacity property', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'text', x: 0, y: 0, width: 100, height: 30, z_index: 0,
          properties: { content: 'Faded', opacity: 0.5 } },
      ],
    };
    const html = buildScreenHtml(screen);
    assert.ok(html.includes('opacity:0.5'));
  });

  it('omits opacity when not set or 1.0', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'text', x: 0, y: 0, width: 100, height: 30, z_index: 0,
          properties: { content: 'Solid' } },
      ],
    };
    const html = buildScreenHtml(screen);
    // Check that no inline opacity is injected into the element wrapper div style
    // (CSS keyframes may contain "opacity:" with a space, so we look for the compact form)
    assert.ok(!html.includes('opacity:0') && !html.includes('opacity:1'));
  });

  it('omits opacity when value is 1', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'text', x: 0, y: 0, width: 100, height: 30, z_index: 0,
          properties: { content: 'Full', opacity: 1 } },
      ],
    };
    const html = buildScreenHtml(screen);
    // Check that no inline opacity is injected into the element wrapper div style
    // (CSS keyframes may contain "opacity:" with a space, so we look for the compact form)
    assert.ok(!html.includes('opacity:0') && !html.includes('opacity:1'));
  });
});

describe('link data attributes', () => {
  it('adds data-link-to attribute when element has link_to', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0,
          properties: { label: 'Go', link_to: { screen_id: 'scr_abc', transition: 'push' } } },
      ],
    };
    const html = buildScreenHtml(screen);
    assert.ok(html.includes('data-link-to="scr_abc"'));
    assert.ok(html.includes('data-transition="push"'));
    assert.ok(html.includes('cursor:pointer'));
  });

  it('does not add link attributes when no link_to', () => {
    const screen = {
      width: 393, height: 852, background: '#FFF',
      elements: [
        { id: 'el_1', type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0,
          properties: { label: 'Stay' } },
      ],
    };
    const html = buildScreenHtml(screen);
    assert.ok(!html.includes('data-link-to'));
  });
});
