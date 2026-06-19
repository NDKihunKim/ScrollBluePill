# Deconstruction Exact Fallback Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend deconstruction to find deterministic exact combinations across scrolls, stimulant effects, Maker gems, and item-level effects, ordered by source priority and capped at 500.

**Architecture:** Project every enhancement outcome onto checked target keys and represent it as a contribution vector. Generate scroll, gem, and item-level states independently; solve stimulant contributions directly from residual vectors; then join sources by priority without constructing one global cross-product.

**Tech Stack:** JavaScript ES modules, Astro 6, Node.js `node:test`, existing Maker and item-level data modules

---

## Prerequisite

Complete `docs/superpowers/plans/2026-06-19-deconstruction-success-count.md` first. This plan assumes the page passes `successfulScrollCount` and uses the slot-state model.

## File map

- Create `src/lib/deconstruction/statVectors.mjs`: checked-stat vector operations and stable keys.
- Create `src/lib/deconstruction/sourceContributions.mjs`: stimulant, Maker gem, and item-level contribution generation.
- Create `tests/deconstruction-stat-vectors.test.mjs`: vector contracts.
- Create `tests/deconstruction-source-contributions.test.mjs`: source rule tests.
- Rewrite `src/lib/deconstruction/engine.mjs`: exact-count scroll states, prioritized residual joins, 500 cap, no probability.
- Expand `tests/deconstruction-engine.test.mjs`: exact, negative, mixed, ordering, deduplication, cap tests.
- Modify `src/pages/deconstruction.astro`: load level-up data, pass complete inputs, render source details and filters, remove probability.
- Expand `tests/deconstruction-ui-contract.test.mjs`: data-flow and result-rendering contracts.

### Task 1: Add checked-stat vector operations

**Files:**
- Create: `src/lib/deconstruction/statVectors.mjs`
- Create: `tests/deconstruction-stat-vectors.test.mjs`

- [ ] **Step 1: Write failing vector tests**

```js
// tests/deconstruction-stat-vectors.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addVectors,
  isExactVector,
  projectVector,
  subtractVectors,
  vectorKey,
} from '../src/lib/deconstruction/statVectors.mjs';

const keys = ['str', 'weaponAttack'];

test('projection ignores unchecked stats and preserves negative values', () => {
  assert.deepEqual(projectVector({ str: -2, dex: 9, weaponAttack: 3 }, keys), {
    str: -2,
    weaponAttack: 3,
  });
});

test('vector arithmetic uses missing values as zero', () => {
  assert.deepEqual(addVectors({ str: 2 }, { str: -3, weaponAttack: 1 }, keys), {
    str: -1,
    weaponAttack: 1,
  });
  assert.deepEqual(subtractVectors({ str: 2 }, { str: 5 }, keys), {
    str: -3,
    weaponAttack: 0,
  });
});

test('exact matching and keys are stable in checked-key order', () => {
  assert.equal(isExactVector({ str: -2, weaponAttack: 3 }, { weaponAttack: 3, str: -2 }, keys), true);
  assert.equal(vectorKey({ weaponAttack: 3, str: -2 }, keys), 'str:-2|weaponAttack:3');
});
```

- [ ] **Step 2: Verify the missing-module failure**

Run: `node --test tests/deconstruction-stat-vectors.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement vector operations**

```js
// src/lib/deconstruction/statVectors.mjs
export function projectVector(stats, targetKeys) {
  return Object.fromEntries(targetKeys.map((key) => [key, Number(stats?.[key]) || 0]));
}

export function addVectors(left, right, targetKeys) {
  return Object.fromEntries(targetKeys.map((key) => [key, (left?.[key] || 0) + (right?.[key] || 0)]));
}

export function subtractVectors(left, right, targetKeys) {
  return Object.fromEntries(targetKeys.map((key) => [key, (left?.[key] || 0) - (right?.[key] || 0)]));
}

export function isExactVector(left, right, targetKeys) {
  return targetKeys.every((key) => (left?.[key] || 0) === (right?.[key] || 0));
}

