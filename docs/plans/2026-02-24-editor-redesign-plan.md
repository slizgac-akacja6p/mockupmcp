# Editor Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full redesign of MockupMCP editor — new design token system, improved layout, visual language refresh, i18n (EN/PL), and performance fixes for drag/select/property panel lag.

**Architecture:** Server-side HTML/CSS generation in `server.js` (EDITOR_CSS constant), client-side vanilla JS modules in `src/preview/editor/`. New i18n layer added as `src/preview/i18n/` with `t(key)` helper imported by all editor modules. Performance fixes applied via rAF throttle, debounce, surgical DOM updates, and hash-based polling diff.

**Tech Stack:** Node.js 20 ESM, Express, vanilla JS (no bundler), CSS custom properties, `node --test` test runner

---

### Task 1: Design Token System

**Files:**
- Modify: `src/preview/server.js` — zastąp sekcję `EDITOR_CSS` nowymi tokenami

**Steps:**
1. Znajdź sekcję `EDITOR_CSS` w `src/preview/server.js` (stała z CSS edytora jako string).
2. Zastąp wszelkie istniejące CSS custom properties `:root` nowym zestawem tokenów:
   ```css
   --surface-0: #0A0A0B;
   --surface-1: #111113;
   --surface-2: #1A1A1F;
   --surface-3: #242429;
   --surface-4: #2E2E35;
   --accent: #6366F1;
   --accent-hover: #818CF8;
   --accent-gradient: linear-gradient(135deg, #6366F1, #8B5CF6);
   --accent-subtle: rgba(99,102,241,0.15);
   --accent-glow: 0 0 20px rgba(99,102,241,0.3);
   --border-subtle: rgba(255,255,255,0.04);
   --border-default: rgba(255,255,255,0.08);
   --border-strong: rgba(255,255,255,0.16);
   --text-primary: rgba(255,255,255,0.92);
   --text-secondary: rgba(255,255,255,0.48);
   --text-tertiary: rgba(255,255,255,0.28);
   --text-xxs: 10px;
   --text-xs: 11px;
   --text-sm: 12px;
   --text-base: 13px;
   --text-md: 14px;
   --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
   --shadow-md: 0 4px 12px rgba(0,0,0,0.5);
   --shadow-lg: 0 8px 32px rgba(0,0,0,0.6);
   --radius-sm: 4px;
   --radius-md: 6px;
   --radius-lg: 10px;
   ```
3. Znajdź wszystkie stare tokeny (np. `--editor-bg`, `--sidebar-bg`, `--panel-bg`, `--accent-color`, `--border-color`) i zastąp ich użycia referencjami do nowych tokenów (np. `var(--surface-0)`, `var(--surface-1)`, `var(--accent)`, `var(--border-default)`).
4. Uruchom `npm test` — upewnij się, że serwer nadal startuje i testy przechodzą.

**Commit:** `refactor: replace editor CSS custom properties with new design token system`

---

### Task 2: Layout — proporcje i separatory

**Files:**
- Modify: `src/preview/server.js` — zmień CSS paneli

**Steps:**
1. Znajdź w `EDITOR_CSS` definicje szerokości sidebar i prawego panelu.
2. Zmień sidebar na `width: 240px` (było 260px).
3. Zmień right panel na `width: 280px` (było 260px).
4. Zaktualizuj offsets canvasu: `margin-left: 240px; margin-right: 280px`.
5. Zaktualizuj offsets toolbara: `left: 240px; right: 280px`.
6. Dodaj separator do sidebar: `border-right: 1px solid var(--border-default)`.
7. Dodaj separator do right panel: `border-left: 1px solid var(--border-default)`.
8. Dodaj inset shadow na canvasie: `box-shadow: inset 2px 0 8px rgba(0,0,0,0.3)` — efekt głębi.
9. Upewnij się, że `#editor-flex-wrapper` używa zaktualizowanych offsetów: `margin-left: 240px`.
10. Uruchom `npm test`.

**Commit:** `refactor: update editor panel proportions and add separators`

