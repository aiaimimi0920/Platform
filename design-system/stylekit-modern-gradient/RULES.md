# NeuroTerminal Rules

This is the default and only art direction for all UI work in this repository.

The rules below define the **NeuroTerminal** (`nt-*`) design system — an industrial-terminal visual language inspired by in-world terminal interfaces.

> **Compatibility note:** The current codebase still uses `mg-*` and `mg-terminal-*` CSS class prefixes. All future UI work must use the `nt-*` prefix. See Section 15 for the migration baseline.

## 1. Theme Positioning

Our default theme is:

- industrial, terminal-like, disciplined
- dark-base, graphite-slab, signal-yellow emphasis
- suitable for all platform pages: dashboards, editors, control centers, landing pages, onboarding, account terminals, and operator surfaces

This theme is not enterprise-gray and not SaaS-flat.
It is not a generic purple-glass dashboard.
It should feel like a terminal that exists inside the product world — layered, structural, and deliberate.

Keywords:
- `industrial`
- `terminal`
- `disciplined`
- `layered`
- `world-consistent`

Rejected keywords:
- `enterprise dashboard`
- `glass card mosaic`
- `marketing poster`
- `candy-colored`

## 2. Core Visual Language

All surfaces must follow these principles:

- Use a dark graphite-to-slate base, never flat pure white as the main page canvas.
- Use graphite slabs for elevated surfaces instead of translucent glass cards.
- Use signal-yellow as the primary emphasis accent — for kickers, active states, focus borders, and key indicators.
- Use cold cyan as the secondary emphasis accent.
- Use structural elements for depth: grid meshes, scan lines, separators, labels, numbered markers, clip-path angled cuts.
- Keep corners tighter than generic glass panels; prefer narrower radii and angled geometry.
- Keep interaction states visible but restrained — signal-yellow border shifts, not floating glow dispersions.
- Use opaque terminal panels, not translucent backdrop-blur surfaces, as the default elevated container.

## 3. Color Rules

### Required Base Palette

- Signal yellow (primary accent): `#d9ff38`
- Cold cyan (secondary accent): `#06b6d4`
- Violet (tertiary, inherited): `#8b5cf6`
- Fuchsia (tertiary, inherited): `#d946ef`
- Accent pink (tertiary): `#ec4899`
- Amber (semantic warning): `#f59e0b`
- Graphite base: `#0d1117`
- Near-black canvas: `#08051a`
- Fog white (content surface): `#f3f5f7`

### Approved Accent Families

- signal-yellow → chartreuse (primary emphasis, kickers, active states, HUD badges)
- cold-cyan → blue-violet (secondary emphasis, support accents, link states)
- violet → fuchsia (tertiary inheritance, subtle decorative use only — not dominant)

### Color Constraints

- Signal yellow is the primary emotional accent. Violet and fuchsia are inherited support colors, never dominant.
- Main content areas must not use plain solid backgrounds without texture, grid, or structural depth.
- Dense data areas may reduce accent intensity, but still keep the dark graphite base and slab surface treatment.
- Never place dark text on dark surfaces.
- Never use washed-out gray as the dominant emotional tone.
- Never use violet-to-fuchsia gradients as the primary visual emphasis for new pages.

## 4. Surface Rules

### Main Page Background

- Use deep dark backgrounds with structural decoration: fine grid meshes, scan lines, signal-yellow corner glows.
- Background decoration must stay behind content and never reduce readability.
- Avoid large floating glow orbs as primary background treatment; prefer structural grid and controlled corner accents.

### Cards and Panels

- Default elevated surface is a graphite slab:
  - near-opaque dark fill (e.g. `rgba(15, 19, 24, 0.78)` to `rgba(11, 14, 18, 0.92)`)
  - thin structural border (`rgba(255, 255, 255, 0.08)`)
  - no backdrop blur required
  - signal-yellow border on hover for interactive items
- Preferred corner radius:
  - panels/sections: `24px` to `28px`
  - controls/tiles: `18px` to `22px`
  - badges/chips: `14px` to `16px`
