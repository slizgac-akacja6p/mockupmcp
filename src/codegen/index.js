import * as html from './html.js';

const generators = { html };

export function getGenerator(framework) {
  return generators[framework] || null;
}

export function getAvailableFrameworks() {
  return Object.keys(generators);
}
