# Deconstruction Gem Pre-Filter

**Date**: 2026-06-24
**Scope**: Gem source accordion sub-options in Section 3 (계산) of the deconstruction page

## Problem

The "보석" (gems) source checkbox currently enables/disables all gems as a group. Users cannot narrow the strategy search to specific gems or grades. The other sources (scrolls, stimulant, itemLevelUp) all have sub-option accordions — gems should too.

## Design

### UX Flow

1. User checks "보석" → accordion opens with **all applicable gems & grades pre-checked**
2. User clicks a gem category → switches to grade view showing 3 grades (하급/중급/상급), all checked
3. User unchecks specific grades → those `gemKey:gradeIndex` combos are excluded from the strategy search
4. Stays on grade view after toggling (no snap-back to categories)
5. "← 뒤로" button returns to category list
6. Re-checking "보석" re-opens the accordion with current filter state preserved

### UI Structure

Two views inside `.decon-source-sub`:

**Category View (default):**
```
.decon-gem-picker-label "보석 종류 선택"
.decon-gem-grid (CSS grid, auto-fill)
  .decon-gem-category × N (clickable cards)
    img (gem base icon from GEM_ITEM_IDS)
    span (gem name)
```

**Grade View (after clicking a gem):**
```
.decon-gem-picker-header
  button.decon-gem-back "← 뒤로"
  img (gem icon)
  span.decon-gem-name (gem name)
.decon-gem-grades
  label.decon-gem-grade × 3
    input[type=checkbox] (checked by default)
    img (grade-specific icon)
    span (grade label + stat value, e.g. "하급 STR +1")
```

### State

```js
let deconGemFilter = null;
// null → all gems available (default, and when source is unchecked)
// Set<string> → whitelist of "gemKey:gradeIndex" entries
```

When the accordion first opens (first enable callback), `deconGemFilter` is initialized as a `Set` containing ALL `"gemKey:gradeIndex"` combos for every applicable gem. Subsequent opens preserve the user's selections.

When "보석" is unchecked, `deconGemFilter` is set to `null`.

### Equipment Kind Filtering

Weapon-only gems (e.g., `darkCrystal`) are hidden from the picker when the selected item is armor, matching the existing `buildGemOutcomeOptions` logic.

### CSS

New classes go in the scoped `<style>` block of `deconstruction.astro`, following the existing result filter gem panel patterns (lines 3242–3348):
- `.decon-gem-grid`: `grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 4px`
- `.decon-gem-category`: flex column card with icon + name, border, rounded corners, cursor pointer, hover state
- `.decon-gem-picker-header`: flex row with back button + icon + name
- `.decon-gem-back`: subtle border button, small text, same as `.decon-secondary-gem-back`
- `.decon-gem-grades`: flex column, gap
- `.decon-gem-grade`: label with checkbox + icon + text, hover state
- `.decon-gem-picker-label`: small muted label matching `.decon-source-sub-label`

The existing `.decon-source-sub` / `.decon-source-sub--open` accordion animation handles the expand/collapse.

### Engine Changes

**`sourceContributions.mjs`:**
- `buildGemOutcomeOptions` gains optional `gemFilter: Set<string> | null` parameter
- After generating each option, if `gemFilter` is non-null, skip options where `!gemFilter.has("gemKey:gradeIndex")`
- `enumerateGemContributions` passes `gemFilter` through to `buildGemOutcomeOptions`

**`engine.mjs`:**
- `enumerateStrategies` accepts optional `gemFilter` parameter
- Passes it through to `enumerateGemContributions`

**`deconstruction.astro`:**
- `runAnalysis` passes `deconGemFilter` to `enumerateStrategies`

### Edge Cases

- **Variable gems** (`darkCrystal`, `blackAmethyst`): Each grade expands to multiple stat outcomes. The filter operates at the grade level — unchecking a grade removes ALL its stat outcomes.
- **Item without gem slots** (level < 48): `gemSlotCount = 0`, no gem contributions are enumerated regardless of filter. The accordion still shows since the source can be enabled for future level-up scenarios.
- **Reset**: Reset button clears `deconGemFilter` to `null`.
- **Item change**: Selecting a new item resets `deconGemFilter` to `null` (consistent with other source sub-options).

## Implementation Notes

- Changes confined to:
  - `src/pages/deconstruction.astro` — HTML template + CSS + JS builder function + data flow
  - `src/lib/deconstruction/sourceContributions.mjs` — filter parameter
  - `src/lib/deconstruction/engine.mjs` — plumb filter through
- Follows the `buildStimulantBoundsEditor` pattern for the builder function
- Follows the result filter gem panel pattern for the UI
- No new files
