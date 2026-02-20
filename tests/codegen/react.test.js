import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generate, mapComponent } from '../../src/codegen/react.js';

const screen = {
  id: 'scr_test', name: 'Login', width: 393, height: 852,
  background: '#FFFFFF',
  elements: [
    { id: 'el_1', type: 'text', x: 20, y: 20, width: 200, height: 40, z_index: 0,
      properties: { content: 'Welcome', fontSize: 24 } },
    { id: 'el_2', type: 'button', x: 20, y: 80, width: 200, height: 48, z_index: 0,
      properties: { label: 'Sign In', variant: 'primary' } },
    { id: 'el_3', type: 'input', x: 20, y: 140, width: 350, height: 44, z_index: 0,
      properties: { placeholder: 'Email', type: 'email' } },
  ],
};

describe('react codegen', () => {
  it('generate returns functional component string', () => {
    const code = generate(screen);
    assert.ok(code.includes('function LoginScreen'));
    assert.ok(code.includes('return ('));
    assert.ok(code.includes('export default'));
  });

  it('generate includes React import', () => {
    const code = generate(screen);
    assert.ok(code.includes("import React from 'react'"));
  });

  it('generate uses inline style objects with absolute positioning', () => {
    const code = generate(screen);
    assert.ok(code.includes('position: "absolute"'));
  });

  it('mapComponent returns JSX for button', () => {
    const jsx = mapComponent(screen.elements[1]);
    assert.ok(jsx.includes('<button'));
    assert.ok(jsx.includes('Sign In'));
  });

  it('mapComponent returns JSX for input', () => {
    const jsx = mapComponent(screen.elements[2]);
    assert.ok(jsx.includes('<input'));
    assert.ok(jsx.includes('placeholder="Email"'));
  });

  it('handles screen name with spaces in component name', () => {
    const code = generate({ ...screen, name: 'My Login Screen' });
    assert.ok(code.includes('function MyLoginScreen'));
  });

  it('handles empty elements array', () => {
    const code = generate({ ...screen, elements: [] });
    assert.ok(code.includes('function LoginScreen'));
    assert.ok(code.includes('return ('));
  });

  it('generates JSX for common types', () => {
    const types = [
      { type: 'text', properties: { content: 'Hi' } },
      { type: 'navbar', properties: { title: 'Nav' } },
      { type: 'card', properties: { title: 'Card' } },
      { type: 'image', properties: {} },
      { type: 'checkbox', properties: { label: 'Check' } },
    ];
    for (const el of types) {
      const jsx = mapComponent(el);
      assert.ok(jsx.length > 0, `mapComponent should return JSX for ${el.type}`);
    }
  });
});
