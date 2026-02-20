# PRD: MockupMCP — Narzędzie do makietowania z MCP dla Claude Code

**Wersja:** 1.0  
**Data:** 2026-02-20  
**Autor:** Maciek / AI-assisted  
**Status:** Draft

---

## 1. Podsumowanie wykonawcze

**MockupMCP** to konteneryzowane (Docker) narzędzie do tworzenia makiet UI, udostępniające swoje funkcje poprzez protokół MCP (Model Context Protocol) dla Claude Code. Pozwala to na programistyczne tworzenie, edycję i eksport wireframe'ów/mockupów bezpośrednio z poziomu terminala i sesji Claude Code — bez konieczności otwierania Figmy, Balsamic czy innego GUI.

### Kluczowa propozycja wartości

- **Claude Code tworzy makiety głosem/tekstem** — opisujesz ekran, Claude generuje mockup
- **Zero kontekstowego przełączania** — wszystko w terminalu, bez otwierania przeglądarki
- **Wersjonowanie** — makiety jako kod (JSON), łatwe do śledzenia w Git
- **Eksport** — PNG, SVG, PDF, HTML do podglądu
- **Podgląd na żywo** — wbudowany serwer HTTP z hot-reload

---

## 2. Problem

| Problem | Wpływ |
|---------|-------|
| Mockupy wymagają GUI (Figma, Sketch) | Przełączanie kontekstu, strata flow |
| AI nie ma narzędzia do wizualizacji UI | Claude Code może opisać UI, ale nie pokazać |
| Brak integracji mockupów z workflow deweloperskim | Makiety żyją osobno od kodu |
| Iteracja na mockupach jest wolna | Każda zmiana wymaga manualnej pracy w GUI |

---

## 3. Rozwiązanie — Architektura

```
┌──────────────────────────────────────────────┐
│  Claude Code (terminal)                       │
│  ↕ MCP Protocol (stdio/SSE)                  │
├──────────────────────────────────────────────┤
│  MockupMCP Server (Docker)                    │
│  ┌────────────┐  ┌───────────┐  ┌──────────┐│
│  │ MCP Handler│  │ Renderer  │  │ HTTP     ││
│  │ (tools)    │→ │ (Canvas/  │→ │ Preview  ││
│  │            │  │  SVG/HTML)│  │ Server   ││
│  └────────────┘  └───────────┘  └──────────┘│
│  ┌────────────┐  ┌───────────┐              │
│  │ Component  │  │ Project   │              │
│  │ Library    │  │ Storage   │              │
│  │ (presets)  │  │ (JSON/FS) │              │
│  └────────────┘  └───────────┘              │
├──────────────────────────────────────────────┤
│  Volume: ./mockups:/data                      │
│  Ports: 3100 (preview), stdio (MCP)           │
└──────────────────────────────────────────────┘
```

### Transport MCP

- **Główny:** `stdio` — Claude Code uruchamia kontener z `docker run` i komunikuje się przez stdin/stdout
- **Alternatywny:** `SSE` na porcie 3200 — dla integracji z innymi klientami MCP

---

## 4. Definicja MCP Tools

### 4.1 Zarządzanie projektami

| Tool | Opis | Parametry |
|------|------|-----------|
| `mockup_create_project` | Tworzy nowy projekt makiet | `name`, `description?`, `viewport?` (mobile/tablet/desktop/custom) |
| `mockup_list_projects` | Lista projektów | `—` |
| `mockup_delete_project` | Usuwa projekt | `project_id` |

### 4.2 Zarządzanie ekranami (screens/pages)

| Tool | Opis | Parametry |
|------|------|-----------|
| `mockup_add_screen` | Dodaje nowy ekran do projektu | `project_id`, `name`, `width?`, `height?`, `background?` |
| `mockup_list_screens` | Lista ekranów w projekcie | `project_id` |
| `mockup_delete_screen` | Usuwa ekran | `screen_id` |
| `mockup_duplicate_screen` | Klonuje ekran | `screen_id`, `new_name?` |

### 4.3 Elementy UI (Components)

| Tool | Opis | Parametry |
|------|------|-----------|
| `mockup_add_element` | Dodaje element na ekran | `screen_id`, `type`, `properties` (patrz §5) |
| `mockup_update_element` | Aktualizuje element | `element_id`, `properties` |
| `mockup_delete_element` | Usuwa element | `element_id` |
| `mockup_move_element` | Zmienia pozycję/rozmiar | `element_id`, `x?`, `y?`, `width?`, `height?`, `z_index?` |
| `mockup_list_elements` | Lista elementów na ekranie | `screen_id` |
| `mockup_group_elements` | Grupuje elementy | `element_ids[]`, `group_name?` |

### 4.4 Szybkie tworzenie (AI-assisted)