---

### Task 3: Sidebar collapse

**Files:**
- Modify: `src/preview/server.js` — dodaj CSS dla stanu `.collapsed` na sidebar
- Modify: `src/preview/editor/editor.js` — dodaj logikę collapse

**Steps:**
1. W `EDITOR_CSS` dodaj reguły dla stanu collapsed:
   ```css
   #editor-sidebar.collapsed { width: 48px; overflow: hidden; }
   #editor-sidebar.collapsed .sidebar-label { display: none; }
   #editor-sidebar.collapsed .sidebar-icon { margin: 0 auto; }
   body.sidebar-collapsed #editor-flex-wrapper { margin-left: 48px; }
   body.sidebar-collapsed #editor-toolbar { left: 48px; }
   #sidebar-collapse-btn { position: absolute; right: -12px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; border-radius: 50%; background: var(--surface-3); border: 1px solid var(--border-default); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: var(--text-xs); color: var(--text-secondary); z-index: 10; }
   #editor-sidebar { position: relative; transition: width 0.2s ease; }
   ```
2. W HTML generowanym przez `server.js` dodaj przycisk collapse do sidebar: `<button id="sidebar-collapse-btn">‹</button>`.
3. W `src/preview/editor/editor.js` dodaj logikę w funkcji inicjalizacyjnej:
   ```js
   const collapseBtn = document.getElementById('sidebar-collapse-btn');
   const sidebar = document.getElementById('editor-sidebar');
   const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
   if (isCollapsed) { sidebar.classList.add('collapsed'); document.body.classList.add('sidebar-collapsed'); collapseBtn.textContent = '›'; }
   collapseBtn.addEventListener('click', () => {
     const collapsed = sidebar.classList.toggle('collapsed');
     document.body.classList.toggle('sidebar-collapsed', collapsed);
     collapseBtn.textContent = collapsed ? '›' : '‹';
     localStorage.setItem('sidebar-collapsed', String(collapsed));
   });
   ```
4. Uruchom `npm test`.

**Commit:** `feat: sidebar collapse with localStorage persistence`

---

### Task 4: Right panel — zakładki Properties | Components

**Files:**
- Modify: `src/preview/server.js` — zastąp układ property-panel + palette zakładkami
- Modify: `src/preview/editor/editor.js` — auto-switch do Properties po zaznaczeniu elementu

**Steps:**
1. W HTML generowanym przez `server.js` dla `/editor/:pid/:sid` zamień obecny układ prawego panelu (property-panel na górze + palette na dole) na:
   ```html
   <div id="editor-right-panel">
     <div id="right-panel-tabs">
       <button class="tab-btn active" data-tab="properties">Properties</button>
       <button class="tab-btn" data-tab="components">Components</button>
     </div>
     <div id="tab-properties" class="tab-content active">
       <!-- treść property-panel -->
     </div>
     <div id="tab-components" class="tab-content">
       <!-- treść palette -->
     </div>
   </div>
   ```
2. Dodaj CSS w `EDITOR_CSS`:
   ```css
   #right-panel-tabs { display: flex; border-bottom: 1px solid var(--border-default); }
   .tab-btn { flex: 1; padding: 8px; background: transparent; border: none; color: var(--text-secondary); font-size: var(--text-sm); cursor: pointer; }
   .tab-btn.active { color: var(--text-primary); border-bottom: 2px solid var(--accent); }
   .tab-btn:hover:not(.active) { background: var(--surface-3); color: var(--text-primary); }
   .tab-content { display: none; flex: 1; overflow-y: auto; }
   .tab-content.active { display: flex; flex-direction: column; }
   ```
3. W `src/preview/editor/editor.js` dodaj logikę przełączania zakładek:
   ```js
   document.querySelectorAll('.tab-btn').forEach(btn => {
     btn.addEventListener('click', () => switchTab(btn.dataset.tab));
   });
   function switchTab(tab) {
     document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
     document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
   }
   ```
