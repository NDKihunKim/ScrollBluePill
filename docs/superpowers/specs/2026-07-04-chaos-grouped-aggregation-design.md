# Chaos Scroll Grouped Aggregation — Design Spec

**Date:** 2026-07-04
**Status:** Approved
**Scope:** Revise the chaos-scroll deconstruction model from individual slot decomposition to grouped slot aggregation

---

## 1. Problem

Currently, chaos-scroll results are represented per successful slot during deconstruction, which creates fragmented strategies:

```
x2 장갑 공격력 주문서 100%
x2 혼돈의 주문서 (└ 공격력 +5)
x1 혼돈의 주문서 (└ 공격력 +1)
```

The desired output is a grouped representation:

```
x2 장갑 공격력 주문서 100%
x3 혼돈의 주문서 (└ 공격력 +6)
```

For multi-stat targets, the format extends naturally:

```
x4 혼돈의 주문서 (└ 공격력 +11, STR +13)
```

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Search model + output (not just output) | Removes the most complex part of the solver |
| Verification | Trust the range (no per-slot decomposition check) | Dense delta space makes infeasibility rare; pragmatic choice |
| Chaos merge | Merge all chaos scrolls by simplified name | Single aggregate row is what users need operationally |

## 3. Architecture Overview

### Before (Current)

```
DFS branches on:
  ├─ Fixed scrolls (count-based)
  └─ Chaos pool entries (count-based)  ← 378 entries, per-key delta enumeration
       ↑
  generateChaosDeltas()  (75 lines — Cartesian product of per-key values)
  chaosPool dedup + sort (23 lines)
  per-key min/max for pruning (14 lines)
  chaosSpreadScore()     (21 lines — post-sort ranking)
```

### After (New)

```
DFS branches on:
  └─ Fixed scrolls (count-based) only

Terminal chaos step:
  "Can N chaos scrolls fill the residual stat vector?"
  → Range check: residual ∈ [N×min, N×max] per key
  → If yes, record aggregate chaos entry, yield result
```

### Net Code Change

- **Removed:** ~200 lines (`generateChaosDeltas`, chaos pool construction, chaos DFS branching, `chaosSpreadScore`)
- **Added:** ~60 lines (`canChaosFillResidual`, `buildAggregateChaosEntry`, simplified rendering, simplified filters)
- **Net:** ~140 lines removed

## 4. Engine Changes (`src/lib/deconstruction/engine.mjs`)

### 4.1 New: `canChaosFillResidual()`

Range check replacing the chaos delta pool enumeration. Accepts a residual stat vector and verifies every key's needed delta falls within `N × [minPerScroll, maxPerScroll]`.

```javascript
function canChaosFillResidual(residual, chaosCount, targetKeys, chaosStatBounds, cleanStats) {
  if (chaosCount <= 0) {
    return targetKeys.every((k) => (residual[k] || 0) === 0);
  }
  for (const key of targetKeys) {
    const needed = residual[key] || 0;
    const defaultRange = HP_MP_KEYS.has(key) ? { min: -50, max: 50 } : { min: -5, max: 5 };
    const bounds = chaosStatBounds?.[key];
    const min = bounds && Number.isFinite(bounds.min)
      ? Math.max(defaultRange.min, bounds.min) : defaultRange.min;
    const max = bounds && Number.isFinite(bounds.max)
      ? Math.min(defaultRange.max, bounds.max) : defaultRange.max;
    if (needed < chaosCount * min || needed > chaosCount * max) return false;
  }
  return true;
}
```

### 4.2 Removed: `generateChaosDeltas()`

The 75-line generator that enumerated Cartesian products of per-key chaos delta values. No longer needed — range check replaces it.

### 4.3 Simplified: `enumerateExactCountScrollStates()`

- DFS branches on fixed scrolls only
- Chaos scrolls are pre-processed to extract per-key min/max ranges (from `chaosStatBounds`, not from pool enumeration)
- Terminal step: after fixed scrolls, if residual can be filled by chaos, yield a result with an aggregate chaos entry
- `canReachTarget()` uses chaos bounds instead of pool-derived min/max

### 4.4 New: `buildAggregateChaosEntry()`

```javascript
function buildAggregateChaosEntry({ representativeScroll, count, totalStats }) {
  return {
    id: representativeScroll.id,
    nameKo: representativeScroll.nameKo,
    stats: { ...totalStats },
    behavior_type: 'chaos',
    isAggregate: true,
    aggregateCount: count,
  };
}
```

### 4.5 Updated: `buildResult()`

Preserves `isAggregate` and `aggregateCount` on scroll entries.

### 4.6 Updated: `strategyCanonicalKey()`

Aggregate chaos entries are keyed by `id + total aggregate stats`. Two strategies that reach the same aggregate chaos totals through different per-slot decompositions produce the same key and are deduplicated — this is intentional.

### 4.7 Removed: `chaosSpreadScore()`

With aggregate chaos, there is only one chaos entry per strategy. Sorting simplifies to priority rank only, with non-chaos strategies ranked first within each tier.

