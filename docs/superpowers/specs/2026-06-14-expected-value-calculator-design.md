# Expected Value Calculator Design

**Date:** 2026-06-14  
**Status:** Approved for spec review  
**Scope:** Add a client-side calculator that estimates the probability of creating the currently configured enhanced item, or better, from a clean base item.

## Goal

Add an expectation/probability feature for the existing item enhancement workflow.

The user first builds a target item in the current UI. That preview is treated as the desired result, not the starting item. When the user clicks `기대값 계산`, the app opens a target-selection flow and then calculates:

> Starting from a clean base item, what is the best supported probability of obtaining this target item or better?

The first version optimizes for success probability only. It does not optimize for mesos, resource cost, or market value.

## Non-Goals

- Do not add backend calculation services.
- Do not persist result state in URL, localStorage, or Supabase.
- Do not model clean-item natural stat variance; use the selected base item data as fixed.
- Do not include meso cost, scroll prices, clean item prices, or cost efficiency.
- Do not expose strategy pruning controls.
- Do not expose Monte Carlo seed controls in the normal UI.
- Do not support custom target thresholds beyond the current preview-derived target.
- Do not include remaining upgrade slots as a target condition in v1.

## User Flow

Add a `기대값 계산` button above the existing `초기화` button in the right-side item panel.

Button state:

- visible whenever an item is selected
- disabled until at least one enhancement has been applied
- enabled when the preview has at least one selectable target condition, including advanced stats or grade

Add a separate `3. 결과` panel below the existing `2. 아이템 강화` panel.

Initial panel placeholder:

```text
강화 목표를 설정한 뒤 기대값 계산을 눌러주세요.
```

Clicking `기대값 계산` opens target selection inside `3. 결과`. The user confirms target conditions and trial count, then clicks `계산 시작`.

If the user presses `취소` before calculation starts, return the panel to the placeholder state.

After calculation completes:

- collapse target controls into a concise summary
- show result metrics and chart
- keep `Best found method` collapsed by default
- no `수정` button is needed; clicking `기대값 계산` again restarts the target-selection flow

## Target Conditions

Stat targets compare **enhancement gain over the clean base item**, not raw final stat value.

Example:

```text
Clean STR: 5
Preview STR: 10
Target: STR gain >= +5
```

The clean item alone does not satisfy that target because its enhancement gain is `0`.

Core target stats:

- `weaponAttack` / 공격력
- `magicAttack` / 마력
- `str` / STR
- `dex` / DEX
- `int` / INT
- `luk` / LUK

Advanced target stats:

- `maxHp` / HP
- `maxMp` / MP
- `weaponDefense` / 물리방어력
- `magicDefense` / 마법방어력
- `accuracy` / 명중률
- `avoidability` / 회피율
- `speed` / 이동속도
- `jump` / 점프력
- grade / 등급

Excluded from target stat checklist:

- `upgradeSlots`
- `attackSpeed`

Default selections:

- core stats are checked only when the preview has positive enhancement gain for that stat
- HP/MP and other advanced stats are unchecked by default
- grade is unchecked by default
- stats with no positive preview gain are disabled or unavailable for selection

If a stat target is checked, the simulated final item must have that stat present with enhancement gain greater than or equal to the preview gain. If a stat is absent because it reached `<= 0`, it fails checked-stat comparison.

Unchecked stats are ignored. Extra unchecked stats neither help nor hurt.

Grade is different from stats:

- grade compares final computed grade class against the preview grade class
- when checked, final grade must be at least the preview grade
- grade is evaluated in addition to checked stat targets

## Supported Enhancement Methods

The optimizer searches supported methods from a clean base item. It should find the highest probability strategy, not reproduce the user's exact preview path.

Allowed methods:

- visible compatible published scrolls
- local visible chaos scroll overrides
- Maker only when Maker is enabled/used in the preview
- Item Level-Up only when Item Level-Up is enabled in the preview

Maker and Item Level-Up are allowed, not forced. The optimizer may skip them if another supported path has a higher success probability.

Enhancement order is fixed:

```text
Maker -> Scrolling -> Item Level-Up
```

No alternate order is considered in v1.

The optimizer may stop before using all upgrade slots. Success is based on selected target conditions, not on consuming all slots or matching remaining slots.

## Scroll Model

Every non-chaos scroll is fixed-on-success. Current `behavior_type: "random"` scrolls are treated the same as fixed scrolls for v1.

Success rate:

- infer from name suffix such as `10%`, `60%`, `100%`
- scrolls without a percent suffix are treated as `100%`
- `100%` scrolls have no failure branch

