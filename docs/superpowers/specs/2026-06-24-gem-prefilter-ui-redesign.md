# Gem Pre-Filter UI Redesign

**Date**: 2026-06-24
**Scope**: CSS-only change in `src/pages/deconstruction.astro` — no JS/HTML changes

## Problem

The gem pre-filter category cards look messy: vertically stacked layout with oversized icons and bold text, constrasting with the cleaner horizontal-row style of the results panel gem filters. The accordion left border uses a hard blue (`#3366ff`) that's visually aggressive.

## Design

### 1. Gem category cards → horizontal rows

Match the results panel `.decon-secondary-gem-category` pattern:

- `flex-direction: row` instead of `column` (icon left of name)
- `align-items: center` instead of stacked
- `padding: 5px 7px` instead of `8px 6px`
- `font-size: 0.72rem` instead of `0.74rem`
- Remove `font-weight: 600` (normal weight)
- `gap: 5px` instead of `3px`
- Icon: `22px` instead of `24px`
- Hover: remove `border-color: var(--green)`, keep only background shift

### 2. Grid sizing

- `grid-template-columns: repeat(auto-fill, minmax(115px, 1fr))` instead of `minmax(80px, ...)`

### 3. Accordion left border

- `.decon-source-sub`: change `border-left: 0 solid #3366ff` to `border-left: 0 solid var(--line)` — affects all source accordions (scrolls, stimulant, gems, level-up)

### 4. Grade view

- `.decon-gem-grade`: already matches the results panel pattern closely. Reduce `font-size` from `0.72rem` to match — no change needed, already correct.

## Files Changed

- `src/pages/deconstruction.astro` — scoped `<style>` block only
