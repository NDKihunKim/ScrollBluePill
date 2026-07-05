# Deconstruction Calculation Strategy — Diagnostic Report

**Date:** 2026-07-04
**Scope:** `3. 계산` panel — stat targeting, strategy enumeration, and the 10,000-result overflow warning
**Status:** Analysis only; no code changes

---

## 1. Plain-Language Explanation of the Current Calculation Logic

### High-Level Flow

The deconstruction calculator answers the question: _"Given a base item and desired final stats, what enhancement strategies can achieve those stats?"_

It operates in four stages, represented by four UI panels:

1. **아이템 검색** — Select a base item
2. **스탯 편집** — Configure desired stat deltas (how much each stat should change from the base)
3. **계산** — Select target conditions and run the strategy search
4. **해체 분석 결과** — View and filter the matching strategies

### Step-by-Step Calculation Walkthrough

#### Step A: User Configures Stat Deltas in Panel 2

- The user adjusts per-stat stepper buttons (MIN / − / value / + / MAX).
- Each stat's desired delta is stored in `deconDeltas[key]` (e.g., `deconDeltas['str'] = 10` meaning "I want STR to increase by 10").
- The list of all known stats is tracked in `deconStatKeys`.

#### Step B: Target Chips Are Rendered in Panel 3

The function `renderTargetChips()` (deconstruction.astro, line 613) generates a checkbox chip for each stat. The rules are:

- **Core stats** (STR, DEX, INT, LUK, weaponAttack, magicAttack): always visible if present on the base item or if they have a non-zero delta.
- **Non-core stats** (maxHp, weaponDefense, speed, etc.): visible only if they have a non-zero delta.
- **Checked state**: `checkbox.checked = (delta !== 0)`. A stat is **checked** (selected as a target condition) if and only if its delta is non-zero.
- A zero-delta stat displays _"유지"_ (maintain) and is **unchecked** — it is NOT included as a target condition.

#### Step C: User Clicks "분석 시작" (Analyze)

The `runAnalysis()` function (deconstruction.astro, line 2363) collects:

- `checkedKeys`: the list of stat keys from checked target chips → becomes `targetKeys`
- `targetDeltas`: `{ [key]: deconDeltas[key] }` for each checked key
- `successfulScrollCount`: how many scroll successes are assumed
- `equipmentKind`: the item's equipment category (e.g., "Glove", "한손검")
- Source permissions: which enhancement types are allowed (scrolls, stimulant, gems, itemLevelUp)
- Various bounds and filters

#### Step D: The Engine Runs `enumerateStrategies()`

The engine (`src/lib/deconstruction/engine.mjs`) takes these inputs and performs a constraint-satisfaction search:

1. **Filters scrolls** to those relevant to the target keys. A scroll is "relevant" if it affects at least one target key, or if it's a chaos scroll (which can affect any stat).

2. **Enumerates scroll states** via `enumerateExactCountScrollStates()`: a DFS that searches for combinations of exactly `successfulScrollCount` scrolls whose net stat contribution is within reach of the target. It uses a pruning function `canReachTarget()` that checks whether any remaining scrolls + correction from other sources (gems, stimulant, itemLevelUp) can still close the gap to the target.

3. **Enumerates non-scroll contributions**:
   - **Stimulant**: solved directly with `solveStimulantResidual()` (a single exact solution per stat key).
   - **Gems**: all possible stat vectors from maker gems are pre-computed via `enumerateGemContributions()`, which enumerates all valid combinations across gem types and grades.
   - **Item Level-Up**: all possible stat vectors from item level-ups are pre-computed via `enumerateItemLevelContributions()`, which enumerates all outcomes within the per-level stat ranges.

4. **Combines sources** to produce strategies. For each scroll state, the engine tries eight composition tiers:
   - Tier 0: scroll-only
   - Tier 1: scroll + stimulant
   - Tier 2: scroll + gems
   - Tier 3: scroll + itemLevelUp
   - Tier 4: scroll + stimulant + gems
   - Tier 5: scroll + stimulant + itemLevelUp
   - Tier 6: scroll + gems + itemLevelUp
   - Tier 7: scroll + stimulant + gems + itemLevelUp

5. **Verifies exact match**: Each candidate is checked with `isExactVector(result.totalStats, targetVector, targetKeys)` — ALL target keys must match exactly.

6. **Deduplicates**: Each accepted strategy is hashed via `strategyCanonicalKey()`, which encodes the full identity of every contributing source (scroll IDs + their stat contributions, gem key + grade + stats, stimulant stats, level-up count + stats).