- Clip-path angled cuts are allowed for hero stages and terminal-feel containers (e.g. `polygon(0 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 0 100%)`)

### Inner Content Surfaces

- When a panel needs lighter inner content (mission slabs, reading panes, action boards), use fog-white / warm-stone fills wrapped inside the dark terminal shell.
- Never make inner content surfaces appear as standalone white browser pages; they must feel contained within the terminal shell.

### Borders and Shadows

- Borders are thin and near-invisible by default; brighten to signal-yellow on hover for interactive elements.
- Shadows should be minimal and structural, not colored atmospheric glows.
- Hover state should shift border color, not expand glow spread.

## 5. Typography Rules

### Tone

- Headlines should feel bold, structured, and authoritative.
- Body copy should remain clean and readable.
- Avoid marketing-energy or candy-styled text treatments.

### Usage

- Use `nt-kicker` with `//` prefix in signal yellow for section markers and eyebrow labels.
- Use white or near-white for core headings on dark surfaces.
- Use softened white (fog) for supporting text.
- Gradient text (violet → fuchsia) is allowed only as a tertiary decorative treatment for isolated hero phrases — never as the dominant typographic pattern.
- Avoid tiny low-contrast body text.

### Weight and Hierarchy

- Display: very bold (800)
- Section title: bold (700)
- Card title: semibold (600-700)
- Body text: regular (400)
- Kicker / label: medium or semibold, small uppercase, wide tracking

## 6. Motion Rules

All interactive motion must feel controlled, structural, and intentional.

### Required Motion Behaviors

- Border Shift:
  interactive borders should shift to signal-yellow on hover, not glow outward
- Controlled Lift:
  tiles and interactive cards may lift slightly on hover (`translateY(-3px)`)
- Signal Pulse:
  active states and HUD elements may use subtle signal-yellow pulse
- Structural Transition:
  staged reveals for important pages (fill → expand → ready → success)

### Motion Constraints

- Default easing: soft ease-out
- Default duration: around `200ms` to `400ms`
- Avoid bouncy, toy-like, or excessively luminous motion
- Avoid neon dispersion and floating glow expansion as default hover behavior
- Respect reduced motion settings

## 7. Layout Rules

- Use strong spacing and breathing room, but with terminal-like discipline — not expansive marketing hero padding.
- Default page layout paradigm: `HUD resource strip` + `asymmetric hero / content area` + `side rail / action board`.
- Use structured separators, slim labels, numbered markers, and terminal-style section heads to create visual rhythm.
- Use `left rail / directory + right main board` for content pages (announcements, settings, reading panes, editors).
- Use `HUD strip + hero stage + lower mission deck` for dashboard / home pages.
- Use internal scroll containers for long indexes or long body regions, instead of letting the whole page stretch indefinitely.
- In all pages, keep the theme structural but controlled: signal-yellow for hierarchy and emphasis, structural grid for depth, not decorative noise on every surface.

## 8. Accessibility Rules

- All interactive controls must have visible focus treatment (signal-yellow focus ring).
- Text contrast must remain at least AA-compliant in practical use.
- Gradient text must only be used where size and contrast remain readable.
- Decorative grid meshes and scan lines must never block pointer interaction.
- Disabled states must still remain legible.

## 9. Do

- Use graphite slabs over deep dark backgrounds.
- Use signal-yellow as the primary emphasis and active-state indicator.
- Use cold cyan as the secondary support accent.
- Use structural elements: grid meshes, separators, numbered labels, clip-path cuts.
- Use compact HUD strips for resource/status data.
- Use `// kicker` markers for section heads.
- Use opaque terminal panels with thin structural borders.
- Use tighter radii and angled geometry for terminal feel.
- Use restrained, structural hover and focus states.
- Make every page feel like a terminal that exists inside the product world.

## 10. Don't

