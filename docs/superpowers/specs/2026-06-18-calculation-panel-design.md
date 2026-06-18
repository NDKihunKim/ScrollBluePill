# Split Calculation Panel from Results Panel

**Date:** 2026-06-18
**Status:** design

## Summary

Insert a new `3. 계산` panel between the existing `2. 아이템 강화` and `3. 결과` panels. The new panel hosts the EV target-selection UI (stat checkboxes, trial count, 계산 시작 button). The results panel is renumbered to `4. 결과` and contains only result display and stale label. The 기대값 계산 button is removed from the right sidebar.

## Layout

### Before
```
LEFT STACK                     RIGHT SIDEBAR
1. 아이템 검색                Item Card
2. 아이템 강화                기대값 계산 button
3. 결과                       초기화 button
   ├─ target selection UI
   └─ result display
```

### After
```
LEFT STACK                     RIGHT SIDEBAR
1. 아이템 검색                Item Card
2. 아이템 강화                초기화 button
3. 계산   ← NEW
   └─ target selection UI
4. 결과   ← was 3. 결과
   └─ result display
```

## Panel 3: 계산

### Data attributes
- `data-calc-panel` — panel container
- `data-calc-placeholder` — pre-item placeholder element
- `data-calc-content` — target selection container (hidden until item selected)

### States

| State | Trigger | Behavior |
|-------|---------|----------|
| Pre-item | No item selected | Placeholder: "강화 목표를 설정한 뒤 계산이 가능합니다." |
| Active | Item selected (via activatePanel2) | Target selection UI rendered into `data-calc-content`. 계산 시작 button enabled/disabled by probability-element detection. |
| Post-calc | User clicks 계산 시작 | Panel 3 stays unchanged. Results flow into panel 4. |

### 계산 시작 button enable logic
Same as current `updateEvButtonState()`: enabled when at least one probability-based element exists (non-100% scroll, chaos scroll, probability-mode gem, probability-mode stimulant, probability-mode item level-up).

### Cancel button
Removed. The target-selection UI is the panel's persistent state while an item is active. No need to dismiss it.

## Panel 4: 결과

### Data attributes
Keep existing: `data-result-panel`, `data-result-placeholder`, `data-result-content`

### Placeholder text
Change from "강화 목표를 설정한 뒤 기대값 계산을 눌러주세요." to "계산 결과가 여기에 표시됩니다."

### Behavior
- `showEvPlaceholder()`: resets this panel to placeholder, clears evResultUI/evResultSummary
- `runEvCalculation()`: creates/reuses evResultUI and renders into `data-result-content`
- Stale label: appears here when enhancement settings change while results exist
- `__evClear`: unchanged, points to showEvPlaceholder

## Right Sidebar

- Remove `<button class="ev-calc-button" data-ev-calc-trigger>기대값 계산</button>`
- Keep `<button data-enhancement-reset>초기화</button>`

## JavaScript changes (index.astro)

### New elements to query
```js
const calcPanel = document.querySelector('[data-calc-panel]');
const calcPlaceholder = calcPanel?.querySelector('[data-calc-placeholder]');
const calcContent = calcPanel?.querySelector('[data-calc-content]');
```

### New function: `showCalcPlaceholder()`
Hides calcContent, shows calcPlaceholder. Called when no item is selected.

### Modified function: `openEvTargetSelection()`
Renders target selection UI into `calcContent` instead of `resultContent`. Triggered when item is selected (from `activatePanel2`), not from a button click.

### Removed: evTrigger click handler
The 기대값 계산 button in the sidebar goes away. Instead, target selection is always visible when an item is selected.

### Removed: `updateEvButtonState()` on the old evTrigger
Replaced by updating the 계산 시작 button's disabled state directly within the target selection UI or via a targeted query.

### Modified: `runEvCalculation()`
Still renders results into `resultContent` (panel 4). No change to result rendering.

### Unchanged
- `__evState()` — still exposes enhancement state
- `__evRefresh()` — still calls updateEvButtonState + showStale
- `__evClear` — still calls showEvPlaceholder
- Mutation guard — still guards enhancement mutations
- `createResultMutationGuard` — unchanged

## CSS changes

- New panel styles: `.calculator-panel.calc-panel` matching `.calculator-panel.result-panel` conventions
- Remove `.ev-calc-button` styles (no longer needed)
- Ensure panel 3 target selection content has proper spacing

## Panel activation flow

1. User selects item → `selectSuggestedItem()` → `activatePanel2(item)`
2. `activatePanel2` now additionally calls a function to activate panel 3 (render target selection)
3. User configures targets, clicks 계산 시작 → results appear in panel 4
4. User can tweak targets in panel 3 and re-click 계산 시작 → panel 4 updates

## Edge cases

- **Item change while results exist**: mutation guard fires (enhancement state resets when new item selected → triggers the enhancement reset path which calls `__evClear`)
- **Reset**: clears both panel 3 (re-renders target selection for current item) and panel 4 (placeholder)
- **Maker/level-up toggle with results**: mutation guard shows confirmation dialog. If confirmed, results cleared from panel 4; panel 3 target selection remains visible.
- **No probability elements**: 계산 시작 is disabled; target selection UI is still visible but inoperable.
- **Stale gains in target selection**: The target-selection checkboxes are rendered with gains computed at activation time. If enhancement settings later change (e.g., applying a scroll that adds new stat gains), the checkbox list will not update until the user re-runs the calculation or selects a new item. The actual calculation always uses current state. This is a pre-existing limitation and is not addressed in this change.
