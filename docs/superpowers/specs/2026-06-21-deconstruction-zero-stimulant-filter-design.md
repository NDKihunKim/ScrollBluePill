# Deconstruction Zero Stimulant Filter Design

**Date:** 2026-06-21

## Goal

Add an explicit `+0` option to the deconstruction result panel's `촉진제/추옵` secondary filter. The option represents strategies that do not use a stimulant or additional-option contribution, making the existing no-source filtering behavior visible and directly selectable.

## Root Cause

The strategy engine intentionally omits zero-only stimulant contributions because they do not change the target outcome. Consequently, strategies without a stimulant store `stimulant: null`, and the result filter currently creates no `촉진제/추옵` option for them.

This is a filter-model visibility issue, not a strategy-calculation defect. Generating explicit zero-delta enhancements would duplicate mathematically identical strategies and incorrectly imply that an enhancement was applied.

## Filter Semantics

Introduce one synthetic secondary option:

- Source: `stimulant`
- Stable key: `stimulant:none`
- Label: `+0`
- Meaning: the strategy has `strategy.stimulant === null`

Real stimulant and additional-option outcomes retain their existing canonical stat keys and labels.

The checked-option behavior is:

- All options checked: show strategies with and without 촉진제/추옵.
- Only `+0` checked: show only strategies without 촉진제/추옵.
- `+0` unchecked with one or more nonzero options checked: exclude no-source strategies and show only strategies using selected outcomes.
- Every 촉진제/추옵 option unchecked: use the agreed empty-selection fallback and show only strategies without 촉진제/추옵.

The empty-selection fallback is specific to the `촉진제/추옵` source. Other secondary sources retain their current behavior.

## Ordering and Availability

The `+0` option participates in the existing dynamic facet system.

- Negative-only outcomes sort before `+0`.
- Positive and mixed-stat outcomes sort after `+0` using deterministic existing ordering within their group.
- `+0` remains visible when unavailable because of selections in other facets, moves into the disabled group, and retains its checked state.
- Availability continues to ignore the active facet's own selections so the panel remains recoverable.

## UI and State Lifecycle

Use the existing checkbox markup, styling, focus behavior, and labeling. Do not add a separate control path.

- A new completed analysis initially checks `+0` together with every other secondary option.
- Switching primary tabs preserves its state.
- Clicking `전체 (n)` hides the secondary panel without changing it.
- The visible strategy cards, zero-result message, and `전체 (n)` count use the effective selections, including the empty-selection fallback.
- When all 촉진제/추옵 checkboxes are visibly unchecked, the fallback applies without visually rechecking `+0`.

## Architecture

Keep the change inside the pure result-filter model and its existing controller integration:

1. Normalize `stimulant: null` into the synthetic `stimulant:none` option for filtering purposes.
2. Make stimulant matching treat an empty checked set as allowing only `stimulant:none`.
3. Add deterministic sign-aware ordering metadata for stimulant outcomes so `+0` is placed between negative-only and positive or mixed outcomes.
4. Reuse the existing model, selection, availability, and controller rendering paths.

Do not change strategy enumeration, source contribution solving, strategy cards, or the meaning of `strategy.stimulant`.

## Verification

Add pure model tests proving:

- `stimulant:none` is created only for strategies with `stimulant: null`;
- only `+0` checked returns only no-source strategies;
- an empty stimulant selection returns the same no-source strategies;
- nonzero selections with `+0` unchecked exclude no-source strategies;
- all checked options preserve the complete strategy set;
- negative-only, `+0`, and remaining outcomes are ordered deterministically;
- cross-facet availability can disable and reorder `+0` without changing its saved state.

Add executable controller coverage for checkbox persistence, effective visible count, zero-result recovery, and the new-analysis reset. Run the focused filter tests, full standard suite, Astro production build, and actual-page browser acceptance.