7. **Overflow guard**: When 10,000 unique strategies are accumulated, the engine stops and returns `{ tooManyResults: true, total: 10001 }`.

#### Step E: Results Are Displayed

- `displayResults()` (line 2402) handles the engine output.
- If `tooManyResults === true`, it displays the warning: _"일치하는 전략이 10,000개를 초과합니다. 위 패널에서 목표 조건을 더 구체적으로 선택해주세요."_
- Otherwise, it renders a filterable strategy list.

---

## 2. Inputs and Outputs: One-Stat vs. Two-Stat Scenarios

### One-Stat Scenario (e.g., STR +10 only)

| Aspect | Value |
|---|---|
| **User sets** | STR delta = +10, all other deltas = 0 |
| **Target chips checked** | Only STR (delta ≠ 0) |
| **`targetKeys`** | `['str']` |
| **`targetDeltas`** | `{ str: 10 }` |
| **Relevant scrolls** | Only scrolls that have `stats.str ≠ 0` (or are chaos scrolls) |
| **Gem contribution space** | 1-dimensional over STR. For dark crystal (variable): ~11 outcomes (values -5 to +5). For fixed gems: ~1 outcome each. |
| **ItemLevelUp contribution space** | 1-dimensional over STR. Typically ~6 outcomes (range min→max for 1 stat). |
| **G×L Cartesian product** | ~11 × 6 = 66 candidate checks per scroll state (Tier 6/7) |
| **Typical result** | Manages to stay under the 10,000 limit; strategies returned normally |

### Two-Stat Scenario (e.g., STR +10, DEX +5)

| Aspect | Value |
|---|---|
| **User sets** | STR delta = +10, DEX delta = +5, others = 0 |
| **Target chips checked** | STR (delta ≠ 0) and DEX (delta ≠ 0) |
| **`targetKeys`** | `['str', 'dex']` |
| **`targetDeltas`** | `{ str: 10, dex: 5 }` |
| **Relevant scrolls** | Scrolls that affect STR **OR** DEX (or are chaos). This is a SUPERSET of the 1-stat case — more scrolls enter the pool. |
| **Gem contribution space** | 2-dimensional over STR × DEX. For dark crystal: ~11 × 11 = 121 outcomes. Each fixed gem still contributes along both axes (one key may be 0). |
| **ItemLevelUp contribution space** | 2-dimensional over STR × DEX. If each stat has a range of ~6 values: ~36 outcomes. |
| **G×L Cartesian product** | ~121 × 36 = 4,356 candidate checks per scroll state (Tier 6/7) |
| **Typical result** | **Exceeds 10,000 strategies** → overflow warning displayed |

---

## 3. Which Stats and Conditions Are Being Used?

### The System Only Considers Explicitly Selected Target Conditions

The target keys fed to the engine are **exclusively** the stats whose target chips are checked. From `runAnalysis()` (line 2367–2372):

```javascript
const checkedKeys = getCheckedTargetKeys();  // Only checked checkboxes
const targetDeltas = Object.fromEntries(
  checkedKeys.map((key) => [key, deconDeltas[key] ?? 0]),
);
```

And target chips are checked based on `delta !== 0` (line 648):

```javascript
checkbox.checked = delta !== 0;
```

**No other stats or conditions are being pulled in.** The engine receives exactly the checked keys and their deltas. Unchecked stats (even if visible as chips with "유지") are NOT part of the target vector.

### Confirmation: How This Flows Through the Engine

- `targetKeys` controls which dimensions the engine optimizes against
- `projectVector()`, `addVectors()`, `subtractVectors()`, `isExactVector()` all operate on `targetKeys` only
- `generateChaosDeltas()` filters chaos stat keys to only those in `targetKeys`
- `enumerateGemContributions()` filters gem variable keys to those in `targetKeys`
- `enumerateItemLevelContributions()` only includes stat keys in `targetKeys`
- The deduplication key `strategyCanonicalKey()` projects each source's stats onto `targetKeys`

**Verdict:** The engine is correctly scoping the calculation to only the user-selected target stats. No hidden stats or conditions are being pulled in.

---

## 4. Why the 10,000-Strategy Overflow Warning Appears in the Two-Stat Case

### Root Cause: Combinatorial Multiplication in the G×L Cartesian Product

The overflow is driven by three interacting factors:

#### Factor 1: More Scrolls Become Relevant

With 1 target key (`['str']`), only scrolls that affect STR pass the relevance filter. With 2 target keys (`['str', 'dex']`), any scroll affecting **either** STR or DEX becomes relevant — a strict superset. This means the DFS in `enumerateExactCountScrollStates` starts with a larger scroll pool.

