# Chaos Scroll Grouped Aggregation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-slot chaos delta enumeration and DFS branching with a terminal aggregate range check, producing grouped chaos output.

**Architecture:** Remove `generateChaosDeltas()`, chaos pool construction, and chaos DFS branching from the engine. Add `canChaosFillResidual()` range check as a terminal step after fixed scrolls. Chaos entries carry `isAggregate: true` with `aggregateCount` — rendering and filters use this instead of per-entry grouping.

**Tech Stack:** Node.js, vanilla JS (no framework), Astro page rendering

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/deconstruction/engine.mjs` | Core deconstruction solver — DFS, result building, dedup |
| `src/pages/deconstruction.astro` | UI — renders strategy cards, handles user interaction |
| `src/lib/deconstruction/resultFilters.mjs` | Filter model — secondary options, range checks, facet computation |
| `src/lib/deconstruction/resultFilterController.mjs` | Filter UI — builds DOM for sliders, wires events |

---

### Task 1: Write unit tests for `canChaosFillResidual()`

**Files:**
- Modify: `tests/deconstruction-engine.test.mjs`

- [ ] **Step 1: Add the test suite for `canChaosFillResidual`**

Since `canChaosFillResidual` is not yet exported, we'll first write the tests that import it. Add this test block after the existing imports in `tests/deconstruction-engine.test.mjs` (after line 4):

```javascript
import { enumerateStrategies } from '../src/lib/deconstruction/engine.mjs';
```

We'll test `canChaosFillResidual` by importing it once exported. For now, write the tests expecting the import to exist. Add at the end of the file:

```javascript
// ── canChaosFillResidual ──

test('canChaosFillResidual: zero chaos, zero residual', () => {
  // Imported dynamically after export is added
  // Test body will be filled in Task 2 after function exists
});

test('canChaosFillResidual: zero chaos, non-zero residual returns false', () => {
});

test('canChaosFillResidual: single key in range', () => {
});

test('canChaosFillResidual: single key above max returns false', () => {
});

test('canChaosFillResidual: single key below min returns false', () => {
});

test('canChaosFillResidual: at exact boundary', () => {
});

test('canChaosFillResidual: multi-key all in range', () => {
});

test('canChaosFillResidual: multi-key one out of range returns false', () => {
});

test('canChaosFillResidual: custom bounds applied', () => {
});

test('canChaosFillResidual: custom bounds reject', () => {
});

test('canChaosFillResidual: HP/MP wider range', () => {
});

test('canChaosFillResidual: HP/MP out of range returns false', () => {
});
```

Wait — we can't test a non-exported function. Let me restructure: we'll add the tests with the actual test bodies but use `enumerateStrategies` integration tests to verify behavior indirectly, then add direct unit tests once the function is exported in Task 2.

Actually, a better approach: we export `canChaosFillResidual` from the engine module so it's testable. Let me adjust the plan:

- [ ] **Step 1: Write the failing test file additions**

Add to `tests/deconstruction-engine.test.mjs` after line 4:

```javascript
import { enumerateStrategies, canChaosFillResidual } from '../src/lib/deconstruction/engine.mjs';
```

Append at end of file:

```javascript
// ── canChaosFillResidual ──

