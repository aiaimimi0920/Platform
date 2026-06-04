# StyleKit Modern Gradient

This directory contains the local design-system baseline for our future UI work.

It adapts the official StyleKit `modern-gradient` style into project-ready assets:

- `RULES.md`: our design rules and usage constraints
- `theme.css`: reusable tokens, global utilities, and control styles
- `preview.html`: static preview of the imported controls

## Usage

Wrap future pages with a root container using the `mg-theme` class and load `theme.css`.

```html
<link rel="stylesheet" href="./theme.css" />

<main class="mg-theme">
  <section class="mg-section">
    <div class="mg-shell">
      <h1 class="mg-display">
        <span class="mg-gradient-text">Modern</span>
        <span>Gradient</span>
      </h1>

      <div class="mg-actions">
        <button class="mg-btn mg-btn--primary">Get Started</button>
        <button class="mg-btn mg-btn--outline">View Docs</button>
        <button class="mg-btn mg-btn--glass">Explore</button>
      </div>
    </div>
  </section>
</main>
```

## Imported Controls

These controls are now part of the local project design system:

- `mg-btn` with `--primary`, `--secondary`, `--outline`, `--glass`
- `mg-card`
- `mg-input`, `mg-textarea`, `mg-select`
- `mg-badge` with semantic variants
- `mg-alert` with `--info`, `--success`, `--warning`, `--danger`
- `mg-progress`
- `mg-stat`
- `mg-panel`

## Adoption Rule

All future UI work in this repository should use this directory as the default visual baseline unless a later project-specific design system explicitly replaces it.

## Source

This local package is adapted from the official StyleKit Modern Gradient style page and its open-source repository:

- https://www.stylekit.top/zh/styles/modern-gradient
- https://github.com/AnxForever/stylekit