Failure behavior:

- failed scrolls consume one upgrade slot
- failed scrolls add no stats
- failed outcomes may still count as successful final items if checked target conditions pass

Duplicate scrolls are allowed as slots permit, except scrolls with restrictions such as `maxApplications`. Those restrictions must be enforced.

Scroll candidate pruning:

- include visible compatible published scrolls normally
- exclude scrolls that only affect unchecked stats and have no target-building value
- keep pruning/caps internal; do not expose pruning controls or notes in the UI

## Chaos Scroll Model

V1 includes the current local `혼돈의 주문서 60%` and should support future chaos variants sharing the same outcome table.

A chaos scroll first rolls its success rate. On failure, it consumes one slot and changes no stats. On success, it independently rolls each currently positive stat except metadata (`upgradeSlots`, `attackSpeed`).

Chaos outcome table:

| Delta | Probability |
| --- | ---: |
| +5 | 0.99% |
| +4 | 1.98% |
| +3 | 10.21% |
| +2 | 15.87% |
| +1 | 19.31% |
| 0 | 18.38% |
| -1 | 13.70% |
| -2 | 8.00% |
| -3 | 3.65% |
| -4 | 2.97% |
| -5 | 4.94% |

HP and MP deltas are multiplied by `10`.

Stats at `<= 0` are removed. Removed stats are no longer eligible for later chaos rolls and count as absent in final comparison.

Fixed scrolls may create new stat lines. Later chaos scrolls may affect those new stat lines if they remain positive.

Scroll order is meaningful and part of strategy search because fixed scrolls can create stats before chaos and chaos can remove stats.

## Maker Model

Maker is allowed only when the preview enables or uses Maker. When allowed, the optimizer can choose legal Maker combinations and may leave gem slots empty.

Normal deterministic gems:

- optimizer may choose any legal gem and grade
- all legal grades are considered

Random gems:

- probability tables live in a repo code/config module
- random rolls are independent per affected stat
- random gems cannot create stats absent from the clean base item

`흑수정`:

| Grade | Range | Probability |
| --- | --- | --- |
| 하급 | -1 to +1 | -1 25%, 0 50%, +1 25% |
| 중급 | -2 to +2 | -2 10%, -1 20%, 0 40%, +1 20%, +2 10% |
| 상급 | -3 to +3 | -3 5%, -2 10%, -1 20%, 0 30%, +1 20%, +2 10%, +3 5% |

`흑수정` grade selection is deterministic strategy choice. After grade selection, use that grade's probability table.

`어둠의 크리스탈`:

- always uses the chaos `-5..+5` probability table
- rolls independently for STR, DEX, INT, and LUK that are present on the clean base item

For `흑수정`, if a valid context can affect both attack and magic attack, roll both independently.

## Item Level-Up Model

Item Level-Up is allowed only when enabled in the preview. When allowed, the optimizer may include or skip the full automatic level-up process depending on best probability.

If included:

- use existing `item-level-ups-gms83-ko.json` definitions
- apply all eligible level-up events
- each stat range is a uniform integer roll from `min` to `max`
- rolls are independent per stat and per level
- final item level/EXP state is not a target condition; only checked stats and optional grade matter

## Probability Engine

Use a hybrid engine.

Exact calculation applies only when a candidate strategy has:

- no chaos scrolls
- no random Maker gems
- no Item Level-Up RNG

For deterministic fixed-scroll-only cases, use dynamic programming where possible instead of enumerating every sequence.

Monte Carlo applies to complex cases involving:

- chaos scroll RNG
- random Maker gems
- Item Level-Up RNG
- large strategy search that exceeds exact bounds

Monte Carlo requirements:

- run in a browser Web Worker
- default `100,000` trials
- user-configurable trial count from `1,000` to `1,000,000`
- round trial count to nearest `1,000`
- support deterministic seeded runs internally for tests/debugging
- do not expose seed in normal UI
- production uses generated random seed unless a hidden/debug seed is provided
- throttle progress updates, e.g. every 1% or roughly every 250ms
- expose `계산 취소`
- on cancel, return to target-selection view with checked stats and trial count preserved

The engine should report whether the result is exact or estimated.

Target performance: default `100,000` trials should aim to complete in about 15 seconds on a normal desktop browser.

## Strategy Optimization

The objective is:

1. highest success probability
2. fewer chaos/random RNG sources
3. fewer total enhancement actions
4. deterministic stable choice if still tied

