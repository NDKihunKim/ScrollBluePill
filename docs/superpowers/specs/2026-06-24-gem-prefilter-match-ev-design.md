# Gem Pre-Filter — Match Expected-Value Maker Picker Design

**Date**: 2026-06-24
**Scope**: CSS-only change in `src/pages/deconstruction.astro`

## Problem

The gem pre-filter styling diverges from the expected-value page gem picker, which the user prefers.

## Design

Copy the exact `.maker-picker-item` / `.maker-picker-grid` / `.enhancement-section-label` / `.maker-picker-back` CSS patterns from `src/pages/expected-value.astro` into the `.decon-gem-*` classes.

### Specific CSS changes

| Selector | Property changes |
|----------|-----------------|
| `.decon-gem-category` | Match `.maker-picker-item`: `flex-direction: column`, `align-items: center`, `padding: 8px 4px`, `gap: 4px`, `font-size: 0.75rem`, `text-align: center`, `background: var(--surface)`, `transition: border-color 0.15s`, hover: `border-color: var(--green)`. Icon: `28px` |
| `.decon-gem-grade` | Same as `.decon-gem-category` (matches `.maker-picker-item`). Checkbox icon stays `22px`, but card icon `28px` |
| `.decon-gem-grid` | `minmax(80px, 1fr)`, `gap: 8px`, `margin-bottom: 10px` |
| `.decon-gem-picker-label` | Match `.enhancement-section-label`: `font-size: 0.88rem`, `font-weight: 700`, `margin-bottom: 6px` |
| `.decon-gem-back` | Match `.maker-picker-back`: `display: block; margin: 0 auto;` |
| `.decon-source-sub` | Keep `border-left: 0 solid var(--line)` — unchanged |

## Files Changed

- `src/pages/deconstruction.astro` — scoped `<style>` block