- Do not use flat white main canvases.
- Do not default to enterprise gray.
- Do not use translucent glass-blur panels as the primary surface treatment.
- Do not use violet-to-fuchsia gradients as the dominant emotional accent.
- Do not use floating glow orbs as primary background decoration.
- Do not stack competing gradient surfaces in one viewport.
- Do not fill data-heavy pages with decorative noise.
- Do not use dark text on dark surfaces.
- Do not make signed-in pages look like generic purple SaaS dashboards.
- Do not make any page feel like a standalone white browser page outside the terminal shell.

## 11. Default Control Inventory

These are the default controls for all future UI work in this repository:

### Buttons
- Primary CTA: `nt-btn nt-btn--primary`
- Secondary CTA: `nt-btn nt-btn--secondary`
- Tertiary CTA: `nt-btn nt-btn--outline`
- Quiet action: `nt-btn nt-btn--glass`

### Panels and Layout
- Standard panel: `nt-card`
- Transparent panel: `nt-panel`
- Section container: `nt-section`
- Section head row: `nt-section__head`
- Top-level page shell: `nt-shell`
- Centered width container: `nt-shell` (replaces `mg-shell`)

### Form Controls
- Text input: `nt-input`
- Textarea: `nt-textarea`
- Select dropdown: `nt-select`
- Form label: `nt-label`
- Form field wrapper: `nt-field`

### Status and Feedback
- Status chip: `nt-badge` (with variants `--signal`, `--cyan`, `--violet`, `--success`, `--warning`, `--danger`)
- System feedback: `nt-alert` (with variants `--info`, `--success`, `--warning`, `--danger`)
- Progress state: `nt-progress`
- Key metric display: `nt-stat`

### Terminal Layout
- HUD resource strip: `nt-hud`
- HUD resource cell: `nt-chip`
- Eyebrow section marker: `nt-kicker`
- Hero layout: `nt-hero`
- Character stage: `nt-stage`
- Side rail container: `nt-rail`
- Rail panel: `nt-rail-card`
- Focus stat grid: `nt-focus-grid`
- Stat grid: `nt-stat-grid`
- Tile grid: `nt-grid`
- Quick entry tile: `nt-tile` (with variants `--signal`, `--cyan`)
- List container: `nt-list`
- List row: `nt-list__row`
- Navigation: `nt-nav`
- Navigation item: `nt-nav__item` (with `--active` state)

### Decorative / Utility
- Separator: `nt-divider`
- Tag pill: `nt-pill`
- Pill list: `nt-pill-list`
- Keyboard shortcut: `nt-kbd`
- Grid layout helpers: `nt-grid--2`, `nt-grid--3`, `nt-grid--4`
- Stack layout: `nt-stack`
- Action row: `nt-actions` / `nt-row`

## 12. Product-Specific Adaptation

All pages in this repository use the same NeuroTerminal visual language:

- **Dashboard and account pages** use the full terminal treatment: HUD strips, hero stages, mission decks, side rails.
- **Landing and login pages** use the industrial access terminal treatment: staged reveal animations, signal-yellow progress strips, dark structural backgrounds.
- **Admin and operator surfaces** use the same terminal language but with tighter spacing and more restrained decoration. Reduce accent intensity, do not switch to a different style.
- **Content and reading pages** use the `left rail + right main board` structure derived from the announcement reference surface.
- **Action and task pages** use the `left tab rail + right action board` structure derived from the benefits center reference surface.
- **Risk, warning, error, and operational states** keep the terminal language but switch to semantic accents (danger red, warning amber) instead of generic red boxes.
- All pages draw from the same `nt-*` component family rather than inventing separate micro-themes.

## 13. Account Home

For `account center`, `user home`, `growth hub`, and other player-facing signed-in surfaces, the default presentation is an industrial terminal / character home.

- Keep the dark graphite base and shared `nt-*` controls.
- Avoid reliance on large equal-weight glass KPI cards.
- Promote a central hero or character stage instead of a top grid of metrics.
- Compress resource data into a narrow HUD strip.
- Move utility actions into a side rail or tool rack.
- Use structural separators, slim labels, and terminal-like modules.
- Use graphite, fog-white, signal yellow, and cold cyan as the main accents.

### Required Account Home Layout