4. W miejscu gdzie editor reaguje na zaznaczenie elementu (selection change) dodaj `switchTab('properties')`.
5. Przy braku zaznaczenia (deselect) dodaj `switchTab('components')`.
6. Uruchom `npm test`.

**Commit:** `feat: right panel tab navigation — Properties and Components tabs`

---

### Task 5: Visual — Toolbar

**Files:**
- Modify: `src/preview/server.js` — nowe style toolbar

**Steps:**
1. Znajdź w `EDITOR_CSS` style `#editor-toolbar` i zaktualizuj:
   ```css
   #editor-toolbar {
     background: var(--surface-2);
     border-bottom: 1px solid var(--border-subtle);
   }
   ```
2. Dodaj separatory między sekcjami toolbara (HTML w server.js):
   ```css
   .toolbar-sep { width: 1px; height: 20px; background: var(--border-subtle); margin: 0 8px; }
   ```
3. Dodaj style dla mode toggle pill:
   ```css
   .mode-pill { display: flex; border-radius: var(--radius-md); background: var(--surface-3); padding: 2px; gap: 2px; }
   .mode-pill .mode-btn { border-radius: var(--radius-sm); padding: 4px 10px; border: none; background: transparent; color: var(--text-secondary); font-size: var(--text-sm); cursor: pointer; transition: background 0.15s; }
   .mode-pill .mode-btn.active { background: var(--accent-gradient); color: white; }
   .mode-pill .mode-btn:hover:not(.active) { background: var(--surface-4); color: var(--text-primary); }
   ```
4. Zastąp obecny light/dark toggle tekstowy ikoną — w HTML toolbara zmień button na `<button id="theme-toggle" title="Toggle theme">☾</button>` i zaktualizuj logikę w `editor.js`: gdy motyw jest `light` button pokazuje `☀`, gdy `dark` — `☾`.
5. Dodaj style dla toolbar buttons (inactive/hover):
   ```css
   .toolbar-btn { background: transparent; border: none; color: var(--text-secondary); border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: var(--text-sm); }
   .toolbar-btn:hover { background: var(--surface-3); color: var(--text-primary); }
   .toolbar-btn.active { background: var(--accent-gradient); color: white; }
   ```
6. Uruchom `npm test`.

**Commit:** `refactor: toolbar visual refresh — pill toggle, icon buttons, separators`

---

### Task 6: Visual — Property panel pola

**Files:**
- Modify: `src/preview/server.js` — nowe style inputs i property panel

**Steps:**
1. Znajdź w `EDITOR_CSS` style dla inputów w property panel i zastąp:
   ```css
   #tab-properties input[type="text"],
   #tab-properties input[type="number"],
   #tab-properties select {
     background: var(--surface-2);
     border: 1px solid var(--border-default);
     border-radius: var(--radius-sm);
     color: var(--text-primary);
     font-size: var(--text-sm);
     padding: 4px 6px;
     width: 100%;
     box-sizing: border-box;
   }
   #tab-properties input:focus,
   #tab-properties select:focus {
     border-color: var(--accent);
     box-shadow: var(--accent-glow);
     outline: none;
   }
   ```
2. Dodaj style dla section headers:
   ```css
   .prop-section-header {
     font-size: var(--text-xxs);
     letter-spacing: 0.08em;
     text-transform: uppercase;
     color: var(--text-secondary);
     padding: 8px 12px 4px;
     margin: 0;
   }
   ```
3. Dodaj style dla field pairs (x/y, w/h) — grid 2-kolumnowy:
   ```css
   .prop-field-pair {
     display: grid;
     grid-template-columns: 1fr 1fr;
     gap: 4px;
     padding: 0 12px 6px;
   }
   .prop-field-single {
     padding: 0 12px 6px;
   }
   .prop-field-label {
     font-size: var(--text-xxs);
     color: var(--text-tertiary);
     margin-bottom: 2px;
   }
   ```
4. Upewnij się, że `src/preview/editor/property-panel.js` generuje HTML z tymi klasami.
5. Uruchom `npm test`.

**Commit:** `refactor: property panel inputs and section headers visual refresh`

