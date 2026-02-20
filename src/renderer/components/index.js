import * as text      from './text.js';
import * as rectangle from './rectangle.js';
import * as button    from './button.js';
import * as input     from './input.js';
import * as image     from './image.js';
import * as icon      from './icon.js';
import * as navbar    from './navbar.js';
import * as tabbar    from './tabbar.js';
import * as card      from './card.js';
import * as list      from './list.js';

const components = { text, rectangle, button, input, image, icon, navbar, tabbar, card, list };

export function getComponent(type) {
  return components[type] || null;
}

export function getAvailableTypes() {
  return Object.keys(components);
}
