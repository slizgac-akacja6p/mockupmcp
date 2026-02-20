import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToSvg } from '../../src/renderer/screenshot.js';

describe('htmlToSvg', () => {
  it('wraps HTML in SVG foreignObject', () => {
    const html = '<!DOCTYPE html><html><body><div>Hello</div></body></html>';
    const svg = htmlToSvg(html, 393, 852);

    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.includes('width="393"'));
    assert.ok(svg.includes('height="852"'));
    assert.ok(svg.includes('<foreignObject'));
    assert.ok(svg.includes('Hello'));
    assert.ok(svg.endsWith('</svg>'));
  });

  it('includes viewBox attribute', () => {
    const svg = htmlToSvg('<html></html>', 400, 800);
    assert.ok(svg.includes('viewBox="0 0 400 800"'));
  });

  it('preserves HTML content intact', () => {
    const html = '<!DOCTYPE html><html><head><style>.test { color: red; }</style></head><body><div class="test">Styled</div></body></html>';
    const svg = htmlToSvg(html, 393, 852);
    assert.ok(svg.includes('color: red'));
    assert.ok(svg.includes('class="test"'));
  });
});
