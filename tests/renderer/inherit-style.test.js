import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildScreenHtml } from '../../src/renderer/html-builder.js';

describe('inheritStyle — element-level', () => {
  it('renders inline backgroundColor when element has inheritStyle: false', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'button', x: 10, y: 20, width: 200, height: 50, z_index: 0,
        inheritStyle: false,
        properties: { label: 'Spotify', backgroundColor: '#1DB954' },
      }],
    });
    assert.ok(html.includes('background-color:#1DB954'), 'Should inline backgroundColor');
  });

  it('renders inline color, fontSize, fontWeight, borderRadius, padding', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'text', x: 0, y: 0, width: 200, height: 40, z_index: 0,
        inheritStyle: false,
        properties: {
          content: 'Custom',
          color: '#FF0000',
          fontSize: 18,
          fontWeight: 'bold',
          borderRadius: 8,
          padding: 12,
        },
      }],
    });
    assert.ok(html.includes('color:#FF0000'), 'Should inline color');
    assert.ok(html.includes('font-size:18px'), 'Should inline fontSize as px');
    assert.ok(html.includes('font-weight:bold'), 'Should inline fontWeight');
    assert.ok(html.includes('border-radius:8px'), 'Should inline borderRadius');
    assert.ok(html.includes('padding:12px'), 'Should inline padding');
  });

  it('renders borderColor with border-style and border-width', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, z_index: 0,
        inheritStyle: false,
        properties: { borderColor: '#0000FF' },
      }],
    });
    assert.ok(html.includes('border-color:#0000FF'), 'Should inline borderColor');
    assert.ok(html.includes('border-style:solid'), 'Should add border-style');
    assert.ok(html.includes('border-width:1px'), 'Should add border-width');
  });

  it('handles fontSize as string with unit', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'text', x: 0, y: 0, width: 100, height: 30, z_index: 0,
        inheritStyle: false,
        properties: { content: 'Rem', fontSize: '1.5rem' },
      }],
    });
    assert.ok(html.includes('font-size:1.5rem'), 'Should pass string fontSize as-is');
  });

  it('does not add inline property styles when inheritStyle is true', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'button', x: 10, y: 20, width: 200, height: 50, z_index: 0,
        inheritStyle: true,
        properties: { label: 'Normal', backgroundColor: '#1DB954' },
      }],
    });
    assert.ok(!html.includes('background-color:#1DB954'), 'Should NOT inline backgroundColor when inheritStyle is true');
  });

  it('does not add inline property styles by default (inheritStyle absent)', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'button', x: 10, y: 20, width: 200, height: 50, z_index: 0,
        properties: { label: 'Default', backgroundColor: '#1DB954' },
      }],
    });
    assert.ok(!html.includes('background-color:#1DB954'), 'Should NOT inline by default');
    // Verify normal "element" class is present
    assert.ok(html.includes('class="element"'), 'Should have element class');
  });

  it('removes "element" CSS class when inheritStyle is false', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'text', x: 0, y: 0, width: 100, height: 30, z_index: 0,
        inheritStyle: false,
        properties: { content: 'NoClass' },
      }],
    });
    assert.ok(html.includes('class=""'), 'Should have empty class when inheritStyle is false');
    assert.ok(html.includes('data-element-id="el_1"'), 'Should still have data attribute');
  });
});

