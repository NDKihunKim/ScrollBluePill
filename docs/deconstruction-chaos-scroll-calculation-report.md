# Chaos Scroll Calculation in the Deconstruction Page — Diagnostic Report

**Date:** 2026-07-04
**Scope:** How chaos scrolls (혼돈의 주문서) are handled from UI input through engine enumeration to result display
**Status:** Analysis only; no code changes

---

## 1. What Makes Chaos Scrolls Different

Chaos scrolls (identified by `behavior_type === 'chaos'`) are fundamentally different from fixed scrolls. A fixed scroll has deterministic stat contributions (e.g., _"공격력 주문서 100%"_ → `{ weaponAttack: +2 }`). A chaos scroll has random outcomes — it can change any of 6–10 stats by values in `[-5, +5]` (or `[-50, +50]` for HP/MP). The engine cannot simply add a fixed stat vector; it must enumerate ALL possible delta combinations the chaos scroll could produce.

This makes chaos scrolls the most computationally expensive part of the deconstruction engine. The entire chaos-handling architecture is built around one goal: **avoid combinatorial explosion while still finding valid chaos-inclusive strategies.**

---

## 2. End-to-End Flow: User Input → Strategy Output

### Phase 1: UI — Enabling Chaos Scrolls

#### Step 1.1: Scroll Rate Filter

In the `3. 계산` panel, under the "주문서" source, there is a row of scroll rate checkboxes:

```html
<label class="decon-rate-chip"><input type="checkbox" data-decon-scroll-rate="100" checked />100%</label>
<label class="decon-rate-chip"><input type="checkbox" data-decon-scroll-rate="60" checked />60%</label>
<label class="decon-rate-chip"><input type="checkbox" data-decon-scroll-rate="10" checked />10%</label>
<label class="decon-rate-chip"><input type="checkbox" data-decon-scroll-rate="chaos" />혼돈의 주문서</label>
```

By default, 100%, 60%, and 10% are checked — chaos is **unchecked**. This is a deliberate UX choice: chaos scrolls are computationally expensive, so the user must opt in explicitly.

The tooltip on the chaos rate chip reads: _"일반 주문서와의 조합이 불가능 할경우 사용됩니다."_ (Used when combination with regular scrolls is impossible.)

#### Step 1.2: Chaos Bounds Editor

When the user checks the chaos rate checkbox, a sub-panel appears (`data-decon-chaos-bounds`, line 258). The `buildChaosBoundsEditor()` function (line 1186) renders a dual-range slider for every stat key that has a **non-zero target delta**:

```javascript
const targetedKeys = deconStatKeys.filter((k) => deconDeltas[k] !== 0);
```

For each targeted stat:
- **Default range**: `[-5, +5]` (or `[-50, +50]` for HP/MP)
- **UI control**: Two-thumb dual-range slider allowing the user to narrow the chaos outcome range
- **State storage**: `deconChaosBoundsMap[key] = { min, max }`

**Key design decision**: Chaos bounds are only shown for stats the user is actively targeting (delta ≠ 0). If the user only targets STR, only STR gets a chaos bounds slider. This is because chaos affecting non-targeted stats is irrelevant to the strategy search.

#### Step 1.3: Data Flow to the Engine

When the user clicks "분석 시작", `runAnalysis()` passes the chaos configuration to the engine:

```javascript
chaosStatBounds: Object.keys(deconChaosBoundsMap).length > 0 ? deconChaosBoundsMap : null,
```

- If the chaos rate checkbox is checked but no stat has bounds configured → `chaosStatBounds = null` → the engine uses default ranges
- If the chaos rate checkbox is checked and the user adjusted sliders → `chaosStatBounds` contains per-key `{min, max}`

---

### Phase 2: Engine — Scroll Pool Preparation

#### Step 2.1: Scroll Rate Filtering

In `enumerateStrategies()` (line 696–697):

```javascript
const rawScrolls = scrollsByEquipmentKind.get(equipmentKind) ?? [];
const scrolls = scrollRateFilter ? filterScrollsByRate(rawScrolls, scrollRateFilter) : rawScrolls;
```

`filterScrollsByRate` (line 33–39) classifies each scroll by name:
- Names containing `혼돈` or `chaos` → rate `'chaos'`
- Names containing a percentage (e.g., `100%`) → the percentage string
- The filter is a `Set` of allowed rate strings — only scrolls with rates in the set survive

#### Step 2.2: Relevance Filtering (Chaos Always Passes)

