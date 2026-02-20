import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getGenerator, getAvailableFrameworks } from '../../src/codegen/index.js';

describe('codegen tools integration', () => {
  const screen = {
    id: 'scr_test', name: 'Test', width: 393, height: 852,
    background: '#FFFFFF',
    elements: [
      { id: 'el_1', type: 'text', x: 20, y: 20, width: 200, height: 40, z_index: 0,
        properties: { content: 'Hello', fontSize: 24 } },
      { id: 'el_2', type: 'button', x: 20, y: 80, width: 200, height: 48, z_index: 0,
        properties: { label: 'Click', variant: 'primary' } },
    ],
  };

  it('all 4 frameworks are registered', () => {
    const frameworks = getAvailableFrameworks();
    assert.deepStrictEqual(frameworks.sort(), ['flutter', 'html', 'react', 'swiftui']);
  });

  it('each framework generates non-empty code', () => {
    for (const fw of getAvailableFrameworks()) {
      const gen = getGenerator(fw);
      assert.ok(gen, `Generator for ${fw} should exist`);
      const code = gen.generate(screen);
      assert.ok(code.length > 100, `${fw} code should be substantial`);
    }
  });

  it('html generator produces DOCTYPE', () => {
    const code = getGenerator('html').generate(screen);
    assert.ok(code.includes('<!DOCTYPE html>'));
  });

  it('react generator produces React component', () => {
    const code = getGenerator('react').generate(screen);
    assert.ok(code.includes('function TestScreen'));
    assert.ok(code.includes("import React from 'react'"));
  });

  it('flutter generator produces StatelessWidget', () => {
    const code = getGenerator('flutter').generate(screen);
    assert.ok(code.includes('class TestScreen extends StatelessWidget'));
  });

  it('swiftui generator produces View struct', () => {
    const code = getGenerator('swiftui').generate(screen);
    assert.ok(code.includes('struct TestScreen: View'));
  });
});