- Top `HUD` resource strip
- Center `character / current-session hero`
- Right `tool rail / action board / profile`
- Lower `missions / quick entries / mailbox / rewards`

### Required Account Home Components

- `nt-shell`
- `nt-hud`
- `nt-chip`
- `nt-hero`
- `nt-stage`
- `nt-focus-grid`
- `nt-section`
- `nt-grid`
- `nt-tile`
- `nt-rail`
- `nt-rail-card`
- `nt-list`
- `nt-nav`
- `nt-stat-grid`

### Account Terminal Overlay Components

For important signed-in notices, the account-terminal shell may add an announcement overlay. When used:

- Keep the trigger inside the account-terminal top bar as a horn / announcement entry, not as a generic browser toast.
- Use a left `announcement list` plus right `detail reading pane` structure.
- Keep the shell dark and industrial, with signal-yellow emphasis and controlled fog-white content areas.
- Let the latest unseen announcement auto-open once for that user, then allow manual re-open from the top-bar trigger.
- Do not replace mailbox or task notifications with the announcement overlay; it is for broadcast-level important information only.

### Announcement-Derived Reference Surface

The current account announcement interface is an approved reference surface for all signed-in pages, dense editors, and structured reading panes.

This means the announcement UI is a reusable visual baseline for:

- account-side detail panes
- operator-side lightweight editors
- left-index + right-content work areas
- rule, update, and configuration reading surfaces

When a new page needs a structured high-density interface, prefer inheriting these traits from the announcement UI before inventing a new panel language:

- a clear `left rail / index / directory` zone and a distinct `main board / reading pane` zone
- one dominant content board instead of many equal-weight floating cards
- dark graphite terminal slabs with signal-yellow micro accents
- restrained cyan or violet as support accents, not dominant emotional color
- clear separators, section heads, labels, and reading rhythm
- internal scroll containers for long indexes or long body regions, instead of letting the whole page stretch indefinitely
- bold title region + unified body region, rather than fragmented mini-cards for every paragraph

Do not regress these surfaces into:

- generic purple glass dashboards
- flat white admin forms
- equal-weight card walls
- native white select menus and other browser-default bright controls
- unbounded long sidebars that become taller as records grow

### Prohibited Account Home Outcomes

- Three oversized resource cards occupying the first screen
- Long explanatory copy above the fold
- Flat enterprise dashboard rhythm
- Every module having the same visual priority
- Cute or noisy decoration that breaks the industrial-terminal tone
- A logged-in dashboard that falls back to a generic purple workbench header instead of continuing the terminal shell

## 14. Login Gate

For `homepage login gate`, `identity entry`, and other pre-auth entry surfaces, use an industrial access terminal treatment consistent with the overall NeuroTerminal design language.

### Required Login Gate Structure

- One dominant access panel as the only interactive focal point
- Dark industrial background with layered geometry, not one monolithic decorative slab
- Signal-yellow edge emphasis as the primary accent
- Panel head that keeps only the platform mark and the product name
- Minimal auxiliary copy above the fold

### Required Login Gate Motion

- Use a short staged reveal, typically `fill -> expand -> ready -> success`
- The left signal-yellow strip should read as an active loader: start from `0`, fill vertically first, expand laterally second, panel reveal last
- The left strip is the only primary progress indicator; do not duplicate the same progress intent at center stage
- The yellow strip's visual fill must be driven by the same progress source used for labels and phase timing; do not fake a partially-filled start state
- Keep the signal strip edge clean; do not leave a decorative bottom triangle or angled cut that reads as a broken artifact
- The panel should complete its reveal by the time the strip settles at roughly one-quarter width
- When a valid session already exists or sign-in returns successfully, let the strip continue from the quarter mark to full-screen before routing onward, without a visible dwell at the quarter-width hold
- A successful sign-in return must resume from the quarter-width `ready` hold instead of replaying the intro fill sequence, and should continue immediately rather than waiting an extra beat
- When a valid session already exists before the page loads, do not re-show the login panel; render a direct handoff animation instead
- The quarter-width to full-screen continuation should use one motion system; do not stack frame-stepped width updates on top of a CSS width transition
- Status copy inside the strip should switch from `signal-yellow / white` on dark background to a dark high-contrast palette once the yellow field expands behind it
- The lower-left status block must always include a visible `UID`; use the provider UID when authenticated and render `-` while unauthenticated
- Motion should visually connect the opening lockup to the panel arrival
- Do not depend on a single opacity toggle for the whole scene
- Respect reduced motion and converge quickly to the ready state