In `enumerateExactCountScrollStates()` (line 150–152):

```javascript
const relevantScrolls = allScrolls.filter((s) =>
  isChaosScroll(s) || targetKeys.some((k) => (s.stats?.[k] || 0) !== 0),
);
```

Fixed scrolls pass only if they affect at least one target key. **Chaos scrolls always pass** — even though their data may show zero-valued stats for all target keys, they can affect any stat within the chaos range. The engine treats them as wildcards.

#### Step 2.3: Splitting Fixed vs. Chaos

The relevant scrolls are separated (lines 158–164):

```javascript
const fixedScrolls = relevantScrolls.filter((s) => !isChaosScroll(s)).sort((a, b) => a.id - b.id);
const chaosScrolls = relevantScrolls.filter((s) => isChaosScroll(s)).sort((a, b) => a.id - b.id);
```

Fixed scrolls are used in the DFS first (they're deterministic and cheaper). Chaos scrolls are pre-processed into a delta pool before the DFS.

---

### Phase 3: Engine — Chaos Delta Pool Construction

This is the most critical part. The `generateChaosDeltas()` generator (line 47–121) takes a chaos scroll's stat data and produces all possible delta vectors it could contribute toward the target.

#### Step 3.1: Candidate Key Selection

```javascript
const scrollPoolKeys = Object.keys(stats).filter((k) => targetKeys.includes(k));
```

Only stats that are **both** in the chaos scroll's native data AND in the user's target keys are considered.

Then, **bounds-introduced keys** are added: if `chaosBounds` specifies a valid `{min, max}` range for a stat that's in `targetKeys` but NOT in the scroll's native data, that stat is included. This allows the engine to consider chaos affecting a stat through user-specified bounds even when the scroll data doesn't list it.

#### Step 3.2: Pruning Irrelevant Keys

```javascript
const statKeys = allCandidateKeys.filter((k) => {
  const delta = targetDeltas?.[k] ?? 0;
  if (delta !== 0) return true;                        // user wants this changed
  const base = cleanStats?.[k];
  if (Number.isFinite(base) && base > 0) return true;   // item has this stat to protect
  return false;                                          // skip — no reason to track
});
```

A chaos stat key is kept if:
1. The user actively wants it changed (target delta ≠ 0), OR
2. The base item has a positive value there (chaos could reduce a valuable stat, so it must be accounted for)

If neither condition holds (delta=0 AND base≤0), the key is skipped — chaos moving a stat from 0 to ±5 wouldn't matter.

#### Step 3.3: Per-Key Value Enumeration

For each surviving key, the engine builds a list of possible delta values:

```javascript
const defaultRange = getChaosRange(key);  // {min:-5,max:5} or {min:-50,max:50} for HP/MP
const min = chaosBounds?.[key] ? Math.max(defaultRange.min, chaosBounds[key].min) : defaultRange.min;
const max = chaosBounds?.[key] ? Math.min(defaultRange.max, chaosBounds[key].max) : defaultRange.max;
```

User-specified bounds clamp the default range. The value list is ordered:
1. `0` first (neutral — no change)
2. `+1, +2, ..., +max` (positive deltas — gains)
3. `-1, -2, ..., min` — ONLY if `targetDeltas[key] < 0` (user wants to reduce this stat)
   - If the target is positive, negative chaos values are skipped as "pure waste"

**This is a key optimization**: for positive-target stats, negative chaos deltas are excluded because they would require extra positive applications to compensate, producing strictly worse strategies.

#### Step 3.4: DFS Enumeration of Delta Vectors

```javascript
function* dfs(idx, current) {
  if (count >= limit) return;   // 100,000 limit safety valve
  if (idx === statKeys.length) {
    count++;
    yield { ...current };
    return;
  }
  const { key, values } = ranges[idx];
  for (const v of values) {
    current[key] = v;
    yield* dfs(idx + 1, current);
  }
}
```

A simple recursive DFS enumerates the Cartesian product of all per-key value lists. For example, with 2 targeted keys and 11 values each (0, +1..+5, -1..-5), this produces 121 delta vectors. With a 100,000 limit, the DFS safely handles up to ~6 keys with 11 values each (11^6 ≈ 1.77M but stops at 100K).

#### Step 3.5: Pool Deduplication and Sorting

Back in `enumerateExactCountScrollStates()` (lines 181–203), the raw delta vectors from all chaos scrolls are collected, deduplicated, and sorted:

```javascript
// Deduplicate by delta vector key
const chaosSeen = new Map();
const chaosPool = [];
for (const entry of chaosPoolRaw) {
  const key = targetKeys.map((k) => `${k}:${entry.deltas[k] || 0}`).join(',');
  if (!chaosSeen.has(key)) {
    chaosSeen.set(key, true);
    chaosPool.push(entry);
  }
}

// Sort by useful contribution (sum of positive deltas, descending)
chaosPool.sort((a, b) => {
  const aScore = targetKeys.reduce((s, k) => s + Math.max(0, a.deltas[k] || 0), 0);
  const bScore = targetKeys.reduce((s, k) => s + Math.max(0, b.deltas[k] || 0), 0);
  return bScore - aScore;
});
```

**Why deduplicate?** Multiple chaos scrolls for the same equipment kind (e.g., "장갑 혼돈의 주문서 60%" and "장갑 혼돈의 주문서 100%") might produce identical delta vectors when projected onto the target keys. Treating them separately would create duplicate strategies differing only in scroll name — wasting search capacity.

**Why sort by positive contribution?** The DFS tries entries in order, and sorting "more useful" deltas first makes the pruning function `canReachTarget()` more likely to find valid branches early, reducing wasted search.

#### Step 3.6: Per-Key Min/Max for Pruning

```javascript
const chaosMins = Object.fromEntries(targetKeys.map((k) => [k, Infinity]));
const chaosMaxs = Object.fromEntries(targetKeys.map((k) => [k, -Infinity]));
for (const { deltas } of chaosPool) {
  for (const k of targetKeys) {
    const v = deltas[k] || 0;
    if (v < chaosMins[k]) chaosMins[k] = v;
    if (v > chaosMaxs[k]) chaosMaxs[k] = v;
  }
}
```

These per-key extremes feed into the pruning function to compute the best/worst possible chaos contribution at each DFS step.

---

### Phase 4: Engine — DFS Search with Chaos Integration

#### Step 4.1: Pruning Function

The `canReachTarget()` function (line 230–255) determines whether a partial scroll combination can still reach the target:

```javascript
function canReachTarget(fixedIdx, remainingApps, currentStats) {
  for (const key of targetKeys) {
    let minPerApp = remainingApps === 0 ? 0 : Infinity;
    let maxPerApp = remainingApps === 0 ? 0 : -Infinity;

    // Fixed scroll contributions
    for (let i = fixedIdx; i < fixedScrolls.length; i++) {
      const value = fixedScrolls[i].stats?.[key] || 0;
      minPerApp = Math.min(minPerApp, value);
      maxPerApp = Math.max(maxPerApp, value);
    }
    // Chaos contributions
    if (Number.isFinite(chaosMins[key])) {
      minPerApp = Math.min(minPerApp, chaosMins[key]);
      maxPerApp = Math.max(maxPerApp, chaosMaxs[key]);
    }

    const correction = correctionBounds[key] ?? { min: 0, max: 0 };
    const current = currentStats[key] || 0;
    const minReachable = current + remainingApps * minPerApp + correction.min;
    const maxReachable = current + remainingApps * maxPerApp + correction.max;
    const target = targetDeltas[key] ?? 0;
    if (target < minReachable || target > maxReachable) return false;
  }
  return true;
}
```

The chaos pool's per-key min/max are folded into `minPerApp`/`maxPerApp` alongside fixed scrolls. The `correctionBounds` also account for stimulant, gem, and itemLevelUp contributions — preventing premature pruning when non-scroll sources could close the gap.

#### Step 4.2: Fixed Scrolls First (DFS Phase 1)

The DFS tries fixed scrolls first (lines 286–318). For each scroll, it computes `maxUses` — the maximum times the scroll can be applied without overshooting any target key:

```javascript
let maxUses = remainingApps;
for (const k of targetKeys) {
  const delta = stats[k] || 0;
  const remaining = targetDeltas[k] - (currentStats[k] || 0);
  if (delta > 0 && remaining > 0) {
    maxUses = Math.min(maxUses, Math.floor(remaining / delta));
  }
}
```

It tries counts from `maxUses` down to 1, recursing after each application.

#### Step 4.3: Chaos Scrolls Second (DFS Phase 2)

After exhausting fixed scroll options at the current depth, the DFS tries chaos pool entries (lines 322–366):

```javascript
for (const entry of chaosPool) {
  const { baseScroll: cs, deltas } = entry;

  // Guard: bounds-introduced keys cannot create stats from zero
  const nativeStats = cs.stats;
  if (Object.keys(deltas).some(
    (k) => !(k in (nativeStats ?? {})) && (currentStats[k] || 0) <= 0,
  )) {
    continue;
  }
  // ...
}
```

**The bounds-introduced keys guard**: If a stat was introduced via `chaosBounds` (not in the scroll's native data), it can only modify existing stats — it cannot create a stat from zero. A fixed scroll must establish the stat first. Without this guard, the engine would waste time exploring branches where chaos "creates" STR +5 on an item that never had STR.

The chaos entry is then applied count-based (like fixed scrolls), with `maxUses` bounded by positive deltas. **Negative deltas don't limit `maxUses`** — a chaos scroll could apply a negative delta multiple times even if the target is positive, as long as other sources compensate. (The delta generation already excludes negative values for positive-target stats, so this is moot in practice.)

**Why count-based instead of one-at-a-time?** The comment at line 178 explains:
> Each unique delta vector gets used count-based (like fixed scrolls) instead of one-at-a-time — otherwise a 378-entry pool × 6–9 slots creates a combinatorially impossible search space.

If each chaos entry were tried individually per slot (like the old approach), a pool of 378 entries across 7 slots would produce billions of branches. Count-based application treats each unique delta vector as a "type" that can be applied N times, collapsing the search space to manageable proportions.

---

### Phase 5: Result Building — Chaos Scroll Identity Preservation

#### Step 5.1: Strategy Construction

When a scroll state passes the DFS, it enters `buildResult()` (line 429). Chaos scrolls are included in the scroll entries with their full identity:

```javascript
const scrollEntries = scrolls.map((s) => ({
  id: s.id,
  nameKo: s.nameKo,
  stats: { ...s.stats },
  behavior_type: s.behavior_type,   // ← 'chaos' preserved
}));
```

The `behavior_type` field survives into the strategy result, enabling downstream display logic to differentiate chaos from fixed scrolls.

#### Step 5.2: Exact Match Verification

Every candidate strategy is verified via `isExactVector()` (line 729):

```javascript
if (!isExactVector(result.totalStats, targetVector, targetKeys)) return;
```

This compares the summed contribution of ALL sources (scrolls + stimulant + gems + itemLevelUp) against the target deltas, key by key. Only strategies whose net stats match the target exactly are kept.

#### Step 5.3: Deduplication

The `strategyCanonicalKey()` (line 375) includes:
- Scroll IDs **and** their per-stat contributions (including chaos delta breakdowns)
- Stimulant, gem, and itemLevelUp signatures

Two strategies using different chaos scrolls (e.g., 60% vs 100%) that produce identical delta vectors are treated as **different** strategies because the scroll IDs differ.

---

### Phase 6: Result Sorting — Chaos Spread Scoring

#### Step 6.1: The Chaos Spread Score

After collection, strategies are sorted by `chaosSpreadScore()` (line 404–424):

```javascript
function chaosSpreadScore(strategy, targetKeys) {
  let chaosCount = 0;
  const chaosTotals = Object.fromEntries(targetKeys.map((k) => [k, 0]));

  for (const scroll of strategy.scrolls) {
    if (scroll.behavior_type === 'chaos') {
      chaosCount++;
      for (const key of targetKeys) {
        chaosTotals[key] += scroll.stats[key] || 0;
      }
    }
  }

  if (chaosCount === 0) return -1;  // non-chaos strategies rank FIRST

  const values = targetKeys.map((k) => chaosTotals[k]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

  return variance;  // lower = more evenly distributed chaos
}
```

The sorting order (line 987–993):
1. `priorityRank` ascending (Tier 0 → Tier 7)
2. Within the same tier: **non-chaos first** (score = -1), then chaos strategies by **spread evenness** (lower variance = more balanced distribution across target keys)

**Rationale**: A chaos strategy that distributes its deltas evenly across stats is preferred over one that dumps everything into one stat. An even spread means the user gets balanced gains rather than lopsided results.

---

### Phase 7: Result Display — Chaos Scroll Filtering

In the result panel (panel 4), the secondary filter controller (`resultFilterController.mjs`) has chaos-specific UI:

#### Step 7.1: Chaos Stat Delta Ranges

For each chaos scroll in the strategy list, the controller computes the observed range of each stat's delta across all strategies (lines 164–182):

```javascript
const chaosStatRanges = new Map(); // scroll:{id} → Map<statKey, {min,max}>
for (const entry of model.entries) {
  for (const s of (entry.strategy.scrolls ?? [])) {
    if (s.behavior_type !== 'chaos') continue;
    // collect per-stat min/max
  }
}
```

#### Step 7.2: Per-Stat Delta Sliders for Chaos

Each chaos scroll gets dual-range sliders for every stat it affects (lines 312–379). This allows the user to filter strategies by chaos delta ranges — e.g., "only show strategies where this chaos scroll gives STR between +1 and +3."

#### Step 7.3: Chaos Delta Filter Application

The `chaosDeltaInRange()` function (resultFilters.mjs, line 214–226) checks each strategy:

```javascript
function chaosDeltaInRange(entry, chaosRanges) {
  for (const scroll of (entry.strategy.scrolls ?? [])) {
    if (scroll.behavior_type !== 'chaos') continue;
    const scrollRanges = chaosRanges.get(`scroll:${scroll.id}`);
    if (!scrollRanges) continue;
    for (const [statKey, { min, max }] of scrollRanges) {
      const value = scroll.stats?.[statKey] ?? 0;
      if (value < min || value > max) return false;
    }
  }
  return true;
}
```

#### Step 7.4: Chaos Scroll Icon and Display Name

In `resultFilters.mjs` (line 79–80):
```javascript
iconId: scroll.behavior_type === 'chaos' ? 2049100 : scroll.id,
label: simplifyScrollDisplayName(scroll.nameKo),
```

Chaos scrolls use a fixed icon ID (2049100) instead of the scroll's own ID. The `simplifyScrollDisplayName()` function strips equipment prefixes: "장갑 혼돈의 주문서" → "혼돈의 주문서".

---

## 3. Key Optimizations That Prevent Combinatorial Explosion

| # | Optimization | Location | Effect |
|---|---|---|---|
| 1 | **Target-key scoping** | `generateChaosDeltas` line 53 | Only enumerates deltas for keys the user cares about (1–2 keys vs. 6–10 native keys) |
| 2 | **Zero-delta key pruning** | `generateChaosDeltas` line 66–72 | Skips keys where delta=0 and base=0 — chaos affecting non-existent stats is irrelevant |
| 3 | **Negative delta exclusion for positive targets** | `generateChaosDeltas` line 96–100 | Cuts the value space in half for positive-target stats |
| 4 | **Delta vector deduplication** | `enumerateExactCountScrollStates` lines 190–198 | Multiple chaos scrolls producing identical projected deltas → one pool entry |
| 5 | **Count-based chaos application** | `enumerateExactCountScrollStates` line 349 | Each unique delta vector is applied N times, not one-at-a-time per slot |
| 6 | **Bounds-introduced key guard** | `enumerateExactCountScrollStates` lines 330–333 | Prevents chaos from "creating" stats that don't exist on the item yet |
| 7 | **Positive-delta sort order** | `enumerateExactCountScrollStates` lines 199–203 | More useful deltas tried first → pruning fires earlier |
| 8 | **canReachTarget pruning** | `enumerateExactCountScrollStates` lines 230–255 | Computes per-key reachability using min/max from fixed scrolls + chaos pool + correction bounds |
| 9 | **DFS limit (100K)** | `generateChaosDeltas` line 107 | Safety valve preventing runaway delta enumeration |
| 10 | **Scroll state limit (150K)** | `enumerateStrategies` line 830 | Safety valve preventing runaway scroll state enumeration |
| 11 | **Strategy limit (10K)** | `enumerateStrategies` line 732 | Safety valve preventing rendering >10,000 strategies |

---

## 4. Complete Trace: Concrete Example

Let's trace a full chaos scroll calculation for a realistic scenario:

### Setup
- **Item**: 노가다 목장갑 (Work Glove), base stats: `{ weaponAttack: 0, str: 0, dex: 0, int: 0, luk: 0 }`
- **Target**: STR +10, DEX +5 (2 target keys)
- **Scroll slots**: 7 successes
- **Chaos rate checkbox**: checked
- **Chaos bounds**: default (`str: [-5, +5]`, `dex: [-5, +5]`)
- **Other sources**: stimulant enabled, gems disabled, itemLevelUp disabled

### Trace

1. **Scroll rate filtering**: Chaos scrolls for "Glove" are included in the pool

2. **Relevance filtering**: Chaos scrolls always pass. Fixed scrolls for STR and/or DEX also pass.

3. **Chaos delta generation** for a glove chaos scroll:
   - Native keys in scroll data: `{ str: 0, dex: 0, int: 0, luk: 0, weaponAttack: 0, magicAttack: 0, weaponDefense: 0, magicDefense: 0, maxHp: 0, maxMp: 0 }`
   - `scrollPoolKeys` = `['str', 'dex']` (only target keys that are in native data)
   - No bounds-introduced keys (all target keys are native)
   - Both keys pass pruning (target deltas are non-zero)
   - Per-key values for STR: `[0, 1, 2, 3, 4, 5]` — no negatives (target is +10)
   - Per-key values for DEX: `[0, 1, 2, 3, 4, 5]` — no negatives (target is +5)
   - DFS enumerates 6 × 6 = 36 delta vectors: `{str:0,dex:0}`, `{str:0,dex:1}`, ..., `{str:5,dex:5}`

4. **Chaos pool deduplication**: Across all glove chaos scrolls (60%, 100%, etc.), duplicate delta vectors are merged. Result: ~36 unique entries.

5. **DFS search** (7 slots, fixed scrolls + 36 chaos pool entries):
   - `canReachTarget` prunes branches using chaos pool per-key ranges: `str_mins={0}, str_maxs={5}, dex_mins={0}, dex_maxs={5}`
   - Correction from stimulant: `str: {min:0, max:0}` (base has no str), `dex: {min:0, max:0}` (base has no dex) — but `statExistsOnBase` check in stimulant rejects these because base stats are 0
   - Correction from other sources: 0 (gems and itemLevelUp disabled)
   - DFS finds scroll states whose net totals are within reach

6. **Strategy composition**: For each scroll state, the engine tries:
   - Scroll-only (Tier 0)
   - Scroll + stimulant (Tier 1) — fails because stimulant can't affect stats with base=0
   - Result: Only Tier 0 strategies are possible

7. **Exact match verification**: Each candidate's total stats must equal `{str: 10, dex: 5}` exactly

8. **Chaos spread scoring**: Strategies using chaos scrolls are ranked by how evenly their chaos contributions are distributed across STR and DEX

9. **Result display**: Chaos strategies have `behavior_type: 'chaos'` in their scroll entries, get icon 2049100, and get per-stat delta range sliders in the filter panel

---

## 5. Interactions with Other Sources

### Chaos + Stimulant

The stimulant `solveStimulantResidual()` in `sourceContributions.mjs` (line 13–41) checks:

```javascript
const statExistsOnBase = cleanStats && Number.isFinite(cleanStats[key]) && cleanStats[key] > 0;
if (!statExistsOnBase && value !== 0) return null;
```

Stimulant can only affect stats that exist on the clean base item. If chaos creates a stat value, stimulant can't add to it. This is consistent with game mechanics: the stimulant modifies existing stats based on the clean item, not stats added by scrolls.

### Chaos + ItemLevelUp

Item level-up contributions are pre-computed independent of chaos. In the `itemLevelUp` outer loop path (engine.mjs line 740), chaos scrolls are handled within the inner `enumerateExactCountScrollStates` call that searches for scroll combinations to fill the residual AFTER level-up stats are deducted. Chaos and itemLevelUp contributions are combined additively.

### Chaos + Gems

Gem contributions are also pre-computed independent of chaos. The same residual-filling approach applies: after deducting gem stats from the target, the engine searches for scroll (including chaos) combinations to fill the gap.

---

## 6. Summary

| Aspect | Assessment |
|---|---|
| **Chaos delta enumeration** | Correctly scoped to target keys; negative deltas excluded for positive targets; 100K limit prevents runaway |
| **Chaos pool deduplication** | Correctly merges scrolls with identical projected deltas; sorting by positive contribution optimizes DFS |
| **DFS integration** | Count-based chaos application avoids combinatorial explosion; guard prevents creating stats from zero |
| **Pruning** | canReachTarget correctly incorporates chaos min/max ranges alongside fixed scroll ranges |
| **Result accuracy** | isExactVector verification ensures chaos-inclusive strategies match targets exactly |
| **Result presentation** | chaosSpreadScore ranks non-chaos strategies first, then chaos by evenness; per-stat delta sliders in filter UI |
| **Inter-source interaction** | Stimulant correctly excluded for stats not on clean item; additive with gems and itemLevelUp |

The chaos scroll handling is the most architecturally sophisticated part of the deconstruction engine. The combination of target-key scoping, delta deduplication, count-based application, and multi-dimensional pruning successfully makes an otherwise intractable search problem solvable in real-time for practical use cases.