---

### Task 7: Visual — Palette karty i search

**Files:**
- Modify: `src/preview/server.js` — nowe style palette
- Modify: `src/preview/editor/palette.js` — dodaj toggle logikę dla collapsible kategorii

**Steps:**
1. Zaktualizuj style komponentów palety w `EDITOR_CSS`:
   ```css
   .palette-component-card {
     border-radius: var(--radius-md);
     background: var(--surface-2);
     border: 1px solid transparent;
     padding: 6px 8px;
     cursor: pointer;
     font-size: var(--text-sm);
     color: var(--text-secondary);
     display: flex;
     align-items: center;
     gap: 6px;
   }
   .palette-component-card:hover {
     background: var(--surface-3);
     border-color: var(--border-default);
     color: var(--text-primary);
   }
   ```
2. Zaktualizuj style search inputu palety:
   ```css
   .palette-search-wrapper {
     position: relative;
     padding: 8px 12px;
   }
   .palette-search-icon {
     position: absolute;
     left: 20px;
     top: 50%;
     transform: translateY(-50%);
     color: var(--text-tertiary);
     font-size: var(--text-sm);
     pointer-events: none;
   }
   #palette-search {
     width: 100%;
     padding: 5px 8px 5px 28px;
     background: var(--surface-2);
     border: 1px solid var(--border-default);
     border-radius: var(--radius-md);
     color: var(--text-primary);
     font-size: var(--text-sm);
     box-sizing: border-box;
   }
   #palette-search:focus {
     border-color: var(--accent);
     outline: none;
   }
   ```
3. Dodaj style dla collapsible kategorii:
   ```css
   .palette-category-header {
     display: flex;
     align-items: center;
     gap: 6px;
     padding: 6px 12px;
     font-size: var(--text-xxs);
     letter-spacing: 0.08em;
     text-transform: uppercase;
     color: var(--text-secondary);
     cursor: pointer;
     user-select: none;
   }
   .palette-category-header:hover { color: var(--text-primary); }
   .palette-category-chevron { font-size: var(--text-xxs); transition: transform 0.15s; }
   .palette-category.collapsed .palette-category-chevron { transform: rotate(-90deg); }
   .palette-category.collapsed .palette-category-items { display: none; }
   ```
4. W `src/preview/editor/palette.js` dodaj event listener dla każdego `.palette-category-header`:
   ```js
   document.querySelectorAll('.palette-category-header').forEach(header => {
     header.addEventListener('click', () => {
       header.closest('.palette-category').classList.toggle('collapsed');
     });
   });
   ```
5. Upewnij się, że generowany HTML kategorii w `palette.js` używa klas `.palette-category`, `.palette-category-header`, `.palette-category-chevron`, `.palette-category-items`.
6. Uruchom `npm test`.

**Commit:** `refactor: palette cards, search, and collapsible categories visual refresh`

---

### Task 8: Visual — Canvas i selection handles

**Files:**
- Modify: `src/preview/server.js` — style canvas i selection

**Steps:**
1. Zaktualizuj styl tła canvasu w `EDITOR_CSS`:
   ```css
   #editor-canvas-area {
     background: var(--surface-0);
   }
   ```
2. Zaktualizuj grid dots (jeśli istnieje CSS grid background):
   ```css
   .canvas-grid {
     background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
     background-size: 16px 16px;
   }
   ```
3. Dodaj shadow dla elementów na canvasie:
   ```css
   .canvas-element {
     box-shadow: var(--shadow-sm);
   }
   ```
4. Zaktualizuj styl selection outline:
   ```css
   .canvas-element.selected {
     outline: 2px solid var(--accent);
     outline-offset: 1px;
   }
   ```
5. Zaktualizuj style resize handles:
   ```css
   .resize-handle {
     width: 6px;
     height: 6px;
     background: var(--accent);
     border-radius: 1px;
     border: 1px solid var(--surface-0);
   }
   ```
6. Uruchom `npm test`.

**Commit:** `refactor: canvas background, grid, element shadows, and selection handle styles`

