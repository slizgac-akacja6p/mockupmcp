// Position fields always shown for every element type.
const POSITION_FIELDS = [
  { key: 'x', label: 'X', type: 'number' },
  { key: 'y', label: 'Y', type: 'number' },
  { key: 'width', label: 'Width', type: 'number' },
  { key: 'height', label: 'Height', type: 'number' },
  { key: 'z_index', label: 'Z-Index', type: 'number' },
  { key: 'opacity', label: 'Opacity', type: 'number' },
];

// Component-specific property schemas.
const PROP_SCHEMAS = {
  text: [
    { key: 'content', label: 'Content', type: 'string' },
    { key: 'fontSize', label: 'Font Size', type: 'number' },
    { key: 'fontWeight', label: 'Font Weight', type: 'select', options: ['normal', 'bold', '500', '600', '700'] },
    { key: 'color', label: 'Color', type: 'string' },
    { key: 'align', label: 'Align', type: 'select', options: ['left', 'center', 'right'] },
  ],
  rectangle: [
    { key: 'fill', label: 'Fill', type: 'string' },
    { key: 'stroke', label: 'Stroke', type: 'string' },
    { key: 'cornerRadius', label: 'Corner Radius', type: 'number' },
  ],
  circle: [
    { key: 'fill', label: 'Fill', type: 'string' },
    { key: 'stroke', label: 'Stroke', type: 'string' },
    { key: 'strokeWidth', label: 'Stroke Width', type: 'number' },
  ],
  line: [
    { key: 'strokeWidth', label: 'Stroke Width', type: 'number' },
    { key: 'color', label: 'Color', type: 'string' },
    { key: 'style', label: 'Style', type: 'select', options: ['solid', 'dashed', 'dotted'] },
  ],
  image: [
    { key: 'placeholder', label: 'Placeholder', type: 'boolean' },
  ],
  icon: [
    { key: 'name', label: 'Icon Name', type: 'string' },
    { key: 'size', label: 'Size', type: 'number' },
    { key: 'color', label: 'Color', type: 'string' },
  ],
  button: [
    { key: 'label', label: 'Label', type: 'string' },
    { key: 'variant', label: 'Variant', type: 'select', options: ['primary', 'secondary', 'outline', 'ghost'] },
    { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg'] },
  ],
  input: [
    { key: 'placeholder', label: 'Placeholder', type: 'string' },
    { key: 'label', label: 'Label', type: 'string' },
    { key: 'type', label: 'Type', type: 'select', options: ['text', 'email', 'password', 'number'] },
  ],
  textarea: [
    { key: 'placeholder', label: 'Placeholder', type: 'string' },
    { key: 'rows', label: 'Rows', type: 'number' },
    { key: 'label', label: 'Label', type: 'string' },
  ],
  checkbox: [
    { key: 'label', label: 'Label', type: 'string' },
    { key: 'checked', label: 'Checked', type: 'boolean' },
  ],
  radio: [
    { key: 'label', label: 'Label', type: 'string' },
    { key: 'selected', label: 'Selected', type: 'boolean' },
    { key: 'group', label: 'Group', type: 'string' },
  ],
  toggle: [
    { key: 'label', label: 'Label', type: 'string' },
    { key: 'on', label: 'On', type: 'boolean' },
  ],
  select: [
    { key: 'placeholder', label: 'Placeholder', type: 'string' },
    { key: 'label', label: 'Label', type: 'string' },
  ],
  slider: [
    { key: 'min', label: 'Min', type: 'number' },
    { key: 'max', label: 'Max', type: 'number' },
    { key: 'value', label: 'Value', type: 'number' },
    { key: 'label', label: 'Label', type: 'string' },
  ],
  navbar: [
    { key: 'title', label: 'Title', type: 'string' },
  ],
  tabbar: [],
  sidebar: [],
  breadcrumb: [],
  card: [
    { key: 'title', label: 'Title', type: 'string' },
    { key: 'subtitle', label: 'Subtitle', type: 'string' },
    { key: 'value', label: 'Value', type: 'string' },
    { key: 'image', label: 'Show Image', type: 'boolean' },
  ],
  list: [
    { key: 'variant', label: 'Variant', type: 'select', options: ['simple', 'icon', 'avatar'] },
  ],
  table: [
    { key: 'striped', label: 'Striped', type: 'boolean' },
  ],
  avatar: [
    { key: 'initials', label: 'Initials', type: 'string' },
    { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg', 'xl'] },
    { key: 'src', label: 'Image URL', type: 'string' },
  ],
  badge: [
    { key: 'label', label: 'Label', type: 'string' },
    { key: 'color', label: 'Color', type: 'select', options: ['default', 'primary', 'success', 'warning', 'danger'] },
  ],
  chip: [
    { key: 'label', label: 'Label', type: 'string' },
    { key: 'removable', label: 'Removable', type: 'boolean' },
    { key: 'selected', label: 'Selected', type: 'boolean' },
  ],
  alert: [
    { key: 'message', label: 'Message', type: 'string' },
    { key: 'type', label: 'Type', type: 'select', options: ['info', 'success', 'warning', 'error'] },
  ],
  modal: [
    { key: 'title', label: 'Title', type: 'string' },
    { key: 'content', label: 'Content', type: 'string' },
  ],
  skeleton: [
    { key: 'variant', label: 'Variant', type: 'select', options: ['text', 'rect', 'circle'] },
  ],
  progress: [
    { key: 'value', label: 'Value', type: 'number' },
    { key: 'max', label: 'Max', type: 'number' },
  ],
  tooltip: [
    { key: 'content', label: 'Content', type: 'string' },
    { key: 'position', label: 'Position', type: 'select', options: ['top', 'bottom', 'left', 'right'] },
  ],
  login_form: [
    { key: 'title', label: 'Title', type: 'string' },
    { key: 'buttonLabel', label: 'Button Label', type: 'string' },
    { key: 'showForgotPassword', label: 'Show Forgot Password', type: 'boolean' },
  ],
  search_bar: [
    { key: 'placeholder', label: 'Placeholder', type: 'string' },
  ],
  header: [
    { key: 'logo', label: 'Logo', type: 'string' },
  ],
  footer: [
    { key: 'text', label: 'Text', type: 'string' },
  ],
  data_table: [
    { key: 'showSearch', label: 'Show Search', type: 'boolean' },
    { key: 'showPagination', label: 'Show Pagination', type: 'boolean' },
  ],
  chart_placeholder: [
    { key: 'type', label: 'Chart Type', type: 'select', options: ['bar', 'line', 'pie', 'donut', 'area'] },
    { key: 'title', label: 'Title', type: 'string' },
  ],
};

export function getEditableProps(type) {
  const specific = PROP_SCHEMAS[type] || [];
  return [...POSITION_FIELDS, ...specific];
}