export function vectorKey(vector, targetKeys) {
  return targetKeys.map((key) => `${key}:${vector?.[key] || 0}`).join('|');
}
```

- [ ] **Step 4: Run tests and commit**

Run: `node --test tests/deconstruction-stat-vectors.test.mjs`

Expected: 3 tests PASS.

```bash
git add src/lib/deconstruction/statVectors.mjs tests/deconstruction-stat-vectors.test.mjs
git commit -m "feat: add deconstruction stat vectors"
```

### Task 2: Generate stimulant and item-level contributions

**Files:**
- Create: `src/lib/deconstruction/sourceContributions.mjs`
- Create: `tests/deconstruction-source-contributions.test.mjs`

- [ ] **Step 1: Write failing stimulant and level-up tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enumerateItemLevelContributions,
  solveStimulantResidual,
} from '../src/lib/deconstruction/sourceContributions.mjs';

test('stimulant solves only residuals inside existing ranges', () => {
  assert.deepEqual(
    solveStimulantResidual({ str: -5, maxHp: 50 }, ['str', 'maxHp']),
    { str: -5, maxHp: 50 },
  );
  assert.equal(solveStimulantResidual({ str: 6 }, ['str']), null);
  assert.equal(solveStimulantResidual({ maxHp: -60 }, ['maxHp']), null);
});

test('item-level contributions include every count and deduplicate totals', () => {
  const results = enumerateItemLevelContributions({
    levelUpDefinition: { maxLevelUps: 2, statRanges: { str: { min: 0, max: 1 } } },
    targetKeys: ['str'],
    bounds: { str: { min: 0, max: 2 } },
  });
  assert.deepEqual(results.map(({ levelCount, stats }) => ({ levelCount, stats })), [
    { levelCount: 1, stats: { str: 0 } },
    { levelCount: 1, stats: { str: 1 } },
    { levelCount: 2, stats: { str: 0 } },
    { levelCount: 2, stats: { str: 1 } },
    { levelCount: 2, stats: { str: 2 } },
  ]);
});

test('missing level-up definitions produce no contributions', () => {
  assert.deepEqual(enumerateItemLevelContributions({
    levelUpDefinition: null,
    targetKeys: ['str'],
    bounds: { str: { min: -5, max: 5 } },
  }), []);
});
```

- [ ] **Step 2: Run tests and verify missing exports**

Run: `node --test tests/deconstruction-source-contributions.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement stimulant residual validation**

```js
import { HP_MP_KEYS } from '../enhancementState.mjs';
import { addVectors, vectorKey } from './statVectors.mjs';

export function solveStimulantResidual(residual, targetKeys) {
  const stats = {};
  for (const key of targetKeys) {
    const value = residual[key] || 0;
    const limit = HP_MP_KEYS.has(key) ? 50 : 5;
    const step = HP_MP_KEYS.has(key) ? 10 : 1;
    if (value < -limit || value > limit || value % step !== 0) return null;
    stats[key] = value;
  }
  return stats;
}

function enumerateRangeVectors(ranges, targetKeys) {
  const results = [];

  function visit(index, current) {
    if (index === targetKeys.length) {
      results.push({ ...current });
      return;
    }
    const key = targetKeys[index];
    const range = ranges[key] ?? { min: 0, max: 0 };
    for (let value = range.min; value <= range.max; value++) {
      current[key] = value;
      visit(index + 1, current);
    }
  }

  visit(0, {});
  return results;
}

