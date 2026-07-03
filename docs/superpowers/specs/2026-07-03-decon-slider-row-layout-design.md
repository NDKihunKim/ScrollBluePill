# Deconstruction Page: Regular Scroll Slider Row Layout

**Date:** 2026-07-03
**Status:** approved
**Scope:** CSS-only layout change to the regular scroll slider area in the deconstruction secondary filters panel.

## Context

In the deconstruction page (`src/pages/deconstruction.astro`), the `.decon-secondary-scroll-list` contains rows for each regular scroll option. Each row has a slider area (`.decon-secondary-scroll-slider-wrap`) that currently stacks the count label + range values on top of the dual-range slider (`flex-direction: column`).

The user wants the label/values and slider combined into a single row, vertically centered.

## Target Selector

```
body > main > section:nth-child(2) > div > div >
  section.calculator-panel.result-panel > div >
  div.decon-secondary-filters > div.decon-secondary-scroll-list
```

## Current Structure

```
.decon-secondary-scroll-slider-wrap (flex-direction: column, items centered)
├── .decon-secondary-scroll-slider-header (flex row, full width)
│   ├── .decon-secondary-scroll-count-label  ("주문서 사용 횟수:")
│   ├── .decon-secondary-stimulant-value      (min)
│   ├── .decon-secondary-stimulant-sep        (~)
│   └── .decon-secondary-stimulant-value      (max)
└── .dual-range
    ├── input[type=range]  (min thumb)
    └── input[type=range]  (max thumb)
```

## Design Decisions

- **Approach:** Flex row (Approach 1) — CSS-only, no JS changes, minimal risk.
- **Layout order:** Label + values on the left, slider fills remaining space on the right.
- **Space behavior:** Always single row. Label/values shrink as needed (`flex-shrink: 1`); slider takes remaining space (`flex: 1 1 0`).
- **No responsive breakpoint.** Keep it simple — the existing column layout is replaced entirely.

## CSS Changes

All changes are in `src/pages/deconstruction.astro`.

### 1. `.decon-secondary-scroll-slider-wrap` (line ~4238)

Change from `flex-direction: column` to `flex-direction: row`. Remove `justify-content: center` (no longer needed in row orientation). Add `gap: 6px` for spacing between header and slider. Reduce bottom padding from `10px` to `4px`.

### 2. `.decon-secondary-scroll-slider-header` (line ~4249)

Remove the full-width constraint (`width: calc(100% - 18px)`) and `justify-content: center`. Add shrink behavior: `flex-shrink: 1`, `min-width: 0`, `overflow: hidden`, `white-space: nowrap`. The label+values are all inline elements inside a flex row — they compress naturally when the panel is narrow.

### 3. `.decon-secondary-scroll-slider-wrap .dual-range` (line ~4260)

Remove the negative `margin-top: -4px` (was compensating for column stacking). Add `flex: 1 1 0; min-width: 0` so the slider fills remaining row space.

## Visual Result

```
Before (stacked):                 After (inline row):
┌────────────────────────┐       ┌──────────────────────────────────┐
│ 주문서 사용 횟수: 0~10 │       │ 주문서 사용 횟수: 0~10 ├══●══●══┤
├══════════●════●════════┤       └──────────────────────────────────┘
└────────────────────────┘
```

## Non-Goals

- Does NOT touch chaos scroll slider layout (`.decon-secondary-scroll-chaos-stats`).
- Does NOT touch stimulant panel sliders (`.decon-secondary-stimulant`).
- No JS/DOM changes — the structure in `resultFilterController.mjs` remains identical.

## Files Affected

| File | Change |
|------|--------|
| `src/pages/deconstruction.astro` | 3 CSS rule modifications (lines ~4238, ~4249, ~4260) |

## Testing

- Open the deconstruction page, search for an item, select a regular scroll in the result list.
- Verify the count label and range values appear on the same row as the dual-range slider.
- Verify both slider thumbs are usable and the range text updates on drag.
- Verify vertical centering of text against the slider track.
- Narrow the result panel — verify the label/values shrink and the slider still functions.