test('canChaosFillResidual: zero chaos, zero residual returns true', () => {
  const result = canChaosFillResidual(
    { weaponAttack: 0 },
    0,
    ['weaponAttack'],
    null,
    {},
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: zero chaos, non-zero residual returns false', () => {
  const result = canChaosFillResidual(
    { weaponAttack: 5 },
    0,
    ['weaponAttack'],
    null,
    {},
  );
  assert.equal(result, false);
});

test('canChaosFillResidual: single key in range', () => {
  // 3 scrolls × [-5,+5] = [-15,+15], need +9 → in range
  const result = canChaosFillResidual(
    { weaponAttack: 9 },
    3,
    ['weaponAttack'],
    null,
    {},
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: single key above max returns false', () => {
  // 3 scrolls × [+5 max] = +15 max, need +16 → out of range
  const result = canChaosFillResidual(
    { weaponAttack: 16 },
    3,
    ['weaponAttack'],
    null,
    {},
  );
  assert.equal(result, false);
});

test('canChaosFillResidual: single key below min returns false', () => {
  // 3 scrolls × [-5 min] = -15 min, need -16 → out of range
  const result = canChaosFillResidual(
    { weaponAttack: -16 },
    3,
    ['weaponAttack'],
    null,
    {},
  );
  assert.equal(result, false);
});

test('canChaosFillResidual: at exact boundary', () => {
  // 3 scrolls × [+5 max] = +15 max, need +15 → at boundary, in range
  const result = canChaosFillResidual(
    { weaponAttack: 15 },
    3,
    ['weaponAttack'],
    null,
    {},
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: multi-key all in range', () => {
  // 2 scrolls × [-5,+5] per key = [-10,+10] per key
  // need {wa:7, str:-4} → both in range
  const result = canChaosFillResidual(
    { weaponAttack: 7, str: -4 },
    2,
    ['weaponAttack', 'str'],
    null,
    {},
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: multi-key one out of range returns false', () => {
  // 2 scrolls × [+5 max on str] = +10 max, need +12 → str out of range
  const result = canChaosFillResidual(
    { weaponAttack: 7, str: 12 },
    2,
    ['weaponAttack', 'str'],
    null,
    {},
  );
  assert.equal(result, false);
});

test('canChaosFillResidual: custom bounds applied — in range', () => {
  // Custom bounds {weaponAttack: {min:0, max:3}}
  // 3 scrolls × [0,+3] = [0,+9], need +9 → in range
  const result = canChaosFillResidual(
    { weaponAttack: 9 },
    3,
    ['weaponAttack'],
    { weaponAttack: { min: 0, max: 3 } },
    {},
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: custom bounds reject — above max', () => {
  // Custom bounds {weaponAttack: {min:0, max:3}}
  // 3 scrolls × [0,+3] = [0,+9], need +12 → out of range
  const result = canChaosFillResidual(
    { weaponAttack: 12 },
    3,
    ['weaponAttack'],
    { weaponAttack: { min: 0, max: 3 } },
    {},
  );
  assert.equal(result, false);
});

test('canChaosFillResidual: HP/MP wider default range', () => {
  // 1 scroll × [-50,+50], need +40 → in range
  const result = canChaosFillResidual(
    { maxHp: 40 },
    1,
    ['maxHp'],
    null,
    {},
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: HP/MP out of range returns false', () => {
  // 1 scroll × [-50,+50], need +60 → out of range
  const result = canChaosFillResidual(
    { maxHp: 60 },
    1,
    ['maxHp'],
    null,
    {},
  );
  assert.equal(result, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/deconstruction-engine.test.mjs 2>&1 | head -20
```

Expected: SyntaxError or ReferenceError because `canChaosFillResidual` is not exported from engine.mjs.

- [ ] **Step 3: Commit**

```bash
git add tests/deconstruction-engine.test.mjs
git commit -m "test: add canChaosFillResidual unit tests (failing — function not yet exported)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Add `canChaosFillResidual()` and `buildAggregateChaosEntry()` to engine.mjs

**Files:**
- Modify: `src/lib/deconstruction/engine.mjs`

- [ ] **Step 1: Add `canChaosFillResidual()` after `getChaosRange()` (after line 45)**

Insert after line 45 (`}` closing `getChaosRange`):

```javascript
/**
 * Check whether N chaos scrolls can collectively produce the residual stat vector.
 * Uses the "trust the range" approach — each chaos scroll independently
 * contributes within [perScrollMin, perScrollMax] per key.
 *
 * @param {Record<string,number>} residual - Stats still needed after fixed scrolls
 * @param {number} chaosCount - Number of chaos scroll slots available
 * @param {string[]} targetKeys - Stat keys being targeted
 * @param {object|null} chaosStatBounds - User-specified per-key min/max, or null for defaults
 * @returns {boolean}
 */
function canChaosFillResidual(residual, chaosCount, targetKeys, chaosStatBounds) {
  if (chaosCount <= 0) {
    return targetKeys.every((k) => (residual[k] || 0) === 0);
  }

  for (const key of targetKeys) {
    const needed = residual[key] || 0;
    const defaultRange = getChaosRange(key);
    const bounds = chaosStatBounds?.[key];
    const min = bounds && Number.isFinite(bounds.min)
      ? Math.max(defaultRange.min, bounds.min)
      : defaultRange.min;
    const max = bounds && Number.isFinite(bounds.max)
      ? Math.min(defaultRange.max, bounds.max)
      : defaultRange.max;

    const minPossible = chaosCount * min;
    const maxPossible = chaosCount * max;

    if (needed < minPossible || needed > maxPossible) return false;
  }
  return true;
}

/**
 * Build a single aggregate chaos entry representing N chaos scrolls
 * that collectively produce totalStats.
 *
 * @param {object} opts
 * @param {object} opts.representativeScroll - Any chaos scroll (used for id, nameKo)
 * @param {number} opts.count - Number of chaos scrolls
 * @param {Record<string,number>} opts.totalStats - Aggregate stat contribution
 * @returns {object}
 */
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

- [ ] **Step 2: Export `canChaosFillResidual`**

Add `canChaosFillResidual` to the export block. Find the `export function enumerateStrategies` line and add a named export before it. Insert after the last import line (line 15) and before `const MAX_DISPLAY_STRATEGIES` (line 17):

```javascript
export { canChaosFillResidual };
```

- [ ] **Step 3: Run the new unit tests**

```bash
node --test tests/deconstruction-engine.test.mjs 2>&1 | tail -20
```

Expected: All 12 new tests pass (the function is now exported), existing tests may have failures from the import change.

- [ ] **Step 4: Commit**

```bash
git add src/lib/deconstruction/engine.mjs
git commit -m "feat: add canChaosFillResidual and buildAggregateChaosEntry functions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Simplify the DFS — remove chaos branching, add terminal chaos step

**Files:**
- Modify: `src/lib/deconstruction/engine.mjs`

This is the core change. We remove `generateChaosDeltas()` entirely, remove the chaos pool construction, and replace the chaos DFS branching with a terminal aggregate check.

- [ ] **Step 1: Remove `generateChaosDeltas()` generator (lines 47-121)**

Delete the entire `generateChaosDeltas` function (lines 47-121 inclusive). This removes ~75 lines.

- [ ] **Step 2: Rewrite `enumerateExactCountScrollStates()` — remove chaos pool, simplify DFS**

Replace the current function body (from line 128 to line 370). The new version keeps fixed scroll filtering and DFS, but chaos is handled as a terminal step.

Replace the function starting at line 128 (`function* enumerateExactCountScrollStates({`) through line 370 (the closing `}` and `yield* dfs(...)` call). The new code:

```javascript
function* enumerateExactCountScrollStates({
  scrolls: allScrolls,
  targetKeys,
  targetDeltas,
  successfulScrollCount,
  correctionBounds,
  chaosStatBounds = null,
  cleanStats = null,
}) {
  const requiredScrollCount = (() => {
    try {
      const n = Number(successfulScrollCount);
      return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    } catch {
      return 0;
    }
  })();
  if (requiredScrollCount === 0) return [];

  // Filter scrolls to those touching at least one checked key.
  // Chaos scrolls always pass — they can affect any stat.
  const relevantScrolls = allScrolls.filter((s) =>
    isChaosScroll(s) || targetKeys.some((k) => (s.stats?.[k] || 0) !== 0),
  );
  if (relevantScrolls.length === 0) return [];

  const fixedScrolls = relevantScrolls
    .filter((s) => !isChaosScroll(s))
    .sort((a, b) => a.id - b.id);

  const chaosScrolls = relevantScrolls
    .filter((s) => isChaosScroll(s))
    .sort((a, b) => a.id - b.id);

  const hasChaosAvailable = chaosScrolls.length > 0;

  // Pre-compute chaos per-key min/max for pruning (from bounds, not pool)
  const chaosMins = {};
  const chaosMaxs = {};
  if (hasChaosAvailable) {
    for (const k of targetKeys) {
      const dr = getChaosRange(k);
      chaosMins[k] = chaosStatBounds?.[k]?.min ?? dr.min;
      chaosMaxs[k] = chaosStatBounds?.[k]?.max ?? dr.max;
    }
  }

  function canReachTarget(fixedIdx, remainingApps, currentStats) {
    for (const key of targetKeys) {
      let minPerApp = remainingApps === 0 ? 0 : Infinity;
      let maxPerApp = remainingApps === 0 ? 0 : -Infinity;

      for (let i = fixedIdx; i < fixedScrolls.length; i++) {
        const value = fixedScrolls[i].stats?.[key] || 0;
        minPerApp = Math.min(minPerApp, value);
        maxPerApp = Math.max(maxPerApp, value);
      }
      if (hasChaosAvailable && chaosMins[key] != null) {
        minPerApp = Math.min(minPerApp, chaosMins[key]);
        maxPerApp = Math.max(maxPerApp, chaosMaxs[key]);
      }

      if (!Number.isFinite(minPerApp)) return false;

      const correction = correctionBounds[key] ?? { min: 0, max: 0 };
      const current = currentStats[key] || 0;
      const minReachable = current + remainingApps * minPerApp + correction.min;
      const maxReachable = current + remainingApps * maxPerApp + correction.max;
      const target = targetDeltas[key] ?? 0;
      if (target < minReachable || target > maxReachable) return false;
    }
    return true;
  }

  function* dfs(fixedIdx, remainingApps, currentStats, chosen) {
    if (!canReachTarget(fixedIdx, remainingApps, currentStats)) return;

    if (chosen.length >= requiredScrollCount) {
      // Terminal: all slots allocated
      // Check if we hit the target exactly (fixed-only)
      if (targetKeys.every((k) => (currentStats[k] || 0) === (targetDeltas[k] || 0))) {
        yield {
          scrolls: [...chosen],
          stats: { ...currentStats },
        };
      }
      return;
    }

    const remainingSlots = requiredScrollCount - chosen.length;

    // Check if remaining slots can be filled by chaos to reach target
    if (hasChaosAvailable && remainingSlots > 0) {
      // Compute residual: what chaos must contribute
      const residual = {};
      let hasNonZeroResidual = false;
      for (const k of targetKeys) {
        residual[k] = (targetDeltas[k] ?? 0) - (currentStats[k] || 0);
        if (residual[k] !== 0) hasNonZeroResidual = true;
      }

      // Check if remaining slots can fill this residual via chaos
      // Use the adjusted remaining (subtract what fixed scrolls at this depth need)
      // We check: can `remainingSlots` chaos scrolls produce residual?
      const chaosCanFill = canChaosFillResidual(
        residual,
        remainingSlots,
        targetKeys,
        chaosStatBounds,
      );

      if (chaosCanFill) {
        // Yield a strategy with fixed scrolls + aggregate chaos
        const chaosEntry = buildAggregateChaosEntry({
          representativeScroll: chaosScrolls[0],
          count: remainingSlots,
          totalStats: residual,
        });
        const allScrolls = [...chosen, chaosEntry];
        const allStats = { ...currentStats };
        for (const k of targetKeys) {
          allStats[k] = (allStats[k] || 0) + (residual[k] || 0);
        }
        yield {
          scrolls: allScrolls,
          stats: allStats,
        };
      }
    }

    if (remainingSlots <= 0) return;

    // Try fixed scrolls (only branching path)
    for (let i = fixedIdx; i < fixedScrolls.length; i++) {
      const scroll = fixedScrolls[i];
      const stats = scroll.stats;

      let maxUses = remainingSlots;
      for (const k of targetKeys) {
        const delta = stats[k] || 0;
        const remaining = (targetDeltas[k] ?? 0) - (currentStats[k] || 0);
        if (delta > 0 && remaining > 0) {
          maxUses = Math.min(maxUses, Math.floor(remaining / delta));
        }
      }

      if (maxUses <= 0) continue;

      for (let count = maxUses; count >= 1; count--) {
        const newStats = { ...currentStats };
        for (const [k, v] of Object.entries(stats)) {
          if (Number.isFinite(v) && targetKeys.includes(k)) {
            newStats[k] = (newStats[k] || 0) + v * count;
          }
        }
        const newChosen = [...chosen];
        for (let c = 0; c < count; c++) {
          newChosen.push({
            id: scroll.id,
            nameKo: scroll.nameKo,
            stats: { ...stats },
          });
        }
        yield* dfs(i + 1, remainingSlots - count, newStats, newChosen);
      }
    }
  }

  const zeroStats = Object.fromEntries(targetKeys.map((k) => [k, 0]));
  yield* dfs(0, requiredScrollCount, zeroStats, []);
}
```

- [ ] **Step 2: Remove `chaosSpreadScore()` function (lines 404-424)**

Delete the entire `chaosSpreadScore` function (lines 404-424 inclusive).

- [ ] **Step 3: Update the sort in `enumerateStrategies()` (lines 987-993)**

Replace the sort block (lines 987-993):

```javascript
  // Sort strategies within each priority tier:
  //   1. priorityRank ascending
  //   2. Non-chaos strategies before chaos strategies
  strategies.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    const aHasChaos = a.scrolls.some((s) => s.behavior_type === 'chaos');
    const bHasChaos = b.scrolls.some((s) => s.behavior_type === 'chaos');
    return (aHasChaos ? 1 : 0) - (bHasChaos ? 1 : 0);
  });
```

- [ ] **Step 4: Remove debug console.log statements referencing chaos pool**

Delete the debug log on line 166 (`console.log('[chaos-debug] enumerateExactCountScrollStates:'...`) through line 175. This block references `chaosScrollsRaw` which no longer exists.

Delete the chaos pool debug log on lines 205-212.

Delete the chaos per-key ranges debug log on lines 225-228.

- [ ] **Step 5: Run existing deconstruction tests**

```bash
node --test tests/deconstruction-engine.test.mjs 2>&1 | tail -30
```

Some existing tests may need updates (chaos-specific test cases). Fix any failures in the next task.

- [ ] **Step 6: Commit**

```bash
git add src/lib/deconstruction/engine.mjs
git commit -m "refactor: replace chaos pool DFS branching with terminal aggregate step

Remove generateChaosDeltas, chaos pool construction, chaosSpreadScore.
Add terminal chaos check using canChaosFillResidual.
DFS now branches on fixed scrolls only.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Update `buildResult()` and `strategyCanonicalKey()` for aggregate chaos

**Files:**
- Modify: `src/lib/deconstruction/engine.mjs`

- [ ] **Step 1: Update `buildResult()` scroll mapping (lines 433-438)**

Replace lines 433-438:

```javascript
  const scrollEntries = scrolls.map((s) => ({
    id: s.id,
    nameKo: s.nameKo,
    stats: { ...s.stats },
    behavior_type: s.behavior_type,
    ...(s.isAggregate ? { isAggregate: true, aggregateCount: s.aggregateCount } : {}),
  }));
```

- [ ] **Step 2: Update `strategyCanonicalKey()` (lines 375-397)**

Replace the existing `strategyCanonicalKey` function (lines 375-397):

```javascript
function strategyCanonicalKey({ scrolls, stimulant, gems, itemLevelUp }, targetKeys) {
  const scrollPart = scrolls
    .map((s) => {
      if (s.isAggregate) {
        // Aggregate chaos: key by id + total aggregate stats
        const statKeys = Object.keys(s.stats).sort();
        const statPart = statKeys.map((k) => `${k}:${s.stats[k]}`).join(',');
        return `${s.id}:agg[${statPart}]`;
      }
      const statKeys = Object.keys(s.stats).sort();
      const statPart = statKeys.map((k) => `${k}:${s.stats[k]}`).join(',');
      return `${s.id}[${statPart}]`;
    })
    .sort()
    .join('|');

  const stimPart = stimulant ? `stim:${vectorKey(stimulant.stats, targetKeys)}` : 'stim:none';

  const gemPart = gems
    .map((g) => `${g.gemKey}:${g.gradeIndex}:${vectorKey(g.stats, targetKeys)}`)
    .sort()
    .join('|') || 'gems:none';

  const levelPart = itemLevelUp
    ? `level:${itemLevelUp.levelCount}:${vectorKey(itemLevelUp.stats, targetKeys)}`
    : 'level:none';

  return `${scrollPart}|${stimPart}|${gemPart}|${levelPart}`;
}
```

- [ ] **Step 3: Run tests**

```bash
node --test tests/deconstruction-engine.test.mjs 2>&1 | tail -15
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/deconstruction/engine.mjs
git commit -m "feat: update buildResult and strategyCanonicalKey for aggregate chaos entries

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Update existing engine tests for new chaos behavior

**Files:**
- Modify: `tests/deconstruction-engine.test.mjs`

- [ ] **Step 1: Review and update failing tests**

Run the full test suite:

```bash
node --test tests/deconstruction-engine.test.mjs 2>&1
```

For each failing test, determine if the test:
1. Tests removed functionality (generateChaosDeltas, chaos pool) → remove the test
2. Tests behavior that changed (chaos output shape) → update assertions
3. Tests unchanged behavior but broke due to refactoring → fix the test setup

Common update patterns:

- Tests that check `scroll.stats` for chaos entries should now check for `isAggregate: true` and `aggregateCount`
- Tests that expect multiple chaos scroll entries should now expect a single aggregate entry
- Tests that reference `chaosSpreadScore` sorting should expect simpler sort (priority rank only)
- Remove any test that validates the `generateChaosDeltas` output shape

- [ ] **Step 2: Add integration test for aggregate chaos output shape**

Add to `tests/deconstruction-engine.test.mjs`:

```javascript
test('chaos aggregate entry has isAggregate and aggregateCount', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 2001,
      nameKo: '장갑 혼돈의 주문서 60%',
      equipmentKind: 'Glove',
      behavior_type: 'chaos',
      stats: { weaponAttack: 0, str: 0, dex: 0, int: 0, luk: 0 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 5 },
    targetKeys: ['weaponAttack'],
    successfulScrollCount: 1,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
    scrollRateFilter: new Set(['chaos']),
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
  });

  assert.ok(result.strategies.length > 0, 'should find at least one chaos strategy');
  const chaosScrolls = result.strategies[0].scrolls.filter(s => s.behavior_type === 'chaos');
  assert.equal(chaosScrolls.length, 1, 'should have exactly one aggregate chaos entry');
  assert.equal(chaosScrolls[0].isAggregate, true);
  assert.equal(chaosScrolls[0].aggregateCount, 1);
  assert.equal(chaosScrolls[0].stats.weaponAttack, 5);
});

test('chaos-only strategy with multiple slots produces single aggregate entry', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 2001,
      nameKo: '장갑 혼돈의 주문서 60%',
      equipmentKind: 'Glove',
      behavior_type: 'chaos',
      stats: { weaponAttack: 0 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 8 },
    targetKeys: ['weaponAttack'],
    successfulScrollCount: 3,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
    scrollRateFilter: new Set(['chaos']),
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
  });

  assert.ok(result.strategies.length > 0, 'should find at least one strategy');
  const chaosScrolls = result.strategies[0].scrolls.filter(s => s.behavior_type === 'chaos');
  assert.equal(chaosScrolls.length, 1, 'should have exactly one aggregate chaos entry');
  assert.equal(chaosScrolls[0].aggregateCount, 3);
  assert.equal(chaosScrolls[0].stats.weaponAttack, 8);
});

test('chaos insufficient to fill residual returns no strategies', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 2001,
      nameKo: '장갑 혼돈의 주문서 60%',
      equipmentKind: 'Glove',
      behavior_type: 'chaos',
      stats: { weaponAttack: 0 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 20 },
    targetKeys: ['weaponAttack'],
    successfulScrollCount: 1,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
    scrollRateFilter: new Set(['chaos']),
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
  });

  assert.equal(result.strategies.length, 0, 'chaos cannot produce +20 from 1 scroll');
});
```

- [ ] **Step 3: Run tests**

```bash
node --test tests/deconstruction-engine.test.mjs 2>&1 | tail -15
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/deconstruction-engine.test.mjs
git commit -m "test: update engine tests for aggregate chaos model

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Update output rendering in `deconstruction.astro`

**Files:**
- Modify: `src/pages/deconstruction.astro`

- [ ] **Step 1: Update scroll grouping logic (lines 2502-2515)**

Replace lines 2502-2515:

```javascript
    // 2. Scrolls — grouped by ID for fixed, aggregate entries carry their own count
    const scrollGroups = new Map();
    for (const s of strategy.scrolls) {
      if (s.isAggregate) {
        // Aggregate chaos entry — already grouped, use its own count
        const groupKey = `agg:${s.id}`;
        scrollGroups.set(groupKey, { scroll: s, count: s.aggregateCount });
      } else {
        // Fixed scroll — group by id (all applications have identical stats)
        const groupKey = String(s.id);
        if (!scrollGroups.has(groupKey)) {
          scrollGroups.set(groupKey, { scroll: s, count: 0 });
        }
        scrollGroups.get(groupKey).count++;
      }
    }
```

- [ ] **Step 2: Verify the display name for aggregate chaos uses simplified name**

The existing `simplifyScrollDisplayName(group.scroll.nameKo)` on line 2547 already strips the equipment prefix. The aggregate entry preserves the `nameKo` from the representative scroll, which will typically be something like "장갑 혼돈의 주문서 60%". With Option A (merge by name), all chaos variants appear under the same simplified name "혼돈의 주문서".

The existing `simplifyScrollDisplayName` (defined on lines 374-377) strips equipment prefix but keeps the rate. Per the spec, we merge all chaos rates. Add a small helper or adjust the name resolution in the grouping step:

Find `simplifyScrollDisplayName` on line 374:

```javascript
function simplifyScrollDisplayName(nameKo) {
  const match = String(nameKo ?? '').match(/(혼돈의 주문서.*)$/);
  return match ? match[1] : nameKo;
}
```

Replace with:

```javascript
function simplifyScrollDisplayName(nameKo) {
  const match = String(nameKo ?? '').match(/(혼돈의 주문서.*)$/);
  return match ? match[1] : nameKo;
}

function simplifyChaosAggregateName(nameKo) {
  // "장갑 혼돈의 주문서 60%" → "혼돈의 주문서"
  const match = String(nameKo ?? '').match(/(혼돈의 주문서)/);
  return match ? match[1] : nameKo;
}
```

Then in the rendering loop (around line 2547), use `simplifyChaosAggregateName` for aggregate entries:

```javascript
        const label = document.createElement('span');
        label.textContent = group.scroll.isAggregate
          ? simplifyChaosAggregateName(group.scroll.nameKo)
          : simplifyScrollDisplayName(group.scroll.nameKo);
        topLine.append(label);
```

- [ ] **Step 3: Verify multi-stat sub-line rendering works for aggregate chaos**

The existing sub-line rendering (lines 2553-2561) already handles multi-stat via `effects.join(', ')`:

```javascript
        const effects = sortStatEntries(Object.entries(group.scroll.stats))
          .filter(([, v]) => v !== 0)
          .map(([k, v]) => `${statLabelByKey[k] ?? k} ${v > 0 ? '+' : ''}${v}`);
        const subLine = document.createElement('span');
        subLine.className = 'decon-scroll-name-sub';
        subLine.textContent = effects.length > 0
          ? `└ ${effects.join(', ')}`
          : '└ 변동없음';
```

This code is already correct for aggregate chaos entries — the entry's `.stats` contains the total aggregate (e.g., `{weaponAttack: 11, str: 13}`), and `effects.join(', ')` produces `공격력 +11, STR +13`.

No changes needed to this block.

- [ ] **Step 4: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: render grouped chaos entries with aggregate count and simplified name

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Simplify chaos filters in `resultFilters.mjs`

**Files:**
- Modify: `src/lib/deconstruction/resultFilters.mjs`

- [ ] **Step 1: Update `getStrategySecondaryOptions()` chaos option generation (lines 75-85)**

Replace the scroll option generation in `getStrategySecondaryOptions` (lines 75-85):

```javascript
  const scrolls = uniqueOptions((strategy.scrolls ?? []).map((scroll) => {
    if (scroll.isAggregate) {
      return {
        source: 'scrolls',
        key: 'scroll:chaos:aggregate',
        label: simplifyScrollDisplayName(scroll.nameKo) ?? String(scroll.id),
        iconId: 2049100,
        stats: { ...scroll.stats },
        statKeys: getScrollStatKeys(scroll.stats),
        behaviorType: 'chaos',
        isAggregate: true,
        sortKey: 'chaos:aggregate',
      };
    }
    return {
      source: 'scrolls',
      key: `scroll:${scroll.id}`,
      label: simplifyScrollDisplayName(scroll.nameKo) ?? String(scroll.id),
      iconId: scroll.behavior_type === 'chaos' ? 2049100 : scroll.id,
      stats: { ...scroll.stats },
      statKeys: getScrollStatKeys(scroll.stats),
      behaviorType: scroll.behavior_type ?? 'normal',
      sortKey: buildScrollSortKey(scroll),
    };
  }));
```

- [ ] **Step 2: Update `chaosDeltaInRange()` (lines 214-226)**

Replace lines 214-226:

```javascript
function chaosDeltaInRange(entry, chaosRanges) {
  if (!chaosRanges || chaosRanges.size === 0) return true;
  // With aggregate chaos, check the single aggregate entry's total stats
  const chaosEntry = (entry.strategy.scrolls ?? []).find(
    (s) => s.behavior_type === 'chaos' && s.isAggregate,
  );
  if (!chaosEntry) return true;
  for (const [statKey, { min, max }] of chaosRanges) {
    const value = chaosEntry.stats?.[statKey] ?? 0;
    if (value < min || value > max) return false;
  }
  return true;
}
```

- [ ] **Step 3: Update `buildSecondaryFilterModel()` scroll counting (lines 128-134)**

Replace the scroll counting block (lines 128-134):

```javascript
    // Count how many times each scroll appears in this strategy
    const scrollCounts = new Map();
    for (const scroll of (strategy.scrolls ?? [])) {
      if (scroll.isAggregate) {
        // Aggregate chaos: keyed by aggregate marker, count = aggregateCount
        scrollCounts.set('scroll:chaos:aggregate', scroll.aggregateCount);
      } else {
        const key = `scroll:${scroll.id}`;
        scrollCounts.set(key, (scrollCounts.get(key) || 0) + 1);
      }
    }
```

- [ ] **Step 4: Run filter tests**

```bash
node --test tests/deconstruction-result-filters.test.mjs 2>&1 | tail -15
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/deconstruction/resultFilters.mjs
git commit -m "feat: simplify chaos filters for aggregate chaos entries

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Simplify chaos sliders in `resultFilterController.mjs`

**Files:**
- Modify: `src/lib/deconstruction/resultFilterController.mjs`

- [ ] **Step 1: Update chaos stat range computation (lines 163-182)**

Replace the per-scroll chaos stat range computation with a single aggregate range:

```javascript
    // Compute per-stat aggregate chaos delta ranges across all entries
    const chaosStatRanges = new Map(); // Map<statKey, {min,max}> for aggregate chaos
    if (model) {
      for (const entry of model.entries) {
        const chaosEntry = (entry.strategy.scrolls ?? []).find(
          (s) => s.behavior_type === 'chaos' && s.isAggregate,
        );
        if (!chaosEntry) continue;
        for (const [k, v] of Object.entries(chaosEntry.stats ?? {})) {
          if (!Number.isFinite(v)) continue;
          const existing = chaosStatRanges.get(k);
          chaosStatRanges.set(k, {
            min: Math.min(existing?.min ?? Infinity, v),
            max: Math.max(existing?.max ?? -Infinity, v),
          });
        }
      }
    }
```

- [ ] **Step 2: Update chaos slider rendering (lines 312-379)**

Replace the chaos slider block (lines 312-379) to use per-stat aggregate ranges instead of per-scroll:

```javascript
      } else {
        // ── Chaos scroll: per-stat aggregate delta range sliders ──
        if (chaosStatRanges.size > 0) {
          const chaosWrap = document.createElement('span');
          chaosWrap.className = 'decon-secondary-scroll-chaos-stats';
          if (!isSelected) chaosWrap.classList.add('decon-secondary-scroll-slider-wrap--disabled');

          // Get or init persisted ranges for aggregate chaos
          const aggKey = 'chaos:aggregate';
          let persisted = chaosDeltaRanges.get(aggKey);
          if (!persisted) {
            persisted = new Map();
            chaosDeltaRanges.set(aggKey, persisted);
          }

          for (const [statKey, fullRange] of chaosStatRanges) {
            const existing = persisted.get(statKey);
            const curMin = existing ? existing.min : fullRange.min;
            const curMax = existing ? existing.max : fullRange.max;

            const rowS = document.createElement('span');
            rowS.className = 'decon-secondary-scroll-chaos-stat-row';

            const label = document.createElement('span');
            label.className = 'decon-secondary-stimulant-stat';
            const formatLabel = (mn, mx) =>
              `${statLabelByKey[statKey] ?? statKey} ${mn}~${mx}`;
            label.textContent = formatLabel(curMin, curMax);

            const minSlider = document.createElement('input');
            minSlider.type = 'range';
            minSlider.min = fullRange.min;
            minSlider.max = fullRange.max;
            minSlider.value = curMin;
            minSlider.disabled = !isSelected;

            const maxSlider = document.createElement('input');
            maxSlider.type = 'range';
            maxSlider.min = fullRange.min;
            maxSlider.max = fullRange.max;
            maxSlider.value = curMax;
            maxSlider.disabled = !isSelected;

            const updateDeltaRange = () => {
              let mn = Number(minSlider.value);
              let mx = Number(maxSlider.value);
              if (mn > mx) [mn, mx] = [mx, mn];
              persisted.set(statKey, { min: mn, max: mx });
              minSlider.value = mn;
              maxSlider.value = mx;
              label.textContent = formatLabel(mn, mx);
              applyFilters();
            };

            minSlider.addEventListener('input', updateDeltaRange);
            maxSlider.addEventListener('input', updateDeltaRange);

            const dualRange = document.createElement('span');
            dualRange.className = 'decon-chaos-dual-range';
            dualRange.append(minSlider, maxSlider);
            rowS.append(label, dualRange);
            chaosWrap.append(rowS);
          }

          chaosWrap.addEventListener('click', (e) => { e.stopPropagation(); });
          chaosWrap.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
          row.append(chaosWrap);
        }
      }
```

- [ ] **Step 3: Run filter controller tests**

```bash
node --test tests/deconstruction-result-filter-controller.test.mjs 2>&1 | tail -15
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/deconstruction/resultFilterController.mjs
git commit -m "feat: simplify chaos delta sliders to per-stat aggregate

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Verify remaining test files pass unchanged

**Files:**
- Verify: `tests/deconstruction-result-filters.test.mjs`
- Verify: `tests/deconstruction-result-filter-controller.test.mjs`
- Verify: `tests/deconstruction-ui-contract.test.mjs`

The existing test suites for result-filters, result-filter-controller, and UI-contract do not test chaos-specific behavior. The result-filters tests use non-chaos strategy fixtures. The result-filter-controller tests verify DOM building mechanics. The UI-contract test only asserts that `<input data-decon-scroll-rate="chaos">` exists in the page source — it does not test strategy rendering output.

- [ ] **Step 1: Run the filter test suite**

```bash
node --test tests/deconstruction-result-filters.test.mjs 2>&1
```

Expected: All tests pass. These tests use strategies with fixed scrolls only (ids 1001, 1002) and non-chaos stimulant/gem/itemLevelUp fixtures.

- [ ] **Step 2: Run the filter controller test suite**

```bash
node --test tests/deconstruction-result-filter-controller.test.mjs 2>&1
```

Expected: All tests pass. The `createResultFilterController` factory and its DOM-building functions do not depend on chaos scroll structure.

- [ ] **Step 3: Run the UI contract test suite**

```bash
node --test tests/deconstruction-ui-contract.test.mjs 2>&1
```

Expected: All tests pass. The only chaos reference is a DOM presence check for the chaos rate checkbox (`data-decon-scroll-rate="chaos"`), which is unchanged by this refactor.

- [ ] **Step 4: If any test fails, fix by updating strategy fixtures**

If a test fixture inadvertently uses a chaos scroll with the old per-entry format, update it to use `isAggregate: true` and `aggregateCount`. Example fix:

```javascript
// Old fixture (if any test uses this):
scrolls: [
  { id: 2049100, nameKo: '혼돈의 주문서', behavior_type: 'chaos', stats: { str: +5 } },
  { id: 2049100, nameKo: '혼돈의 주문서', behavior_type: 'chaos', stats: { str: +1 } },
]

// New fixture:
scrolls: [
  { id: 2049100, nameKo: '혼돈의 주문서', behavior_type: 'chaos', stats: { str: +6 }, isAggregate: true, aggregateCount: 2 },
]
```

- [ ] **Step 5: Run all deconstruction tests together**

```bash
node --test tests/deconstruction-*.test.mjs 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/
git commit -m "test: verify all deconstruction tests pass with aggregate chaos model

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Manual verification and final cleanup

- [ ] **Step 1: Run the full test suite**

```bash
node --test tests/deconstruction-*.test.mjs 2>&1
```

All tests must pass.

- [ ] **Step 2: Verify the target example from the spec**

Using `scripts/` or manual testing, verify that with:
- Item: 노가다 목장갑 (Work Glove)
- Target: `{weaponAttack: 13}`
- 5 successful scrolls
- 100% + chaos rates enabled

The output shows grouped chaos like `x3 혼돈의 주문서 (└ 공격력 +9)` instead of fragmented entries.

- [ ] **Step 3: Verify multi-stat aggregate format**

Test with multiple target keys to confirm the sub-line shows all stats: `└ 공격력 +11, STR +13`

- [ ] **Step 4: Verify chaos-only mode works**

Enable only chaos rate, disable all other sources. Verify strategies are found and rendered correctly.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final verification and cleanup for chaos grouped aggregation

Co-Authored-By: Claude <noreply@anthropic.com>"
```