---

### Task 9: i18n — Core module

**Files:**
- Create: `src/preview/i18n/index.js`
- Create: `src/preview/i18n/en.json`
- Create: `src/preview/i18n/pl.json`
- Modify: `src/preview/server.js` — dodaj route `GET /i18n/:lang.json`

**Steps:**
1. Utwórz `src/preview/i18n/index.js`:
   ```js
   // Language loader and t() helper for editor UI strings.
   // Locale loaded from /i18n/:lang.json served by preview server.
   let locale = {};

   export async function setLanguage(lang) {
     const res = await fetch(`/i18n/${lang}.json`);
     if (!res.ok) throw new Error(`Failed to load locale: ${lang}`);
     locale = await res.json();
     localStorage.setItem('editor-lang', lang);
   }

   export function t(key) {
     return locale[key] ?? key;
   }

   export async function initI18n() {
     const lang = localStorage.getItem('editor-lang') ?? 'en';
     await setLanguage(lang);
     return lang;
   }
   ```
2. Utwórz `src/preview/i18n/en.json` z wszystkimi kluczami UI:
   ```json
   {
     "toolbar.selectMode": "Select",
     "toolbar.addMode": "Add",
     "toolbar.undo": "Undo",
     "toolbar.redo": "Redo",
     "toolbar.delete": "Delete",
     "toolbar.copy": "Copy",
     "toolbar.paste": "Paste",
     "toolbar.zoomIn": "Zoom In",
     "toolbar.zoomOut": "Zoom Out",
     "toolbar.themeToggle": "Toggle theme",
     "toolbar.language": "Language",
     "properties.title": "Properties",
     "properties.x": "X",
     "properties.y": "Y",
     "properties.width": "W",
     "properties.height": "H",
     "properties.visible": "Visible",
     "properties.label": "Label",
     "properties.color": "Color",
     "properties.background": "Background",
     "properties.fontSize": "Font size",
     "properties.noSelection": "No element selected",
     "components.title": "Components",
     "components.search": "Search components...",
     "components.recent": "Recent",
     "components.all": "All",
     "components.basic": "Basic",
     "components.form": "Form",
     "components.layout": "Layout",
     "components.navigation": "Navigation",
     "components.data": "Data",
     "components.media": "Media",
     "toast.copied": "Copied",
     "toast.pasted": "Pasted",
     "toast.deleted": "Deleted",
     "toast.undone": "Undone",
     "toast.error": "Something went wrong",
     "sidebar.projects": "Projects",
     "sidebar.screens": "Screens",
     "sidebar.newScreen": "New Screen",
     "sidebar.newProject": "New Project"
   }
   ```
3. Utwórz `src/preview/i18n/pl.json` z polskimi tłumaczeniami:
   ```json
   {
     "toolbar.selectMode": "Zaznacz",
     "toolbar.addMode": "Dodaj",
     "toolbar.undo": "Cofnij",
     "toolbar.redo": "Ponów",
     "toolbar.delete": "Usuń",
     "toolbar.copy": "Kopiuj",
     "toolbar.paste": "Wklej",
     "toolbar.zoomIn": "Przybliż",
     "toolbar.zoomOut": "Oddal",
     "toolbar.themeToggle": "Przełącz motyw",
     "toolbar.language": "Język",
     "properties.title": "Właściwości",
     "properties.x": "X",
     "properties.y": "Y",
     "properties.width": "S",
     "properties.height": "W",
     "properties.visible": "Widoczny",
     "properties.label": "Etykieta",
     "properties.color": "Kolor",
     "properties.background": "Tło",
     "properties.fontSize": "Rozmiar czcionki",
     "properties.noSelection": "Nie wybrano elementu",
     "components.title": "Komponenty",
     "components.search": "Szukaj komponentów...",
     "components.recent": "Ostatnie",
     "components.all": "Wszystkie",
     "components.basic": "Podstawowe",
     "components.form": "Formularz",
     "components.layout": "Układ",
     "components.navigation": "Nawigacja",
     "components.data": "Dane",
     "components.media": "Media",
     "toast.copied": "Skopiowano",
     "toast.pasted": "Wklejono",
     "toast.deleted": "Usunięto",
     "toast.undone": "Cofnięto",
     "toast.error": "Coś poszło nie tak",
     "sidebar.projects": "Projekty",
     "sidebar.screens": "Ekrany",
     "sidebar.newScreen": "Nowy ekran",
     "sidebar.newProject": "Nowy projekt"
   }
   ```
