import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generate, mapComponent } from '../../src/codegen/flutter.js';

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

describe('flutter codegen', () => {
  it('generate returns StatelessWidget class', () => {
    const code = generate(screen);
    assert.ok(code.includes('class LoginScreen extends StatelessWidget'));
    assert.ok(code.includes('@override'));
    assert.ok(code.includes('Widget build'));
  });

  it('generate includes flutter import', () => {
    const code = generate(screen);
    assert.ok(code.includes("import 'package:flutter/material.dart'"));
  });

  it('generate uses Stack + Positioned widgets', () => {
    const code = generate(screen);
    assert.ok(code.includes('Stack('));
    assert.ok(code.includes('Positioned('));
  });

  it('mapComponent returns Text widget for text type', () => {
    const dart = mapComponent(screen.elements[0]);
    assert.ok(dart.includes("Text("));
    assert.ok(dart.includes('Welcome'));
  });

  it('mapComponent returns ElevatedButton for primary button', () => {
    const dart = mapComponent(screen.elements[1]);
    assert.ok(dart.includes('ElevatedButton'));
    assert.ok(dart.includes('Sign In'));
  });

  it('mapComponent returns TextField for input', () => {
    const dart = mapComponent(screen.elements[2]);
    assert.ok(dart.includes('TextField'));
    assert.ok(dart.includes('Email'));
  });

  it('handles screen name with spaces', () => {
    const code = generate({ ...screen, name: 'My Login Screen' });
    assert.ok(code.includes('class MyLoginScreen extends StatelessWidget'));
  });

  it('handles empty elements', () => {
    const code = generate({ ...screen, elements: [] });
    assert.ok(code.includes('Stack('));
  });

  it('generates Dart widgets for common types', () => {
    const types = [
      { type: 'card', properties: { title: 'Card' } },
      { type: 'image', properties: {} },
      { type: 'navbar', properties: { title: 'Nav' } },
      { type: 'checkbox', properties: { label: 'Check' } },
      { type: 'rectangle', properties: { fill: '#FF0000' } },
    ];
    for (const el of types) {
      const dart = mapComponent(el);
      assert.ok(dart.length > 0, `mapComponent should return Dart for ${el.type}`);
    }
  });
});
