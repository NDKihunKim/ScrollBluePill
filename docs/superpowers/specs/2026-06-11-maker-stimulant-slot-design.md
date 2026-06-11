# Maker Stimulant Slot Design

## Goal

Add one special Maker material slot for 촉진제 to the left of the existing normal Maker gem slots. The slot lets users simulate Maker stimulant variance by entering a `-5` to `+5` delta for each currently applicable item stat, including `0`.

## Existing Context

The Maker panel already renders three normal gem slots in `src/lib/makerPanel.mjs`, stores Maker state in `src/lib/enhancementState.mjs`, and updates the result card through `computeAccumulatedStats` and `computeGradeColor`. Chaos scrolls in `src/lib/enhancementPanel.mjs` already provide the closest UI pattern: a per-stat stepper limited to `-5..+5`.

## User Experience

When Maker is active, the special slot appears before the three existing gem boxes.

- Empty state: the slot displays `(촉진제)` instead of `(추가)`.
- Click behavior: clicking the empty or filled special slot opens a compact input panel with one row per eligible stat.
- Input range: each stat row supports integer values from `-5` through `+5`.
- Zero values: `0` is valid and is preserved when the user applies the stimulant.
- Filled state: after apply, the slot shows item icon `4130000` and text `촉진제` below it.
- Clearing: the filled slot gets the same `x` affordance as existing filled Maker gem slots.

The ordinary gem slots keep their current behavior, count, duplicate prevention, and `(추가)` empty text.

## Eligible Stats

The stimulant input panel uses the same stat eligibility model as chaos scroll inputs: current accumulated item stats are considered, metadata keys such as `upgradeSlots` and `attackSpeed` are excluded, and only finite positive stat values are listed. This means normal gems and scrolls already applied before opening the stimulant panel can make additional stats eligible.

## State Model

`enhancementState` gains one Maker-side stimulant entry, separate from `gemSlots`.

```js
{
  stimulantSlot: null | {
    stats: Record<string, number>
  }
}
```

The stimulant does not consume scroll upgrade slots and does not participate in normal gem duplicate rules.

State operations:

- Creating enhancement state initializes `stimulantSlot` to `null`.
- Applying the stimulant stores all eligible stat keys with their selected values, including zeros.
- Clearing the stimulant sets `stimulantSlot` back to `null`.
- Resetting or deactivating Maker clears `stimulantSlot` along with normal gems.

## Stat and Grade Computation

`computeAccumulatedStats` adds stimulant stat values after base item stats, scroll stats, and normal gem stats. Negative values can reduce displayed stats. Zero values do not change totals but remain part of the applied stimulant entry so the slot can represent an intentionally applied stimulant.

`computeGradeColor` includes stimulant values in the same accumulated added-constant calculation used for scrolls and gems. HP and MP keep the existing 10:1 weighting.

## UI Structure

`makerPanel.mjs` owns the special slot because it belongs to the Maker section and shares Maker reset/toggle lifecycle. The implementation should reuse small local helpers where practical, but avoid broad refactors of the existing scroll and gem code.

The Maker slot container will render:

1. One special stimulant slot.
2. The existing three normal gem slots.

The stimulant input panel should reuse the visual language of the chaos input panel: stat label, minus button, current value, plus button, and an `적용` button.

## Testing

Add focused tests before implementation:

- Enhancement state initializes, applies, clears, and resets `stimulantSlot`.
- Stimulant stats can include negative, positive, and zero values.
- Accumulated stats include stimulant deltas without consuming scroll slots.
- Grade color includes stimulant deltas.
- Source contract verifies the UI uses `(촉진제)`, item icon `4130000`, and displays `촉진제` for the filled special slot.

## Out of Scope

- Random generation of stimulant values.
- Changing normal gem item data or gem slot counts.
- Allowing stimulant on non-positive or metadata-only stats.
- Persisting Maker state outside the current in-memory calculator session.