function withinBounds(stats, bounds, targetKeys) {
  return targetKeys.every((key) => {
    const range = bounds[key] ?? { min: -Infinity, max: Infinity };
    return stats[key] >= range.min && stats[key] <= range.max;
  });
}
```

- [ ] **Step 4: Implement bounded level-up dynamic programming**

Add helpers that generate one-level vectors from normalized integer ranges, then accumulate unique totals for counts `1..maxLevelUps`:

```js
export function enumerateItemLevelContributions({ levelUpDefinition, targetKeys, bounds }) {
  if (!Number.isInteger(levelUpDefinition?.maxLevelUps) || levelUpDefinition.maxLevelUps <= 0) return [];
  const oneLevel = enumerateRangeVectors(levelUpDefinition.statRanges ?? {}, targetKeys);
  const results = [];
  let previous = [{ stats: Object.fromEntries(targetKeys.map((key) => [key, 0])) }];

  for (let levelCount = 1; levelCount <= levelUpDefinition.maxLevelUps; levelCount++) {
    const seen = new Map();
    for (const base of previous) {
      for (const outcome of oneLevel) {
        const stats = addVectors(base.stats, outcome, targetKeys);
        if (!withinBounds(stats, bounds, targetKeys)) continue;
        seen.set(vectorKey(stats, targetKeys), { levelCount, stats });
      }
    }
    previous = [...seen.values()];
    results.push(...previous);
  }
  return results;
}
```

Sort each level's `seen` values by `vectorKey(entry.stats, targetKeys)` before assigning `previous`; this keeps output ordered by level count and vector key.

- [ ] **Step 5: Run tests and commit**

Run: `node --test tests/deconstruction-source-contributions.test.mjs`

Expected: all tests PASS.

```bash
git add src/lib/deconstruction/sourceContributions.mjs tests/deconstruction-source-contributions.test.mjs
git commit -m "feat: enumerate deconstruction fallback outcomes"
```

### Task 3: Generate valid Maker gem contributions

**Files:**
- Modify: `src/lib/deconstruction/sourceContributions.mjs`
- Modify: `tests/deconstruction-source-contributions.test.mjs`

- [ ] **Step 1: Add failing gem tests**

```js
import { enumerateGemContributions } from '../src/lib/deconstruction/sourceContributions.mjs';

test('fixed gems obey slot count, grade values, and no-duplicate rule', () => {
  const results = enumerateGemContributions({
    gemSlotCount: 1,
    equipmentKind: '장갑',
    cleanStats: { str: 5 },
    targetKeys: ['str'],
    bounds: { str: { min: -5, max: 5 } },
  });
  assert.ok(results.some((entry) => entry.stats.str === 5 && entry.gems[0].gemKey === 'strCrystal'));
  assert.ok(results.every((entry) => new Set(entry.gems.map((gem) => gem.gemKey)).size === entry.gems.length));
});

