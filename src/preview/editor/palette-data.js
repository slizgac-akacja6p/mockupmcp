// Component catalog for the editor palette.
// Width/height are the default dimensions when dropped onto the canvas.

const CATALOG = [
  {
    name: 'Basic',
    components: [
      { type: 'text', label: 'Text', width: 200, height: 30, properties: { content: 'Text', fontSize: 16, fontWeight: 'normal', color: '#333333', align: 'left' } },
      { type: 'rectangle', label: 'Rectangle', width: 200, height: 100, properties: { fill: '#F5F5F5', stroke: '#DDDDDD', cornerRadius: 4, opacity: 1 } },
      { type: 'circle', label: 'Circle', width: 80, height: 80, properties: { fill: '#DDDDDD', stroke: '#999999', strokeWidth: 1 } },
      { type: 'line', label: 'Line', width: 200, height: 2, properties: { strokeWidth: 1, color: '#DDDDDD', style: 'solid' } },
      { type: 'image', label: 'Image', width: 200, height: 150, properties: { placeholder: true, aspectRatio: null } },
      { type: 'icon', label: 'Icon', width: 40, height: 40, properties: { name: 'circle', size: 24, color: '#666666' } },
    ],
  },
  {
    name: 'Form',
    components: [
      { type: 'button', label: 'Button', width: 120, height: 44, properties: { label: 'Button', variant: 'primary', size: 'md' } },
      { type: 'input', label: 'Input', width: 240, height: 44, properties: { placeholder: 'Enter text...', label: null, type: 'text' } },
      { type: 'textarea', label: 'Textarea', width: 240, height: 120, properties: { placeholder: 'Enter text...', rows: 4, label: null } },
      { type: 'checkbox', label: 'Checkbox', width: 160, height: 24, properties: { label: 'Checkbox', checked: false } },
      { type: 'radio', label: 'Radio', width: 160, height: 24, properties: { label: 'Option', selected: false, group: 'default' } },
      { type: 'toggle', label: 'Toggle', width: 100, height: 32, properties: { label: 'Toggle', on: false } },
      { type: 'select', label: 'Select', width: 240, height: 44, properties: { options: ['Option 1', 'Option 2', 'Option 3'], placeholder: 'Select...', selected: null, label: null } },
      { type: 'slider', label: 'Slider', width: 240, height: 32, properties: { min: 0, max: 100, value: 50, label: null } },
    ],
  },
  {
    name: 'Navigation',
    components: [
      { type: 'navbar', label: 'Navbar', width: 375, height: 56, properties: { title: 'Screen', leftIcon: null, rightIcons: [] } },
      { type: 'tabbar', label: 'Tab Bar', width: 375, height: 56, properties: { tabs: [{ icon: 'home', label: 'Home', active: true }, { icon: 'search', label: 'Search' }, { icon: 'user', label: 'Profile' }] } },
      { type: 'sidebar', label: 'Sidebar', width: 280, height: 600, properties: { items: [{ icon: 'home', label: 'Home', active: true }, { icon: 'search', label: 'Search' }, { icon: 'settings', label: 'Settings' }] } },
      { type: 'breadcrumb', label: 'Breadcrumb', width: 300, height: 32, properties: { items: ['Home', 'Products', 'Detail'] } },
    ],
  },
  {
    name: 'Content',
    components: [
      { type: 'card', label: 'Card', width: 280, height: 160, properties: { title: 'Card Title', subtitle: null, value: null, image: false, actions: [] } },
      { type: 'list', label: 'List', width: 280, height: 180, properties: { items: ['Item 1', 'Item 2', 'Item 3'], variant: 'simple' } },
      { type: 'table', label: 'Table', width: 400, height: 200, properties: { headers: ['Name', 'Email', 'Role'], rows: [['John Doe', 'john@example.com', 'Admin']], striped: false } },
      { type: 'avatar', label: 'Avatar', width: 48, height: 48, properties: { initials: 'U', size: 'md', src: null } },
      { type: 'badge', label: 'Badge', width: 80, height: 24, properties: { label: 'Badge', color: 'default' } },
      { type: 'chip', label: 'Chip', width: 100, height: 32, properties: { label: 'Chip', removable: false, selected: false } },
    ],
  },
  {
    name: 'Feedback',
    components: [
      { type: 'alert', label: 'Alert', width: 300, height: 60, properties: { message: 'This is an alert message.', type: 'info' } },
      { type: 'modal', label: 'Modal', width: 360, height: 240, properties: { title: 'Modal Title', content: 'Modal content goes here.', actions: ['Cancel', 'Confirm'] } },
      { type: 'skeleton', label: 'Skeleton', width: 200, height: 20, properties: { variant: 'text' } },
      { type: 'progress', label: 'Progress', width: 200, height: 16, properties: { value: 50, max: 100 } },
      { type: 'tooltip', label: 'Tooltip', width: 140, height: 36, properties: { content: 'Tooltip text', position: 'top' } },
    ],
  },
  {
    name: 'Composite',
    components: [
      { type: 'login_form', label: 'Login Form', width: 320, height: 480, properties: { title: 'Sign In', emailLabel: 'Email', passwordLabel: 'Password', buttonLabel: 'Sign In', showForgotPassword: true } },
      { type: 'search_bar', label: 'Search Bar', width: 280, height: 44, properties: { placeholder: 'Search...', icon: 'search' } },
      { type: 'header', label: 'Header', width: 375, height: 64, properties: { logo: 'App', nav: ['Home', 'About', 'Contact'], rightIcon: 'user' } },
      { type: 'footer', label: 'Footer', width: 375, height: 60, properties: { text: '© 2026 App Inc.', links: ['Privacy', 'Terms', 'Contact'] } },
      { type: 'data_table', label: 'Data Table', width: 400, height: 300, properties: { headers: ['Name', 'Status', 'Date', 'Actions'], rows: [['Alpha', 'Active', '2026-01-15', 'Edit']], showSearch: true, showPagination: true } },
      { type: 'chart_placeholder', label: 'Chart', width: 300, height: 200, properties: { type: 'bar', title: null } },
    ],
  },
];

export function getPaletteCategories() {
  return CATALOG;
}

export function getComponentDefaults(type) {
  for (const cat of CATALOG) {
    const comp = cat.components.find(c => c.type === type);
    if (comp) return { width: comp.width, height: comp.height, properties: comp.properties };
  }
  return { width: 100, height: 40, properties: {} };
}