4. W `src/preview/server.js` dodaj route do serwowania plików locale (po istniejących routach, przed catch-all):
   ```js
   import { readFile } from 'fs/promises';
   import { join } from 'path';
   // ...
   app.get('/i18n/:lang.json', async (req, res) => {
     const { lang } = req.params;
     if (!/^[a-z]{2}$/.test(lang)) return res.status(400).json({ error: 'Invalid lang' });
     try {
       const filePath = join(new URL('../i18n/', import.meta.url).pathname, `${lang}.json`);
       const content = await readFile(filePath, 'utf8');
       res.setHeader('Content-Type', 'application/json');
       res.send(content);
     } catch {
       res.status(404).json({ error: 'Locale not found' });
     }
   });
   ```
5. Uruchom `npm test`.

**Commit:** `feat: i18n core module — t() helper, EN/PL locale files, /i18n/:lang.json route`

---

### Task 10: i18n — Integracja w edytorze

**Files:**
- Modify: `src/preview/editor/editor.js` — import `{ t, initI18n }`, wywołaj `initI18n()` na starcie
- Modify: `src/preview/editor/property-panel.js` — import `{ t }`, zastąp hardcoded stringi
- Modify: `src/preview/editor/palette.js` — import `{ t }`, zastąp hardcoded stringi
- Modify: `src/preview/editor/shortcuts.js` — import `{ t }` dla tooltip texts

**Steps:**
1. W `src/preview/editor/editor.js`:
   - Dodaj import: `import { t, initI18n } from '../i18n/index.js';`
   - W funkcji inicjalizacyjnej (na początku, przed innymi operacjami) dodaj: `await initI18n();`
   - Znajdź wszystkie hardcoded stringi UI (etykiety przycisków toolbar, toast messages) i zastąp `t('klucz')`.
   - Zaktualizuj label przycisku theme toggle po zmianie motywu: `themeBtn.title = t('toolbar.themeToggle')`.
2. W `src/preview/editor/property-panel.js`:
   - Dodaj import: `import { t } from '../i18n/index.js';`
   - Zastąp hardcoded stringi sekcji (np. `'Properties'` → `t('properties.title')`, `'No selection'` → `t('properties.noSelection')`).
   - Zastąp labele pól (X, Y, W, H, Label, Color, etc.) wywołaniami `t()`.
3. W `src/preview/editor/palette.js`:
   - Dodaj import: `import { t } from '../i18n/index.js';`
   - Zastąp hardcoded stringi: placeholder searcha → `t('components.search')`, nagłówki kategorii → `t('components.basic')` etc., nagłówek sekcji Recent → `t('components.recent')`.
4. W `src/preview/editor/shortcuts.js`:
   - Dodaj import: `import { t } from '../i18n/index.js';`
   - Zastąp tooltip texts w definicjach skrótów klawiszowych (jeśli istnieją) wywołaniami `t()`.
5. Upewnij się, że wszystkie moduły są ESM i mają poprawne ścieżki importu względem `src/preview/editor/`.
6. Uruchom `npm test`.

**Commit:** `feat: i18n integration in editor modules — replace hardcoded strings with t()`

---

### Task 11: i18n — Language switcher w toolbar

**Files:**
- Modify: `src/preview/server.js` — dodaj HTML dla language switcher w toolbar
- Modify: `src/preview/editor/editor.js` — event listener na lang-switcher

