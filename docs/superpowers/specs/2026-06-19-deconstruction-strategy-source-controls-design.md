# Deconstruction Strategy Source Controls

## Goal

Let users choose which enhancement source types the deconstruction analysis may use when finding exact-match strategies. The controls belong in `3. 계산` on `/deconstruction` and affect candidate generation, not the target stats selected by the user.

## User interface

Add a `분석에 사용할 강화 유형` group to the calculation panel with checkbox-style chips for:

- `주문서`, checked by default.
- `촉진제`, unchecked by default.
- `보석`, unchecked by default.
- `레벨업`, unchecked by default and rendered only when level-up data exists for the selected 리버스 or 타임리스 item.

Selecting a different item resets the source controls to these defaults. Editing stats, successful-scroll count, remaining slots, or target conditions preserves the current source selection.

A checked source is allowed, not required. For example, when 주문서 and 보석 are checked, the result may contain a scroll-only strategy, a gem-only strategy when the successful-scroll count is zero, or a combined scroll-and-gem strategy.

## Validation

Disable `분석 시작` while the source selection is invalid and show an inline explanation near the button.

- When no source is selected, show `분석에 사용할 강화 유형을 하나 이상 선택해주세요`.
- When 주문서 is unchecked and the successful-scroll count is greater than zero, show `주문서 성공 횟수가 1회 이상으로 설정되어 있어 주문서를 제외할 수 없습니다. 성공한 주문서가 있는 아이템은 주문서를 사용하지 않은 전략으로 분석할 수 없습니다.`

The second state is impossible because the successful-scroll count is known information about the item. The analysis must not silently ignore that count.

Existing requirements for selecting target conditions remain in effect. The page should resolve the button state and message from all current validation conditions without changing the target deltas.

## Engine API and behavior

Pass an `allowedSources` object from the page to `enumerateStrategies`:

```js
{
  scrolls: true,
  stimulant: false,
  gems: false,
  itemLevelUp: false,
}
```

The engine will:

- Generate scroll states only when 주문서 is allowed.
- Generate gem contributions only when 보석 is allowed.
- Generate item-level contributions only when 레벨업 is allowed.
- Solve stimulant residuals only when 촉진제 is allowed.
- Skip every combination tier containing a disabled source.
- Return only strategies whose `sourceTypes` are a subset of the allowed sources.
- Continue requiring exactly the entered number of successful scrolls when that count is positive.
- Use an empty scroll state when the successful-scroll count is zero, allowing enabled non-scroll sources to form strategies.
- Return no strategies defensively when 주문서 is disabled and the successful-scroll count is positive, even though the page prevents submission in that state.

Enabled sources use the existing complete compatible option pools. The exact target deltas, existing strategy ordering, contribution rules, and canonical deduplication remain unchanged.

For compatibility with existing direct callers, omitting `allowedSources` retains the current engine behavior in which all four source types are allowed.

## Result limit

Replace the current 500-strategy truncation behavior with an overflow boundary of 1,000 displayable strategies.

The engine stops after finding the 1,001st distinct exact-match strategy and returns `{ strategies: [], total: 1001, tooManyResults: true }`. The sentinel total means "more than 1,000," not an exact total. Normal results return `tooManyResults: false`. The page must not render strategy cards or result filter chips in the overflow state. Instead, Step 4 displays:

`일치하는 전략이 1,000개를 초과합니다. 위 패널에서 목표 조건을 더 구체적으로 선택해주세요.`

Exactly 1,000 or fewer matches are returned and displayed normally. The 1,001st match is used only to prove overflow and is not displayed.

## Data flow

1. Item selection establishes which source controls are available and resets their defaults.
2. The user edits the observed item stats and selects fixed target conditions as before.
3. The page validates the source permissions together with the successful-scroll count and target selection.
4. On analysis, the page sends the fixed target, exact successful-scroll count, item data, and `allowedSources` to the engine.
5. The engine enumerates only allowed exact-match strategies until search completion or the 1,001-result overflow boundary.
6. The page renders normal strategies, the existing no-match state, or the overflow guidance state.

## Testing

Engine tests will cover:

- Each disabled source is absent from every returned strategy.
- Enabled sources are permitted but not required.
- Non-scroll and mixed non-scroll strategies are possible when the successful-scroll count is zero.
- A positive successful-scroll count with 주문서 disabled returns no strategies.
- Omitted `allowedSources` preserves existing behavior.
- Exactly 1,000 strategies are returned normally.
- Finding a 1,001st distinct strategy returns `tooManyResults` without exposing result strategies for display.
- Existing exact matching, deduplication, and ordering remain unchanged.

UI contract tests will cover:

- Source labels, hooks, and default checked states.
- 레벨업 is rendered only for eligible 리버스/타임리스 items.
- Source state resets on item selection and persists through edits.
- Both invalid-selection explanations and disabled-button behavior.
- `allowedSources` is passed to the engine.
- Overflow displays the approved guidance and clears cards and filters.

## Scope

This change does not alter enhancement contribution math, target construction, item-level-up data, result-card content, or post-result filter semantics. It adds source permissions to the existing exact-match engine and replaces the existing result truncation behavior with the approved overflow state.
