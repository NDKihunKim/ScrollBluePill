# Deconstruction Global Secondary Filters Design

**Date:** 2026-06-21

## Goal

Revise deconstruction result filtering so primary source chips navigate one visible secondary filter panel at a time, while persistent secondary exclusions apply globally to every strategy. The visible-strategy count in `전체 (n)` must update with those exclusions.

## Superseded Behavior

The current result filter treats selected primary chips as an exact source-set query. For example, selecting `주문서` restricts results to scroll-only strategies, and selecting multiple primary chips renders all corresponding secondary panels.

This design supersedes those rules. Primary chips no longer determine strategy eligibility or combine as a source-set query.

## Primary Tabs

The primary controls become mutually exclusive navigation tabs:

- `전체 (n)`
- `주문서`
- `촉진제/추옵`
- `보석 (메이커)`
- `레벨업`

Only one tab is active at a time.

- Selecting a source tab shows only that source's secondary option panel.
- Selecting another source tab replaces the visible secondary panel.
- Selecting `전체 (n)` hides the secondary panel.
- Tab selection never changes which strategies match.
- Tab changes never reset secondary checkbox settings.

## Secondary Option Universe and State

Build secondary options from all returned strategies rather than strategies matching an exact primary source set.

Maintain one persistent checked-option set for each source:

- 주문서 options use scroll item IDs.
- 촉진제/추옵 options use canonical exact stat outcomes.
- 보석 options use gem type and grade.
- 레벨업 options use canonical maximum-level aggregate stat outcomes.

All options start checked after each new successful analysis. Checked means allowed; unchecked means excluded.

## Global Exclusion Semantics

A strategy remains visible only when every secondary option it uses is checked.

- If any scroll used by a strategy is unchecked, exclude that strategy.
- If any gem type-and-grade used by a strategy is unchecked, exclude that strategy.
- If its exact stimulant outcome is unchecked, exclude that strategy.
- If its exact level-up total is unchecked, exclude that strategy.
- Exclusions in all four sources apply simultaneously, including panels that are not currently visible.
- A strategy that does not use a particular source is unaffected by exclusions for that source.

Example:

- Strategy A uses 10% and 60% scrolls.
- Strategy B uses 10% and 60% scrolls.
- Strategy C uses 10%, 60%, and 100% scrolls.

Unchecking the 100% scroll excludes Strategy C and leaves A and B visible. Unchecking both 100% and 60% excludes all three strategies because each uses at least one unchecked scroll.

## Visible Count and Empty State

- `전체 (n)` always displays the number of strategies currently visible after every saved secondary exclusion is applied.
- The count and card visibility must derive from the same visible-strategy index set.
- Clicking `전체 (n)` does not bypass or reset exclusions; it hides the secondary panel while continuing to show the globally filtered strategy set.
- When no strategies remain, retain the existing message: `선택한 조합에 해당하는 전략이 없습니다.`
- Analysis-level empty and overflow states remain unchanged.

## Cross-Facet Availability

Preserve dynamic availability across hidden panels.

- Recalculate availability after each secondary checkbox change.
- For the currently visible panel, evaluate each option against selections from the other three sources.
- Options that can participate in at least one otherwise-compatible strategy remain enabled at the top.
- Options made incompatible by exclusions in other sources remain visible at the bottom, disabled, and retain their checked or unchecked state.
- Availability ignores the currently visible source's own selections so an emptied panel remains recoverable.
- Switching tabs recalculates and renders availability for the newly visible panel using all saved exclusions.

Example:

- Strategy A uses a 10% scroll and Gem 1.
- Strategy B uses a 60% scroll and Gem 2.

After Gem 2 is unchecked, switching to 주문서 leaves 10% available and moves 60% to the disabled lower group because every strategy using 60% is excluded by the hidden gem setting.

## State Lifecycle

- A new successful analysis rebuilds the global option model, checks every option, activates `전체 (n)`, and hides the secondary panel.
- Switching primary tabs changes only the visible panel.
- Secondary changes preserve the active tab and every other source's saved settings.
- Selecting `전체 (n)` preserves all settings.
- Existing result-loss confirmation behavior remains responsible for changes in calculation panel inputs and is outside this filter-state refactor.

## Architecture

Refactor the pure result filter model so `buildSecondaryFilterModel` accepts the complete strategy array and includes every strategy and source option. Remove exact primary source-set matching from model construction.

Retain the pure responsibilities already present in `resultFilters.mjs`:

- normalize strategy enhancements into stable option identities;
- create initially checked option sets;
- determine visible strategy indexes from allowed-option sets;
- calculate per-source cross-facet availability;
- return deterministic option ordering.

In `deconstruction.astro`:

- replace the multi-source `selectedResultSources` set with a nullable `activePanelSource`;
- build the model once per completed analysis;
- retain one `selectedSecondaryOptions` map while tabs change;
- render at most one secondary panel;
- use one filter-application path to toggle cards, update `전체 (n)`, update the empty state, and refresh the active panel's availability.

No engine re-enumeration or strategy-card rebuild is required for filter changes.

## Verification

Update pure filter-model tests to verify:

- model construction includes all strategies regardless of source combination;
- mixed strategies remain eligible when a source panel is active;
- an unchecked option excludes every strategy that uses it;
- strategies without that source remain eligible;
- exclusions from multiple sources combine globally;
- hidden-panel exclusions affect visible results and active-panel availability;
- an emptied source remains recoverable;
- option and result ordering stays deterministic.

Update page contract tests to verify:

- primary controls use one `activePanelSource` rather than a selected-source set;
- only the active source panel renders;
- switching tabs preserves `selectedSecondaryOptions`;
- `전체` hides the panel without clearing selections;
- the `전체 (n)` label derives from the filtered visible count;
- a new analysis resets tabs and secondary selections.

Preserve the existing uncommitted confirmation-state regression fix and its tests. Then run focused tests, the full automated suite, a production build, and browser verification covering mixed strategies, hidden exclusions, tab switching, dynamic counts, availability ordering, and zero-result recovery.