**Steps:**
1. W HTML toolbara generowanym przez `server.js` dodaj (w prawej sekcji, obok theme toggle):
   ```html
   <div id="lang-switcher">
     <button class="lang-btn active" data-lang="en">EN</button>
     <button class="lang-btn" data-lang="pl">PL</button>
   </div>
   ```
2. Dodaj CSS w `EDITOR_CSS`:
   ```css
   #lang-switcher { display: flex; gap: 2px; }
   .lang-btn { padding: 3px 7px; border-radius: var(--radius-sm); border: 1px solid transparent; background: transparent; color: var(--text-secondary); font-size: var(--text-xs); cursor: pointer; }
   .lang-btn.active { background: var(--surface-3); color: var(--text-primary); border-color: var(--border-default); }
   .lang-btn:hover:not(.active) { color: var(--text-primary); }
   ```
3. W `src/preview/editor/editor.js` dodaj event listener (po `initI18n()`):
   ```js
   document.querySelectorAll('.lang-btn').forEach(btn => {
     btn.addEventListener('click', async () => {
       await setLanguage(btn.dataset.lang);
       document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === btn.dataset.lang));
       rerenderUILabels();
     });
   });
   ```
4. Zaimplementuj `rerenderUILabels()` — funkcja aktualizuje wszystkie elementy DOM z `data-i18n` atrybutem lub wywołuje `render()` dla property panel i palette:
   ```js
   function rerenderUILabels() {
     document.querySelectorAll('[data-i18n]').forEach(el => {
       el.textContent = t(el.dataset.i18n);
     });
     propertyPanel.render(currentSelection);
     palette.render();
   }
   ```
5. Dodaj atrybut `data-i18n` do statycznych elementów UI w HTML (przyciski toolbar z etykietami tekstowymi).
6. Przy inicjalizacji ustaw active state na właściwym przycisku na podstawie `localStorage.getItem('editor-lang') ?? 'en'`.
7. Uruchom `npm test`.

**Commit:** `feat: language switcher in toolbar — EN/PL toggle with live UI update`

---

### Task 12: Performance — rAF throttle dla drag i resize

**Files:**
- Modify: `src/preview/editor/drag.js` — rAF throttle w mousemove
- Modify: `src/preview/editor/resize.js` — rAF throttle w mousemove
- Modify: `src/preview/editor/editor.js` — rAF throttle dla alignment guides mousemove

**Steps:**
1. W `src/preview/editor/drag.js` znajdź handler `mousemove` (lub `pointermove`) i owij go w rAF throttle:
   ```js
   let rafPending = false;
   function onMouseMove(e) {
     if (rafPending) return;
     rafPending = true;
     requestAnimationFrame(() => {
       doMove(e);
       rafPending = false;
     });
   }
   ```
   Zastąp bezpośrednie przypisanie handlera na `document.addEventListener('mousemove', onMouseMove)`.
2. W `src/preview/editor/resize.js` zastosuj identyczny wzorzec dla handlera resize mousemove. Zmienna `rafPending` powinna być lokalna dla modułu (nie globalna).
3. W `src/preview/editor/editor.js` znajdź wywołanie `findAlignmentGuides` w mousemove i owij je w rAF throttle:
   ```js
   let guideRafPending = false;
   canvas.addEventListener('mousemove', (e) => {
     if (guideRafPending) return;
     guideRafPending = true;
     requestAnimationFrame(() => {
       findAlignmentGuides(e);
       guideRafPending = false;
     });
   });
   ```
4. Upewnij się, że zmienna `rafPending` jest resetowana do `false` zarówno po normalnym wykonaniu, jak i gdy drag/resize jest anulowany (mouseup, escape). Dodaj reset w cleanup handlerach.
5. Uruchom `npm test`.

**Commit:** `perf: rAF throttle for drag, resize, and alignment guide mousemove handlers`

---

### Task 13: Performance — Surgical DOM updates dla selection

**Files:**
- Modify: `src/preview/editor/editor.js` — zastąp pełny rerender przy zmianie zaznaczenia surgical DOM toggle

