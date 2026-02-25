# MockupMCP

Dockerized MCP server for creating UI mockups from Claude Code. Describe a screen in natural language — get a PNG mockup in seconds.

## Quick Start

```bash
# Pull the image
docker pull mggs/mockupmcp:latest

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
        "mggs/mockupmcp:latest"
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

- **34 MCP tools** — full CRUD for projects, screens, elements, plus export, codegen, layout, versioning, and comments
- **6 MCP resources** — read project data, previews, catalogs, and per-screen comments via `mockup://` URIs
- **4 MCP prompts** — AI-assisted UX review, accessibility check, screen comparison, and layout guide
- **35 UI components** — buttons, inputs, cards, tables, modals, charts, and more
- **19 styles** — wireframe, Material Design 3, iOS HIG, blueprint, flat, hand-drawn, and 13 additional design styles
- **7 screen templates** — login, dashboard, settings, list, form, profile, onboarding
- **Screen generation** — describe a screen in natural language, get a full mockup
- **Code export** — generate HTML, React, Flutter, or SwiftUI from any screen
- **Live preview** — browser preview with hot-reload at `http://localhost:3100`
- **Navigation flows** — link screens together, export Mermaid flow diagrams
- **Multiple formats** — export PNG, SVG, or PDF
- **Layers panel** — visual layer reorder, bring-to-front/send-to-back, keyboard shortcuts
- **Screen versioning** — create screen versions, track status (draft/review/approved/rejected)
- **Per-element comments** — add, list, and resolve review comments pinned to canvas elements
- **High-level Layout API** — compose screens from semantic sections (hero, navbar, footer, etc.)

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

### Compose a screen from layout sections

```
mockup_create_screen_layout({
  project_id: "proj_...",
  name: "Landing Page",
  sections: ["navbar", "hero_with_cta", "card_grid_3", "footer"]
})
```

### Manage screen versions

```
mockup_create_screen_version({ project_id: "proj_...", screen_id: "scr_...", label: "v2 — new header" })
mockup_set_screen_status({ project_id: "proj_...", screen_id: "scr_...", status: "review" })
```

### Add review comments

```
mockup_add_comment({ project_id: "proj_...", screen_id: "scr_...", element_id: "el_...", text: "CTA too small" })
mockup_list_comments({ project_id: "proj_...", screen_id: "scr_..." })
mockup_resolve_comment({ project_id: "proj_...", screen_id: "scr_...", comment_id: "cmt_..." })
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
| `mockup_create_screen_version` | Create a version snapshot of a screen |
| `mockup_set_screen_status` | Set screen status: draft, review, approved, rejected |

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
| `mockup_create_screen_layout` | Compose a screen from semantic layout sections |

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

### Comments

| Tool | Description |
|------|-------------|
| `mockup_add_comment` | Add a review comment to an element on a screen |
| `mockup_list_comments` | List all comments on a screen |
| `mockup_resolve_comment` | Mark a comment as resolved |

## MCP Resources

| URI | Description |
|-----|-------------|
| `mockup://projects` | List of all projects (summary) |
| `mockup://projects/{projectId}` | Full project with screens and elements |
| `mockup://projects/{projectId}/screens/{screenId}/preview` | PNG preview (base64) |
| `mockup://projects/{projectId}/screens/{screenId}/comments` | All comments on a screen |
| `mockup://templates` | Available templates with descriptions |
| `mockup://components` | UI component types with default properties |

## MCP Prompts

AI-assisted analysis prompts that provide screen data (JSON + PNG) for Claude to evaluate.

| Prompt | Description |
|--------|-------------|
| `mockup_design_review` | Review a mockup for UX quality — visual hierarchy, spacing, CTA placement, consistency |
| `mockup_accessibility_check` | Check for accessibility issues — touch targets (44px min), text sizes, contrast, labels |
| `mockup_compare_screens` | Compare two screens for visual consistency — typography, colors, spacing, components |
| `layout_guide` | Guide for composing screens using the high-level Layout API sections |

Each prompt takes `project_id` + `screen_id` (or `screen_id_a`/`screen_id_b` for compare) and returns the screen element data plus a rendered PNG screenshot for visual analysis.

## Styles

### Original styles

| Style | Description |
|-------|-------------|
| `wireframe` | Greyscale, minimal — focus on layout |
| `material` | Material Design 3 — Android apps |
| `ios` | iOS Human Interface Guidelines — Apple apps |
| `blueprint` | Blue on white, monospace — technical drawings |
| `flat` | Vibrant colors, zero shadows — modern flat design |
| `hand-drawn` | Sketchy, Comic Neue font — Balsamiq-like wireframes |

### Extended design styles

