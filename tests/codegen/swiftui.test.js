import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generate, mapComponent } from '../../src/codegen/swiftui.js';

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

describe('swiftui codegen', () => {
  it('generate returns SwiftUI View struct', () => {
    const code = generate(screen);
    assert.ok(code.includes('struct LoginScreen: View'));
    assert.ok(code.includes('var body: some View'));
  });

  it('generate includes SwiftUI import', () => {
    const code = generate(screen);
    assert.ok(code.includes('import SwiftUI'));
  });

  it('generate uses ZStack with positioned elements', () => {
    const code = generate(screen);
    assert.ok(code.includes('ZStack'));
    assert.ok(code.includes('.position('));
  });

  it('mapComponent returns Text view for text type', () => {
    const swift = mapComponent(screen.elements[0]);
    assert.ok(swift.includes('Text("Welcome")'));
  });

  it('mapComponent returns Button for button type', () => {
    const swift = mapComponent(screen.elements[1]);
    assert.ok(swift.includes('Button'));
    assert.ok(swift.includes('Sign In'));
  });

  it('mapComponent returns TextField for input type', () => {
    const swift = mapComponent(screen.elements[2]);
    assert.ok(swift.includes('TextField'));
    assert.ok(swift.includes('Email'));
  });

  it('handles screen name with spaces', () => {
    const code = generate({ ...screen, name: 'My Login Screen' });
    assert.ok(code.includes('struct MyLoginScreen: View'));
  });

  it('handles empty elements', () => {
    const code = generate({ ...screen, elements: [] });
    assert.ok(code.includes('ZStack'));
  });

  it('generates SwiftUI views for common types', () => {
    const types = [
      { type: 'card', properties: { title: 'Card' } },
      { type: 'image', properties: {} },
      { type: 'navbar', properties: { title: 'Nav' } },
      { type: 'checkbox', properties: { label: 'Check' } },
      { type: 'rectangle', properties: { fill: '#FF0000' } },
    ];
    for (const el of types) {
      const swift = mapComponent(el);
      assert.ok(swift.length > 0, `mapComponent should return Swift for ${el.type}`);
    }
  });
});
