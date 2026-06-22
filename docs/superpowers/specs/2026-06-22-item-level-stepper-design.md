# Deconstruction Item Level Stepper Design

> **Goal:** Add an item level stepper for Reverse/Timeless items on the deconstruction page so users can specify how many levels remain and get accurate stat delta results.

## UI & HTML

New stepper row added directly after the existing `.decon-slot-row` (남은 슬롯) row:

```html
<div class="chaos-stat-row decon-level-row" data-decon-level-row hidden>
  <span class="chaos-stat-label">아이템 레벨</span>
  <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-level-min>MIN</button>
  <button type="button" class="chaos-stepper-btn" data-decon-level-dec>−</button>
  <span class="chaos-stepper-value" data-decon-level-value>1</span>
  <button type="button" class="chaos-stepper-btn" data-decon-level-inc>+</button>
  <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-level-max>MAX</button>
</div>
```

- **Hidden by default** — shown only when the selected item has a level-up definition (Reverse/Timeless, identified by `itemLevelUpByItemId.has(item.id)`)
- **Default value:** 1 (all level-ups remaining)
- **Min:** 1, **Max:** `maxLevelUps` from the item's level-up definition (5 for all current data)
- **Step:** 1
- **Resets to 1** on item selection
- **Visibility toggles** as items are selected and cleared

## CSS

Single new rule matching the existing `.decon-slot-row` vertical rhythm:

```css
.decon-level-row {
  margin-bottom: 10px;
}
```

No additional global styles needed — `.chaos-stat-row`, `.chaos-stat-label`, `.chaos-stepper-btn`, and `.chaos-stepper-value` already provide layout and sizing.

## Data Flow

### New state variable

`deconItemLevel` (number, default 1) — the user-set current level of the item.

### Item selection flow

1. User selects an item → `selectedItem` is set
2. If `itemLevelUpByItemId.has(selectedItem.id)`:
   - Show `[data-decon-level-row]`
   - Set min=1, max=`maxLevelUps`, value=1
   - `deconItemLevel = 1`
3. If no level-up definition:
   - Hide `[data-decon-level-row]`
   - `deconItemLevel = null`

### ITEM LEV / EXP card display

Instead of always passing `{ itemLevelUpSlots: [] }` to `computeItemLevelUpCardMeta`, construct a virtual slot array:

```
alreadyApplied = deconItemLevel - 1
virtual slots = array of length maxLevelUps, first alreadyApplied filled
→ computeItemLevelUpCardMeta({ itemLevelUpSlots: virtual }, definition)
→ ITEM LEV shows next level (or "MAX"), ITEM EXP shows progress
```

### Engine: enumerateItemLevelContributions

Add `alreadyAppliedLevels` parameter (default 0 — backward compatible):

```
remainingLevels = maxLevelUps - alreadyAppliedLevels
if remainingLevels <= 0 → return []
generate combos only for levelCount 1..remainingLevels
```

The `enumerateStrategies` signature gains `alreadyAppliedLevels` (optional, defaults to 0). The deconstruction page passes `deconItemLevel - 1`.

### Level-up source eligibility

- `deconItemLevel < maxLevelUps` → source is eligible (levels remain)
- `deconItemLevel >= maxLevelUps` → source unavailable (already max)

### Guarded mutation

Level changes after results are shown trigger the existing confirmation dialog (`guardDeconMutation`), matching slot count change behavior.

## Testing

### Engine unit test (`tests/deconstruction-engine.test.mjs`)

- `enumerateItemLevelContributions` with `alreadyAppliedLevels = 0` produces same results as current behavior (regression)
- `alreadyAppliedLevels = 3, maxLevelUps = 5` → only 2 levels of combos, `levelCount` shows 1..2
- `alreadyAppliedLevels = 5, maxLevelUps = 5` → empty array (no levels remaining)

### UI contract test (`tests/deconstruction-ui-contract.test.mjs`)

- Level row hidden when selected item lacks level-up definition
- Level row visible for items with level-up definition
- Stepper controls (min/max/dec/inc) are wired via data attributes
- `runAnalysis` passes `alreadyAppliedLevels` derived from `deconItemLevel`
- Level-up source hidden when `deconItemLevel >= maxLevelUps`

### Template test

- `data-decon-level-row` and `data-decon-level-value` exist in page source

## Files Changed

- `src/pages/deconstruction.astro` — HTML, JS, CSS for the stepper
- `src/lib/deconstruction/sourceContributions.mjs` — `enumerateItemLevelContributions` parameter
- `src/lib/deconstruction/engine.mjs` — `enumerateStrategies` parameter passthrough
- `tests/deconstruction-engine.test.mjs` — engine unit tests
- `tests/deconstruction-ui-contract.test.mjs` — UI contract tests

## Also Included

- The CSS fix for `:global(.selected-item-line--item-level)` from the paused task (color `#c28b39`) since it's adjacent to the ITEM LEV/EXP card display changes