test('weapon-only and random gem outcomes follow existing rules', () => {
  const glove = enumerateGemContributions({
    gemSlotCount: 1,
    equipmentKind: '장갑',
    cleanStats: { weaponAttack: 2 },
    targetKeys: ['weaponAttack'],
    bounds: { weaponAttack: { min: -3, max: 3 } },
  });
  assert.ok(glove.every((entry) => entry.gems.every((gem) => gem.gemKey !== 'diamond' && gem.gemKey !== 'blackAmethyst')));

  const weapon = enumerateGemContributions({
    gemSlotCount: 1,
    equipmentKind: '한손검',
    cleanStats: { weaponAttack: 50 },
    targetKeys: ['weaponAttack'],
    bounds: { weaponAttack: { min: -3, max: 3 } },
  });
  assert.ok(weapon.some((entry) => entry.gems[0].gemKey === 'blackAmethyst' && entry.stats.weaponAttack === -3));
});
```

- [ ] **Step 2: Run tests and verify missing export**

Run: `node --test tests/deconstruction-source-contributions.test.mjs`

Expected: FAIL because `enumerateGemContributions` is not exported.

- [ ] **Step 3: Implement deterministic gem outcome generation**

Use `GEM_TYPES`, `GEM_GRADES`, `isWeaponKind`, `getFixedGemStats`, `BLACK_AMETHYST_TABLES`, and `DARK_CRYSTAL_TABLES`. Convert probability tables to unique value lists because deconstruction no longer uses probabilities.

```js
export function enumerateGemContributions({
  gemSlotCount,
  equipmentKind,
  cleanStats,
  targetKeys,
  bounds,
}) {
  if (!Number.isInteger(gemSlotCount) || gemSlotCount <= 0) return [];
  const options = buildGemOutcomeOptions({ equipmentKind, cleanStats, targetKeys });
  const results = [];
  const seen = new Set();

  function visit(startIndex, gems, stats) {
    if (gems.length > 0 && withinBounds(stats, bounds, targetKeys)) {
      const key = `${gems.map((gem) => `${gem.gemKey}:${gem.gradeIndex}:${vectorKey(gem.stats, targetKeys)}`).sort().join('|')}::${vectorKey(stats, targetKeys)}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ gems: gems.map((gem) => ({ ...gem })), stats: { ...stats } });
      }
    }
    if (gems.length === gemSlotCount) return;
    for (let index = startIndex; index < options.length; index++) {
      const option = options[index];
      if (gems.some((gem) => gem.gemKey === option.gemKey)) continue;
      visit(index + 1, [...gems, option], addVectors(stats, option.stats, targetKeys));
    }
  }

  visit(0, [], Object.fromEntries(targetKeys.map((key) => [key, 0])));
  return results.sort(compareGemEntries);
}
```

`buildGemOutcomeOptions` must:

- Exclude weapon-only gems for non-weapons.
- Produce fixed gem values via `getFixedGemStats` for grade indices 0–2.
- Produce the Cartesian outcomes for each checked eligible random-gem stat from the unique values in its grade table.
- Project every outcome onto checked keys while retaining `{ gemKey, gradeIndex, stats }` for rendering.

Implement the referenced helpers as follows:

```js
const uniqueValues = (table) => [...new Set(table.map(({ value }) => value))].sort((a, b) => a - b);

function enumerateIndependentStats(keys, values) {
  const results = [];
  function visit(index, stats) {
    if (index === keys.length) return void results.push({ ...stats });
    for (const value of values) {
      stats[keys[index]] = value;
      visit(index + 1, stats);
    }
  }
  visit(0, {});
  return results;
}

function buildGemOutcomeOptions({ equipmentKind, cleanStats, targetKeys }) {
  const options = [];
  for (const gem of GEM_TYPES) {
    if (gem.weaponOnly && !isWeaponKind(equipmentKind)) continue;
    for (let gradeIndex = 0; gradeIndex < GEM_GRADES.length; gradeIndex++) {
      if (isFixedGem(gem.key)) {
        options.push({
          gemKey: gem.key,
          gradeIndex,
          stats: projectVector(getFixedGemStats(gem.key, gradeIndex), targetKeys),
        });
        continue;
      }
      const gradeKey = ['low', 'mid', 'high'][gradeIndex];
      const table = gem.key === 'blackAmethyst'
        ? BLACK_AMETHYST_TABLES[gradeKey]
        : DARK_CRYSTAL_TABLES[gradeKey];
      const keys = gem.variableKeys.filter(
        (key) => targetKeys.includes(key) && Number.isFinite(cleanStats[key]),
      );
      for (const stats of enumerateIndependentStats(keys, uniqueValues(table))) {
        options.push({ gemKey: gem.key, gradeIndex, stats: projectVector(stats, targetKeys) });
      }
    }
  }
  return options;
}

function compareGemEntries(left, right) {
  const key = (entry) => entry.gems
    .map((gem) => `${gem.gemKey}:${gem.gradeIndex}:${JSON.stringify(gem.stats)}`)
    .sort()
    .join('|');
  return key(left).localeCompare(key(right));
}
```

Import `GEM_TYPES`, `GEM_GRADES`, and `isWeaponKind` from `makerData.mjs`; import `isFixedGem`, `getFixedGemStats`, `BLACK_AMETHYST_TABLES`, and `DARK_CRYSTAL_TABLES` from `expectedValue/makerModel.mjs`; import `projectVector` with the other vector helpers.

- [ ] **Step 4: Run source tests and commit**

Run: `node --test tests/deconstruction-source-contributions.test.mjs`

Expected: all tests PASS.

```bash
git add src/lib/deconstruction/sourceContributions.mjs tests/deconstruction-source-contributions.test.mjs
git commit -m "feat: enumerate deconstruction gem outcomes"
```

### Task 4: Rewrite the engine as prioritized residual joins

**Files:**
- Modify: `src/lib/deconstruction/engine.mjs`
- Modify: `tests/deconstruction-engine.test.mjs`

- [ ] **Step 1: Add failing integration tests**

Add fixtures covering these exact assertions:

```js
test('supports exact negative checked deltas and ignores unchecked stats', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: -2 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 5 },
    scrollsByEquipmentKind: new Map([['Cape', [{
      id: 7001, nameKo: '카오스 주문서', behavior_type: 'chaos', stats: { str: 1, dex: 1 },
    }]]]),
    levelUpDefinition: null,
  });
  assert.ok(result.strategies.some((strategy) => strategy.totalStats.str === -2));
});

test('finds and prioritizes all single and mixed fallback sources', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: 7 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 120,
    cleanStats: { str: 5 },
    scrollsByEquipmentKind: new Map([['Cape', [{
      id: 7002, nameKo: '힘 주문서', behavior_type: 'fixed', stats: { str: 1 },
    }]]]),
    levelUpDefinition: { maxLevelUps: 1, statRanges: { str: { min: 1, max: 1 } } },
  });
  assert.ok(result.strategies.some((strategy) => strategy.hasStimulant));
  assert.ok(result.strategies.some((strategy) => strategy.gems.length > 0));
  assert.ok(result.strategies.some((strategy) => strategy.hasItemLevelUp));
  assert.ok(result.strategies.some((strategy) => strategy.sourceTypes.length > 1));
  assert.deepEqual(result.strategies.map((strategy) => strategy.priorityRank),
    [...result.strategies.map((strategy) => strategy.priorityRank)].sort((a, b) => a - b));
});

test('removes probability and caps deterministic results at 500', () => {
  const first = enumerateStrategies(makeLargeFixture());
  const second = enumerateStrategies(makeLargeFixture());
  assert.equal(first.strategies.length, 500);
  assert.equal(first.truncated, true);
  assert.deepEqual(first, second);
  assert.ok(first.strategies.every((strategy) => !Object.hasOwn(strategy, 'probability')));
});
```

Define the deterministic large fixture without production JSON:

```js
function makeLargeFixture() {
  const scrolls = Array.from({ length: 600 }, (_, index) => ({
    id: 8000 + index,
    nameKo: `힘 주문서 ${index}`,
    behavior_type: 'fixed',
    stats: { str: 1 },
  }));
  return {
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: '망토',
    requiredLevel: 0,
    cleanStats: { str: 1 },
    scrollsByEquipmentKind: new Map([['망토', scrolls]]),
    levelUpDefinition: null,
  };
}
```

- [ ] **Step 2: Run engine tests and verify failures**

Run: `node --test tests/deconstruction-engine.test.mjs`

Expected: FAIL for negative targets, fallback sources, result ordering, cap 500, and probability removal.

- [ ] **Step 3: Replace probability helpers with contribution-state helpers**

Remove `parseScrollProbability`. Change strategy shape to:

```js
{
  scrolls,
  stimulant: null | { stats },
  gems,
  itemLevelUp: null | { levelCount, stats },
  hasStimulant,
  hasItemLevelUp,
  sourceTypes,
  priorityRank,
  approach,
  totalStats,
}
```

Set `MAX_STRATEGIES = 500`. Canonical keys must include sorted scroll IDs/outcomes, stimulant vector, sorted gem keys/grades/outcomes, and item-level count/vector.

- [ ] **Step 4: Generate exact-count scroll states within fallback bounds**

Filter scrolls to those touching at least one checked key. Compute per-key correction bounds from stimulant limits, possible gem outcomes, and item-level ranges. During exact-count DFS, prune a partial scroll vector only when even all remaining scrolls plus fallback correction bounds cannot reach the target. Emit scroll states only at exactly `successfulScrollCount` applications.

```js
const scrollStates = enumerateExactCountScrollStates({
  scrolls,
  target,
  targetKeys,
  successfulScrollCount,
  correctionBounds,
});
```

Keep chaos outcomes deterministic and projected onto checked keys. Do not apply the old positive-only pruning.

- [ ] **Step 5: Join residuals in approved priority order**

For each scroll state, calculate `residual = subtractVectors(target, scrollState.stats, targetKeys)` and append strategies in these tiers:

```js
const tiers = [
  joinScrollOnly,
  joinStimulantOnly,
  joinGemsOnly,
  joinItemLevelOnly,
  joinStimulantAndGems,
  joinStimulantAndItemLevel,
  joinGemsAndItemLevel,
  joinStimulantGemsAndItemLevel,
];

for (let priorityRank = 0; priorityRank < tiers.length; priorityRank++) {
  tiers[priorityRank]({
    scrollStates,
    gemContributions,
    itemLevelContributions,
    target,
    targetKeys,
    addResult: (parts) => addResult({ ...parts, priorityRank }),
  });
  if (strategies.length >= MAX_STRATEGIES) break;
}
```

Stimulant tiers compute the remaining vector last and call `solveStimulantResidual`; they do not enumerate a stimulant cross-product. Every `addResult` recomputes totals and rejects non-exact checked vectors before deduplication.

- [ ] **Step 6: Run focused engine and source tests**

Run: `node --test tests/deconstruction-stat-vectors.test.mjs tests/deconstruction-source-contributions.test.mjs tests/deconstruction-engine.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit the exact fallback engine**

```bash
git add src/lib/deconstruction/engine.mjs tests/deconstruction-engine.test.mjs
git commit -m "feat: add exact deconstruction fallback search"
```

### Task 5: Load source data and render probability-free results

**Files:**
- Modify: `tests/deconstruction-ui-contract.test.mjs`
- Modify: `src/pages/deconstruction.astro`

- [ ] **Step 1: Add failing page contract tests**

```js
test('page loads item-level data and passes complete exact-search inputs', () => {
  assert.match(source, /item-level-ups-gms83-ko\.json/);
  assert.match(source, /itemLevelUpByItemId/);
  assert.match(source, /targetKeys:\s*checkedKeys/);
  assert.match(source, /requiredLevel:\s*selectedItem\.requiredLevel/);
  assert.match(source, /cleanStats:\s*selectedItem\.stats/);
  assert.match(source, /levelUpDefinition:\s*itemLevelUpByItemId\.get\(selectedItem\.id\) \?\? null/);
});

test('deconstruction results contain source details without probability', () => {
  assert.doesNotMatch(source, /strategy\.probability/);
  assert.doesNotMatch(source, /decon-strategy-prob/);
  assert.match(source, /strategy\.stimulant/);
  assert.match(source, /strategy\.gems/);
  assert.match(source, /strategy\.itemLevelUp/);
});

test('target extraction includes checked negative and zero deltas', () => {
  assert.match(source, /checkedKeys\.includes\(k\)/);
  assert.doesNotMatch(source, /v > 0 && checkedKeys\.includes\(k\)/);
});
```

- [ ] **Step 2: Run contract tests and verify failure**

Run: `node --test tests/deconstruction-ui-contract.test.mjs`

Expected: FAIL for missing level-up data, incomplete engine inputs, and remaining probability markup.

- [ ] **Step 3: Load item-level definitions beside scroll data**

Replace the independent scroll fetch with one `Promise.all` for scrolls and `/data/item-level-ups-gms83-ko.json`. Build:

```js
let itemLevelUpByItemId = new Map();

itemLevelUpByItemId = new Map(
  itemLevelUps
    .filter((definition) => Number.isInteger(definition.itemId))
    .map((definition) => [definition.itemId, definition]),
);
```

Keep the existing optional-data behavior: a failed item-level fetch produces `[]`; scroll fetch failure remains an error.

- [ ] **Step 4: Pass checked exact deltas and all source inputs**

Build `targetDeltas` for every checked key without a positivity filter:

```js
const targetDeltas = Object.fromEntries(
  checkedKeys.map((key) => [key, deconDeltas[key] ?? 0]),
);

const result = enumerateStrategies({
  targetDeltas,
  targetKeys: checkedKeys,
  successfulScrollCount: deconSlotState.successfulScrollCount,
  equipmentKind: selectedItem.equipmentKind,
  requiredLevel: selectedItem.requiredLevel,
  cleanStats: selectedItem.stats ?? {},
  scrollsByEquipmentKind,
  levelUpDefinition: itemLevelUpByItemId.get(selectedItem.id) ?? null,
});
```

- [ ] **Step 5: Replace probability rows with enhancement-source details**

Keep scroll and total-stat rows. Add conditional rows:

```js
if (strategy.stimulant) appendSourceRow(card, '촉진제', strategy.stimulant.stats);
if (strategy.gems.length > 0) appendGemRows(card, strategy.gems);
if (strategy.itemLevelUp) {
  appendSourceRow(card, `아이템 레벨업 ${strategy.itemLevelUp.levelCount}회`, strategy.itemLevelUp.stats);
}
```

Define the helpers beside `displayResults`:

```js
const formatSourceStats = (stats) => Object.entries(stats)
  .filter(([, value]) => value !== 0)
  .map(([key, value]) => `${statLabelByKey[key] ?? key}: ${value > 0 ? '+' : ''}${value}`)
  .join(', ');

const appendSourceRow = (card, label, stats) => {
  const row = document.createElement('div');
  row.className = 'decon-strategy-source';
  row.textContent = `${label}: ${formatSourceStats(stats)}`;
  card.append(row);
};

const appendGemRows = (card, gems) => {
  for (const gem of gems) {
    appendSourceRow(card, `${gem.nameKo} ${GEM_GRADES[gem.gradeIndex]}`, gem.stats);
  }
};
```

Update card `data-source-types` and filter behavior for `scrolls`, `stimulant`, `gems`, and `itemLevelUp`. `주문서만` matches strategies whose `sourceTypes` is empty. Remove `.decon-strategy-prob` CSS.

- [ ] **Step 6: Run page and engine tests**

Run: `node --test tests/deconstruction-ui-contract.test.mjs tests/deconstruction-engine.test.mjs tests/deconstruction-source-contributions.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit the page integration**

```bash
git add src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
git commit -m "feat: render deconstruction fallback combinations"
```

### Task 6: Verify the complete feature

**Files:**
- Verify only: no planned source changes

- [ ] **Step 1: Run all tests**

Run: `node --test tests/*.test.mjs`

Expected: all tests PASS.

- [ ] **Step 2: Build production output**

Run: `npm run build`

Expected: exit code 0 and all three route outputs are generated.

- [ ] **Step 3: Verify representative browser scenarios**

Run `npm run dev -- --port 4321`, open `/deconstruction`, and verify:

1. A scroll-only exact combination appears first.
2. Stimulant, gem, item-level, and mixed combinations remain present when valid.
3. A checked negative delta can produce an exact chaos/stimulant/random-gem result.
4. An unchecked stat modified by a source does not reject a result.
5. Every result contains exactly the selected scroll count.
6. Result cards contain no probability label.
7. Items without Maker slots or level-up definitions omit those sources.
8. A no-match query shows `일치하는 전략을 찾을 수 없습니다.`
9. Filters show only the requested source category.
10. Desktop and narrow layouts remain usable with no console errors.

Expected: all ten checks pass.

- [ ] **Step 4: Confirm deterministic cap behavior**

Run the same broad query twice and compare the first and last rendered strategy identifiers.

Expected: both runs return the same ordered results; no more than 500 cards render, and capped summaries use the existing `+` indicator.
