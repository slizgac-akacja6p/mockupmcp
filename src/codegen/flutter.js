// Generates a Flutter/Dart StatelessWidget from a screen definition.
// Elements are laid out with Stack + Positioned to preserve absolute positions from the mockup.

function toPascalCase(name) {
  return (name || 'Screen')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

// Converts #RRGGBB hex to Flutter Color constructor (always full opacity).
function colorToFlutter(hex) {
  const clean = (hex || '#FFFFFF').replace('#', '');
  return `Color(0xFF${clean.toUpperCase()})`;
}

export function generate(screen) {
  const base = toPascalCase(screen.name);
  // Avoid doubling the "Screen" suffix when the name already ends with that word
  const className = base.endsWith('Screen') ? base : base + 'Screen';

  const positioned = (screen.elements || [])
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .map(el => {
      const widget = mapComponent(el);
      return `        Positioned(
          left: ${el.x},
          top: ${el.y},
          width: ${el.width},
          height: ${el.height},
          child: ${widget},
        ),`;
    }).join('\n');

  return `import 'package:flutter/material.dart';

class ${className} extends StatelessWidget {
  const ${className}({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: ${screen.width},
      height: ${screen.height},
      color: ${colorToFlutter(screen.background)},
      child: Stack(
        children: [
${positioned}
        ],
      ),
    );
  }
}
`;
}

// Maps a single element to its closest Flutter widget equivalent.
// Widgets are intentionally minimal — they capture structure, not full styling.
export function mapComponent(el) {
  const p = el.properties || {};

  switch (el.type) {
    case 'text': {
      const fs = p.fontSize || 16;
      const color = p.color ? `, style: TextStyle(fontSize: ${fs}, color: ${colorToFlutter(p.color)})` : `, style: TextStyle(fontSize: ${fs})`;
      return `Text('${_escapeSingleQuote(p.content || '')}' ${color})`;
    }

    case 'button': {
      const variant = p.variant || 'primary';
      const label = `Text('${_escapeSingleQuote(p.label || 'Button')}')`;
      if (variant === 'primary') {
        return `ElevatedButton(onPressed: () {}, child: ${label})`;
      } else if (variant === 'outline') {
        return `OutlinedButton(onPressed: () {}, child: ${label})`;
      }
      return `TextButton(onPressed: () {}, child: ${label})`;
    }

    case 'input':
      return `TextField(decoration: InputDecoration(hintText: '${_escapeSingleQuote(p.placeholder || '')}'))`;

    case 'textarea':
      return `TextField(maxLines: null, decoration: InputDecoration(hintText: '${_escapeSingleQuote(p.placeholder || '')}'))`;

    case 'image':
      return p.src
        ? `Image.network('${_escapeSingleQuote(p.src)}')`
        : `Placeholder()`;

    case 'icon':
      return `Icon(Icons.star, size: ${p.size || 24})`;

    case 'rectangle': {
      const fill = p.fill || p.background || '#E0E0E0';
      const radius = p.borderRadius ? `, borderRadius: BorderRadius.circular(${p.borderRadius})` : '';
      return `Container(decoration: BoxDecoration(color: ${colorToFlutter(fill)}${radius}))`;
    }

    case 'circle':
      return `Container(decoration: BoxDecoration(shape: BoxShape.circle, color: ${colorToFlutter(p.fill || '#E0E0E0')}))`;

    case 'line':
      return `Divider(color: ${colorToFlutter(p.stroke || '#CCCCCC')}, thickness: ${p.strokeWidth || 1})`;

    case 'navbar':
      return `AppBar(title: Text('${_escapeSingleQuote(p.title || 'Screen')}'))`;

    case 'tabbar': {
      const tabs = (p.tabs || ['Tab 1', 'Tab 2', 'Tab 3'])
        .map(t => `Tab(text: '${_escapeSingleQuote(t)}')`)
        .join(', ');
      return `TabBar(tabs: [${tabs}])`;
    }

    case 'sidebar': {
      const items = (p.items || ['Item 1', 'Item 2'])
        .map(item => `ListTile(title: Text('${_escapeSingleQuote(item)}'))`)
        .join(', ');
      return `ListView(children: [${items}])`;
    }

    case 'breadcrumb': {
      const crumbs = (p.items || ['Home'])
        .map(item => `Text('${_escapeSingleQuote(item)}')`)
        .join(', ');
      return `Row(children: [${crumbs}])`;
    }

    case 'card': {
      const subtitle = p.subtitle
        ? `, Text('${_escapeSingleQuote(p.subtitle)}', style: TextStyle(color: Colors.grey))`
        : '';
      return `Card(child: Padding(padding: EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${_escapeSingleQuote(p.title || 'Card')}', style: TextStyle(fontWeight: FontWeight.bold))${subtitle}])))`;
    }

    case 'list': {
      const items = (p.items || ['Item 1', 'Item 2', 'Item 3'])
        .map(item => `ListTile(title: Text('${_escapeSingleQuote(typeof item === 'string' ? item : item.title || '')}'))`)
        .join(', ');
      return `ListView(children: [${items}])`;
    }

    case 'table': {
      const cols = (p.columns || ['Col 1', 'Col 2'])
        .map(c => `DataColumn(label: Text('${_escapeSingleQuote(c)}'))`)
        .join(', ');
      return `DataTable(columns: [${cols}], rows: [])`;
    }

    case 'avatar': {
      const initials = p.initials || (p.name ? p.name[0] : '?');
      return `CircleAvatar(backgroundColor: ${colorToFlutter(p.background || '#007AFF')}, child: Text('${_escapeSingleQuote(initials)}', style: TextStyle(color: Colors.white)))`;
    }

    case 'badge':
      return `Container(padding: EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: ${colorToFlutter(p.color || '#FF3B30')}, borderRadius: BorderRadius.circular(12)), child: Text('${_escapeSingleQuote(p.text || String(p.count ?? '0'))}', style: TextStyle(color: Colors.white, fontSize: 12)))`;

    case 'chip':
      return `Chip(label: Text('${_escapeSingleQuote(p.label || 'Chip')}'))`;

    case 'checkbox':
      return `CheckboxListTile(title: Text('${_escapeSingleQuote(p.label || 'Checkbox')}'), value: ${p.checked ? 'true' : 'false'}, onChanged: (_) {})`;

    case 'radio':
      return `RadioListTile(title: Text('${_escapeSingleQuote(p.label || 'Radio')}'), value: true, groupValue: ${p.checked ? 'true' : 'false'}, onChanged: (_) {})`;

    case 'toggle':
      return `SwitchListTile(title: Text('${_escapeSingleQuote(p.label || '')}'), value: ${(p.checked || p.on) ? 'true' : 'false'}, onChanged: (_) {})`;

    case 'select': {
      const opts = (p.options || ['Option 1', 'Option 2'])
        .map(o => `DropdownMenuItem(value: '${_escapeSingleQuote(o)}', child: Text('${_escapeSingleQuote(o)}'))`)
        .join(', ');
      return `DropdownButton(value: null, items: [${opts}], onChanged: (_) {})`;
    }

    case 'slider':
      return `Slider(value: ${(p.value || 50) / (p.max || 100)}, onChanged: (_) {})`;

    case 'alert': {
      // Background color encodes severity — matches the HTML generator's variant logic
      const bg = p.variant === 'error' ? '#FEE2E2'
        : p.variant === 'warning' ? '#FEF3C7'
        : p.variant === 'success' ? '#D1FAE5'
        : '#DBEAFE';
      return `Container(padding: EdgeInsets.all(12), decoration: BoxDecoration(color: ${colorToFlutter(bg)}, borderRadius: BorderRadius.circular(8)), child: Text('${_escapeSingleQuote(p.message || p.content || 'Alert message')}'))`;
    }

    case 'modal':
      return `AlertDialog(title: Text('${_escapeSingleQuote(p.title || 'Modal')}'), content: Text('${_escapeSingleQuote(p.content || '')}'))`;

    case 'skeleton':
      return `Container(decoration: BoxDecoration(color: Color(0xFFF0F0F0), borderRadius: BorderRadius.circular(${p.borderRadius || 4})))`;

    case 'progress':
      return `LinearProgressIndicator(value: ${(p.value || 50) / 100})`;

    case 'tooltip':
      return `Tooltip(message: '${_escapeSingleQuote(p.text || p.content || 'Tooltip')}', child: Container())`;

    case 'login_form':
      return `Column(children: [TextField(decoration: InputDecoration(hintText: '${_escapeSingleQuote(p.emailPlaceholder || 'Email')}')), SizedBox(height: 12), TextField(obscureText: true, decoration: InputDecoration(hintText: '${_escapeSingleQuote(p.passwordPlaceholder || 'Password')}')), SizedBox(height: 12), ElevatedButton(onPressed: () {}, child: Text('${_escapeSingleQuote(p.buttonLabel || 'Sign In')}'))])`;

    case 'search_bar':
      return `TextField(decoration: InputDecoration(hintText: '${_escapeSingleQuote(p.placeholder || 'Search...')}', prefixIcon: Icon(Icons.search)))`;

    case 'header':
      return `AppBar(title: Text('${_escapeSingleQuote(p.title || 'Header')}'))`;

    case 'footer':
      return `Container(alignment: Alignment.center, child: Text('${_escapeSingleQuote(p.text || p.content || 'Footer')}', style: TextStyle(fontSize: 14, color: Colors.grey)))`;

    case 'data_table': {
      const cols = (p.columns || ['Name', 'Value'])
        .map(c => `DataColumn(label: Text('${_escapeSingleQuote(c)}'))`)
        .join(', ');
      return `DataTable(columns: [${cols}], rows: [])`;
    }

    case 'chart_placeholder':
      return `Container(decoration: BoxDecoration(color: Color(0xFFF8F8F8), border: Border.all(color: Colors.grey)), child: Center(child: Text('${_escapeSingleQuote(p.chartType || 'Chart')} Placeholder')))`;

    default:
      // Unrecognised types render as an empty container with a comment so the file compiles
      return `Container() /* ${el.type} */`;
  }
}

// Escapes single quotes inside Dart string literals.
function _escapeSingleQuote(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
