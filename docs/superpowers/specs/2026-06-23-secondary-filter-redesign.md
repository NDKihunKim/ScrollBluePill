# Secondary Result Filter Redesign

**Date:** 2026-06-23
**Design:** Three distinct formats per source type — icon rows, two-level drill-down, stat range sliders

## Problem

The secondary filter panel in deconstruction results uses a uniform format for all
source types: a bordered card with an `<h3>` heading and a scrollable checkbox list
(`max-height: 180px`). This creates three issues:

1. **Heavy frame** — every tab gets the same card treatment regardless of content volume
2. **Dead space** — tabs with few entries (stimulant: ~3 options) have empty scroll containers
3. **No icons** — scroll names and gem grades lack visual identity, making scanning harder

## Goal

Replace the uniform checkbox-list panel with three source-specific formats,
each optimized for its content type. Remove the heavy card frame — options
render inline between the primary filter chips and strategy cards.

## Design

### Layout

The secondary filter area (`.decon-secondary-filters`) remains between the
primary chips and strategy list. It no longer uses CSS grid or card framing.
Each active tab renders its options directly into the container with minimal
chrome — no border, no background panel, no heading.

### 주문서 (Scrolls) — Icon Rows

Vertical list. Each row:

```
[checkbox] [20×20 item icon] [scroll name]
```

- Rows are compact (3px vertical padding)
- Container has `max-height: 160px; overflow-y: auto` for long lists
- Deselected/inapplicable rows render at reduced opacity
- Icons loaded via `buildItemIconUrl(scroll.id)` (existing API)

### 보석 (Gems) — Two-Level Drill-Down

**Level 1: Category grid.** Shows gem types as items in a responsive grid
(`grid-template-columns: repeat(auto-fill, minmax(115px, 1fr))`).
Each item shows a gem icon (`GEM_ITEM_IDS[gemKey].base`) and the gem name.
Clicking a category drills into Level 2.

**Level 2: Grade toggles.** Shows a back button (`← 뒤로`), the selected
gem icon + name, and grade pills. Each pill is a toggleable chip with the
grade-specific icon (`GEM_ITEM_IDS[gemKey].low/mid/high`), grade label
(상급/중급/하급), and checkbox. Deselected pills render at reduced opacity.

State persists across category switches — toggling grades for 힘의 보석 then
navigating back and into 덱스의 보석 does not lose 힘의 보석's selections.

The gem category items are navigation-only (not toggleable themselves).
Only the grade pills in Level 2 carry checkbox state. Grade selections are
stored in the existing `selections` Map under the `'gems'` key, keyed by
`gem:${gemKey}:${gradeIndex}`.

### 촉진제/추옵 (Stimulant) — Stat Range Sliders

Per-stat dual range handles. For each stat key the user has checked:

```
[stat label] [min slider] [min value] – [max value] [max slider]
```

- Range is -5 to +5 for normal stats, -50 to +50 for HP/MP
- Sliders are compact (55px wide, 3px tall)
- Min/Max values update in real time
- Strategies are filtered on the client side: only cards whose stimulant stat
  falls within all per-stat ranges are shown
- A count label updates: "표시 전략: 89개"

## Implementation Notes

### resultFilterController.mjs

The `renderPanel(source)` function branches by source:

- `scrolls` → `renderScrollPanel(container, model, selections)`
- `gems` → `renderGemPanel(container, model, selections)`  
- `stimulant` → `renderStimulantPanel(container, model, selections)`

Each render function manages its own DOM and event listeners. The existing
`setSecondaryOption(source, key, checked)` and `selections` Map continue to
drive the common filtering logic — only the UI rendering changes.

### Stimulant range filtering

`getVisibleStrategyIndexes` is extended to accept an optional
`stimulantRanges` parameter (`Map<statKey, {min, max}>`). When present,
entries whose stimulant stats fall outside any per-stat range are excluded
in addition to the existing checkbox-based filtering. Strategies with
`stimulant: null` (no stimulant in the result) always pass the range check.

When no stimulant ranges are set (default on first load), the range check
is a no-op — all strategies pass.

The range state is stored in the resultFilterController, separate from the
`selections` Map. Changing ranges re-runs `applyFilters()` immediately
(no debounce needed — range input events are already low-frequency).

### Icons

Use existing infrastructure:
- `buildItemIconUrl(id)` for scroll and gem icons
- `GEM_ITEM_IDS[gemKey]` with `base`/`low`/`mid`/`high` keys for gem IDs
- Grade index mapping: 0=하급(low), 1=중급(mid), 2=상급(high)

## Files Changed

| File | Change |
|---|---|
| `src/lib/deconstruction/resultFilterController.mjs` | Source-specific render functions; stimulant range state and filtering |
| `src/lib/deconstruction/resultFilters.mjs` | Export gem category groupings, stimulant stat metadata |
| `src/pages/deconstruction.astro` | New CSS: icon rows, category grid, grade pills, range sliders; remove old card-frame CSS |
| `tests/deconstruction-ui-contract.test.mjs` | Update assertions for new per-source formats |