| Tool | Opis | Parametry |
|------|------|-----------|
| `mockup_generate_screen` | Generuje cały ekran z opisu | `project_id`, `description` (naturalny język), `style?` (wireframe/material/ios) |
| `mockup_apply_template` | Stosuje gotowy szablon | `screen_id`, `template` (login/dashboard/settings/list/form/profile/onboarding) |
| `mockup_auto_layout` | Automatyczny layout elementów | `screen_id`, `direction` (vertical/horizontal/grid), `spacing?`, `padding?` |

### 4.5 Eksport i podgląd

| Tool | Opis | Parametry |
|------|------|-----------|
| `mockup_export` | Eksportuje ekran/projekt | `target_id`, `format` (png/svg/pdf/html), `scale?` |
| `mockup_get_preview_url` | Zwraca URL do podglądu na żywo | `screen_id` |
| `mockup_export_all` | Eksport wszystkich ekranów projektu | `project_id`, `format`, `output_dir?` |
| `mockup_to_code` | Generuje szkielet kodu z makiety | `screen_id`, `framework` (html/react/flutter/swiftui) |

### 4.6 Nawigacja i flow

| Tool | Opis | Parametry |
|------|------|-----------|
| `mockup_add_link` | Dodaje nawigację między ekranami | `element_id`, `target_screen_id`, `transition?` |
| `mockup_export_flow` | Eksportuje diagram flow | `project_id`, `format` (mermaid/png/svg) |

---

## 5. Biblioteka komponentów UI

### Typy elementów (`type` w `mockup_add_element`)

#### Podstawowe
- `text` — tekst (props: `content`, `fontSize`, `fontWeight`, `color`, `align`)
- `rectangle` — prostokąt/kontener (props: `fill`, `stroke`, `cornerRadius`, `opacity`)
- `circle` — okrąg (props: `fill`, `stroke`, `radius`)
- `line` — linia/separator (props: `strokeWidth`, `color`, `style: solid|dashed|dotted`)
- `image` — placeholder obrazka (props: `src?`, `placeholder: true`, `aspectRatio?`)
- `icon` — ikona z zestawu (props: `name` — np. "home", "search", "user", `size`, `color`)

#### Formularze
- `button` — przycisk (props: `label`, `variant: primary|secondary|outline|ghost`, `size: sm|md|lg`)
- `input` — pole tekstowe (props: `placeholder`, `label?`, `type: text|password|email|search`)
- `textarea` — pole wieloliniowe (props: `placeholder`, `rows?`)
- `checkbox` — checkbox (props: `label`, `checked?`)
- `radio` — radio button (props: `label`, `selected?`, `group`)
- `toggle` — switch (props: `label`, `on?`)
- `select` — dropdown (props: `options[]`, `placeholder`, `selected?`)
- `slider` — suwak (props: `min`, `max`, `value`)

#### Nawigacja
- `navbar` — pasek nawigacji (props: `title`, `leftIcon?`, `rightIcons?[]`)
- `tabbar` — dolny tab bar (props: `tabs[]` z `icon`, `label`, `active?`)
- `sidebar` — boczne menu (props: `items[]` z `icon`, `label`, `active?`)
- `breadcrumb` — ścieżka nawigacji (props: `items[]`)

#### Listy i dane
- `list` — lista elementów (props: `items[]`, `variant: simple|detailed|card`)
- `card` — karta (props: `title`, `subtitle?`, `image?`, `actions?[]`)
- `table` — tabela (props: `headers[]`, `rows[][]`, `striped?`)
- `avatar` — awatar użytkownika (props: `initials?`, `size`, `src?`)
- `badge` — badge/tag (props: `label`, `color`)
- `chip` — chip/tag (props: `label`, `removable?`, `selected?`)

#### Feedback
- `alert` — alert/toast (props: `message`, `type: info|success|warning|error`)
- `modal` — okno modalne (props: `title`, `content`, `actions?[]`)
- `skeleton` — placeholder ładowania (props: `variant: text|circle|rectangle`)
- `progress` — pasek postępu (props: `value`, `max?`)
- `tooltip` — dymek (props: `content`, `position`)

#### Złożone (Composite)
- `login_form` — gotowy formularz logowania
- `search_bar` — pasek wyszukiwania z ikoną
- `header` — nagłówek strony z logo i nawigacją
- `footer` — stopka
- `data_table` — tabela z sortowaniem/filtrowaniem (wireframe)
- `chart_placeholder` — placeholder wykresu (props: `type: bar|line|pie|donut`)

---

## 6. Format danych — JSON Schema