V1 uses an internal practical candidate set. Candidate pruning and strategy caps are implementation details and should not be shown to users.

The result displays only a concise collapsed strategy detail:

```text
Best found method
```

Include Maker choices, scroll sequence, and Item Level-Up use only when they are actually used. Keep the default UI focused on probability, attempts, percentiles, and chart.

## Result Output

Show:

- calculation method label: `정확 계산` or `시뮬레이션 추정 · 100,000회`
- success probability
- expected clean-item attempts
- 50%, 75%, 90%, and 95% attempt percentiles
- attempt distribution chart
- collapsed `Best found method`

Expected attempts and percentile attempts are rounded up to whole clean-item attempts.

For very small probabilities, use percentage formatting with scientific-notation fallback.

If the clean item already satisfies all selected target conditions, return `100%` with `no enhancement needed`. For stat targets this should be rare in normal UI because zero-gain stats are not selectable. For grade, this can occur if the selected preview grade threshold is no higher than the clean item's computed grade.

If no strategy can deterministically create a required target, show:

```text
현재 지원되는 방법으로는 목표 아이템을 만들 수 없습니다.
```

If Monte Carlo observes zero successes, do not call it provably impossible. Show both:

- no successes observed, e.g. `100,000회 중 성공 없음`
- an upper-bound style message such as `< 0.001%`
- suggestion to increase trials

## Chart

The chart uses clean-item attempt count on the x-axis.

Show both:

- per-attempt probability distribution bars
- cumulative success probability line

Use a geometric distribution derived from the per-clean-item success probability `p`. Even when `p` is estimated by Monte Carlo, the attempt-count chart is generated mathematically from `p`.

The x-axis automatically chooses a useful range based on the calculated probability. By default, show attempts up to the 95% percentile. Highlighting the 95% marker is allowed.

## Stale Results and Confirmation

After a calculation result exists, target-changing edits must show an in-app confirmation before proceeding.

Target-changing edits include:

- changing base item
- applying, clearing, or selecting scroll slots
- Maker changes
- Item Level-Up changes
- reset
- clicking `기대값 계산` again to start a fresh target-selection flow
- changing target stat checkboxes after a result exists

Dialog text:

```text
계산 결과가 초기화됩니다. 변경하시겠습니까?
```

Buttons:

```text
변경하기
취소
```

If confirmed:

- clear the existing result
- immediately proceed with the original action

If canceled:

- keep the result and current target setup unchanged

No confirmation is needed while only target-selection mode is open and no completed result exists.

While calculation is running, target-changing inputs wait or are unavailable until the calculation finishes or the user presses `계산 취소`.

Calculation configuration changes, such as trial count, do not use confirmation. If a completed result exists and trial count changes:

- keep the old result visible
- show stale label such as `설정 변경됨 · 다시 계산 필요`
- preserve the result's original trial count display
- require clicking `기대값 계산` / `계산 시작` again to recompute

## Architecture

Add probability-specific modules separate from UI so the engine can move later if needed.

Suggested boundaries:

- target extraction: clean item + current preview -> target gains and grade threshold
- candidate generation: visible scrolls, Maker choices, Item Level-Up permission -> candidate strategies
- exact engine: deterministic DP and exact probability
- Monte Carlo engine: seeded RNG, trial runner, worker protocol
- result formatting: probability, attempts, percentiles, chart buckets
- UI controller: result panel state, target checklist, stale/confirmation behavior

The Web Worker should communicate through structured messages:

- start calculation
- progress
- complete
- cancel acknowledgment
- error

## Testing

Use test-first implementation.

Core tests:

- target stat extraction uses enhancement gains, not raw totals
- core default checks only positive gains
- advanced stats and grade are unchecked by default
- grade condition compares final grade class at least preview grade
- non-chaos scroll success/failure probabilities are inferred from names
- missing percent suffix defaults to 100%
- failed scrolls consume slots and can still produce successful final items
- `maxApplications` restrictions are enforced
- chaos success first, then independent stat rolls
- chaos removes stats at `<= 0`
- removed stats are not rolled by later chaos scrolls
- HP/MP chaos deltas use 10x scale
- Maker random gem tables match configured probabilities
- random Maker gems cannot create absent clean stats
- Item Level-Up uses uniform independent integer rolls
- exact deterministic fixed-scroll case matches hand-calculated probability
- Monte Carlo supports deterministic seeded tests
- zero-success simulation returns zero-observed state, not deterministic impossible
- geometric attempt percentiles round up
- result stale state is only for calculation configuration changes
- target-changing edits trigger confirmation only after completed results
