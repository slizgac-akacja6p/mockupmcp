// Produces a SwiftUI View struct from a screen definition.
// Elements are absolutely positioned using ZStack + .position() with center coordinates,
// which is SwiftUI's native absolute-placement mechanism.

// SwiftUI's .position() takes the center of the view, so we offset by half width/height.
export function generate(screen) {
  const base = toPascalCase(screen.name);
  // Avoid doubling "Screen" when the name already ends with it (e.g. "My Login Screen")
  const structName = base.endsWith('Screen') ? base : base + 'Screen';

  const views = (screen.elements || [])
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .map(el => {
      const view = mapComponent(el);
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      return `            ${view}
                .frame(width: ${el.width}, height: ${el.height})
                .position(x: ${cx}, y: ${cy})`;
    }).join('\n');

  return `import SwiftUI

struct ${structName}: View {
    var body: some View {
        ZStack {
${views}
        }
        .frame(width: ${screen.width}, height: ${screen.height})
        .background(${colorToSwiftUI(screen.background)})
    }
}

#Preview {
    ${structName}()
}
`;
}

// Maps a single screen element to the closest native SwiftUI view.
// Simplified representations — real NavigationStack/sheet usage requires parent context
// that a standalone View struct cannot provide, so we use Text/VStack stand-ins.
export function mapComponent(el) {
  const p = el.properties || {};
  switch (el.type) {
    case 'text': {
      const fs = p.fontSize || 16;
      const color = p.color ? colorToSwiftUI(p.color) : '.primary';
      return `Text(${swiftString(p.content || '')})
                .font(.system(size: ${fs}))
                .foregroundColor(${color})`;
    }

    case 'button': {
      const variant = p.variant || 'primary';
      const style = variant === 'primary'
        ? '.borderedProminent'
        : variant === 'outline'
        ? '.bordered'
        : '.borderless';
      return `Button(${swiftString(p.label || 'Button')}) { }
                .buttonStyle(${style})`;
    }

    case 'input':
      return `TextField(${swiftString(p.placeholder || '')}, text: .constant(""))`;

    case 'textarea':
      return `TextEditor(text: .constant(${swiftString(p.content || '')}))`;

    case 'image':
      return p.src
        ? `AsyncImage(url: URL(string: ${swiftString(p.src)})!) { i in i.resizable() } placeholder: { ProgressView() }`
        : `Image(systemName: "photo").resizable().aspectRatio(contentMode: .fit)`;

    case 'icon':
      return `Image(systemName: ${swiftString(p.name || 'questionmark')})
                .font(.system(size: ${p.size || 24}))`;

    case 'rectangle': {
      const fill = colorToSwiftUI(p.fill || p.background || '#E0E0E0');
      const radius = p.borderRadius || 0;
      return `Rectangle()
                .fill(${fill})
                .cornerRadius(${radius})`;
    }

    case 'circle':
      return `Circle().fill(${colorToSwiftUI(p.fill || '#E0E0E0')})`;

    case 'line':
      return `Divider()`;

    // NavigationBar is context-dependent; render as a styled title Text for standalone use
    case 'navbar':
      return `Text(${swiftString(p.title || 'Screen')})
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(UIColor.systemBackground))`;

    case 'tabbar': {
      const tabs = (p.tabs || ['Tab 1', 'Tab 2', 'Tab 3'])
        .map(t => `            Text(${swiftString(t)}).font(.caption)`)
        .join('\n');
      return `HStack(spacing: 0) {\n${tabs}\n        }`;
    }

    case 'sidebar': {
      const items = (p.items || ['Item 1', 'Item 2'])
        .map(i => `            Text(${swiftString(i)}).padding(.vertical, 8)`)
        .join('\n');
      return `VStack(alignment: .leading, spacing: 0) {\n${items}\n        }`;
    }

    case 'breadcrumb': {
      const crumbs = (p.items || ['Home'])
        .map(i => `            Text(${swiftString(i)}).font(.caption)`)
        .join('\n');
      return `HStack(spacing: 4) {\n${crumbs}\n        }`;
    }

    case 'card':
      return `VStack(alignment: .leading) {
                Text(${swiftString(p.title || 'Card')}).font(.headline)
                ${p.subtitle ? `Text(${swiftString(p.subtitle)}).font(.subheadline).foregroundColor(.secondary)` : ''}
            }
            .padding()
            .background(RoundedRectangle(cornerRadius: 8).fill(Color.white))
            .shadow(radius: 2)`;

    case 'list': {
      const items = (p.items || ['Item 1', 'Item 2', 'Item 3'])
        .map(i => `            Text(${swiftString(typeof i === 'string' ? i : i.title || '')}).padding()`)
        .join('\n');
      return `VStack(spacing: 0) {\n${items}\n        }`;
    }

    case 'table': {
      const cols = (p.columns || ['Col 1', 'Col 2'])
        .map(c => `            Text(${swiftString(c)}).font(.caption.bold())`)
        .join('\n');
      return `VStack(alignment: .leading) {\n${cols}\n        }`;
    }

    case 'avatar': {
      const initials = p.initials || (p.name ? p.name[0] : '?');
      const bg = colorToSwiftUI(p.background || '#007AFF');
      return `Circle()
                .fill(${bg})
                .overlay(Text(${swiftString(initials)}).foregroundColor(.white).font(.headline))`;
    }

    case 'badge': {
      const text = p.text || (p.count !== undefined ? String(p.count) : '0');
      const bg = colorToSwiftUI(p.color || '#FF3B30');
      return `Text(${swiftString(text)})
                .font(.caption.bold())
                .foregroundColor(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Capsule().fill(${bg}))`;
    }

    case 'chip':
      return `Text(${swiftString(p.label || 'Chip')})
                .font(.subheadline)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(Capsule().fill(Color(.systemGray5)))`;

    case 'checkbox':
      return `Toggle(${swiftString(p.label || 'Checkbox')}, isOn: .constant(${p.checked ? 'true' : 'false'}))
                .toggleStyle(.checkmark)`;

    // SwiftUI has no native radio button; Toggle with a label is the closest equivalent
    case 'radio':
      return `Text(${swiftString(p.label || 'Radio')})`;

    case 'toggle':
      return `Toggle(${swiftString(p.label || '')}, isOn: .constant(${p.checked || p.on ? 'true' : 'false'}))`;

    case 'select': {
      const options = (p.options || ['Option 1', 'Option 2'])
        .map((o, i) => `            Text(${swiftString(o)}).tag(${i})`)
        .join('\n');
      return `Picker("", selection: .constant(0)) {\n${options}\n        }`;
    }

    case 'slider':
      return `Slider(value: .constant(${p.value || 50}), in: ${p.min || 0}...${p.max || 100})`;

    case 'alert': {
      const bgColor = p.variant === 'error' ? 'Color(.systemRed).opacity(0.15)'
        : p.variant === 'warning' ? 'Color(.systemOrange).opacity(0.15)'
        : p.variant === 'success' ? 'Color(.systemGreen).opacity(0.15)'
        : 'Color(.systemBlue).opacity(0.15)';
      return `Text(${swiftString(p.message || p.content || 'Alert message')})
                .padding()
                .background(RoundedRectangle(cornerRadius: 8).fill(${bgColor}))`;
    }

    case 'modal':
      return `VStack(spacing: 8) {
                Text(${swiftString(p.title || 'Modal')}).font(.title3.bold())
                Text(${swiftString(p.content || '')}).font(.body).foregroundColor(.secondary)
            }
            .padding()
            .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
            .shadow(radius: 8)`;

    case 'skeleton':
      return `RoundedRectangle(cornerRadius: ${p.borderRadius || 4})
                .fill(Color(.systemGray5))`;

    case 'progress':
      return `ProgressView(value: ${(p.value || 50) / 100})
                .tint(${colorToSwiftUI(p.color || '#007AFF')})`;

    case 'tooltip':
      return `Text(${swiftString(p.text || p.content || 'Tooltip')})
                .font(.caption)
                .foregroundColor(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(RoundedRectangle(cornerRadius: 6).fill(Color(.darkGray)))`;

    case 'login_form':
      return `VStack(spacing: 12) {
                TextField(${swiftString(p.emailPlaceholder || 'Email')}, text: .constant(""))
                SecureField("Password", text: .constant(""))
                Button(${swiftString(p.buttonLabel || 'Sign In')}) { }.buttonStyle(.borderedProminent)
            }`;

    case 'search_bar':
      return `TextField(${swiftString(p.placeholder || 'Search...')}, text: .constant(""))
                .textFieldStyle(.roundedBorder)`;

    case 'header':
      return `Text(${swiftString(p.title || 'Header')})
                .font(.title.bold())
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal)`;

    case 'footer':
      return `Text(${swiftString(p.text || p.content || 'Footer')})
                .font(.footnote)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .center)`;

    case 'data_table': {
      const cols = (p.columns || ['Name', 'Value'])
        .map(c => `            Text(${swiftString(c)}).font(.caption.bold()).frame(maxWidth: .infinity, alignment: .leading)`)
        .join('\n');
      return `VStack(alignment: .leading) {\n            HStack {\n${cols}\n            }\n        }`;
    }

    case 'chart_placeholder':
      return `RoundedRectangle(cornerRadius: 8)
                .strokeBorder(Color(.systemGray4), lineWidth: 1)
                .overlay(Text(${swiftString(p.chartType || 'Chart')}).foregroundColor(.secondary))`;

    default:
      // Unknown types produce a comment-style placeholder so the struct still compiles
      return `Text("// ${el.type}")`;
  }
}

// Converts a CSS hex color to a SwiftUI Color initializer using normalized RGB values.
function colorToSwiftUI(hex) {
  const clean = (hex || '#FFFFFF').replace('#', '');
  // Fallback gracefully when the value is not a 6-char hex (e.g. named colors)
  if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '.primary';
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return `Color(red: ${r.toFixed(2)}, green: ${g.toFixed(2)}, blue: ${b.toFixed(2)})`;
}

// Converts an arbitrary string to a Swift string literal with escaped quotes.
function swiftString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// Converts a screen name to PascalCase for use as a Swift struct identifier.
function toPascalCase(name) {
  return (name || 'Screen')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}