```json
{
  "project": {
    "id": "proj_abc123",
    "name": "Drop App Mockups",
    "created_at": "2026-02-20T10:00:00Z",
    "viewport": { "width": 393, "height": 852, "preset": "mobile" },
    "screens": [
      {
        "id": "scr_001",
        "name": "Home Screen",
        "width": 393,
        "height": 852,
        "background": "#FFFFFF",
        "elements": [
          {
            "id": "el_001",
            "type": "navbar",
            "x": 0, "y": 0,
            "width": 393, "height": 56,
            "z_index": 10,
            "properties": {
              "title": "Drop",
              "leftIcon": "menu",
              "rightIcons": ["search", "notifications"]
            }
          },
          {
            "id": "el_002",
            "type": "button",
            "x": 97, "y": 400,
            "width": 200, "height": 48,
            "properties": {
              "label": "Share Files",
              "variant": "primary",
              "size": "lg"
            }
          }
        ],
        "links": [
          {
            "from_element": "el_002",
            "to_screen": "scr_002",
            "transition": "push"
          }
        ]
      }
    ]
  }
}
```

---

## 7. Style renderowania

| Styl | Opis | Użycie |
|------|------|--------|
| `wireframe` | Szary, szkicowy, minimalistyczny | Wczesne koncepty, UX flow |
| `blueprint` | Niebieski na białym, techniczny | Dokumentacja, specyfikacje |
| `material` | Material Design 3 | Aplikacje Android |
| `ios` | iOS Human Interface Guidelines | Aplikacje iOS |
| `flat` | Kolorowy, płaski design | Web, prezentacje |
| `hand-drawn` | Ręcznie rysowany efekt (Balsamiq-like) | Warsztaty, burze mózgów |

---

## 8. Docker — Konfiguracja

### Dockerfile

```dockerfile
FROM node:20-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV DATA_DIR=/data
ENV PREVIEW_PORT=3100
ENV MCP_TRANSPORT=stdio

EXPOSE 3100 3200

VOLUME ["/data"]

ENTRYPOINT ["node", "src/index.js"]
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  mockupmcp:
    build: .
    image: mockupmcp:latest
    container_name: mockupmcp
    ports:
      - "3100:3100"   # Preview server
      - "3200:3200"   # SSE MCP (opcjonalnie)
    volumes:
      - ./mockups:/data
    environment:
      - MCP_TRANSPORT=stdio
      - PREVIEW_PORT=3100
      - DEFAULT_STYLE=wireframe
    stdin_open: true
    tty: true
```

### Konfiguracja Claude Code (`~/.claude/mcp.json`)

```json
{
  "mcpServers": {
    "mockupmcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "./mockups:/data",
        "-p", "3100:3100",
        "mockupmcp:latest"
      ]
    }
  }
}
```

---

## 9. Stack technologiczny

| Warstwa | Technologia | Uzasadnienie |
|---------|-------------|-------------|
| Runtime | Node.js 20 (Alpine) | Lekki, szybki start kontenera |
| MCP SDK | `@modelcontextprotocol/sdk` | Oficjalne SDK |
| Renderowanie | HTML/CSS + Puppeteer → screenshot | Elastyczny, obsługuje wszystkie style |
| Podgląd na żywo | Express + WebSocket (hot-reload) | Natychmiastowe odświeżanie |
| Eksport SVG | `svg.js` lub custom | Wektorowe makiety |
| Eksport PDF | Puppeteer `page.pdf()` | PDF z HTML |
| Storage | JSON na volumenie `/data` | Prosto, wersjonowalny w Git |
| Ikony | Lucide Icons (SVG) | Spójne, otwarte |

---

## 10. Przykłady użycia z Claude Code

### Tworzenie ekranu logowania

```
> Claude, stwórz mockup ekranu logowania dla aplikacji Drop

Claude Code wywołuje:
1. mockup_create_project("Drop App", viewport: "mobile")
2. mockup_add_screen(project_id, "Login Screen")
3. mockup_apply_template(screen_id, "login")
4. mockup_update_element(logo_el, { content: "Drop", fontSize: 32 })
5. mockup_export(screen_id, "png")

→ Zwraca: /data/exports/login-screen.png
```

### Generowanie z opisu

```
> Stwórz ekran z listą plików do udostępnienia, z FAB do dodawania

Claude Code wywołuje:
1. mockup_generate_screen(project_id, 
     "File list screen with file cards showing name, size, 
      date. Floating action button in bottom right for adding 
      new files. Top navbar with search icon.")
2. mockup_get_preview_url(screen_id)

→ Zwraca: http://localhost:3100/preview/scr_002
```

### Iteracja na istniejącym mockupie

```
> Zmień przycisk "Share" na zielony i dodaj ikonę send

Claude Code wywołuje:
1. mockup_list_elements(screen_id)
2. mockup_update_element(button_id, { 
     properties: { fill: "#4CAF50", icon: "send" }
   })
3. mockup_export(screen_id, "png")
```

### Eksport do kodu

