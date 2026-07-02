# Chaos Scroll Card Redesign — Spec

**Date:** 2026-07-02
**Status:** Approved

## Problem

The chaos scroll card (4th row in `.decon-secondary-scroll-list` within the result filter panel) has a misleading stat subtitle ("변화 없음") because chaos scroll base stats are all zero. The per-stat delta sliders appear only when strategies exist with varied deltas, and their layout is inconsistent with the user's expectations.

## Design

### Left Side: Icon + Name (No Subtitle)

- Show the chaos scroll icon (id `2049100`) and the name "혼돈의 주문서" stripped of the equipment prefix (existing `simplifyScrollDisplayName`).
- **No stat subtitle.** Chaos scrolls have random deltas with no fixed stat values.
- The text block switches from two-line (`flex-direction: column` with name + stat) to a single vertically-centered line aligned with the icon.

### Right Side: Per-Stat Delta Range Sliders (Vertical Stack)

- One row per **target-relevant stat** (stats the user checked in the editor, i.e. `targetKeys`).
- Each row contains: **stat label** (e.g. "공격력", "STR") + **min value** + **~ separator** + **max value** + **dual-range slider**.
- Ranges reflect **actual deltas observed across computed strategies**, not the theoretical ±5 chaos bound.
- **No strategies loaded:** Right side is empty. Card shows only icon + name.
- **All strategies share the same delta for a stat:** Both slider handles sit at the same position. Readout shows e.g. "2~2".

### Behavior: Filter Mode

- Sliders are **interactive controls**. Dragging the min/max handles filters the strategy list — strategies whose chaos scroll delta for that stat falls outside the selected range are hidden.
- Default: both handles at the extremities of the observed range (no filtering).
- **Card deselected** (chaos scrolls toggled off): All sliders dim to 35% opacity. All chaos-containing strategies are filtered out.
- **Card selected** (chaos scrolls toggled on): Sliders return to full opacity. Only strategies within the selected delta ranges remain visible.

### Interaction

- Clicking the card toggles chaos scrolls on/off (existing toggle behavior).
- Clicks on sliders and their containers are stopped from propagating (`e.stopPropagation()`) to prevent accidental toggling while adjusting ranges — existing behavior, preserved.

## Files Changed

### `src/pages/deconstruction.astro` (CSS only)

- `.decon-secondary-scroll-text`: When inside a chaos card, switch to single-line vertical center instead of two-line column.
- `.decon-secondary-scroll-info`: Ensure `align-items: center` for vertical centering with single-line text.
- `.decon-secondary-scroll-chaos-stat-row`: Refine spacing/gap to match the new vertical stack layout.
- `.decon-secondary-scroll-chaos-stats`: Keep existing `flex-direction: column` for vertical stacking.

### `src/lib/deconstruction/resultFilterController.mjs` (JS only)

- **`renderScrollPanel()` chaos branch (lines ~311-394):**
  - Remove stat subtitle generation (the `statLine` element for chaos scrolls).
  - Restrict stat rows to `targetKeys` — pass `targetKeys` through to the chaos stat rendering loop (line 326).
  - Keep existing dual-range slider plumbing (`chaosDeltaRanges`, `applyFilters`).

## No New Patterns

Reuses 100% existing CSS classes and JS patterns:
- `.decon-secondary-scroll-chaos-stats` — vertical flex column (exists)
- `.decon-secondary-scroll-chaos-stat-row` — one row per stat (exists)
- `.dual-range` — dual-range slider wrapper (exists)
- `chaosDeltaRanges` — filter state map (exists)
- `chaosStatRanges` — observed delta ranges from model (exists)
