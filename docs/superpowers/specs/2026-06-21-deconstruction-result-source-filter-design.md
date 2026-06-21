# Deconstruction Result Source Filter Design

**Date:** 2026-06-21

## Goal

Replace the deconstruction result panel's single-choice, hard-coded combination filters with multi-select source chips. Users can select any exact source combination while retaining `전체 (n)` as the default view of every strategy.

## Scope

This change affects only the result filtering UI in `src/pages/deconstruction.astro` and its UI contract tests. It does not change strategy enumeration, source permissions, result ordering, or strategy card content.

## Filter Labels and Source Mapping

| Label | Strategy source type |
| --- | --- |
| `주문서` | `scrolls` |
| `촉진제/추옵` | `stimulant` |
| `보석 (메이커)` | `gems` |
| `레벨업` | `itemLevelUp` |

Only the all-results chip displays a count: `전체 (n)`, where `n` is the complete strategy count. Individual source chips do not display counts.

## Interaction

- The initial state is `전체 (n)`, with every strategy visible.
- Clicking a source chip while `전체` is active deactivates `전체` and selects that source.
- Source chips are independent toggles, so multiple sources can be active simultaneously.
- Clicking `전체 (n)` clears all selected sources and shows every strategy.
- Deselecting the final active source automatically restores `전체 (n)`.
- Existing chip styling remains in use. Every selected source chip receives the existing active appearance.

## Matching Semantics

Filtering uses exact, order-independent set equality between the selected sources and each strategy's `sourceTypes`.

For example, selecting `주문서` and `보석 (메이커)` shows strategies whose source types are exactly `scrolls` and `gems`. It excludes scroll-only strategies and strategies that also include `stimulant` or `itemLevelUp`.

The page uses one exact-match operation for card visibility and visible-result counting so the displayed state cannot disagree with the empty-state decision.

## Empty and Existing Result States

- If an active source combination has no exact matches, keep the chips visible and show `선택한 조합에 해당하는 전략이 없습니다.` in the strategy area.
- Changing the selection immediately hides this message when matches become visible.
- The existing no-analysis-results and result-overflow messages remain unchanged.
- Each new completed analysis resets the result filter to `전체 (n)`.

## Implementation

- Replace the single `activeFilter` string with a `Set` containing selected strategy source types.
- Define the four source chips from a label-to-source mapping.
- Treat an empty selected-source set as the `전체` state.
- Compare the selected set with each card's source types using exact set equality.
- Continue filtering the already-rendered cards by toggling `hidden`; do not rebuild strategy cards on every filter interaction.
- Add a dedicated inline empty-state element for a selected combination with zero matches.

No new shared module is introduced because this state and behavior have a single consumer on the deconstruction page.

## Verification

Extend `tests/deconstruction-ui-contract.test.mjs` to verify:

- the exact five labels and count placement;
- source chips use independent multi-select state;
- matching requires exact, order-independent source-set equality;
- `전체` clears source selections;
- deselecting the final source restores `전체`;
- a zero-match selection displays the filter-specific empty message;
- existing overflow and no-result handling remain intact.

Run the focused UI contract test, then the complete test suite and production build. Browser verification should confirm multi-selection, exact combination matching, active styling, automatic `전체` fallback, and the zero-match message.
