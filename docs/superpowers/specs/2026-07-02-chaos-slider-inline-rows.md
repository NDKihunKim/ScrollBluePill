# Chaos Scroll Card — Inline Slider Rows

**Date:** 2026-07-02
**Status:** Approved

## Problem

Each chaos stat row in the result filter card wraps the label/values in a `header` span with CSS `width: calc(100% - 18px)`. This forces the dual-range slider to wrap onto a second visual line, doubling the vertical height per stat. With 4+ target stats, the chaos card becomes tall and hard to scan.

## Design

### One Row Per Stat

Each stat row contains exactly two elements in a flex row:
1. **Label span** — combined text: stat name + range values (e.g., `공격력 -5~5`)
2. **Dual-range slider** — two `<input type="range">` elements (min/max)

No header wrapper. The existing CSS `.decon-secondary-scroll-chaos-stat-row` (`display: flex; align-items: center; gap: 4px`) handles the inline layout.

### Dynamic Label Updates

As the user drags slider handles, the label text updates to reflect the current range. From `공격력 -5~5` to `공격력 1~4`.

### Default State

Label shows the full observed range from strategies. Slider handles at the extremities.

### Deselected State

Same 35% opacity dimming as before. Sliders disabled. Labels static.

## Files Changed

### `src/lib/deconstruction/resultFilterController.mjs`

- **Remove** the `header` span creation in the chaos stat loop (lines 387-390).
- **Change** the label from stat name only to stat name + range: `` `${statLabelByKey[statKey]} ${curMin}~${curMax}` ``
- **Append** `label` and `dualRange` directly to `rowS` instead of wrapping in `header`.
- **Update** `updateDeltaRange` to refresh the label text on slider input.

### No CSS changes

The existing flex layout on `.decon-secondary-scroll-chaos-stat-row` is sufficient.