**Steps:**
1. Znajdź w `src/preview/editor/editor.js` miejsce, gdzie zmiana `selectedIds` powoduje `screenEl.outerHTML = await fetchHtml()` lub `renderScreen()`.
2. Wydziel `updateSelectionClasses()` jako osobną funkcję:
   ```js
   function updateSelectionClasses(selectedIds) {
     document.querySelectorAll('[data-element-id]').forEach(el => {
       el.classList.toggle('selected', selectedIds.has(el.dataset.elementId));
     });
   }
   ```
3. Zastąp wywołanie `renderScreen()` / fetch HTML na `selectedIds` change wywołaniem `updateSelectionClasses(selectedIds)`.
4. Zachowaj pełny `renderScreen()` / fetch HTML tylko dla zdarzeń zmieniających dane: `POST` (nowy element), `PATCH` (edycja), `DELETE` (usunięcie), undo/redo.
5. Upewnij się, że przy pollingowych aktualizacjach z serwera (jeśli element zmienił dane) zaznaczenie jest przywracane po rerendzie przez `updateSelectionClasses(selectedIds)`.
6. Uruchom `npm test`.

**Commit:** `perf: surgical DOM selection updates — skip full HTML fetch on selection-only changes`

---

### Task 14: Performance — Debounce i hash-based polling

**Files:**
- Create: `src/preview/editor/utils.js`
- Modify: `src/preview/editor/property-panel.js` — import `{ debounce }`, owij PATCH call
- Modify: `src/preview/editor/palette.js` — import `{ debounce }`, owij search
- Modify: `src/preview/editor/editor.js` — import `{ simpleHash }`, hash diff w polling

**Steps:**
1. Utwórz `src/preview/editor/utils.js`:
   ```js
   // Utility helpers for editor performance: debounce and hash-based change detection.

   export function debounce(fn, delay) {
     let timer;
     return (...args) => {
       clearTimeout(timer);
       timer = setTimeout(() => fn(...args), delay);
     };
   }

   export function simpleHash(str) {
     let h = 0;
     for (const c of str) {
       h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
     }
     return h;
   }
   ```
2. W `src/preview/editor/property-panel.js`:
   - Dodaj import: `import { debounce } from './utils.js';`
   - Znajdź wszystkie `input.addEventListener('input', handler)` i owij handler w debounce:
     ```js
     input.addEventListener('input', debounce((e) => {
       patchElement({ [field]: e.target.value });
     }, 150));
     ```
3. W `src/preview/editor/palette.js`:
   - Dodaj import: `import { debounce } from './utils.js';`
   - Znajdź `searchInput.addEventListener('input', ...)` i owij w debounce:
     ```js
     searchInput.addEventListener('input', debounce(renderAll, 100));
     ```
4. W `src/preview/editor/editor.js`:
   - Dodaj import: `import { simpleHash } from './utils.js';`
   - Dodaj zmienną modułową: `let lastScreenHash = 0;`
   - W funkcji pollingu (setInterval lub setTimeout) dodaj hash diff:
     ```js
     const newHash = simpleHash(JSON.stringify(screenData));
     if (newHash === lastScreenHash) return;
     lastScreenHash = newHash;
     // ... kontynuuj rerender
     ```
5. Uruchom `npm test`.

**Commit:** `perf: debounce for property panel and palette search, hash-based polling diff`

---

## Test Plan

Po każdym tasku odpal: `npm test` (919 testów, baseline do zachowania)

Testy wizualne (manualne):
- [ ] Drag elementu — płynny ruch bez jank
- [ ] Zaznaczenie elementu — natychmiastowe
- [ ] Wpisywanie w property panel — bez lag
- [ ] Search w palecie — bez lag przy szybkim wpisywaniu
- [ ] Sidebar collapse — animacja + canvas rozszerza się
- [ ] Tab Properties/Components — przełączanie działa
- [ ] Language switcher — EN/PL zmiana etykiet bez reload
- [ ] Design spójny z Linear/Vercel style

## Commit Strategy

Jeden commit per task. Branch: `feature/m18-editor-redesign` (nowy branch od `develop`).
