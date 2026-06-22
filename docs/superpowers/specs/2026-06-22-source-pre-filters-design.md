# Source Pre-Filters Design

> **Goal:** Add secondary pre-filter options under each source checkbox in `분석에 사용할 강화 유형`, shown in an accordion style when the parent source is checked. Pre-filters reduce the strategy space before analysis, complementing the existing result filter chips.

## UI Layout

Restructure `<fieldset class="decon-source-options">` into accordion rows:

```
분석에 사용할 강화 유형
─────────────────────────────
 ☐ 주문서
   └ (checked → ☑100% ☑60% ☑10% ☑Chaos)
 ☐ 촉진제
   └ (checked → per-target-stat min/max steppers, -5/+5 default)
 ☐ 보석 (메이커)
   └ (checked → no sub-options, just enabled)
 ☐ 레벨업
   └ (checked → per-slot stat range editors,
      count matches remaining levels from 아이템 레벨 stepper)
```

- **All source checkboxes deselected by default** (change from current `scrolls: true` default)
- When a source is first enabled, all sub-options are pre-selected/at defaults
- Sub-options slide in/out inline when parent checkbox toggles
- 주문서 rate chips: 100%, 60%, 10%, Chaos — all checked by default when 주문서 enabled
- 촉진제 min/max: per target stat key, default range -5 to +5 (-50/+50 for HP/MP), editable via steppers
- 레벨업 slots: per-remaining-level-up slot stat range editors, one per slot, initialized from item's `levelUpDefinition.statRanges`

## Engine Interface

Three new optional parameters on `enumerateStrategies`:

### scrollRateFilter
- **Type:** `Set<'100'|'60'|'10'|'chaos'> | null`
- **Behavior:** Before enumerating scroll states, filter `scrolls` array to only scrolls whose `nameKo` matches selected rates. Parse rate from name (e.g., "100%", "60%") or detect "chaos"/"혼돈". `null` = no filtering (backward compatible).

### stimulantStatBounds
- **Type:** `Record<string, {min: number, max: number}> | null`
- **Behavior:** Passed to `solveStimulantResidual` to clamp generated stat outcomes per key. Keys not present use default (-5/+5, or -50/+50 for HP/MP). Values outside default range are clamped. `null` = full range.

### levelUpSlotStatRanges
- **Type:** `Array<Record<string, {min: number, max: number}>> | null`
- **Behavior:** One entry per remaining level-up slot. Each entry maps stat keys to restricted min/max. The i-th level iteration in `enumerateItemLevelContributions` uses the i-th entry's ranges. Ranges are clamped to the definition's `statRanges`. Missing stat keys or missing slot entries fall back to the definition's full range. `null` or absent = full ranges for all levels.

## Data Flow

### State variables (deconstruction.astro)

```js
let deconScrollRateFilter = new Set(['100', '60', '10', 'chaos']);
let deconStimulantBounds = {};        // { str: {min:-5, max:5}, ... }
let deconLevelUpSlotRanges = [];      // [{str:{min:0,max:1}, ...}, ...]
```

### Accordion behavior
- Parent checkbox toggle shows/hides sub-options container
- On first enable of 주문서: sub-options initialize all rates checked
- On first enable of 촉진제: sub-options initialize per-target-stat bounds at defaults
- On first enable of 레벨업: sub-options rebuild from item's `statRanges`, with slot count = `maxLevelUps - (deconItemLevel - 1)`
- State persists while source stays enabled; re-checking re-initializes to defaults

### Engine passthrough
- `runAnalysis` collects current pre-filter state
- Only passes filters for enabled sources
- `enumerateStrategies` receives: `scrollRateFilter`, `stimulantStatBounds`, `levelUpSlotStatRanges`
- If a source is disabled, its filter is ignored

### Level-up slot persistence (Option A)
- `deconLevelUpSlotRanges` stores ranges for ALL possible slots (indices 0..maxLevelUps-1)
- Current render shows only slots 0..`remainingLevels-1`
- When remainingLevels changes (via 아이템 레벨 stepper): existing entries keep custom values; new entries initialize from defaults; excess entries are hidden but preserved
- Persistence allows toggling between level values without losing per-slot edits

### Source eligibility
- Sources without level-up definition: .hidden for 레벨업 row (unchanged)
- Sources at max level: no longer hidden (previous fix), but engine excludes itemLevelUp contributions
- Scroll conflict: if `successfulScrollCount > 0`, scrolls cannot be unchecked (existing validation)

### Default source selection change
- `getDefaultSourceSelection()` changed to all `false`
- On item selection: `resetAllowedSources()` sets all checkboxes unchecked
- User must explicitly choose which sources to use
- Validation: analyze button disabled when no sources selected (`NO_SOURCE_MESSAGE`)

### Result filter chips
- Unchanged behavior: filter displayed results by source type
- Only show chips for sources that produced results
- Operate on the already-pre-filtered result set

### Resets
- Item selection / calculator reset: all sub-option state resets to defaults
- `deconLevelUpSlotRanges` cleared on item selection, rebuilt from new item's statRanges

## Tests

### Engine unit tests (`tests/deconstruction-engine.test.mjs`)
- `scrollRateFilter`: "100%" filter excludes "60%"/"10%"/chaos scrolls; empty filter returns no scrolls; null preserves all
- `stimulantStatBounds`: narrowed range excludes out-of-bounds stimulant outcomes; keys not in bounds use defaults; bounds outside [-5,5] are clamped
- `levelUpSlotStatRanges`: per-slot ranges override definition ranges; missing slot falls back to definition; ranges exceeding definition `statRanges` are clamped; correct slot index used per iteration

### UI contract tests (`tests/deconstruction-ui-contract.test.mjs`)
- All source checkboxes deselected by default (no `checked` on `data-decon-source` inputs)
- Accordion sub-options exist in HTML for each source
- `data-decon-scroll-rate` attributes on rate chip inputs
- `data-decon-stimulant-bound-min/max` stepper hooks per target stat
- `data-decon-level-slot` container with per-stat range inputs
- `runAnalysis` passes `scrollRateFilter`, `stimulantStatBounds`, `levelUpSlotStatRanges`
- Rate chip toggling, stimulant stepper events, level-up slot edit events
- Source validation: all-deselected state shows `NO_SOURCE_MESSAGE`, button disabled

## Files Changed
- `src/pages/deconstruction.astro` — HTML accordion layout, CSS, JS state/wiring/events
- `src/lib/deconstruction/engine.mjs` — new parameters on `enumerateStrategies`, scroll name parsing
- `src/lib/deconstruction/sourceContributions.mjs` — `enumerateItemLevelContributions` per-slot ranges, `solveStimulantResidual` bounds clamping
- `src/lib/deconstruction/sourcePolicy.mjs` — `getDefaultSourceSelection` defaults change
- `tests/deconstruction-engine.test.mjs` — engine unit tests
- `tests/deconstruction-ui-contract.test.mjs` — UI contract tests
