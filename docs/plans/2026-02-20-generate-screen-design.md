# Design: mockup_generate_screen

**Date:** 2026-02-20
**Status:** Approved
**Approach:** Template-first with keyword overlay (rule-based, no LLM)

## TL;DR

New MCP tool that generates a full UI screen from a natural language description. Rule-based parser matches description to the closest of 7 existing templates, then augments with additional elements based on keywords. Creates a new screen in the project automatically.

## Architecture

```
description (text)
    |
    v
+------------------+
| Screen Generator  |
|                   |
| 1. parseDesc()   |---> keywords, hints
| 2. matchTempl()  |---> best template + score
| 3. generate()    |---> element array (from template)
| 4. augment()     |---> modify/add elements per keywords
| 5. store         |---> addScreen + applyTemplate
+------------------+
    |
    v
screen object + match info
```

## MCP Tool API

```
mockup_generate_screen(
  project_id: string,       // required
  description: string,      // "login screen with social auth buttons"
  name?: string,            // screen name (default: derived from description)
  style?: string,           // wireframe|material|ios (default: project style)
  viewport?: string         // mobile|tablet|desktop (default: project viewport)
)
```

**Returns:** screen object with elements + `match_info`:
```json
{
  "template": "login",
  "confidence": "high|medium|low",
  "augmentations": ["added social buttons"]
}
```

## Parser Design (rule-based)

### Step 1 — Keyword Extraction

Tokenize description, lowercase, remove stop words. Identify:

- **Screen type keywords:** login, dashboard, settings, profile, list, form, onboarding, signup, register, home, detail
- **Component keywords:** button, input, navbar, card, table, toggle, checkbox, search, avatar, image, chart
- **Modifier keywords:** social, dark mode, grid, horizontal, with image

### Step 2 — Template Matching

Each template has a keyword set with weights. Score = sum of matched keyword weights / max possible score. Threshold:
- score >= 0.5 -> confidence "high"
- score >= 0.3 -> confidence "medium"
- score < 0.3 -> confidence "low" (fallback)

### Step 3 — Augmentation Rules

Keyword-to-action map applied after template generation:

| Keyword | Action |
|---------|--------|
| social | Add 2 buttons (Google, Apple) below form |
| search | Add search_bar at top |
| dark mode / toggle | Add toggle element |
| image / photo / avatar | Add image/avatar element |
| table / data | Replace list with data_table |
| chart | Add chart_placeholder |
| notification / alert | Add alert element |

### Fallback (low confidence)

When score < 0.3: generate basic screen with:
- Navbar with title derived from description
- Text element with full description as placeholder
- Return confidence "low" + suggestion list of recognized screen types

## File Structure

- `src/mcp/screen-generator.js` — pure functions: parseDescription(), matchTemplate(), augmentElements(), generateScreen()
- Tool registration in `src/mcp/tools/screen-tools.js` (add to existing file)

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| NLP approach | Rule-based parser | No LLM dependency, deterministic, Claude already does intelligent mapping |
| Fallback behavior | Basic layout + warning | User gets something usable, Claude can augment manually |
| Screen creation | Auto-create new screen | Simpler API, one call instead of two |
| Architecture | Template-first + keywords | Leverages existing 7 tested templates, minimal new code |
