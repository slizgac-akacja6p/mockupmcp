// Basic
import * as text      from './text.js';
import * as rectangle from './rectangle.js';
import * as circle    from './circle.js';
import * as line      from './line.js';
import * as image     from './image.js';
import * as icon      from './icon.js';

// Forms
import * as button   from './button.js';
import * as input    from './input.js';
import * as textarea from './textarea.js';
import * as checkbox from './checkbox.js';
import * as radio    from './radio.js';
import * as toggle   from './toggle.js';
import * as select   from './select.js';
import * as slider   from './slider.js';

// Navigation
import * as navbar     from './navbar.js';
import * as tabbar     from './tabbar.js';
import * as sidebar    from './sidebar.js';
import * as breadcrumb from './breadcrumb.js';

// Data
import * as card   from './card.js';
import * as list   from './list.js';
import * as table  from './table.js';
import * as avatar from './avatar.js';
import * as badge  from './badge.js';
import * as chip   from './chip.js';

// Feedback
import * as alert    from './alert.js';
import * as modal    from './modal.js';
import * as skeleton from './skeleton.js';
import * as progress from './progress.js';
import * as tooltip  from './tooltip.js';

// Composite
import * as login_form        from './login_form.js';
import * as search_bar        from './search_bar.js';
import * as header            from './header.js';
import * as footer            from './footer.js';
import * as data_table        from './data_table.js';
import * as chart_placeholder from './chart_placeholder.js';

const components = {
  text, rectangle, rect: rectangle, circle, line, image, icon,
  button, input, textarea, checkbox, radio, toggle, select, slider,
  navbar, tabbar, sidebar, breadcrumb,
  card, list, table, avatar, badge, chip,
  alert, modal, skeleton, progress, tooltip,
  login_form, search_bar, header, footer, data_table, chart_placeholder,
};

export function getComponent(type) {
  return components[type] || null;
}

export function getAvailableTypes() {
  return Object.keys(components);
}