describe('inheritStyle — screen-level', () => {
  it('renders all elements without style CSS when screen has inheritStyle: false', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      inheritStyle: false,
      elements: [{
        id: 'el_1', type: 'button', x: 10, y: 20, width: 200, height: 50, z_index: 0,
        properties: { label: 'Custom', backgroundColor: '#FF6600' },
      }],
    });
    // Style CSS should be empty when screen inheritStyle is false
    assert.ok(!html.includes('.mockup-button'), 'Should NOT include style CSS rules');
    assert.ok(html.includes('background-color:#FF6600'), 'Should inline backgroundColor');
  });

  it('element-level inheritStyle overrides screen-level', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      inheritStyle: false,
      elements: [
        {
          id: 'el_1', type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0,
          inheritStyle: true,
          properties: { label: 'Styled', backgroundColor: '#123456' },
        },
        {
          id: 'el_2', type: 'text', x: 0, y: 50, width: 100, height: 30, z_index: 0,
          properties: { content: 'Unstyled', color: '#AABB00' },
        },
      ],
    });
    // el_1 explicitly says inheritStyle: true — should get "element" class, no inline bg
    assert.ok(html.includes('class="element" data-element-id="el_1"'), 'Element with inheritStyle:true should have element class');
    // el_1 should NOT have inline backgroundColor (it inherits style)
    assert.ok(!html.includes('background-color:#123456'), 'Should NOT inline bg for element with inheritStyle:true');
    // el_2 inherits screen's inheritStyle: false — should get empty class, inline color
    assert.ok(html.includes('class="" data-element-id="el_2"'), 'Element inheriting screen inheritStyle:false should have empty class');
    assert.ok(html.includes('color:#AABB00'), 'Should inline color for element inheriting screen-level false');
  });

  it('preserves layout properties regardless of inheritStyle', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'rectangle', x: 50, y: 100, width: 200, height: 150, z_index: 3,
        inheritStyle: false,
        properties: { backgroundColor: '#CCDDEE' },
      }],
    });
    assert.ok(html.includes('left:50px'), 'Should keep x position');
    assert.ok(html.includes('top:100px'), 'Should keep y position');
    assert.ok(html.includes('width:200px'), 'Should keep width');
    assert.ok(html.includes('height:150px'), 'Should keep height');
    assert.ok(html.includes('z-index:3'), 'Should keep z-index');
  });

  it('opacity and link support still works with inheritStyle: false', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'button', x: 0, y: 0, width: 100, height: 40, z_index: 0,
        inheritStyle: false,
        properties: {
          label: 'Go',
          opacity: 0.5,
          link_to: { screen_id: 'scr_target', transition: 'fade' },
          backgroundColor: '#FF0000',
        },
      }],
    });
    assert.ok(html.includes('opacity:0.5'), 'Opacity should still work');
    assert.ok(html.includes('data-link-to="scr_target"'), 'Link should still work');
    assert.ok(html.includes('cursor:pointer'), 'Cursor pointer for links');
    assert.ok(html.includes('background-color:#FF0000'), 'Inline bg should be present');
  });
});

describe('inheritStyle — XSS protection', () => {
  it('sanitizes malicious CSS values in wrapper inline styles', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'rectangle', x: 0, y: 0, width: 100, height: 30, z_index: 0,
        inheritStyle: false,
        properties: {
          backgroundColor: '<script>alert(1)</script>',
        },
      }],
    });
    // Extract the wrapper div's style attribute specifically
    const wrapperMatch = html.match(/data-element-id="el_1" style="([^"]*)"/);
    assert.ok(wrapperMatch, 'Should find wrapper element');
    const wrapperStyle = wrapperMatch[1];
    assert.ok(!wrapperStyle.includes('<script>'), 'Wrapper style should not contain raw script tags');
    assert.ok(wrapperStyle.includes('&lt;script&gt;'), 'Wrapper style should have escaped HTML entities');
  });

  it('blocks javascript: protocol in CSS values', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'rectangle', x: 0, y: 0, width: 100, height: 30, z_index: 0,
        inheritStyle: false,
        properties: {
          backgroundColor: 'url(javascript:alert(1))',
        },
      }],
    });
    const wrapperMatch = html.match(/data-element-id="el_1" style="([^"]*)"/);
    assert.ok(wrapperMatch, 'Should find wrapper element');
    const wrapperStyle = wrapperMatch[1];
    assert.ok(!wrapperStyle.includes('javascript'), 'Should block javascript: protocol entirely');
    // The value should be empty — blocked payload produces no background-color value
    assert.ok(wrapperStyle.includes('background-color:;'), 'Should produce empty value for blocked payload');
  });

  it('blocks expression() in CSS values', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: 'rectangle', x: 0, y: 0, width: 100, height: 30, z_index: 0,
        inheritStyle: false,
        properties: {
          color: 'expression(alert(1))',
        },
      }],
    });
    const wrapperMatch = html.match(/data-element-id="el_1" style="([^"]*)"/);
    assert.ok(wrapperMatch, 'Should find wrapper element');
    const wrapperStyle = wrapperMatch[1];
    assert.ok(!wrapperStyle.includes('expression'), 'Should block expression() entirely');
  });

  it('escapes unknown element type in HTML comment', () => {
    const html = buildScreenHtml({
      width: 393, height: 852, background: '#FFF',
      elements: [{
        id: 'el_1', type: '<img src=x onerror=alert(1)>', x: 0, y: 0, width: 50, height: 50, properties: {},
      }],
    });
    assert.ok(!html.includes('<img src=x'), 'Should not contain raw injected tag');
    assert.ok(html.includes('&lt;img'), 'Should have escaped element type in comment');
  });
});