### Prohibited Login Gate Outcomes

- Multi-column explanatory login layouts
- Generic admin or enterprise sign-in cards
- Skip controls that stay visible without a clear need
- Branding stacks that repeat the product name in multiple textual lines inside the panel head
- Multi-line splash wordmarks when the intended opening lockup is a single centered product mark

## 15. Compatibility and Migration

The current codebase uses two legacy CSS class prefix families:

- `mg-*` — the original Modern Gradient base controls (buttons, cards, inputs, badges, alerts, progress, stats, layout)
- `mg-terminal-*` — the terminal-specific layout components (shell, hud, chip, hero, stage, rail, tile, list, nav, etc.)

Going forward:

- **All new UI work** must use the `nt-*` prefix as defined in Section 11.
- **Existing `mg-*` and `mg-terminal-*` classes** remain valid in the current codebase and are not being removed immediately.
- When modifying existing components, prefer migrating to `nt-*` if the scope of changes is significant enough to justify it.
- Do not introduce new `mg-*` or `mg-terminal-*` classes; use the `nt-*` equivalent instead.
- If a frontend runtime is added later, wrap the `nt-*` classes into framework-native components instead of restyling from scratch.
- Prefer extending the existing `nt-*` control family over creating one-off visual patterns.

### Prefix Mapping Reference

| Legacy prefix | NeuroTerminal equivalent |
|---|---|
| `mg-theme` | `nt-shell` (page root) |
| `mg-shell` | `nt-shell` (centered container) |
| `mg-section` | `nt-section` |
| `mg-panel` | `nt-panel` |
| `mg-card` | `nt-card` |
| `mg-btn` | `nt-btn` |
| `mg-input` | `nt-input` |
| `mg-textarea` | `nt-textarea` |
| `mg-select` | `nt-select` |
| `mg-badge` | `nt-badge` |
| `mg-alert` | `nt-alert` |
| `mg-progress` | `nt-progress` |
| `mg-stat` | `nt-stat` |
| `mg-display` | `nt-display` |
| `mg-title` | `nt-title` |
| `mg-subtitle` | `nt-kicker` |
| `mg-gradient-text` | `nt-kicker` (or tertiary decorative only) |
| `mg-copy` | `nt-copy` |
| `mg-divider` | `nt-divider` |
| `mg-pill` | `nt-pill` |
| `mg-kbd` | `nt-kbd` |
| `mg-icon-box` | `nt-icon-box` |
| `mg-orb` | *(removed — no floating glow orbs in NeuroTerminal)* |
| `mg-terminal-shell` | `nt-shell` |
| `mg-terminal-hud` | `nt-hud` |
| `mg-terminal-chip` | `nt-chip` |
| `mg-terminal-kicker` | `nt-kicker` |
| `mg-terminal-hero` | `nt-hero` |
| `mg-terminal-stage` | `nt-stage` |
| `mg-terminal-rail` | `nt-rail` |
| `mg-terminal-rail-card` | `nt-rail-card` |
| `mg-terminal-focus-grid` | `nt-focus-grid` |
| `mg-terminal-focus` | `nt-focus` |
| `mg-terminal-stat-grid` | `nt-stat-grid` |
| `mg-terminal-stat` | `nt-stat` |
| `mg-terminal-section` | `nt-section` |
| `mg-terminal-grid` | `nt-grid` |
| `mg-terminal-tile` | `nt-tile` |
| `mg-terminal-list` | `nt-list` |
| `mg-terminal-nav` | `nt-nav` |
