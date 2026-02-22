# Design: 3 New Rendering Styles (Blueprint, Flat, Hand-drawn)

## TL;DR
Add 3 CSS files following existing style pattern. No code changes to components or html-builder.

## Blueprint
- Palette: white bg, blue (#1565C0) text/borders, light blue (#E3F2FD) fills
- Font: Courier New, monospace
- Borders: solid 1-2px blue, zero shadows
- Background: subtle CSS grid pattern
- Feel: technical drawing

## Flat
- Palette: vibrant — primary #2196F3, success #4CAF50, warning #FF9800, error #F44336
- Font: Segoe UI, Roboto, sans-serif
- Zero shadows, zero gradients, zero borders (or minimal)
- Solid color fills, colored accents
- Feel: Metro/flat design

## Hand-drawn
- Palette: off-white bg (#FFFEF5), dark text (#333)
- Font: Comic Neue (Google Fonts @import) + cursive fallback
- Irregular border-radius for hand-drawn effect
- Light offset shadows (2px 2px 0)
- Optional SVG feTurbulence filter for roughness
- Feel: Balsamiq-like sketchy

## Files
- `src/renderer/styles/blueprint.css` (NEW)
- `src/renderer/styles/flat.css` (NEW)
- `src/renderer/styles/hand-drawn.css` (NEW)
- `src/renderer/styles/index.js` (add 3 names to VALID_STYLES)
- `tests/integration/` (extend style matrix)
