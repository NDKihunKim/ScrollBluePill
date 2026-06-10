# Center Content Grid with Equal Side Spacing

**Date:** 2026-06-10
**Status:** approved

## Context

The main page uses a two-column grid (`.grid.two`) with `grid-template-columns: 1fr 315px`. The left column (calculator form) stretches to fill all available space in the 1180px container, making it unnecessarily wide and creating visual asymmetry. The right column (item detail aside) is fixed at 315px.

## Goal

Constrain the left panel width and center the two-column block within the container, producing equal empty space on the left and right sides of the content area.

## Design

**Single CSS rule change** in `src/layouts/BaseLayout.astro`:

```css
/* Before */
.grid.two {
  grid-template-columns: 1fr 315px;
}

/* After */
.grid.two {
  grid-template-columns: minmax(0, 550px) 315px;
  justify-content: center;
}
```

### Behavior by viewport

- **Wide (>1180px):** Container capped at 1180px, grid centered inside → equal gutters on both sides
- **Medium (760–1180px):** Container fills viewport, grid centers proportionally
- **Mobile (<760px):** Unchanged — existing media query collapses to single column

### What stays the same

- Container remains `width: min(1180px, 100%); margin: 0 auto;`
- Gap between columns remains 14px
- Right panel remains 315px
- No new CSS classes, variables, or elements are added
- The existing `.ad-slot` class and placeholder are untouched

## Files changed

- `src/layouts/BaseLayout.astro` — one line in the `.grid.two` rule
