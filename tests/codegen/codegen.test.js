import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getGenerator, getAvailableFrameworks } from '../../src/codegen/index.js';

describe('codegen registry', () => {
  it('getAvailableFrameworks returns array with html', () => {
    const frameworks = getAvailableFrameworks();
    assert.ok(frameworks.includes('html'));
  });

  it('getGenerator returns object with generate function', () => {
    const gen = getGenerator('html');
    assert.ok(gen !== null);
    assert.equal(typeof gen.generate, 'function');
  });

  it('getGenerator returns null for unknown framework', () => {
    assert.equal(getGenerator('cobol'), null);
  });
});

describe('html codegen', () => {
  const screen = {
    id: 'scr_test', name: 'Test', width: 393, height: 852,
    background: '#FFFFFF',
    elements: [
      { id: 'el_1', type: 'text', x: 20, y: 20, width: 200, height: 40, z_index: 0,
        properties: { content: 'Hello World', fontSize: 24 } },
      { id: 'el_2', type: 'button', x: 20, y: 80, width: 200, height: 48, z_index: 0,
        properties: { label: 'Click Me', variant: 'primary' } },
    ],
  };

  it('generate returns valid HTML string', () => {
    const gen = getGenerator('html');
    const code = gen.generate(screen);
    assert.ok(code.includes('<!DOCTYPE html>'));
    assert.ok(code.includes('Hello World'));
    assert.ok(code.includes('Click Me'));
  });

  it('generate includes absolute positioning styles', () => {
    const gen = getGenerator('html');
    const code = gen.generate(screen);
    assert.ok(code.includes('position: absolute'));
    assert.ok(code.includes('left: 20px'));
  });

  it('generate handles empty elements', () => {
    const gen = getGenerator('html');
    const code = gen.generate({ ...screen, elements: [] });
    assert.ok(code.includes('<!DOCTYPE html>'));
  });

  it('mapComponent returns HTML for known types', () => {
    const gen = getGenerator('html');
    const html = gen.mapComponent(screen.elements[1]);
    assert.ok(html.includes('button'));
    assert.ok(html.includes('Click Me'));
  });

  it('generates semantic HTML for all major types', () => {
    const gen = getGenerator('html');

    // text -> span/p/h1-h6
    const textEl = { type: 'text', properties: { content: 'Hi', fontSize: 16 } };
    assert.ok(gen.mapComponent(textEl).includes('Hi'));

    // input -> input element
    const inputEl = { type: 'input', properties: { placeholder: 'Email', type: 'email' } };
    assert.ok(gen.mapComponent(inputEl).includes('input'));

    // navbar -> nav
    const navEl = { type: 'navbar', properties: { title: 'Home' } };
    assert.ok(gen.mapComponent(navEl).includes('nav'));

    // card -> div.card
    const cardEl = { type: 'card', properties: { title: 'Title' } };
    const cardHtml = gen.mapComponent(cardEl);
    assert.ok(cardHtml.includes('card'));
    assert.ok(cardHtml.includes('Title'));

    // image -> img
    const imgEl = { type: 'image', properties: { src: 'photo.jpg', alt: 'Photo' } };
    assert.ok(gen.mapComponent(imgEl).includes('img'));

    // rectangle -> div
    const rectEl = { type: 'rectangle', properties: { fill: '#FF0000' } };
    assert.ok(gen.mapComponent(rectEl).includes('div'));
  });

  it('escapes user content in generated HTML', () => {
    const gen = getGenerator('html');
    const xssEl = { type: 'text', properties: { content: '<script>alert("xss")</script>' } };
    const html = gen.mapComponent(xssEl);
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});