#### Factor 2: Gem and ItemLevelUp Contribution Spaces Grow Multiplicatively

The helper functions `enumerateGemContributions()` and `enumerateItemLevelContributions()` enumerate all possible stat vectors over the target keys. The number of possible vectors grows **exponentially** with the number of target keys:

- For a variable gem (Dark Crystal / Black Amethyst) with ~11 possible values per stat: 1 key → ~11 vectors, 2 keys → ~121 vectors
- For item level-ups with ~6 possible values per stat: 1 key → ~6 vectors, 2 keys → ~36 vectors

#### Factor 3: The G×L Cartesian Product Dominates Strategy Generation

For each scroll state found by the DFS, Tiers 6 and 7 iterate over the Cartesian product `gemContributions × itemLevelContributions`:

| Scenario | Gem vectors | ItemLevelUp vectors | G×L checks per scroll state |
|---|---|---|---|
| 1 stat | ~11 | ~6 | ~66 |
| 2 stats | ~121 | ~36 | ~4,356 |

If the DFS produces, say, 50 scroll states and even 5% of G×L combinations match, that's:
- 1 stat: 50 × 66 × 0.05 = ~165 strategies (well under 10,000)
- 2 stats: 50 × 4,356 × 0.05 = ~10,890 strategies (exceeds 10,000)

### Is This Behavior Expected by Design?

**Yes, this is expected by design — but it may be undesirable UX.** Here's the reasoning:

The `MAX_DISPLAY_STRATEGIES = 10000` constant at line 17 of `engine.mjs` is explicitly a safeguard:

```javascript
const MAX_DISPLAY_STRATEGIES = 10000;
```

The engine has multiple bail-out mechanisms:
- `tooManyResults` flag checked throughout the enumeration
- `effectiveScrollStatesSeen > 150000` limit for the non-itemLevelUp path (line 830)
- The final check: `if (strategies.length >= MAX_DISPLAY_STRATEGIES) { tooManyResults = true; }` (line 732)

The design intent is clear: **the engine should not return more than 10,000 strategies** because rendering that many DOM elements would crash or freeze the browser. The warning is a graceful degradation.

### However: The Filters May Not Be Restrictive Enough

The question is whether the engine genuinely finds 10,000+ **meaningfully different** strategies, or whether it's generating many strategies that differ only in trivial ways (e.g., using a different gem grade that produces the same stat totals).

Looking at the deduplication key (`strategyCanonicalKey`, line 375), it distinguishes strategies based on:
- Scroll IDs and their per-stat contributions
- Stimulant stat breakdown
- Gem key + grade + per-stat projection
- ItemLevelUp count + per-stat projection

Two strategies that produce the exact same net stats but use different scroll IDs or gem grades are considered **distinct**. This is intentional — the user is meant to see all available options. But when there are genuinely hundreds of scroll types, gem types, and grade combinations that can all be composed to hit the same 2-stat target, the number of distinct strategies explodes.

---

## 5. Expected vs. Actual Behavior Comparison

| Aspect | Expected Behavior | Actual Behavior | Assessment |
|---|---|---|---|
| **1-stat targeting** | Strategies found and displayed normally | ✅ Works correctly | Matches expectations |
| **2-stat targeting** | Fewer strategies should match (stricter constraints) | ⚠️ MORE strategies match (10,000+), overflow warning shown | **Counterintuitive but correct** — see explanation below |
| **Target condition scoping** | Only checked stats used as targets | ✅ Only checked keys passed to engine | Works as intended |
| **Overflow handling** | Graceful warning when >10,000 strategies | ✅ Warning displayed correctly | Works as intended |
| **Deduplication** | No duplicate strategies | ✅ Canonical key prevents duplicates | Works as intended |
| **Exact matching** | Total stats must match target exactly | ✅ `isExactVector` enforced before adding | Works as intended |

### Why "More Constraints = More Results" Is Counterintuitive But Correct

Intuitively, adding a second target stat (e.g., requiring both STR +10 AND DEX +5) should narrow the result set. And it DOES narrow it per degree of freedom — any individual strategy must satisfy both constraints.

However, the **number of distinct ways** to satisfy those constraints increases because:
1. **More building blocks enter the search**: scrolls affecting DEX join the pool alongside STR scrolls
2. **More unique compositions exist**: a strategy using STR scrolls + DEX gems is different from one using DEX scrolls + STR gems, even if both hit the same totals
3. **Higher-dimensional deduplication**: the dedup key captures the full stat profile of each source across all target keys, making more strategies "unique"
4. **The G×L Cartesian product** simply enumerates more candidates, and enough of them pass the exact-match filter to exceed 10,000

