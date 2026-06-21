# Deconstruction Secondary Result Filters Design

**Date:** 2026-06-21

## Goal

Extend the deconstruction result panel's existing exact source-type filters with reactive secondary filters for the concrete enhancements used by matching strategies. Also require deconstruction item-level-up contributions to represent totals after the selected item's maximum possible level-ups.

## Existing Behavior

The result panel already supports the primary source chips `전체 (n)`, `주문서`, `촉진제/추옵`, `보석 (메이커)`, and `레벨업`. Non-`전체` chips are independent toggles, and strategies match only when their source types exactly equal the selected source set.

This design preserves that behavior and adds secondary facets beneath the primary chips.

## Primary and Secondary Filter Flow

- `전체 (n)` shows all strategies, hides secondary filters, and clears secondary state.
- Selecting one or more primary source chips defines an exact source-type combination.
- Only strategies matching that exact combination form the secondary-filter universe.
- Show one secondary section for every selected source type.
- All secondary options start checked whenever the primary combination changes.
- Secondary checkbox changes update visible strategy cards immediately without rerunning strategy enumeration.

## Secondary Option Identity

Each source type uses a stable normalized option key:

| Source | Option identity | Display |
| --- | --- | --- |
| 주문서 | Scroll item ID | Korean scroll name |
| 촉진제/추옵 | Canonical exact stat vector | Formatted nonzero total stats |
| 보석 (메이커) | Gem key and grade index | Gem name and grade |
| 레벨업 | Canonical maximum-level total stat vector | Maximum level-up count and formatted total stats |

Identical options are deduplicated across strategies. Gem outcomes with the same gem type and grade share one option even when their exact rolled stats differ.

## Strategy Matching

Secondary filters use an allowed-enhancement exclusion model:

- A strategy remains visible only when every enhancement it uses is checked in its corresponding secondary section.
- If a strategy uses multiple scrolls or gems, one unchecked option excludes the entire strategy.
- Selected secondary sections combine with AND semantics.
- Users may uncheck every option in a section, producing zero visible strategies.
- Zero matches show the existing filter-specific message: `선택한 조합에 해당하는 전략이 없습니다.`

## Faceted Availability

Secondary lists react to one another:

- Recalculate option availability after every secondary checkbox change.
- An option is available when toggling or retaining it can participate in at least one strategy compatible with the other current secondary selections and the strategy's remaining enhancements.
- Available options appear first.
- Unavailable options remain visible at the bottom, are disabled, and retain their checked or unchecked state.
- Availability calculation must leave the actively edited section recoverable after every option is unchecked; users must be able to recheck an option and restore results.
- Within the available and unavailable groups, ordering is deterministic:
  - scrolls by Korean name, then item ID;
  - gems by Korean name, then grade;
  - stimulant and level-up outcomes by their formatted stat labels.

## Secondary Filter UI

- Render secondary sections directly beneath the primary source chips.
- Use a compact section per selected source, with a vertically scrollable checkbox list.
- Multiple selected primary sources display their sections simultaneously.
- Checked options are visually consistent with existing checkbox controls.
- Disabled unavailable options remain legible and retain their position in the lower availability group.
- Primary changes rebuild all secondary sections from the new exact-match universe and preselect every option.

## Maximum Item-Level-Up Rule

Item-level-up deconstruction strategies must always assume the selected item has completed all available level-ups:

- Read `maxLevelUps` and `statRanges` from the selected item's own level-up definition.
- Accumulate possible stat deltas through exactly `maxLevelUps` rolls.
- Return only aggregate outcomes at `levelCount === maxLevelUps`.
- Do not expose or combine partial outcomes from levels `1` through `maxLevelUps - 1`.
- Deduplicate identical aggregate stat totals deterministically.
- Items without a valid positive `maxLevelUps` continue to produce no item-level-up contributions.

This rule changes strategy enumeration globally for deconstruction and therefore affects both result generation and the 레벨업 secondary options.

## Architecture

Create a focused pure result-filter module under `src/lib/deconstruction/` responsible for:

- normalizing enhancement option keys and labels from strategy objects;
- building the secondary option universe for an exact primary source selection;
- evaluating strategy visibility from checked option sets;
- calculating faceted availability without mutating checkbox selections;
- returning deterministic option ordering.

`src/pages/deconstruction.astro` remains responsible for storing the current returned strategies, rendering primary and secondary controls, wiring checkbox events, toggling strategy-card visibility, and rendering the zero-match state.

Keep maximum-level enumeration in `sourceContributions.mjs`, where item-level contribution generation already lives. The strategy engine consumes its revised output without a new filtering input or a browser-to-engine round trip.

## State Reset and Existing Result States

- A new successful analysis resets the primary filter to `전체 (n)` and clears secondary state.
- Selecting `전체 (n)` clears and hides all secondary controls.
- Changing the primary source combination rebuilds and preselects the relevant secondary options.
- Analysis overflow and analysis-level zero results keep their existing messages and do not render secondary controls.
- Secondary filtering never changes the total strategy count shown by `전체 (n)`.

## Verification

Add pure unit coverage for:

- scroll identity and exclusion, including multi-scroll strategies;
- gem grouping by type and grade;
- canonical exact stimulant and maximum-level stat outcomes;
- AND matching within and across secondary sections;
- dynamic availability, unavailable ordering, disabled-state inputs, and selection retention;
- recovery after every option in one section is unchecked;
- deterministic output regardless of strategy order.

Update item-level contribution tests to prove:

- only `maxLevelUps` totals are returned;
- partial totals are absent;
- different item definitions produce their own maximum counts and total ranges;
- duplicate maximum-level totals are deduplicated.

Extend page contract tests for secondary containers, selected-source section rendering, checkbox event wiring, immediate filter application, primary reset behavior, and filter-empty handling.

Finally, run all focused tests, the complete test suite, a production build, and browser verification covering multi-source facets, disabled unavailable options, zero-result recovery, and item-specific maximum-level outcomes.
