# Deconstruction Success Count and Exact Fallback Search Design

**Date:** 2026-06-19

## Goal

Enhance `/deconstruction` so users can specify the exact number of successful scroll applications on the target item. Enforce valid upgrade-slot accounting, show the successful-scroll count in the item-card name, and expand deconstruction from scroll-only matching to deterministic exact matching across scrolls, stimulant effects, Maker gems, and item-level effects.

The work is split into two independently verified phases:

1. Add the successful-scroll editor and exact scroll-count constraint.
2. Add prioritized, mixed-source exact fallback search.

## Non-goals

- Do not model or identify failed scroll types.
- Do not calculate or display result probabilities.
- Do not require unchecked target stats to match.
- Do not change enhancement rules used elsewhere in the application.

## Phase 1: Successful-scroll editor

### User interface

Add a `주문서 성공 횟수` row directly above `남은 슬롯` in panel 2. It uses the existing `MIN / − / value / + / MAX` stepper layout.

When a clean item is selected:

- Successful scrolls default to `0`.
- Remaining slots default to the clean item's `업그레이드 가능 횟수`.
- The clean item's upgrade-slot value is retained as an immutable maximum for the selected item.

The item-card title displays `아이템 이름 (+N)` when `N > 0`. The suffix is hidden when the successful-scroll count is zero, matching the existing expected-value item-card format.

### Slot invariant

For clean maximum `M`, successful scroll count `S`, and remaining slots `R`:

```text
0 <= S <= M
0 <= R <= M - S
failed attempts = M - S - R
```

Interactions preserve the invariant as follows:

- Increasing `S` automatically reduces `R` by any overflow.
- Decreasing `S` leaves `R` unchanged. The newly available difference represents additional failed attempts.
- Increasing `R` clamps at `M - S`; it never changes `S`.
- Decreasing `R` leaves `S` unchanged.
- Success `MAX` sets `S` to `M` and therefore reduces `R` to `0`.
- Remaining-slot `MAX` sets `R` to `M - S`.

Selecting another item resets the state using that item's clean maximum.

### Analysis constraint

The successful-scroll count is an exact constraint, not display-only metadata. Every returned combination must contain exactly `S` successful scroll applications. Normal scrolls and chaos scrolls each count as one successful application.

Remaining slots are used only for slot accounting. They do not independently control the number of successful scrolls searched. Failed attempts are inferred from the invariant and are not included in the search.

## Phase 2: Prioritized exact fallback search

### Exact matching semantics

The engine receives the checked target keys and their edited deltas. A result is valid when:

- Its scroll list contains exactly the requested successful-scroll count.
- Its total contribution exactly equals every checked target delta.
- Positive, zero, and negative checked deltas are handled correctly.

Unchecked stats do not affect validity. A source may modify an unchecked stat without invalidating a result.

### Contribution sources

Each enhancement system is represented as an independently testable contribution source.

#### Scrolls

- Reuse equipment-kind filtering.
- Include normal and chaos scrolls.
- Generate combinations containing exactly the requested number of successful applications.
- Preserve existing scroll identity and outcome details for result rendering.

#### Stimulant

- Reuse the existing eligible-stat rules.
- Enumerate non-HP/MP contributions from `-5` through `+5`.
- Enumerate HP/MP contributions from `-50` through `+50` using the existing step size.
- Generate only values relevant to the residual checked target to avoid unnecessary combinations.

#### Maker gems

- Derive Maker slot count from the existing required-level rule.
- Enforce weapon-only restrictions and the existing no-duplicate-gem rule.
- Include fixed-stat and random-outcome gems at all valid grades.
- Represent each exact random outcome as a deterministic contribution during deconstruction search; no probability is calculated.

#### Item-level effects

- Use the selected item's existing level-up definition when one exists.
- Consider every applied level-up count from `1` through the item's maximum.
- Enumerate and deduplicate attainable aggregate contribution vectors from the configured per-level ranges.
- Skip this source for items without a level-up definition.

### Mixed-source search

All valid source mixtures remain eligible. For example, a residual delta may be satisfied by stimulant and Maker gem contributions together. The search does not stop when a higher-priority source produces a result.

The engine uses layered residual matching:

1. Generate exact-count scroll contribution states.
2. Check scroll-only exact matches.
3. Compute the checked-stat residual for each scroll state.
4. Match the residual against stimulant, gem, item-level, and mixed contribution states.
5. Prune partial states that cannot reach the residual bounds.
6. Deduplicate equivalent enhancement configurations.

This avoids constructing the full cross-product of every enhancement outcome.

### Result ordering and cap

Results are ordered deterministically:

1. Scroll-only
2. Scroll + stimulant
3. Scroll + Maker gems
4. Scroll + item-level effects
5. Mixed fallback sources, ordered by fewer source types first and then by source priority: stimulant, gems, item-level effects
6. Stable enhancement-detail tie-breaking within the same priority

Search tiers are processed in priority order so the cap cannot allow lower-priority combinations to displace higher-priority results. Equivalent configurations are deduplicated before counting toward the cap. At most 500 results are returned.

## Data flow

The deconstruction page passes the engine:

- Checked target deltas
- Exact successful-scroll count
- Clean item stats and clean upgrade-slot maximum
- Equipment kind and required level
- Available scroll definitions
- Maker gem definitions
- The selected item's level-up definition, if available

The engine returns deterministic strategy records containing:

- Successful scroll applications
- Optional stimulant contribution
- Optional Maker gem choices and exact outcomes
- Optional item-level count and aggregate outcome
- Total checked-stat contribution
- Source-priority metadata for ordering and rendering

Probability fields are removed from the deconstruction engine output and result cards.

## Empty and boundary states

- Analysis remains disabled when no target stat is checked.
- A successful-scroll count of zero is valid. Non-scroll sources may still satisfy the selected deltas.
- If no exact combination exists, the result panel shows a clear no-match message.
- Items without Maker slots or item-level definitions simply omit those sources.
- Slot steppers prevent invalid state rather than displaying a validation error after the fact.

## Verification

Implementation follows test-driven development.

### Slot-state unit tests

- Item-selection defaults
- Success increase reduces remaining slots
- Success decrease preserves remaining slots
- Remaining-slot increase clamps without changing success
- MIN/MAX boundaries
- Failed-attempt inference

### Engine unit tests

- Exact successful-scroll count rejects fewer or more scrolls
- Normal and chaos scroll counting
- Exact checked-stat matching and ignored unchecked stats
- Positive and negative deltas
- Stimulant-only residuals
- Fixed and random Maker gem residuals
- Item-level outcomes for every usable level count
- Mixed fallback sources
- Deterministic priority ordering
- Configuration deduplication
- Deterministic 500-result cap

### UI contract tests

- New row placement and label
- Item-name `(+N)` suffix behavior
- Correct engine inputs
- Probability output removal
- Reset behavior on item changes

### Browser verification

- Stepper interaction and coupled slot behavior
- Live item-card suffix updates
- Item-switch reset behavior
- Representative scroll-only and mixed-source exact results
- No-match state
- Responsive layout regression check

## Success criteria

- Users can set an exact successful-scroll count without creating an invalid slot state.
- Every result uses exactly that many successful scrolls.
- Checked target deltas match exactly, including negative values.
- Scroll-only results remain first, while all valid stimulant, gem, item-level, and mixed combinations remain searchable.
- Results are deterministic, deduplicated, probability-free, and capped at 500.
