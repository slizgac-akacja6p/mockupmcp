# Content Hints — generate_screen content adaptation

**Goal:** Templates adapt their content to user's description instead of showing hardcoded placeholders.

## Architecture

Pipeline change in `generateScreen()`:
1. `parseDescription()` — add `contentHints: string[]` to output
2. `template.generate(width, height, style, contentHints)` — 4th param, array of content phrases
3. Each template maps hints to its elements, falls back to current defaults when no hints

## Content extraction

In `parseDescription()`, after existing keyword extraction:
- Split description on `,` and ` and `
- From each segment, remove stop words + known keywords (screen/component/modifier)
- Trim, titleCase, filter empty
- Result: `contentHints[]`

Example: "fitness dashboard with steps count, calories burned, active minutes, and weekly bar chart"
→ `["Fitness", "Steps Count", "Calories Burned", "Active Minutes", "Weekly Bar Chart"]`

## Template mapping

Each template uses `contentHints` positionally for its "slots":

| Template | Slots (in order) |
|----------|-----------------|
| dashboard | card titles (2+), chart label, list title |
| list | navbar title, list item labels |
| settings | section title, toggle labels |
| profile | user name, bio, stat labels |
| login | heading, button label |
| form | field labels, submit button |
| onboarding | heading, description |

Templates fall back to current hardcoded defaults when `contentHints` is empty or shorter than slot count.

## Testing

- Unit tests: parseDescription contentHints extraction
- Integration: "fitness dashboard with steps" → card titles contain "Steps"
- Regression: empty description still produces valid screens