| Style | Description |
|-------|-------------|
| `dark-minimal` | Dark background, white text, minimal — developer tools |
| `pastel` | Soft pastel palette — consumer apps |
| `corporate` | Conservative blue/grey — enterprise software |
| `retro` | 80s/90s aesthetic — nostalgic products |
| `glassmorphism` | Frosted glass, blur effects — modern premium |
| `neon` | Bright neons on dark — gaming / entertainment |
| `paper` | Off-white, tactile — editorial / documentation |
| `terminal` | Green on black, monospace — CLI tools |
| `playful` | Rounded, colorful, bouncy — kids / casual |
| `gradient` | Gradient backgrounds and fills — landing pages |
| `monochrome` | Pure black-and-white — print / PDF export |
| `soft-ui` | Neumorphic soft shadows — premium consumer |
| `slate` | Two-variant dark/light — professional apps (use `color_scheme: "dark"` or `"light"`) |

### Additional styles (available via style name)

`antd`, `aurora`, `carbon`, `claymorphism`, `fluent2`, `hig`, `material3`, `neubrutalism`, `neumorphic`, `skeuomorphic`

## Templates

`login`, `dashboard`, `settings`, `list`, `form`, `profile`, `onboarding`

## Layout Sections (Layout API)

Pre-built semantic sections for rapid screen composition:

`navbar`, `hero_with_cta`, `card_grid_2`, `card_grid_3`, `feature_list`, `footer`, `login_form`, `profile_header`, `search_bar`, `settings_panel`

## UI Components

**Basic:** text, rectangle, circle, line, image, icon

**Forms:** button, input, textarea, checkbox, radio, toggle, select, slider

**Navigation:** navbar, tabbar, sidebar, breadcrumb

**Data:** card, list, table, avatar, badge, chip

**Feedback:** alert, modal, skeleton, progress, tooltip

**Composite:** login_form, search_bar, header, footer, data_table, chart_placeholder

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio`, `http`, or `both` |
| `PREVIEW_PORT` | `3100` | Preview server port |
| `MCP_PORT` | `3200` | HTTP MCP transport port |
| `DEFAULT_STYLE` | `wireframe` | Default style for new screens |
| `DATA_DIR` | `/data` | Data directory for project storage |

### HTTP Transport

MockupMCP supports Streamable HTTP transport on port 3200 alongside stdio.

```bash
# Run with HTTP transport
docker run -d -p 3100:3100 -p 3200:3200 -v ./mockups:/data -e MCP_TRANSPORT=both mggs/mockupmcp:latest
```

HTTP endpoint: `POST /mcp` with JSON-RPC messages. Each `initialize` request creates a new session. Use the `mcp-session-id` header for subsequent requests.

### Docker Compose

```yaml
services:
  mockupmcp:
    image: mggs/mockupmcp:latest
    ports:
      - "3100:3100"
      - "3200:3200"
    volumes:
      - ./mockups:/data
    environment:
      - MCP_TRANSPORT=both
```

## Development

```bash
# Install dependencies
npm install

# Run tests (~1564 tests)
npm test

# Run Docker E2E tests (requires running container)
RUN_E2E=1 npm test

# Build Docker image
docker build -t mockupmcp:latest .

# Run locally (stdio)
node src/index.js

# Run locally (HTTP)
MCP_TRANSPORT=http node src/index.js
```

## Project Structure

```
src/
  index.js                 # Entry point: MCP + preview server
  config.js                # Environment configuration
  mcp/
    server.js              # MCP server (stdio)
    http-transport.js      # HTTP MCP transport
    resources.js           # 6 MCP resource handlers
    prompts.js             # 4 MCP prompt handlers
    screen-generator.js    # NLP screen generation
    tools/                 # 34 MCP tool handlers
      project-tools.js     # Project CRUD (3)
      screen-tools.js      # Screen CRUD + versioning (7)
      element-tools.js     # Element CRUD (5)
      export-tools.js      # Export PNG/SVG/PDF + preview + codegen (4)
      group-tools.js       # Element grouping (3)
      layout-tools.js      # Auto-layout + Layout API (2)
      template-tools.js    # Screen templates (2)
      comment-tools.js     # Per-element comments (3)
      approval-tools.js    # Screen approval workflow
      bulk-tools.js        # Bulk element operations
  renderer/
    html-builder.js        # Screen JSON -> HTML
    screenshot.js          # Puppeteer PNG/PDF
    layout-composer.js     # High-level layout section composition
    components/            # 35 UI components
    styles/                # 19 CSS styles
    sections/              # 10 semantic layout sections
    templates/             # 7 screen templates
  storage/
    project-store.js       # JSON file CRUD with folder-aware index
  codegen/                 # Code generation: html, react, swiftui, flutter, flow
  preview/
    server.js              # Express preview server (port 3100)
    editor/                # Client-side editor modules
      layers.js            # Layers panel — reorder, z_index, drag-to-reorder
      comments.js          # Comment pins on canvas
      canvas.js            # Canvas interaction
      drag.js              # Drag-and-drop
      resize.js            # Resize handles
      palette.js           # Component palette
      inspector.js         # Property inspector
      history.js           # Undo/redo
      shortcuts.js         # Keyboard shortcuts
tests/
  mcp/                     # Tool + resource + prompt tests
  renderer/                # Component + style + layout tests
  storage/                 # Store tests
  integration/             # Cross-module tests
  codegen/                 # Code generation tests
  preview/                 # Preview server tests
  e2e/                     # Docker E2E (gated: RUN_E2E=1)
```

## License

MIT