## 5. Output & Rendering Changes (`src/pages/deconstruction.astro`)

### 5.1 Scroll Grouping

Aggregate chaos entries carry their own count (`aggregateCount`), so the grouping loop is trivial:

```javascript
if (s.isAggregate) {
  scrollGroups.set(`agg:${s.id}`, { scroll: s, count: s.aggregateCount });
} else {
  // Fixed scrolls — group by id as before
}
```

### 5.2 Display Format

```
x3 혼돈의 주문서
└ 공격력 +6

x4 혼돈의 주문서
└ 공격력 +11, STR +13
```

The existing `sortStatEntries` + `effects.join(', ')` pattern works unchanged.

### 5.3 Name Simplification

`simplifyScrollDisplayName()` already strips equipment prefixes. Per Option A, all chaos variants (60%, 100%) merge under the same simplified name "혼돈의 주문서".

## 6. Filter Changes

### 6.1 `resultFilters.mjs`

- `chaosDeltaInRange()`: Simplified from per-scroll iteration to a single aggregate check
- `getStrategySecondaryOptions()`: Single chaos option instead of per-delta-pattern options
- `buildSecondaryFilterModel()`: Simplified scroll counting for aggregate entries

### 6.2 `resultFilterController.mjs`

Chaos delta sliders change from per-scroll-per-stat to per-stat-aggregate. One slider per stat key showing the aggregate range across all strategies.

## 7. Testing Strategy

### 7.1 New Unit Tests: `canChaosFillResidual()`

| Test | Input | Expected |
|------|-------|----------|
| Zero chaos, zero residual | `count=0, residual={wa:0}` | `true` |
| Zero chaos, non-zero residual | `count=0, residual={wa:5}` | `false` |
| Single key, in range | `count=3, residual={wa:9}` (range ±5) | `true` |
| Single key, above max | `count=3, residual={wa:16}` (max 15) | `false` |
| Single key, below min | `count=3, residual={wa:-16}` (min -15) | `false` |
| At boundary | `count=3, residual={wa:15}` | `true` |
| Multi-key, all in range | `count=2, residual={wa:7, str:-4}` | `true` |
| Multi-key, one out | `count=2, residual={wa:7, str:12}` | `false` |
| Custom bounds | `count=3, residual={wa:9}`, bounds `{wa:{min:0,max:3}}` | `true` |
| Custom bounds reject | `count=3, residual={wa:12}`, bounds `{wa:{min:0,max:3}}` | `false` |
| HP/MP wider range | `count=1, residual={maxHp:40}` | `true` |
| HP/MP out of range | `count=1, residual={maxHp:60}` | `false` |

### 7.2 Integration Tests: `enumerateExactCountScrollStates()`

| Test | Expected |
|------|----------|
| Fixed-only, no chaos | Strategy: `x1 fixed` |
| Fixed + chaos aggregate | Strategy: `x1 fixed`, `x1 chaos agg` |
| Chaos-only | Strategy: `x1 chaos agg` |
| Chaos insufficient | 0 strategies |
| Multi-stat chaos aggregate | Aggregate fills both stats |
| Fixed overshoot | 0 strategies |
| Aggregate entry structure | `isAggregate: true`, `aggregateCount: N` |

### 7.3 Existing Tests to Update

| File | Change |
|------|--------|
| `deconstruction-engine.test.mjs` | Remove chaos pool, delta generation, spread score tests |
| `deconstruction-result-filters.test.mjs` | Update `chaosDeltaInRange`, secondary options |
| `deconstruction-result-filter-controller.test.mjs` | Update slider range computation |
| `deconstruction-ui-contract.test.mjs` | Update rendering assertions for grouped format |

## 8. Files Changed

| File | Nature of change |
|------|-----------------|
| `src/lib/deconstruction/engine.mjs` | Major — remove ~150 lines, add ~40 lines |
| `src/pages/deconstruction.astro` | Minor — simplify scroll grouping loop |
| `src/lib/deconstruction/resultFilters.mjs` | Minor — simplify chaos filter functions |
| `src/lib/deconstruction/resultFilterController.mjs` | Minor — simplify chaos slider to per-stat |
| `tests/deconstruction-engine.test.mjs` | Update chaos-specific tests |
| `tests/deconstruction-result-filters.test.mjs` | Update aggregate chaos filter tests |
| `tests/deconstruction-result-filter-controller.test.mjs` | Update slider range tests |
| `tests/deconstruction-ui-contract.test.mjs` | Update rendering assertions |

## 9. Non-Goals

- The expected-value calculator (`src/lib/expectedValue/`) is **untouched** — it uses its own `chaosModel.mjs` for probabilistic expected value, not deconstruction
- No changes to scroll data loading, item search, or stimulant/gem/itemLevelUp handling
- No changes to the chaos bounds UI (the dual-range sliders for constraining chaos ranges before solving remain as-is)

## 10. Rollback Safety

All changes are contained within the deconstruction path. The expected-value calculator has no shared state with the deconstruction engine. Git history provides clean rollback if needed.
