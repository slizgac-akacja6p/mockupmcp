import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateMermaid } from '../../src/codegen/flow.js';

const project = {
  id: 'proj_test',
  screens: [
    {
      id: 'scr_1', name: 'Login',
      elements: [
        { id: 'el_1', type: 'button', properties: { label: 'Sign In', link_to: { screen_id: 'scr_2', transition: 'push' } } },
      ],
    },
    {
      id: 'scr_2', name: 'Dashboard',
      elements: [
        { id: 'el_2', type: 'tabbar', properties: { link_to: { screen_id: 'scr_3', transition: 'fade' } } },
      ],
    },
    { id: 'scr_3', name: 'Settings', elements: [] },
  ],
};

describe('mermaid flow generation', () => {
  it('generates valid mermaid graph', () => {
    const mermaid = generateMermaid(project);
    assert.ok(mermaid.startsWith('graph LR'));
  });

  it('includes screen nodes', () => {
    const mermaid = generateMermaid(project);
    assert.ok(mermaid.includes('scr_1[Login]'));
    assert.ok(mermaid.includes('scr_2[Dashboard]'));
    assert.ok(mermaid.includes('scr_3[Settings]'));
  });

  it('includes edges with labels', () => {
    const mermaid = generateMermaid(project);
    assert.ok(mermaid.includes('scr_1 -->|button: Sign In| scr_2'));
    assert.ok(mermaid.includes('scr_2 -->'));
  });

  it('handles project with no links', () => {
    const empty = { id: 'proj_x', screens: [{ id: 'scr_1', name: 'Home', elements: [] }] };
    const mermaid = generateMermaid(empty);
    assert.ok(mermaid.includes('graph LR'));
    assert.ok(mermaid.includes('scr_1[Home]'));
  });

  it('handles screens with no elements', () => {
    const proj = {
      id: 'proj_y',
      screens: [
        { id: 'scr_1', name: 'A', elements: [] },
        { id: 'scr_2', name: 'B', elements: [] },
      ],
    };
    const mermaid = generateMermaid(proj);
    assert.ok(mermaid.includes('scr_1[A]'));
    assert.ok(mermaid.includes('scr_2[B]'));
    assert.ok(!mermaid.includes('-->'));
  });

  it('uses element type + label for edge labels', () => {
    const proj = {
      id: 'proj_z',
      screens: [
        {
          id: 'scr_1', name: 'Start',
          elements: [
            { id: 'el_1', type: 'button', properties: { label: 'Next', link_to: { screen_id: 'scr_2', transition: 'push' } } },
            { id: 'el_2', type: 'navbar', properties: { title: 'Back', link_to: { screen_id: 'scr_2', transition: 'push' } } },
          ],
        },
        { id: 'scr_2', name: 'End', elements: [] },
      ],
    };
    const mermaid = generateMermaid(proj);
    assert.ok(mermaid.includes('button: Next'));
    assert.ok(mermaid.includes('navbar'));
  });
});