This is analogous to: "Find all ways to make $10 using coins" vs "Find all ways to make $10 using coins AND bills." Adding bills (a second dimension) creates MORE distinct combinations, even though each combination is more constrained.

---

## 6. Inconsistencies and Surprising Behaviors

### 6.1 The overflow manifests even with seemingly modest targets

A user setting STR +10, DEX +5 on a typical glove with 7 scroll slots can hit the 10,000 limit. This feels surprising because the user likely expects to see a manageable handful of strategies, not 10,000+. The disconnect is between the **mathematical** search space (which genuinely has thousands of valid compositions) and the **user's mental model** (which expects a few obviously-best strategies).

### 6.2 The G×L Cartesian product is the primary bottleneck

Tiers 6 and 7 (`scroll + gems + itemLevelUp` and `scroll + stimulant + gems + itemLevelUp`) iterate over `gemContributions × itemLevelContributions` for every scroll state. This is where most of the strategies are generated. Disabling gems or itemLevelUp as sources would dramatically reduce the result count, but the user has no indication of this before hitting the overflow.

### 6.3 Default source selection behavior

`getDefaultSourceSelection()` in `sourcePolicy.mjs` returns all `false`. When a new item is selected, all source checkboxes are reset to unchecked. The user must explicitly enable at least one source for the analyze button to work. However, once sources ARE enabled (especially if gems and itemLevelUp are both on), the 2-stat case almost always overflows.

### 6.4 The 150,000 scroll state limit

In the non-itemLevelUp path (line 830), there's an additional guard: if more than 150,000 scroll states are enumerated, it sets `tooManyResults = true`. This is a deeper bail-out to prevent the DFS from running forever in pathological cases.

### 6.5 Zero-delta targets are excluded from the search

If a stat has a delta of 0, its target chip is unchecked, and it's NOT included in `targetKeys`. This means the engine does not constrain that stat at all — strategies can freely change or not change that stat. This is correct behavior (matching the user's intent of "I don't care about this stat"), but users who add a stat to the editor (via "+ 스탯 추가") and leave it at 0 might be surprised that it's not being considered as a constraint.

---

## 7. Questions and Clarifications Needed

To fully confirm design intent and guide any future adjustments, I would need your input on these points:

1. **What is the expected user experience for 2-stat targeting?** Should the system return ALL valid strategies (potentially 10,000+), or should it return only the "best" ones by some ranking criteria? If the latter, what ranking dimension makes sense (fewest total sources, lowest cost, highest probability)?

2. **Should the sources (gems, stimulant, itemLevelUp) default to on or off?** Currently they default to off. But if the typical workflow has users enabling them, a different default (or smarter auto-enable) could improve UX.

3. **Is the 10,000 limit the right threshold?** It's arbitrary. Some strategies might render quickly in the DOM, others might be heavy. Would a lower limit (e.g., 1,000) with a "show more" option be better? Or should the engine itself limit results earlier?

4. **Should the engine prioritize strategies before counting them?** Currently, strategies are sorted by priorityRank and chaos spread AFTER collection. If the engine could truncate to the top-N during collection (e.g., only keep the best 1,000 by some heuristic), it would never overflow and would always show the most relevant results.

5. **Do you want the engine to merge strategies that differ only in gem grade but produce the same stat totals?** Currently, a strategy using a Low-grade Dark Crystal is distinct from one using a Mid-grade Dark Crystal even if both produce `{str: +1, dex: -1}`. If you consider these equivalent, the deduplication could be coarser.

6. **Is there a specific set of target stat combinations that should always work without overflow?** If so, those should become test cases, and the engine should be optimized to handle them within the limit.

---

## Summary

| Question | Answer |
|---|---|
| Is the system working as intended? | **Yes** — the calculation logic is correct, the target conditions are properly scoped, and the overflow warning is triggered by design when strategies exceed 10,000. |
| Is the overflow behavior expected? | **Partially** — the 10,000 limit and warning are intentional safeguards. However, the fact that 2-stat targeting so consistently triggers the overflow may indicate the search space is broader than intended in practice. |
| Are there bugs? | **No clear bugs found.** The logic correctly constrains, matches, deduplicates, and counts strategies. The overflow is a consequence of combinatorial mathematics, not a logic error. |
| Should anything change? | **That's a design decision for you to make.** The engine is correct but perhaps too thorough. Options include: reducing the strategy space (coarser dedup, source limits), increasing the display limit (with pagination/lazy rendering), or prioritizing/truncating results. |
