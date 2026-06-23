# Item Level-Up as Base Layer in Strategy Enumeration

**Date:** 2026-06-23
**Design:** Approach B — itemLevelUp resolved first, other sources fill remainder

## Problem

When `itemLevelUp` is enabled as an allowed source, the strategy engine generates
results across 8 combinatorial tiers. Tiers 0, 1, 2, and 4 produce strategies
that do NOT include itemLevelUp at all — the target delta is satisfied entirely
by scrolls, stimulant, and/or gems. These strategies appear in results even when
the user has explicitly opted into 레벨업.

Additionally, the result view renders a "레벨업" primary filter chip so users
can hide non-itemLevelUp strategies — a workaround the underlying problem
necessitates.

## Goal

When `itemLevelUp` is enabled, **every returned strategy must include itemLevelUp**.
The redundant "레벨업" primary filter chip is removed from the result view.

## Design

### Engine: Restructure the enumeration loop

**Current flow (8 tiers per scroll state):**
```
for each scrollState:
    residual = target - scrollState
    tier 0: scroll only            (no itemLevelUp)
    tier 1: scroll + stim          (no itemLevelUp)
    tier 2: scroll + gems          (no itemLevelUp)
    tier 3: scroll + itemLevelUp
    tier 4: scroll + stim + gems   (no itemLevelUp)
    tier 5: scroll + stim + itemLevelUp
    tier 6: scroll + gems + itemLevelUp
    tier 7: all four sources
```

**New flow when itemLevelUp is enabled:**
```
for each levelUpContribution:                     ← outer loop
    remainingTarget = target - levelUp.stats
    for each scrollState (within remainingTarget):
        residual = remainingTarget - scrollState
        tier A: scroll only       (fills remaining exactly)
        tier B: scroll + stim
        tier C: scroll + gems
        tier D: scroll + stim + gems
```

When `itemLevelUp` is **disabled**, the existing 8-tier code is untouched.

### Correction bounds

`itemLevelContributions` are excluded from `correctionBounds` for scroll pruning
when itemLevelUp is enabled, since level-up is resolved outside the scroll loop.

### Scroll-only strategies (normCount = 0)

When `successfulScrollCount` is 0 and itemLevelUp is enabled, the inner scroll
loop uses the zero-scroll state (`{ scrolls: [], stats: {} }`). Stims and gems
fill the remaining target after level-up. All strategies still carry a levelUp
contribution.

### Result filter chips

In `displayResults()`, the primary filter chip list currently renders chips
for `scrolls`, `stimulant`, `gems`, and `itemLevelUp`. Remove the `itemLevelUp`
chip entry. When itemLevelUp is enabled, every strategy has it so the filter
is redundant; when disabled, no strategy has it so the filter would be empty.
The remaining chips (`전체`, `주문서`, `촉진제/추옵`, `보석`) are unchanged.

The secondary filter panel for itemLevelUp (sub-options within the 레벨업 chip)
is removed as a consequence — `buildSecondaryFilterModel` no longer receives
an `itemLevelUp` facet.

### Priority ranks

When itemLevelUp is enabled, ranks are assigned from the inner-tier base values
(0=scroll-only, 1=scroll+stim, 2=scroll+gems, 4=scroll+stim+gems). The outer
levelUp loop does not add further rank bands — all results carry the same
intrinsic "includes itemLevelUp" property, so there is no need to distinguish
them by rank. The existing `priorityRank` values 0–1–2–4 are reused directly.

## Files changed

| File | Changes |
|---|---|
| `src/lib/deconstruction/engine.mjs` | Branch on `itemLevelUp` enabled: outer levelUp loop, inner scroll+stim+gem tiers. Disabled path unchanged. |
| `src/pages/deconstruction.astro` | Remove `itemLevelUp` filter chip from `displayResults()` |
| `tests/deconstruction-engine.test.mjs` | Tests for itemLevelUp-in-all-strategies; test that disabled path preserves existing tiers |
| `tests/deconstruction-ui-contract.test.mjs` | Update filter chip assertions |
