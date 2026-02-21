# MockupMCP

Dockerized MCP server for creating UI mockups from Claude Code. Describe a screen in natural language — get a PNG mockup in seconds.

## Quick Start

```bash
# Pull the image
docker pull maciek/mockupmcp:latest

# Add to ~/.claude/mcp.json:
```

```json
{
  "mcpServers": {
    "mockupmcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "./mockups:/data",
        "-p", "3100:3100",
        "maciek/mockupmcp:latest"
      ]
    }
  }
}
```

Then in Claude Code:

```
> Create a login screen mockup for my app
```

Claude will call `mockup_create_project`, `mockup_generate_screen`, and `mockup_export` — returning a PNG.

## Features

- **25 MCP tools** — full CRUD for projects, screens, elements, plus export, codegen, and layout
- **5 MCP resources** — read project data, previews, and catalogs via `mockup://` URIs
- **35 UI components** — buttons, inputs, cards, tables, modals, charts, and more
- **3 styles** — wireframe, Material Design 3, iOS HIG
- **7 screen templates** — login, dashboard, settings, list, form, profile, onboarding
- **Screen generation** — describe a screen in natural language, get a full mockup
- **Code export** — generate HTML, React, Flutter, or SwiftUI from any screen
- **Live preview** — browser preview with hot-reload at `http://localhost:3100`
- **Navigation flows** — link screens together, export Mermaid flow diagrams
- **Multiple formats** — export PNG, SVG, or PDF

## Usage Examples

### Generate a screen from description

```
mockup_create_project({ name: "My App" })
mockup_generate_screen({ project_id: "proj_...", description: "login screen with social auth" })
mockup_export({ project_id: "proj_...", screen_id: "scr_...", format: "png" })
```

### Apply a template and customize

```
mockup_add_screen({ project_id: "proj_...", name: "Settings" })
mockup_apply_template({ project_id: "proj_...", screen_id: "scr_...", template: "settings" })
mockup_update_element({ project_id: "proj_...", screen_id: "scr_...", element_id: "el_...", properties: { label: "Dark Mode" } })
```

### Export to code

```
mockup_to_code({ project_id: "proj_...", screen_id: "scr_...", framework: "react" })
```

## MCP Tools

### Projects

| Tool | Description |
|------|-------------|
| `mockup_create_project` | Create a new mockup project |
| `mockup_list_projects` | List all projects |
| `mockup_delete_project` | Delete a project |

### Screens

| Tool | Description |
|------|-------------|
| `mockup_add_screen` | Add a screen to a project |
| `mockup_list_screens` | List screens in a project |
| `mockup_delete_screen` | Delete a screen |
| `mockup_duplicate_screen` | Clone a screen with all elements |
| `mockup_generate_screen` | Generate a screen from natural language description |

### Elements

| Tool | Description |
|------|-------------|
| `mockup_add_element` | Add a UI element to a screen |
| `mockup_update_element` | Update element properties |
| `mockup_delete_element` | Delete an element |
| `mockup_move_element` | Move/resize an element |
| `mockup_list_elements` | List elements on a screen |

### Templates & Layout

| Tool | Description |
|------|-------------|
| `mockup_apply_template` | Apply a predefined template to a screen |
| `mockup_list_templates` | List available templates |
| `mockup_auto_layout` | Auto-arrange elements (vertical/horizontal/grid) |

### Export

| Tool | Description |
|------|-------------|
| `mockup_export` | Export screen as PNG, SVG, or PDF |
| `mockup_get_preview_url` | Get live preview URL |
| `mockup_to_code` | Generate code (HTML/React/Flutter/SwiftUI) |
| `mockup_export_flow` | Export navigation flow as Mermaid diagram |

### Navigation & Grouping

| Tool | Description |
|------|-------------|
| `mockup_add_link` | Link an element to another screen |
| `mockup_remove_link` | Remove a navigation link |
| `mockup_group_elements` | Group elements together |
| `mockup_ungroup_elements` | Ungroup elements |
| `mockup_move_group` | Move an entire group |

## MCP Resources

| URI | Description |
|-----|-------------|
| `mockup://projects` | List of all projects (summary) |
| `mockup://projects/{projectId}` | Full project with screens and elements |
| `mockup://projects/{projectId}/screens/{screenId}/preview` | PNG preview (base64) |
| `mockup://templates` | Available templates with descriptions |
| `mockup://components` | UI component types with default properties |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio`, `http`, or `both` |
| `PREVIEW_PORT` | `3100` | Preview server port |
| `MCP_PORT` | `3200` | HTTP MCP transport port |
| `DEFAULT_STYLE` | `wireframe` | Default style: `wireframe`, `material`, `ios` |
| `DATA_DIR` | `/data` | Data directory for project storage |

### Docker Compose

```yaml
services:
  mockupmcp:
    image: maciek/mockupmcp:latest
    ports:
      - "3100:3100"
      - "3200:3200"
    volumes:
      - ./mockups:/data
    environment:
      - MCP_TRANSPORT=both
```

## UI Components

**Basic:** text, rectangle, circle, line, image, icon

**Forms:** button, input, textarea, checkbox, radio, toggle, select, slider

**Navigation:** navbar, tabbar, sidebar, breadcrumb

**Data:** card, list, table, avatar, badge, chip

**Feedback:** alert, modal, skeleton, progress, tooltip

**Composite:** login_form, search_bar, header, footer, data_table, chart_placeholder

## Development

```bash
# Install dependencies
npm install

# Run tests (588 tests)
node --test tests/**/*.test.js tests/**/**/*.test.js

# Run Docker E2E tests (requires Docker)
RUN_E2E=1 node --test tests/e2e/docker-e2e.test.js

# Build Docker image
docker build -t mockupmcp:latest .

# Run locally (stdio)
node src/index.js

# Run locally (HTTP)
MCP_TRANSPORT=http node src/index.js
```

### Project Structure

```
src/
  index.js                 # Entry point
  config.js                # Environment configuration
  mcp/
    server.js              # MCP server (stdio)
    http-transport.js      # HTTP MCP transport
    resources.js           # MCP resource handlers
    screen-generator.js    # NLP screen generation
    tools/                 # 25 MCP tool handlers
  renderer/
    html-builder.js        # Screen JSON -> HTML
    screenshot.js          # Puppeteer PNG/PDF
    components/            # 35 UI components
    styles/                # wireframe/material/ios CSS
    templates/             # 7 screen templates
  storage/
    project-store.js       # JSON file CRUD
  preview/
    server.js              # Express preview server
tests/
  mcp/                     # Tool + resource tests
  renderer/                # Component + style tests
  storage/                 # Store tests
  integration/             # Cross-module tests
```

## License

MIT
