import * as html from './html.js';
import * as react from './react.js';
import * as flutter from './flutter.js';
import * as swiftui from './swiftui.js';

const generators = { html, react, flutter, swiftui };

export function getGenerator(framework) {
  return generators[framework] || null;
}

export function getAvailableFrameworks() {
  return Object.keys(generators);
}