```
> Wygeneruj szkielet SwiftUI z tego mockupu

Claude Code wywołuje:
1. mockup_to_code(screen_id, "swiftui")

→ Zwraca wygenerowany kod SwiftUI z layoutem odpowiadającym mockupowi
```

---

## 11. Fazy rozwoju

### Faza 1 — MVP (1-2 tygodnie)

- [ ] Kontener Docker z Node.js
- [ ] MCP server ze `stdio` transport
- [ ] Podstawowe tools: create_project, add_screen, add_element, export (PNG)
- [ ] 10 typów elementów (text, rectangle, button, input, navbar, tabbar, card, list, image, icon)
- [ ] Styl `wireframe` (jedyny)
- [ ] JSON storage
- [ ] Renderowanie: HTML → Puppeteer screenshot

### Faza 2 — Rozbudowa (2-3 tygodnie)

- [ ] Pełna biblioteka komponentów (§5)
- [ ] Style: material, ios, hand-drawn
- [ ] `mockup_generate_screen` — generowanie z opisu NLP
- [ ] Szablony (login, dashboard, settings, etc.)
- [ ] Podgląd na żywo (Express + WebSocket)
- [ ] Eksport SVG i PDF
- [ ] Auto-layout

### Faza 3 — Zaawansowane (3-4 tygodnie)

- [ ] `mockup_to_code` — eksport do React/Flutter/SwiftUI
- [ ] Nawigacja i flow (linki między ekranami)
- [ ] Eksport flow do Mermaid
- [ ] SSE transport MCP
- [ ] Grupowanie elementów
- [ ] Warstwy (layers) i opacity
- [ ] Animowane przejścia w preview
- [ ] Publikacja obrazu na Docker Hub / GitHub Container Registry

---

## 12. MCP Resources (opcjonalne)

Oprócz tools, serwer może udostępniać MCP Resources:

| Resource URI | Opis |
|-------------|------|
| `mockup://projects` | Lista projektów (JSON) |
| `mockup://project/{id}` | Pełna definicja projektu |
| `mockup://screen/{id}/preview` | Obraz PNG podglądu ekranu (base64) |
| `mockup://templates` | Lista dostępnych szablonów |
| `mockup://components` | Lista typów komponentów z parametrami |

---

## 13. MCP Prompts (opcjonalne)

| Prompt | Opis |
|--------|------|
| `mockup_design_review` | Przegląd designu — Claude analizuje mockup i sugeruje ulepszenia UX |
| `mockup_accessibility_check` | Sprawdzenie dostępności (kontrast, rozmiary tap targets) |
| `mockup_compare_screens` | Porównanie dwóch ekranów wizualnie |

---

## 14. Metryki sukcesu

| Metryka | Target (MVP) |
|---------|------|
| Czas od opisu do PNG | < 10 sekund |
| Czas startu kontenera | < 3 sekundy |
| Rozmiar obrazu Docker | < 500 MB |
| Obsługiwane typy elementów | ≥ 10 (MVP), ≥ 30 (Faza 2) |
| Formaty eksportu | PNG (MVP), +SVG, PDF, HTML (Faza 2) |

---

## 15. Ryzyka i mitigacja

| Ryzyko | Prawdopodobieństwo | Wpływ | Mitigacja |
|--------|---------------------|-------|-----------|
| Puppeteer w Alpine — problemy z fontami | Średnie | Wysoki | Instalacja ttf-freefont + noto-fonts w Dockerfile |
| Rozmiar kontenera za duży (Chromium) | Wysokie | Średni | Użycie `--no-sandbox`, slim Chromium; rozważyć `playwright` |
| Generowanie z opisu NLP niecelne | Średnie | Średni | Mapowanie na szablony + ręczne poprawki przez update_element |
| Wydajność przy złożonych ekranach | Niskie | Średni | Limitowanie elementów, lazy rendering |
| Konkurencja (v0, Galileo AI) | Średnie | Niski | USP: offline, Docker, MCP, integracja z Claude Code |

---

## 16. Alternatywy rozważane

| Opcja | Zalety | Wady | Decyzja |
|-------|--------|------|---------|
| Figma Plugin + MCP bridge | Bogaty ekosystem | Wymaga Figma, nie offline | Odrzucona |
| SVG-only rendering (bez Puppeteer) | Lżejszy kontener | Ograniczone style, trudniejsze layouty | Backup plan |
| Python + Pillow | Prostszy stack | Gorsze renderowanie tekstu, brak CSS | Odrzucona |
| Playwright zamiast Puppeteer | Lżejszy Chromium | Mniejsza społeczność MCP | Rozważyć w Fazie 3 |

---

## 17. Licencja i dystrybucja

- **Licencja:** MIT (open source)
- **Repozytorium:** GitHub
- **Docker Hub:** `maciek/mockupmcp:latest`
- **Instalacja:** `docker pull maciek/mockupmcp && claude mcp add mockupmcp`
