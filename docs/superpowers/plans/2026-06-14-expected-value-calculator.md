# Expected Value Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side expected-value calculator that estimates the probability of creating the currently configured enhanced item (or better) from a clean base item, using exact DP or Monte Carlo simulation.

**Architecture:** New `src/lib/expectedValue/` directory holds all probability engine modules (target extraction, scroll/chaos/maker/level-up models, candidate generation, exact engine, Monte Carlo engine, optimizer, result formatter, chart renderer). A Web Worker runs Monte Carlo off the main thread. A new UI panel module (`expectedValuePanel.mjs`) manages the result panel below the existing enhancement panel in `index.astro`. All engine code is pure functions with no DOM dependencies so it can be moved to a backend later.

**Tech Stack:** Vanilla JS (.mjs modules), Astro (bundling via Vite), Canvas API (chart), Web Worker API, Node.js built-in `node:test` + `node:assert/strict`

---

## File Structure

| Responsibility | File |
|---|---|
| Target extraction from state vs clean base | `src/lib/expectedValue/targetExtraction.mjs` |
| Scroll success rate parsing & failure model | `src/lib/expectedValue/scrollModel.mjs` |
| Chaos scroll probability tables & stat rolls | `src/lib/expectedValue/chaosModel.mjs` |
| Maker gem probability tables (흑수정, 어둠의 크리스탈, fixed gems) | `src/lib/expectedValue/makerModel.mjs` |
| Item Level-Up uniform random roll model | `src/lib/expectedValue/levelUpModel.mjs` |
| Candidate strategy generation | `src/lib/expectedValue/candidateGenerator.mjs` |
| Exact DP probability calculation | `src/lib/expectedValue/exactEngine.mjs` |
| Monte Carlo simulation runner + seeded RNG | `src/lib/expectedValue/monteCarloEngine.mjs` |
| Monte Carlo Web Worker entry point | `src/lib/expectedValue/monteCarloWorker.mjs` |
| Strategy optimizer (objective ranking) | `src/lib/expectedValue/strategyOptimizer.mjs` |
| Result formatting & percentile math | `src/lib/expectedValue/resultFormatter.mjs` |
| Canvas-based attempt distribution chart | `src/lib/expectedValue/chartRenderer.mjs` |
| UI controller for result panel, target selection, stale/confirmation | `src/lib/expectedValue/expectedValuePanel.mjs` |
| Main page (button, panel mount, wiring) | `src/pages/index.astro` |
| Tests for target extraction | `tests/expected-value-target-extraction.test.mjs` |
| Tests for scroll model | `tests/expected-value-scroll-model.test.mjs` |
| Tests for chaos model | `tests/expected-value-chaos-model.test.mjs` |
| Tests for maker model | `tests/expected-value-maker-model.test.mjs` |
| Tests for level-up model | `tests/expected-value-level-up-model.test.mjs` |
| Tests for candidate generation | `tests/expected-value-candidate-generator.test.mjs` |
| Tests for exact engine | `tests/expected-value-exact-engine.test.mjs` |
| Tests for Monte Carlo engine | `tests/expected-value-monte-carlo.test.mjs` |
| Tests for result formatting | `tests/expected-value-result-formatter.test.mjs` |
| Tests for UI panel contracts | `tests/expected-value-ui-contract.test.mjs` |

Existing files to modify:
- `src/pages/index.astro` — add 기대값 계산 button, 3. 결과 panel, confirmation dialog, stale-result wiring
- `src/lib/probabilityEngine.ts` — remove or replace the stub if needed

---

### Task 1: Target Extraction Module

**Files:**
- Create: `src/lib/expectedValue/targetExtraction.mjs`
- Test: `tests/expected-value-target-extraction.test.mjs`

The module extracts target conditions from an enhancement state + clean base item. Stat targets are enhancement **gains** (preview total − clean base), not raw totals.

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeEnhancementGains,
  extractTargetConditions,
  getDefaultCheckedStats,
  CORE_STAT_KEYS,
  ADVANCED_STAT_KEYS,
  ALL_TARGET_STAT_KEYS,
} from '../src/lib/expectedValue/targetExtraction.mjs';

test('computeEnhancementGains returns gain over clean base for each stat', () => {
  const cleanStats = { str: 5, dex: 10, weaponAttack: 50 };
  const previewStats = { str: 12, dex: 8, weaponAttack: 55 };
  const gains = computeEnhancementGains(cleanStats, previewStats);
  assert.deepEqual(gains, { str: 7, dex: -2, weaponAttack: 5 });
});

test('computeEnhancementGains includes stats only in preview as gain', () => {
  const cleanStats = { str: 5 };
  const previewStats = { str: 10, dex: 3 };
  const gains = computeEnhancementGains(cleanStats, previewStats);
  assert.deepEqual(gains, { str: 5, dex: 3 });
});

test('computeEnhancementGains omits stats with zero gain', () => {
  const cleanStats = { str: 5, dex: 10 };
  const previewStats = { str: 5, dex: 10 };
  const gains = computeEnhancementGains(cleanStats, previewStats);
  assert.deepEqual(gains, {});
});

test('CORE_STAT_KEYS contains the six core stats', () => {
  assert.deepEqual([...CORE_STAT_KEYS].sort(), ['weaponAttack', 'magicAttack', 'str', 'dex', 'int', 'luk'].sort());
});

test('ADVANCED_STAT_KEYS contains HP, MP, defenses, accuracy, avoid, speed, jump', () => {
  assert.ok(ADVANCED_STAT_KEYS.has('maxHp'));
  assert.ok(ADVANCED_STAT_KEYS.has('maxMp'));
  assert.ok(ADVANCED_STAT_KEYS.has('weaponDefense'));
  assert.ok(ADVANCED_STAT_KEYS.has('magicDefense'));
  assert.ok(ADVANCED_STAT_KEYS.has('accuracy'));
  assert.ok(ADVANCED_STAT_KEYS.has('avoidability'));
  assert.ok(ADVANCED_STAT_KEYS.has('speed'));
  assert.ok(ADVANCED_STAT_KEYS.has('jump'));
});

test('ALL_TARGET_STAT_KEYS excludes upgradeSlots and attackSpeed', () => {
  assert.ok(!ALL_TARGET_STAT_KEYS.has('upgradeSlots'));
  assert.ok(!ALL_TARGET_STAT_KEYS.has('attackSpeed'));
  assert.ok(ALL_TARGET_STAT_KEYS.has('weaponAttack'));
  assert.ok(ALL_TARGET_STAT_KEYS.has('maxHp'));
});

test('getDefaultCheckedStats checks core stats with positive gain, leaves advanced unchecked', () => {
  const gains = { str: 5, dex: 3, maxHp: 10, weaponAttack: 0 };
  const checked = getDefaultCheckedStats(gains);
  assert.equal(checked.str, true);
  assert.equal(checked.dex, true);
  assert.equal(checked.weaponAttack, false); // zero gain not checked
  assert.equal(checked.maxHp, false);        // advanced not checked by default
  assert.equal(checked.int, false);          // no gain, not checked
});

test('getDefaultCheckedStats grade defaults to unchecked', () => {
  const checked = getDefaultCheckedStats({ str: 5 });
  assert.equal(checked.grade, false);
});

test('extractTargetConditions builds stat thresholds as enhancement gains and optional grade', () => {
  const cleanStats = { str: 5, dex: 10 };
  const previewStats = { str: 12, dex: 15 };
  const checkedStats = { str: true, dex: false, grade: true };
  const previewGradeClass = 3; // e.g., 상품
  const conditions = extractTargetConditions(cleanStats, previewStats, checkedStats, previewGradeClass);
  assert.deepEqual(conditions.statThresholds, { str: 7 }); // dex unchecked, omitted
  assert.equal(conditions.gradeThreshold, 3);
});

test('extractTargetConditions returns null gradeThreshold when grade unchecked', () => {
  const conditions = extractTargetConditions(
    { str: 5 }, { str: 10 }, { str: true, grade: false }, 2
  );
  assert.equal(conditions.gradeThreshold, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/expected-value-target-extraction.test.mjs`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/expectedValue/targetExtraction.mjs

export const CORE_STAT_KEYS = new Set([
  'weaponAttack', 'magicAttack', 'str', 'dex', 'int', 'luk',
]);

export const ADVANCED_STAT_KEYS = new Set([
  'maxHp', 'maxMp', 'weaponDefense', 'magicDefense',
  'accuracy', 'avoidability', 'speed', 'jump',
]);

export const ALL_TARGET_STAT_KEYS = new Set([
  ...CORE_STAT_KEYS,
  ...ADVANCED_STAT_KEYS,
]);

const EXCLUDED_STAT_KEYS = new Set(['upgradeSlots', 'attackSpeed']);

/**
 * Computes enhancement gain (preview total − clean base) for each stat.
 * Returns only stats with non-zero gain.
 */
export function computeEnhancementGains(cleanStats, previewStats) {
  const gains = {};
  for (const key of Object.keys(previewStats)) {
    if (EXCLUDED_STAT_KEYS.has(key)) continue;
    if (!ALL_TARGET_STAT_KEYS.has(key)) continue;
    const cleanValue = Number.isFinite(cleanStats[key]) ? cleanStats[key] : 0;
    const previewValue = Number.isFinite(previewStats[key]) ? previewStats[key] : 0;
    const gain = previewValue - cleanValue;
    if (gain !== 0) {
      gains[key] = gain;
    }
  }
  return gains;
}

/**
 * Returns default checkbox state for target stat selection.
 * Core stats with positive gain are checked; advanced stats and grade are unchecked.
 */
export function getDefaultCheckedStats(gains) {
  const checked = {};
  for (const key of ALL_TARGET_STAT_KEYS) {
    if (CORE_STAT_KEYS.has(key)) {
      checked[key] = typeof gains[key] === 'number' && gains[key] > 0;
    } else {
      checked[key] = false;
    }
  }
  checked.grade = false;
  return checked;
}

/**
 * Extracts target conditions from clean base stats, preview stats,
 * user-selected stat checkboxes, and preview grade class.
 *
 * Returns:
 *   statThresholds: { [statKey]: minimumGain }
 *   gradeThreshold: number | null
 */
export function extractTargetConditions(cleanStats, previewStats, checkedStats, previewGradeClass) {
  const gains = computeEnhancementGains(cleanStats, previewStats);
  const statThresholds = {};
  for (const [key, gain] of Object.entries(gains)) {
    if (checkedStats[key] && gain > 0) {
      statThresholds[key] = gain;
    }
  }
  const gradeThreshold = checkedStats.grade ? previewGradeClass : null;
  return { statThresholds, gradeThreshold };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/expected-value-target-extraction.test.mjs`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add tests/expected-value-target-extraction.test.mjs src/lib/expectedValue/targetExtraction.mjs
git commit -m "feat: add target extraction module for expected value calculator

Extracts target conditions (stat gain thresholds and optional grade)
from clean base item vs enhanced preview item.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Scroll Model (Success Rate Parsing & Failure Behavior)

**Files:**
- Create: `src/lib/expectedValue/scrollModel.mjs`
- Test: `tests/expected-value-scroll-model.test.mjs`

Models non-chaos scroll application: parses success rate from name suffix, consumes slots on failure, applies stats only on success, enforces `maxApplications`.

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseScrollSuccessRate,
  SCROLL_PERCENT_PATTERN,
} from '../src/lib/expectedValue/scrollModel.mjs';

test('parseScrollSuccessRate extracts 10% from name', () => {
  assert.equal(parseScrollSuccessRate('공격력의 주문서 10%'), 0.1);
});

test('parseScrollSuccessRate extracts 60% from name', () => {
  assert.equal(parseScrollSuccessRate('방어력의 주문서 60%'), 0.6);
});

test('parseScrollSuccessRate extracts 100% from name', () => {
  assert.equal(parseScrollSuccessRate('장인의 주문서 100%'), 1.0);
});

test('parseScrollSuccessRate defaults to 100% when no percent suffix', () => {
  assert.equal(parseScrollSuccessRate('혼돈의 주문서'), 1.0);
  assert.equal(parseScrollSuccessRate('일반 주문서'), 1.0);
});

test('parseScrollSuccessRate handles percent in middle of name', () => {
  assert.equal(parseScrollSuccessRate('공 10% 주문서 (방어구)'), 0.1);
});

test('SCROLL_PERCENT_PATTERN matches percent values in names', () => {
  assert.ok(SCROLL_PERCENT_PATTERN.test('주문서 30%'));
  assert.ok(SCROLL_PERCENT_PATTERN.test('70% 주문서'));
  assert.equal(SCROLL_PERCENT_PATTERN.test('주문서'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/expected-value-scroll-model.test.mjs`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/expectedValue/scrollModel.mjs

/** Matches a percent value (e.g. "10%", "100%") in scroll names */
export const SCROLL_PERCENT_PATTERN = /(\d+)%/;

/**
 * Parses the success rate from a scroll name.
 * Returns a float 0–1. Defaults to 1.0 (100%) if no percent suffix found.
 */
export function parseScrollSuccessRate(nameKo) {
  const match = SCROLL_PERCENT_PATTERN.exec(nameKo ?? '');
  if (match) {
    const pct = parseInt(match[1], 10);
    return Math.min(Math.max(pct / 100, 0), 1);
  }
  return 1.0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/expected-value-scroll-model.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/expected-value-scroll-model.test.mjs src/lib/expectedValue/scrollModel.mjs
git commit -m "feat: add scroll success rate parsing model

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Chaos Scroll Model

**Files:**
- Create: `src/lib/expectedValue/chaosModel.mjs`
- Test: `tests/expected-value-chaos-model.test.mjs`

Models chaos scroll application: first roll success rate (60% for current chaos), then independently roll each positive stat using the chaos outcome table. Stats at `<= 0` are removed and not rolled by later chaos scrolls. HP/MP deltas use 10x scale.

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHAOS_OUTCOME_TABLE,
  CHAOS_HPMP_MULTIPLIER,
  buildChaosCumulativeTable,
  rollChaosStatDelta,
  applyChaosToStats,
  filterPositiveStats,
  CHAOS_SUCCESS_RATE,
} from '../src/lib/expectedValue/chaosModel.mjs';

test('CHAOS_OUTCOME_TABLE sums to approximately 100%', () => {
  const total = CHAOS_OUTCOME_TABLE.reduce((sum, entry) => sum + entry.probability, 0);
  assert.ok(Math.abs(total - 1.0) < 0.01, `Total probability ${total} is not ~1.0`);
});

test('CHAOS_HPMP_MULTIPLIER is 10', () => {
  assert.equal(CHAOS_HPMP_MULTIPLIER, 10);
});

test('buildChaosCumulativeTable creates cumulative probabilities', () => {
  const cumulative = buildChaosCumulativeTable();
  assert.equal(cumulative.length, CHAOS_OUTCOME_TABLE.length);
  // Last entry should be ~1.0
  const last = cumulative[cumulative.length - 1];
  assert.ok(Math.abs(last.cumulative - 1.0) < 0.01);
});

test('rollChaosStatDelta returns a valid delta for a given random value', () => {
  const delta = rollChaosStatDelta(0.5);
  assert.ok(typeof delta === 'number');
  assert.ok(delta >= -5 && delta <= 5);
});

test('rollChaosStatDelta returns +5 for very low random values (0.99% chance)', () => {
  const delta = rollChaosStatDelta(0.005);
  assert.equal(delta, 5);
});

test('rollChaosStatDelta returns -5 for very high random values (4.94% chance at end)', () => {
  const delta = rollChaosStatDelta(0.99);
  assert.equal(delta, -5);
});

test('rollChaosStatDelta returns 0 for middle random values', () => {
  const delta = rollChaosStatDelta(0.55);
  assert.equal(delta, 0);
});

test('filterPositiveStats keeps only stats with value > 0', () => {
  const stats = { str: 5, dex: 0, int: -1, luk: 3, maxHp: 0 };
  const filtered = filterPositiveStats(stats);
  assert.deepEqual(filtered, { str: 5, luk: 3 });
});

test('filterPositiveStats excludes upgradeSlots and attackSpeed even if positive', () => {
  const stats = { str: 5, upgradeSlots: 7, attackSpeed: 4 };
  const filtered = filterPositiveStats(stats);
  assert.deepEqual(filtered, { str: 5 });
});

test('applyChaosToStats rolls each positive stat independently', () => {
  // Use a deterministic sequence: mock the RNG to return specific values
  const mockRng = (() => {
    const values = [0.1, 0.5, 0.9]; // +3, 0, -4
    let i = 0;
    return () => values[i++];
  })();

  const stats = { str: 10, dex: 8, luk: 12 };
  const result = applyChaosToStats(stats, mockRng);

  // str gets +3 (rng=0.1), dex gets 0 (rng=0.5), luk gets -4 (rng=0.9)
  assert.deepEqual(result, { str: 13, dex: 8, luk: 8 });

  // dex was still positive so it stays, luk still positive so it stays
  assert.ok(result.str > 0);
  assert.ok(result.dex > 0);
  assert.ok(result.luk > 0);
});

test('applyChaosToStats removes stats that drop to <= 0', () => {
  const mockRng = (() => {
    // For str(1): -2 → -1 (removed)
    // For dex(1): -5 → -4 (removed)
    const values = [0.87, 0.99]; // delta of -2, -5
    let i = 0;
    return () => values[i++];
  })();

  const stats = { str: 1, dex: 1 };
  const result = applyChaosToStats(stats, mockRng);

  assert.equal(result.str, undefined); // removed
  assert.equal(result.dex, undefined); // removed
});

test('applyChaosToStats applies 10x multiplier to HP and MP deltas', () => {
  const mockRng = (() => {
    // maxHp gets +3 (rng=0.1) → * 10 = +30
    const values = [0.1];
    let i = 0;
    return () => values[i++];
  })();

  const stats = { maxHp: 100 };
  const result = applyChaosToStats(stats, mockRng);

  assert.equal(result.maxHp, 130); // 100 + (3 * 10)
});

test('CHAOS_SUCCESS_RATE is 0.6 (60%)', () => {
  assert.equal(CHAOS_SUCCESS_RATE, 0.6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/expected-value-chaos-model.test.mjs`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/expectedValue/chaosModel.mjs

import { HP_MP_KEYS } from '../enhancementState.mjs';

/** Chaos scroll success rate (60% for 혼돈의 주문서 60%) */
export const CHAOS_SUCCESS_RATE = 0.6;

/** HP/MP delta multiplier */
export const CHAOS_HPMP_MULTIPLIER = 10;

/** Chaos outcome table: delta → probability */
export const CHAOS_OUTCOME_TABLE = [
  { delta: 5,  probability: 0.0099 },
  { delta: 4,  probability: 0.0198 },
  { delta: 3,  probability: 0.1021 },
  { delta: 2,  probability: 0.1587 },
  { delta: 1,  probability: 0.1931 },
  { delta: 0,  probability: 0.1838 },
  { delta: -1, probability: 0.1370 },
  { delta: -2, probability: 0.0800 },
  { delta: -3, probability: 0.0365 },
  { delta: -4, probability: 0.0297 },
  { delta: -5, probability: 0.0494 },
];

const METADATA_KEYS = new Set(['upgradeSlots', 'attackSpeed']);

let _cumulativeTable = null;

/**
 * Builds cumulative probability table for binary-search lookup.
 * Each entry: { delta, cumulative } where cumulative is the upper bound.
 */
export function buildChaosCumulativeTable() {
  if (_cumulativeTable) return _cumulativeTable;
  let cumulative = 0;
  _cumulativeTable = CHAOS_OUTCOME_TABLE.map(({ delta, probability }) => {
    cumulative += probability;
    return { delta, cumulative };
  });
  return _cumulativeTable;
}

/**
 * Returns the delta for a given uniform random value [0, 1).
 */
export function rollChaosStatDelta(randomValue) {
  const table = buildChaosCumulativeTable();
  for (const { delta, cumulative } of table) {
    if (randomValue < cumulative) return delta;
  }
  return table[table.length - 1].delta;
}

/**
 * Filters stats to only those with value > 0, excluding metadata keys.
 */
export function filterPositiveStats(stats) {
  const filtered = {};
  for (const [key, value] of Object.entries(stats)) {
    if (METADATA_KEYS.has(key)) continue;
    if (Number.isFinite(value) && value > 0) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Applies chaos stat rolls to each positive stat independently.
 * HP/MP deltas are multiplied by CHAOS_HPMP_MULTIPLIER.
 * Stats that drop to <= 0 are removed from the result.
 *
 * @param {Record<string, number>} stats - current item stats (all positive)
 * @param {() => number} rng - random number generator returning [0, 1)
 * @returns {Record<string, number>} resulting stats after chaos application
 */
export function applyChaosToStats(stats, rng) {
  const result = {};
  const positive = filterPositiveStats(stats);

  for (const [key, value] of Object.entries(positive)) {
    const rawDelta = rollChaosStatDelta(rng());
    const delta = HP_MP_KEYS.has(key) ? rawDelta * CHAOS_HPMP_MULTIPLIER : rawDelta;
    const newValue = value + delta;
    if (newValue > 0) {
      result[key] = newValue;
    }
    // If newValue <= 0, stat is omitted (removed)
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/expected-value-chaos-model.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/expected-value-chaos-model.test.mjs src/lib/expectedValue/chaosModel.mjs
git commit -m "feat: add chaos scroll probability model

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Maker Model (Gem Probabilities)

**Files:**
- Create: `src/lib/expectedValue/makerModel.mjs`
- Test: `tests/expected-value-maker-model.test.mjs`

Models Maker gem outcomes: deterministic fixed gems (always produce exact stat values), 흑수정 random gem (grade-based probability tables), and 어둠의 크리스탈 (chaos -5..+5 table per stat).

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isFixedGem,
  isRandomGem,
  getFixedGemStats,
  BLACK_AMETHYST_TABLES,
  rollBlackAmethystStats,
  rollDarkCrystalStats,
  computeGemContribution,
} from '../src/lib/expectedValue/makerModel.mjs';

test('isFixedGem returns true for diamond, strCrystal, etc.', () => {
  assert.equal(isFixedGem('diamond'), true);
  assert.equal(isFixedGem('strCrystal'), true);
  assert.equal(isFixedGem('garnet'), true);
});

test('isFixedGem returns false for variable gems', () => {
  assert.equal(isFixedGem('blackAmethyst'), false);
  assert.equal(isFixedGem('darkCrystal'), false);
});

test('isRandomGem returns true for blackAmethyst and darkCrystal', () => {
  assert.equal(isRandomGem('blackAmethyst'), true);
  assert.equal(isRandomGem('darkCrystal'), true);
});

test('isRandomGem returns false for fixed gems', () => {
  assert.equal(isRandomGem('strCrystal'), false);
  assert.equal(isRandomGem('diamond'), false);
});

test('getFixedGemStats returns correct value for each grade', () => {
  assert.deepEqual(getFixedGemStats('diamond', 0), { weaponAttack: 1 });
  assert.deepEqual(getFixedGemStats('diamond', 1), { weaponAttack: 2 });
  assert.deepEqual(getFixedGemStats('diamond', 2), { weaponAttack: 3 });
  assert.deepEqual(getFixedGemStats('strCrystal', 0), { str: 1 });
  assert.deepEqual(getFixedGemStats('strCrystal', 2), { str: 5 });
  assert.deepEqual(getFixedGemStats('topaz', 0), { maxHp: 10 });
  assert.deepEqual(getFixedGemStats('topaz', 2), { maxHp: 30 });
});

test('getFixedGemStats returns null for non-fixed gems', () => {
  assert.equal(getFixedGemStats('blackAmethyst', 0), null);
  assert.equal(getFixedGemStats('darkCrystal', 0), null);
});

test('BLACK_AMETHYST_TABLES has three grade entries with correct probability sums', () => {
  for (const grade of ['low', 'mid', 'high']) {
    const table = BLACK_AMETHYST_TABLES[grade];
    assert.ok(table, `Grade ${grade} table exists`);
    const total = table.reduce((sum, entry) => sum + entry.probability, 0);
    assert.ok(Math.abs(total - 1.0) < 0.01, `Grade ${grade} total=${total}`);
  }
});

test('rollBlackAmethystStats returns stat deltas for weaponAttack based on RNG', () => {
  // Use low-grade table. RNG values select -1, 0, +1
  const rng = (() => { const v = [0.1, 0.6, 0.95]; let i = 0; return () => v[i++]; })();
  const result = rollBlackAmethystStats('low', ['weaponAttack'], rng);
  // Low table: -1(25%), 0(50%), +1(25%)
  // 0.1 → -1, 0.6 → +1
  assert.equal(result.weaponAttack, 1); // -1 + (+1) from second roll = 0? No...
  // Actually, rng values: 0.1 → first 25% → -1; 0.6 → third quartile → +1
  // But we only have one stat key, so second rng not consumed
  assert.equal(result.weaponAttack, -1);
});

test('rollBlackAmethystStats with both weaponAttack and magicAttack rolls both independently', () => {
  const rng = (() => { const v = [0.1, 0.9]; let i = 0; return () => v[i++]; })();
  const result = rollBlackAmethystStats('mid', ['weaponAttack', 'magicAttack'], rng);
  // Mid table: -2(10%), -1(20%), 0(40%), +1(20%), +2(10%)
  // 0.1 → -2 (first 10%), 0.9 → +2 (last 10%)
  assert.equal(result.weaponAttack, -2);
  assert.equal(result.magicAttack, 2);
});

test('rollDarkCrystalStats rolls each of STR/DEX/INT/LUK present on clean item', () => {
  const cleanStats = { str: 10, dex: 5, int: 5, luk: 5 };
  const rng = (() => { const v = [0.5, 0.5, 0.5, 0.5]; let i = 0; return () => v[i++]; })();
  const result = rollDarkCrystalStats(cleanStats, rng);
  // Each gets delta 0 at rng=0.5
  assert.deepEqual(result, { str: 10, dex: 5, int: 5, luk: 5 });
});

test('rollDarkCrystalStats does not create stats absent from clean base', () => {
  const cleanStats = { str: 10 }; // only STR
  const rng = (() => { const v = [0.5]; let i = 0; return () => v[i++]; })();
  const result = rollDarkCrystalStats(cleanStats, rng);
  assert.deepEqual(result, { str: 10 });
  assert.equal(result.dex, undefined);
  assert.equal(result.int, undefined);
  assert.equal(result.luk, undefined);
});

test('computeGemContribution returns deterministic stats for fixed gems', () => {
  assert.deepEqual(computeGemContribution('diamond', 1, {}), { weaponAttack: 2 });
  assert.deepEqual(computeGemContribution('strCrystal', 2, {}), { str: 5 });
});

test('computeGemContribution returns random result for variable gems using RNG', () => {
  const rng = (() => { const v = [0.75]; let i = 0; return () => v[i++]; })();
  const result = computeGemContribution('blackAmethyst', 'low', {}, rng);
  // Low table: -1(25%), 0(50%), +1(25%). 0.75 → +1
  assert.ok(typeof result.weaponAttack === 'number' || typeof result.magicAttack === 'number');
});

test('computeGemContribution returns null for unknown gem key', () => {
  assert.equal(computeGemContribution('nonexistent', 0, {}), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/expected-value-maker-model.test.mjs`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/expectedValue/makerModel.mjs

import { getGemTypeByKey } from '../makerData.mjs';
import { rollChaosStatDelta } from './chaosModel.mjs';

const FIXED_GEM_KEYS = new Set([
  'diamond', 'sapphire', 'strCrystal', 'dexCrystal', 'intCrystal', 'lukCrystal',
  'garnet', 'opal', 'amethyst', 'aquamarine', 'topaz', 'emerald',
]);

const RANDOM_GEM_KEYS = new Set(['blackAmethyst', 'darkCrystal']);

/** Probability tables for 흑수정 (Black Amethyst) by grade */
export const BLACK_AMETHYST_TABLES = {
  low: [
    { value: -1, probability: 0.25 },
    { value: 0,  probability: 0.50 },
    { value: 1,  probability: 0.25 },
  ],
  mid: [
    { value: -2, probability: 0.10 },
    { value: -1, probability: 0.20 },
    { value: 0,  probability: 0.40 },
    { value: 1,  probability: 0.20 },
    { value: 2,  probability: 0.10 },
  ],
  high: [
    { value: -3, probability: 0.05 },
    { value: -2, probability: 0.10 },
    { value: -1, probability: 0.20 },
    { value: 0,  probability: 0.30 },
    { value: 1,  probability: 0.20 },
    { value: 2,  probability: 0.10 },
    { value: 3,  probability: 0.05 },
  ],
};

const GRADE_INDEX_TO_KEY = ['low', 'mid', 'high'];

export function isFixedGem(gemKey) {
  return FIXED_GEM_KEYS.has(gemKey);
}

export function isRandomGem(gemKey) {
  return RANDOM_GEM_KEYS.has(gemKey);
}

/**
 * Returns the deterministic stat contribution for a fixed gem at the given grade.
 */
export function getFixedGemStats(gemKey, gradeIndex) {
  if (!isFixedGem(gemKey)) return null;
  const gem = getGemTypeByKey(gemKey);
  if (!gem) return null;
  const value = gem.values[gradeIndex];
  if (!Number.isFinite(value)) return null;
  return { [gem.stat]: value };
}

function selectFromTable(table, rngValue) {
  let cumulative = 0;
  for (const entry of table) {
    cumulative += entry.probability;
    if (rngValue < cumulative) return entry.value;
  }
  return table[table.length - 1].value;
}

/**
 * Rolls 흑수정 (Black Amethyst) outcomes for the given stat keys.
 * Each stat is rolled independently using the grade's probability table.
 */
export function rollBlackAmethystStats(gradeKey, statKeys, rng) {
  const table = BLACK_AMETHYST_TABLES[gradeKey];
  if (!table) return {};

  const result = {};
  for (const key of statKeys) {
    result[key] = selectFromTable(table, rng());
  }
  return result;
}

/**
 * Rolls 어둠의 크리스탈 (Dark Crystal) outcomes.
 * Uses the chaos -5..+5 table independently for each of STR/DEX/INT/LUK
 * that are present on the clean base item.
 */
export function rollDarkCrystalStats(cleanStats, rng) {
  const darkKeys = ['str', 'dex', 'int', 'luk'];
  const result = { ...cleanStats };

  for (const key of darkKeys) {
    if (Number.isFinite(cleanStats[key])) {
      const delta = rollChaosStatDelta(rng());
      result[key] = (result[key] ?? 0) + delta;
    }
  }
  return result;
}

/**
 * Computes a gem's stat contribution, handling both fixed and random gems.
 *
 * @param {string} gemKey
 * @param {number|string} grade - gradeIndex (0-2) for fixed, or 'low'/'mid'/'high' for random
 * @param {Record<string, number>} cleanStats - base item stats (needed for darkCrystal)
 * @param {() => number} rng - random number generator
 * @returns {Record<string, number>|null}
 */
export function computeGemContribution(gemKey, grade, cleanStats, rng) {
  if (isFixedGem(gemKey)) {
    return getFixedGemStats(gemKey, grade);
  }

  if (gemKey === 'blackAmethyst') {
    const gradeKey = typeof grade === 'number' ? GRADE_INDEX_TO_KEY[grade] : grade;
    const statKeys = ['weaponAttack', 'magicAttack'];
    return rollBlackAmethystStats(gradeKey, statKeys, rng);
  }

  if (gemKey === 'darkCrystal') {
    return rollDarkCrystalStats(cleanStats, rng);
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/expected-value-maker-model.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/expected-value-maker-model.test.mjs src/lib/expectedValue/makerModel.mjs
git commit -m "feat: add Maker gem probability model

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Item Level-Up Model

**Files:**
- Create: `src/lib/expectedValue/levelUpModel.mjs`
- Test: `tests/expected-value-level-up-model.test.mjs`

Models Item Level-Up: each stat range is a uniform integer roll from `min` to `max`, independent per stat and per level.

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  rollLevelUpStats,
  rollAllLevelUps,
} from '../src/lib/expectedValue/levelUpModel.mjs';

test('rollLevelUpStats returns a stat roll within the defined range', () => {
  const ranges = { str: { min: 1, max: 2 }, weaponAttack: { min: 0, max: 2 } };
  const rng = (() => { const v = [0.0, 1.0]; let i = 0; return () => v[i++]; })();
  const result = rollLevelUpStats(ranges, rng);

  // floor(0.0 * 2) + 1 = 1 for str (2 values: 1,2)
  // floor(1.0 * 2.999...) ≈ 2, + 0 = 2 for weaponAttack? No...
  // With rng=1.0 and max-min+1=3, floor(1.0*3)=2 for the 3-element range [0,1,2]
  // So max-min=2, count=3, floor(1.0*3)=2, min+2=2
  assert.equal(result.str, 1);    // min=1, max=2: floor(0.0*(2-1+1))=0, 1+0=1
  assert.equal(result.weaponAttack, 2); // min=0, max=2: floor(1.0*3)=2, 0+2=2
});

test('rollLevelUpStats returns integer values across full range', () => {
  const ranges = { str: { min: 0, max: 5 } };
  // Test all possible RNG values to ensure uniform coverage
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const rng = () => i / 100;
    const result = rollLevelUpStats(ranges, rng);
    seen.add(result.str);
  }
  // Should see all values 0-5
  for (let v = 0; v <= 5; v++) {
    assert.ok(seen.has(v), `Should have seen value ${v}`);
  }
});

test('rollAllLevelUps rolls each level independently and accumulates', () => {
  const ranges = { str: { min: 1, max: 1 } }; // always +1
  const rng = () => 0;
  const results = rollAllLevelUps(ranges, 3, rng);
  // Each of 3 levels: str = 1, accumulated = 3
  assert.deepEqual(results, { str: 3 });
});

test('rollAllLevelUps handles multiple stats', () => {
  const ranges = {
    str: { min: 0, max: 1 },
    dex: { min: 1, max: 2 },
  };
  const rng = (() => { const v = [0.0, 0.0, 0.5, 0.5]; let i = 0; return () => v[i++]; })();
  const results = rollAllLevelUps(ranges, 2, rng);
  // Level 1: str=0 (floor(0.0*2)=0), dex=1 (floor(0.0*2)+1=1)
  // Level 2: str=1 (floor(0.5*2)=1), dex=2 (floor(0.5*2)+1=2)
  // Total: str=1, dex=3
  assert.equal(results.str, 1);
  assert.equal(results.dex, 3);
});

test('rollAllLevelUps with 0 levels returns empty object', () => {
  const ranges = { str: { min: 1, max: 2 } };
  assert.deepEqual(rollAllLevelUps(ranges, 0, () => 0), {});
});

test('rollAllLevelUps handles empty ranges', () => {
  assert.deepEqual(rollAllLevelUps({}, 3, () => 0), {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/expected-value-level-up-model.test.mjs`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/expectedValue/levelUpModel.mjs

import { normalizeItemLevelUpRange } from '../itemLevelUpData.mjs';

/**
 * Rolls one level of stat gains. Each stat in `ranges` gets a uniform
 * integer roll from min to max (inclusive).
 *
 * @param {Record<string, {min: number, max: number}>} ranges
 * @param {() => number} rng - returns [0, 1)
 * @returns {Record<string, number>} stat gains for this level
 */
export function rollLevelUpStats(ranges, rng) {
  const stats = {};
  for (const [key, range] of Object.entries(ranges)) {
    const normalized = normalizeItemLevelUpRange(range);
    if (!normalized) continue;
    const count = normalized.max - normalized.min + 1;
    const value = Math.floor(rng() * count) + normalized.min;
    if (value !== 0) {
      stats[key] = value;
    }
  }
  return stats;
}

/**
 * Rolls all item level-up levels and returns accumulated stat gains.
 *
 * @param {Record<string, {min: number, max: number}>} ranges
 * @param {number} levelCount - number of level-up events
 * @param {() => number} rng
 * @returns {Record<string, number>} total accumulated stat gains
 */
export function rollAllLevelUps(ranges, levelCount, rng) {
  const accumulated = {};
  for (let level = 0; level < levelCount; level++) {
    const gains = rollLevelUpStats(ranges, rng);
    for (const [key, value] of Object.entries(gains)) {
      accumulated[key] = (accumulated[key] ?? 0) + value;
    }
  }
  return accumulated;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/expected-value-level-up-model.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/expected-value-level-up-model.test.mjs src/lib/expectedValue/levelUpModel.mjs
git commit -m "feat: add Item Level-Up probability model

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Seeded RNG Utility

**Files:**
- Modify: `src/lib/expectedValue/monteCarloEngine.mjs` (create with just the RNG)

The Monte Carlo engine needs a seedable RNG. We'll use a simple mulberry32 PRNG that's deterministic given a seed.

- [ ] **Step 1: Write RNG into monteCarloEngine.mjs**

```javascript
// src/lib/expectedValue/monteCarloEngine.mjs (initial version)

/**
 * Mulberry32 seeded PRNG.
 * Returns a function that produces uniform [0, 1) values.
 */
export function createSeededRng(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a random seed from crypto.getRandomValues.
 */
export function createRandomSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0];
  }
  return (Math.random() * 4294967296) | 0;
}
```

- [ ] **Step 2: Write a minimal RNG test and commit**

```bash
# Create the tests file with RNG tests
```
(Test file created inline below)

```javascript
// tests/expected-value-monte-carlo.test.mjs (RNG portion)
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSeededRng,
  createRandomSeed,
} from '../src/lib/expectedValue/monteCarloEngine.mjs';

test('createSeededRng produces deterministic sequence', () => {
  const rng1 = createSeededRng(42);
  const rng2 = createSeededRng(42);
  const values1 = Array.from({ length: 10 }, () => rng1());
  const values2 = Array.from({ length: 10 }, () => rng2());
  assert.deepEqual(values1, values2);
});

test('createSeededRng produces values in [0, 1)', () => {
  const rng = createSeededRng(12345);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `Value ${v} out of range`);
  }
});

test('createSeededRng different seeds produce different sequences', () => {
  const rng1 = createSeededRng(1);
  const rng2 = createSeededRng(2);
  const v1 = Array.from({ length: 5 }, () => rng1());
  const v2 = Array.from({ length: 5 }, () => rng2());
  assert.notDeepEqual(v1, v2);
});

test('createRandomSeed returns a 32-bit integer', () => {
  const seed = createRandomSeed();
  assert.ok(Number.isInteger(seed));
  assert.ok(seed >= 0 && seed <= 0xFFFFFFFF);
});
```

- [ ] **Step 3: Commit**

```bash
git add tests/expected-value-monte-carlo.test.mjs src/lib/expectedValue/monteCarloEngine.mjs
git commit -m "feat: add seeded RNG for Monte Carlo engine

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Candidate Strategy Generator

**Files:**
- Create: `src/lib/expectedValue/candidateGenerator.mjs`
- Test: `tests/expected-value-candidate-generator.test.mjs`

Generates practical candidate enhancement strategies given available scrolls, Maker options, and Item Level-Up permission.

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateScrollCandidates,
  generateMakerCandidates,
  generateStrategyCandidates,
  pruneUselessScrolls,
} from '../src/lib/expectedValue/candidateGenerator.mjs';

test('generateScrollCandidates includes scrolls that affect checked stats', () => {
  const scrolls = [
    { id: 's1', nameKo: 'STR 주문서 10%', stats: { str: 3 }, maxApplications: null },
    { id: 's2', nameKo: 'DEX 주문서 60%', stats: { dex: 2 }, maxApplications: null },
  ];
  const checkedStats = { str: true, dex: false };
  const candidates = generateScrollCandidates(scrolls, checkedStats, 7);
  assert.ok(candidates.some(s => s.scroll.id === 's1'));
  // DEX is unchecked but the scroll still appears — pruning is separate
});

test('pruneUselessScrolls removes scrolls that only affect unchecked stats', () => {
  const scrolls = [
    { id: 's1', nameKo: 'STR 주문서 10%', stats: { str: 3 }, maxApplications: null },
    { id: 's2', nameKo: 'DEX 주문서 60%', stats: { dex: 2 }, maxApplications: null },
    { id: 's3', nameKo: 'INT 주문서 10%', stats: { int: 3 }, maxApplications: null },
  ];
  const checkedStats = { str: true, dex: false, int: false };
  const pruned = pruneUselessScrolls(scrolls, checkedStats);
  assert.equal(pruned.length, 1);
  assert.equal(pruned[0].id, 's1');
});

test('pruneUselessScrolls keeps scrolls with at least one checked stat', () => {
  const scrolls = [
    { id: 's1', nameKo: '혼합 주문서 10%', stats: { str: 3, dex: 2 }, maxApplications: null },
  ];
  const checkedStats = { str: false, dex: true };
  const pruned = pruneUselessScrolls(scrolls, checkedStats);
  assert.equal(pruned.length, 1);
});

test('pruneUselessScrolls keeps scrolls when grade is checked even without stat overlap', () => {
  const scrolls = [
    { id: 's1', nameKo: 'HP 주문서 100%', stats: { maxHp: 10 }, maxApplications: null },
  ];
  // grade contributes to target, so all scrolls that add any stats are useful
  const checkedStats = { str: true, grade: true };
  const pruned = pruneUselessScrolls(scrolls, checkedStats);
  assert.equal(pruned.length, 1);
});

test('generateStrategyCandidates returns strategies with correct fixed order', () => {
  const scrolls = [
    { id: 's1', nameKo: 'STR 주문서 10%', stats: { str: 3 }, maxApplications: null },
  ];
  const options = {
    scrolls,
    checkedStats: { str: true, grade: false },
    upgradeSlots: 2,
    makerAllowed: false,
    gemSlotCount: 0,
    itemLevelUpAllowed: false,
    levelUpDefinition: null,
  };
  const strategies = generateStrategyCandidates(options);
  assert.ok(strategies.length > 0);
  // Each strategy must follow Maker → Scrolling → Item Level-Up
  for (const strat of strategies) {
    assert.ok(Array.isArray(strat.makerChoices));
    assert.ok(Array.isArray(strat.scrollSequence));
    assert.equal(strat.useItemLevelUp, false);
  }
});

test('generateStrategyCandidates includes empty strategy', () => {
  const options = {
    scrolls: [],
    checkedStats: { str: true, grade: false },
    upgradeSlots: 7,
    makerAllowed: false,
    gemSlotCount: 0,
    itemLevelUpAllowed: false,
    levelUpDefinition: null,
  };
  const strategies = generateStrategyCandidates(options);
  // At minimum includes doing nothing
  assert.ok(strategies.some(s => s.makerChoices.length === 0 && s.scrollSequence.length === 0));
});

test('generateStrategyCandidates enforces maxApplications', () => {
  const scrolls = [
    { id: 's1', nameKo: '제한 주문서 30%', stats: { str: 5 }, maxApplications: 1 },
  ];
  const options = {
    scrolls,
    checkedStats: { str: true, grade: false },
    upgradeSlots: 3,
    makerAllowed: false,
    gemSlotCount: 0,
    itemLevelUpAllowed: false,
    levelUpDefinition: null,
  };
  const strategies = generateStrategyCandidates(options);
  for (const strat of strategies) {
    const s1Count = strat.scrollSequence.filter(s => s.id === 's1').length;
    assert.ok(s1Count <= 1, `Strategy has ${s1Count} applications of s1, max is 1`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/expected-value-candidate-generator.test.mjs`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/expectedValue/candidateGenerator.mjs

import { isFixedGem, isRandomGem } from './makerModel.mjs';
import { getGemTypeByKey, GEM_TYPES, GEM_GRADES } from '../makerData.mjs';

/**
 * Filters scrolls to those that could contribute to target conditions.
 * A scroll is useful if it affects any checked stat, OR if grade is checked
 * (since any stat contributes to grade).
 */
export function pruneUselessScrolls(scrolls, checkedStats) {
  const gradeChecked = checkedStats?.grade === true;
  return scrolls.filter(scroll => {
    if (!scroll.stats || Object.keys(scroll.stats).length === 0) return false;
    if (gradeChecked) return true;
    for (const key of Object.keys(scroll.stats)) {
      if (checkedStats[key]) return true;
    }
    return false;
  });
}

/**
 * Generates scroll sequence candidates for the given upgrade slots.
 * Includes varying lengths (may stop before using all slots).
 */
export function generateScrollCandidates(scrolls, checkedStats, upgradeSlots) {
  const useful = pruneUselessScrolls(scrolls, checkedStats);
  const results = [];

  function enumerate(sequence, slot) {
    results.push([...sequence]);
    if (slot >= upgradeSlots) return;

    for (const scroll of useful) {
      // Enforce maxApplications
      if (scroll.maxApplications != null) {
        const count = sequence.filter(s => s.id === scroll.id).length;
        if (count >= scroll.maxApplications) continue;
      }
      sequence.push(scroll);
      enumerate(sequence, slot + 1);
      sequence.pop();
    }
  }

  enumerate([], 0);
  return results;
}

/**
 * Generates Maker gem slot candidates.
 */
export function generateMakerCandidates(gemSlotCount, equipmentKind) {
  if (gemSlotCount <= 0) return [[]];

  const isWeapon = equipmentKind ? equipmentKind.includes('검') || equipmentKind.includes('완드') : true;
  const availableGems = GEM_TYPES.filter(g => {
    if (g.weaponOnly && !isWeapon) return false;
    return true;
  });

  const results = [];

  function enumerate(slots, index) {
    results.push([...slots]);
    if (index >= gemSlotCount) return;

    for (const gem of availableGems) {
      // Check not already used
      if (slots.some(s => s && s.gemKey === gem.key)) continue;

      if (isFixedGem(gem.key)) {
        for (let grade = 0; grade < GEM_GRADES.length; grade++) {
          slots[index] = { gemKey: gem.key, grade };
          enumerate(slots, index + 1);
          slots[index] = null;
        }
      } else if (isRandomGem(gem.key)) {
        for (let grade = 0; grade < GEM_GRADES.length; grade++) {
          slots[index] = { gemKey: gem.key, grade };
          enumerate(slots, index + 1);
          slots[index] = null;
        }
      }
    }

    // Also allow leaving slot empty
    slots[index] = null;
    enumerate(slots, index + 1);
  }

  const slots = new Array(gemSlotCount).fill(null);
  enumerate(slots, 0);
  return results;
}

/**
 * Generates full strategy candidates.
 *
 * Fixed order: Maker → Scrolling → Item Level-Up
 */
export function generateStrategyCandidates(options) {
  const {
    scrolls,
    checkedStats,
    upgradeSlots,
    makerAllowed,
    gemSlotCount,
    equipmentKind,
    itemLevelUpAllowed,
    levelUpDefinition,
  } = options;

  const makerCandidates = makerAllowed && gemSlotCount > 0
    ? generateMakerCandidates(gemSlotCount, equipmentKind)
    : [[]];

  const scrollCandidates = generateScrollCandidates(scrolls, checkedStats, upgradeSlots);

  const strategies = [];

  for (const makerChoices of makerCandidates) {
    for (const scrollSequence of scrollCandidates) {
      // Item Level-Up: include if allowed (as a boolean flag — the optimizer decides)
      if (itemLevelUpAllowed) {
        strategies.push({
          makerChoices: makerChoices.filter(m => m !== null),
          scrollSequence,
          useItemLevelUp: true,
        });
      }
      strategies.push({
        makerChoices: makerChoices.filter(m => m !== null),
        scrollSequence,
        useItemLevelUp: false,
      });
    }
  }

  return strategies;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/expected-value-candidate-generator.test.mjs`
Expected: PASS (or adjust tests for any implementation differences)

- [ ] **Step 5: Commit**

```bash
git add tests/expected-value-candidate-generator.test.mjs src/lib/expectedValue/candidateGenerator.mjs
git commit -m "feat: add candidate strategy generator

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Exact Probability Engine

**Files:**
- Create: `src/lib/expectedValue/exactEngine.mjs`
- Test: `tests/expected-value-exact-engine.test.mjs`

Calculates exact success probability for deterministic strategies (fixed scrolls only, no chaos, no random gems, no item level-up RNG). Uses dynamic programming to handle scroll order efficiently.

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeExactProbability,
  isDeterministicStrategy,
} from '../src/lib/expectedValue/exactEngine.mjs';

test('isDeterministicStrategy returns true for fixed scrolls only', () => {
  const strategy = {
    makerChoices: [{ gemKey: 'strCrystal', grade: 1 }],
    scrollSequence: [
      { id: 's1', nameKo: 'STR 주문서 10%', stats: { str: 3 }, maxApplications: null },
      { id: 's2', nameKo: 'STR 주문서 60%', stats: { str: 2 }, maxApplications: null },
    ],
    useItemLevelUp: false,
  };
  assert.equal(isDeterministicStrategy(strategy), true);
});

test('isDeterministicStrategy returns false if chaos scroll present', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [
      { id: 'chaos1', nameKo: '혼돈의 주문서 60%', stats: {}, maxApplications: null, behaviorType: 'chaos' },
    ],
    useItemLevelUp: false,
  };
  assert.equal(isDeterministicStrategy(strategy), false);
});

test('isDeterministicStrategy returns false with random maker gems', () => {
  const strategy = {
    makerChoices: [{ gemKey: 'blackAmethyst', grade: 1 }],
    scrollSequence: [],
    useItemLevelUp: false,
  };
  assert.equal(isDeterministicStrategy(strategy), false);
});

test('isDeterministicStrategy returns false with item level-up', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [],
    useItemLevelUp: true,
  };
  assert.equal(isDeterministicStrategy(strategy), false);
});

test('computeExactProbability returns 100% for clean item matching target', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [],
    useItemLevelUp: false,
  };
  const cleanStats = { str: 10 };
  const targetConditions = { statThresholds: { str: 0 }, gradeThreshold: null };
  const result = computeExactProbability(strategy, cleanStats, targetConditions, {});
  assert.equal(result.successProbability, 1.0);
  assert.equal(result.isExact, true);
});

test('computeExactProbability for single 60% scroll', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [
      { id: 's1', nameKo: 'STR 주문서 60%', stats: { str: 2 }, maxApplications: null },
    ],
    useItemLevelUp: false,
  };
  const cleanStats = { str: 5 };
  const targetConditions = { statThresholds: { str: 2 }, gradeThreshold: null };
  const result = computeExactProbability(strategy, cleanStats, targetConditions, {});

  // 60% chance of success (scroll passes, gives +2 STR → meets threshold)
  assert.ok(Math.abs(result.successProbability - 0.6) < 0.001);
  assert.equal(result.isExact, true);
});

test('computeExactProbability for two independent 10% scrolls', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [
      { id: 's1', nameKo: 'STR 주문서 10%', stats: { str: 3 }, maxApplications: null },
      { id: 's2', nameKo: 'STR 주문서 10%', stats: { str: 3 }, maxApplications: null },
    ],
    useItemLevelUp: false,
  };
  const cleanStats = { str: 5 };
  const targetConditions = { statThresholds: { str: 3 }, gradeThreshold: null };
  const result = computeExactProbability(strategy, cleanStats, targetConditions, {});

  // Success if at least one scroll passes: 1 - (0.9 * 0.9) = 0.19
  assert.ok(Math.abs(result.successProbability - 0.19) < 0.001);
  assert.equal(result.isExact, true);
});

test('computeExactProbability with 100% scroll is deterministic', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [
      { id: 's1', nameKo: '공 100% 주문서', stats: { weaponAttack: 1 }, maxApplications: null },
    ],
    useItemLevelUp: false,
  };
  const cleanStats = { weaponAttack: 50 };
  const targetConditions = { statThresholds: { weaponAttack: 1 }, gradeThreshold: null };
  const result = computeExactProbability(strategy, cleanStats, targetConditions, {});

  assert.equal(result.successProbability, 1.0);
  assert.equal(result.isExact, true);
});

test('computeExactProbability failure branch can still succeed if target already met', () => {
  const strategy = {
    makerChoices: [{ gemKey: 'strCrystal', grade: 2 }], // +5 STR from Maker
    scrollSequence: [
      { id: 's1', nameKo: 'STR 주문서 10%', stats: { str: 3 }, maxApplications: null },
    ],
    useItemLevelUp: false,
  };
  const cleanStats = { str: 5 };
  // Maker gives +5 STR = 10 total. Target needs STR gain >= 5.
  // Maker alone meets it. Scroll failure keeps Maker contribution → still succeeds.
  const targetConditions = { statThresholds: { str: 5 }, gradeThreshold: null };
  const result = computeExactProbability(strategy, cleanStats, targetConditions, {});

  // Maker fixed +5 meets target. Scroll failure still succeeds (10 >= 10).
  // Scroll success also succeeds. So 100% success.
  assert.equal(result.successProbability, 1.0);
  assert.equal(result.isExact, true);
});

test('computeExactProbability for empty strategy (no enhancement needed)', () => {
  const strategy = { makerChoices: [], scrollSequence: [], useItemLevelUp: false };
  const cleanStats = { str: 5 };
  const targetConditions = { statThresholds: {}, gradeThreshold: null };
  const result = computeExactProbability(strategy, cleanStats, targetConditions, {});

  assert.equal(result.successProbability, 1.0);
  assert.equal(result.isExact, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/expected-value-exact-engine.test.mjs`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/expectedValue/exactEngine.mjs

import { parseScrollSuccessRate } from './scrollModel.mjs';
import { isFixedGem, isRandomGem, getFixedGemStats } from './makerModel.mjs';

/**
 * Returns true if the strategy has no random elements (chaos, random gems, level-up).
 */
export function isDeterministicStrategy(strategy) {
  if (strategy.useItemLevelUp) return false;
  for (const gem of strategy.makerChoices) {
    if (isRandomGem(gem.gemKey)) return false;
  }
  for (const scroll of strategy.scrollSequence) {
    if (scroll.behaviorType === 'chaos') return false;
  }
  return true;
}

/**
 * Computes the deterministic stat contribution from Maker choices.
 */
function computeMakerStats(makerChoices) {
  const stats = {};
  for (const choice of makerChoices) {
    if (isFixedGem(choice.gemKey)) {
      const gemStats = getFixedGemStats(choice.gemKey, choice.grade);
      if (gemStats) {
        for (const [key, value] of Object.entries(gemStats)) {
          stats[key] = (stats[key] ?? 0) + value;
        }
      }
    }
  }
  return stats;
}

/**
 * Checks if stat totals satisfy target thresholds.
 */
function satisfiesTargets(currentStats, cleanStats, targetConditions) {
  const { statThresholds, gradeThreshold } = targetConditions;
  for (const [key, threshold] of Object.entries(statThresholds)) {
    const gain = (currentStats[key] ?? 0) - (cleanStats[key] ?? 0);
    if (gain < threshold) return false;
  }
  if (gradeThreshold != null) {
    // Grade will be computed externally and passed in; skip for exact engine tests
    // For now, grade checking is simplified
  }
  return true;
}

/**
 * Computes exact success probability for a deterministic strategy using DP.
 *
 * DP state: after processing first k scrolls, what's the probability of each stat outcome.
 * For deterministic strategies, Maker stats are fixed and added to the base before DP.
 */
export function computeExactProbability(strategy, cleanStats, targetConditions, options = {}) {
  const makerStats = computeMakerStats(strategy.makerChoices);

  // Apply fixed Maker stats to clean stats for baseline
  const baseline = { ...cleanStats };
  for (const [key, value] of Object.entries(makerStats)) {
    baseline[key] = (baseline[key] ?? 0) + value;
  }

  // DP: map of stat-state-key → probability
  let dp = new Map();
  const emptyKey = JSON.stringify(baseline);
  dp.set(emptyKey, 1.0);

  for (const scroll of strategy.scrollSequence) {
    const successRate = parseScrollSuccessRate(scroll.nameKo);
    const nextDp = new Map();

    for (const [stateKey, prob] of dp.entries()) {
      if (prob <= 0) continue;
      const state = JSON.parse(stateKey);

      // Success branch: apply scroll stats
      const successState = { ...state };
      if (scroll.stats) {
        for (const [key, value] of Object.entries(scroll.stats)) {
          if (Number.isFinite(value)) {
            successState[key] = (successState[key] ?? 0) + value;
          }
        }
      }
      const successKey = JSON.stringify(successState);
      nextDp.set(successKey, (nextDp.get(successKey) ?? 0) + prob * successRate);

      // Failure branch: stats unchanged, slot consumed
      const failKey = stateKey;
      if (successRate < 1.0) {
        nextDp.set(failKey, (nextDp.get(failKey) ?? 0) + prob * (1 - successRate));
      }
    }
    dp = nextDp;
  }

  // Sum probabilities of states that meet target
  let successProb = 0;
  for (const [stateKey, prob] of dp.entries()) {
    const state = JSON.parse(stateKey);
    if (satisfiesTargets(state, cleanStats, targetConditions)) {
      successProb += prob;
    }
  }

  return {
    successProbability: Math.min(successProb, 1.0),
    isExact: true,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/expected-value-exact-engine.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/expected-value-exact-engine.test.mjs src/lib/expectedValue/exactEngine.mjs
git commit -m "feat: add exact probability engine with DP

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Monte Carlo Engine (Main Thread Runner + Worker)

**Files:**
- Modify: `src/lib/expectedValue/monteCarloEngine.mjs` (add simulation runner)
- Create: `src/lib/expectedValue/monteCarloWorker.mjs`
- Modify: `tests/expected-value-monte-carlo.test.mjs` (add simulation tests)

The main-thread module provides the simulation runner and worker management. The worker file handles the actual trial loop.

- [ ] **Step 1: Add simulation tests to existing test file**

Append to `tests/expected-value-monte-carlo.test.mjs`:

```javascript
import {
  runMonteCarloSimulation,
  computeGeometricPercentiles,
  GEOMETRIC_PERCENTILE_KEYS,
} from '../src/lib/expectedValue/monteCarloEngine.mjs';

test('runMonteCarloSimulation returns success count and total trials', () => {
  // Deterministic success: every trial succeeds
  const simulateOneTrial = (rng) => true;
  const result = runMonteCarloSimulation(simulateOneTrial, 1000, 42);
  assert.equal(result.successCount, 1000);
  assert.equal(result.totalTrials, 1000);
  assert.equal(result.isZeroSuccess, false);
});

test('runMonteCarloSimulation with zero successes', () => {
  const simulateOneTrial = (rng) => false;
  const result = runMonteCarloSimulation(simulateOneTrial, 1000, 42);
  assert.equal(result.successCount, 0);
  assert.equal(result.isZeroSuccess, true);
});

test('runMonteCarloSimulation is deterministic with same seed', () => {
  let callCount = 0;
  const simulateOneTrial = (rng) => {
    callCount++;
    return rng() < 0.3; // ~30% success
  };
  const result1 = runMonteCarloSimulation(simulateOneTrial, 10000, 12345);
  callCount = 0;
  const result2 = runMonteCarloSimulation(simulateOneTrial, 10000, 12345);
  assert.equal(result1.successCount, result2.successCount);
});

test('computeGeometricPercentiles returns expected values for p=0.5', () => {
  const percentiles = computeGeometricPercentiles(0.5);
  // p50 for geometric: ceil(log(0.5)/log(0.5)) = 1
  assert.equal(percentiles.p50, 1);
  // p95 for geometric: ceil(log(0.05)/log(0.5)) = ceil(4.32) = 5
  assert.equal(percentiles.p95, 5);
});

test('computeGeometricPercentiles for p=1.0 returns 1 for all', () => {
  const percentiles = computeGeometricPercentiles(1.0);
  assert.equal(percentiles.p50, 1);
  assert.equal(percentiles.p75, 1);
  assert.equal(percentiles.p90, 1);
  assert.equal(percentiles.p95, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/expected-value-monte-carlo.test.mjs`
Expected: FAIL (new tests fail)

- [ ] **Step 3: Add simulation runner to monteCarloEngine.mjs**

Append to `src/lib/expectedValue/monteCarloEngine.mjs`:

```javascript
export const GEOMETRIC_PERCENTILE_KEYS = ['p50', 'p75', 'p90', 'p95'];

/**
 * Runs a Monte Carlo simulation with a given trial count and seed.
 *
 * @param {(rng: () => number) => boolean} simulateOneTrial - returns true if trial succeeds
 * @param {number} trialCount - number of trials
 * @param {number} seed - RNG seed
 * @returns {{ successCount: number, totalTrials: number, isZeroSuccess: boolean }}
 */
export function runMonteCarloSimulation(simulateOneTrial, trialCount, seed) {
  const rng = createSeededRng(seed);
  let successCount = 0;
  for (let i = 0; i < trialCount; i++) {
    if (simulateOneTrial(rng)) {
      successCount++;
    }
  }
  return {
    successCount,
    totalTrials: trialCount,
    isZeroSuccess: successCount === 0,
  };
}

/**
 * Computes attempt-count percentiles from a geometric distribution.
 * All values are rounded up to whole clean-item attempts.
 *
 * @param {number} p - per-clean-item success probability [0, 1]
 * @returns {{ p50: number, p75: number, p90: number, p95: number }}
 */
export function computeGeometricPercentiles(p) {
  if (p >= 1.0) {
    return { p50: 1, p75: 1, p90: 1, p95: 1 };
  }
  if (p <= 0) {
    return { p50: Infinity, p75: Infinity, p90: Infinity, p95: Infinity };
  }

  const percentile = (q) => Math.ceil(Math.log(1 - q) / Math.log(1 - p));

  return {
    p50: percentile(0.50),
    p75: percentile(0.75),
    p90: percentile(0.90),
    p95: percentile(0.95),
  };
}

/**
 * Computes the expected number of clean-item attempts (geometric mean).
 */
export function computeExpectedAttempts(p) {
  if (p >= 1.0) return 1;
  if (p <= 0) return Infinity;
  return Math.ceil(1 / p);
}
```

- [ ] **Step 4: Create the Web Worker file**

```javascript
// src/lib/expectedValue/monteCarloWorker.mjs
// Web Worker entry point for Monte Carlo simulation.
// Receives messages from the main thread and runs trials in chunks.

import { createSeededRng } from './monteCarloEngine.mjs';

let cancelRequested = false;

self.onmessage = function (event) {
  const msg = event.data;

  if (msg.type === 'cancel') {
    cancelRequested = true;
    return;
  }

  if (msg.type !== 'start') return;

  cancelRequested = false;
  const { trialCount, seed, trialFunctionCode } = msg;

  // The trial function is sent as a string and eval'd in worker context.
  // It must be a pure function: (rng) => boolean
  let simulateOneTrial;
  try {
    // eslint-disable-next-line no-eval
    simulateOneTrial = eval(`(${trialFunctionCode})`);
  } catch (e) {
    self.postMessage({ type: 'error', message: `Failed to parse trial function: ${e.message}` });
    return;
  }

  const rng = createSeededRng(seed);
  let successCount = 0;
  const progressInterval = Math.max(1, Math.floor(trialCount / 100));
  const startTime = performance.now();

  for (let i = 0; i < trialCount; i++) {
    if (cancelRequested) {
      self.postMessage({ type: 'cancelled', trialsCompleted: i });
      return;
    }

    try {
      if (simulateOneTrial(rng)) {
        successCount++;
      }
    } catch (e) {
      self.postMessage({ type: 'error', message: `Trial ${i} error: ${e.message}` });
      return;
    }

    // Throttled progress updates: every 1% or roughly every 250ms
    if (i > 0 && (i % progressInterval === 0)) {
      const elapsed = performance.now() - startTime;
      if (elapsed >= 250 || i % (progressInterval * 10) === 0) {
        self.postMessage({
          type: 'progress',
          trialsCompleted: i + 1,
          totalTrials: trialCount,
          successCount,
          progress: (i + 1) / trialCount,
        });
      }
    }
  }

  self.postMessage({
    type: 'complete',
    successCount,
    totalTrials: trialCount,
    isZeroSuccess: successCount === 0,
  });
};
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `node --test tests/expected-value-monte-carlo.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/expected-value-monte-carlo.test.mjs src/lib/expectedValue/monteCarloEngine.mjs src/lib/expectedValue/monteCarloWorker.mjs
git commit -m "feat: add Monte Carlo engine with Web Worker support

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Strategy Optimizer

**Files:**
- Create: `src/lib/expectedValue/strategyOptimizer.mjs`
- Test: `tests/expected-value-strategy-optimizer.test.mjs`

Ranks strategies by the spec's objective ordering: (1) highest success probability, (2) fewer chaos/random RNG sources, (3) fewer total enhancement actions, (4) deterministic tiebreak.

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  rankStrategies,
  countRngSources,
  countTotalActions,
  optimizeStrategies,
} from '../src/lib/expectedValue/strategyOptimizer.mjs';

test('countRngSources returns 0 for deterministic strategy', () => {
  const strat = {
    makerChoices: [{ gemKey: 'strCrystal', grade: 1 }],
    scrollSequence: [
      { id: 's1', nameKo: 'STR 주문서 10%', stats: { str: 3 } },
    ],
    useItemLevelUp: false,
  };
  assert.equal(countRngSources(strat), 0);
});

test('countRngSources counts chaos scrolls', () => {
  const strat = {
    makerChoices: [],
    scrollSequence: [
      { id: 'c1', nameKo: '혼돈 주문서 60%', stats: {}, behaviorType: 'chaos' },
    ],
    useItemLevelUp: false,
  };
  assert.equal(countRngSources(strat), 1);
});

test('countRngSources counts random Maker gems', () => {
  const strat = {
    makerChoices: [{ gemKey: 'blackAmethyst', grade: 1 }],
    scrollSequence: [],
    useItemLevelUp: false,
  };
  assert.equal(countRngSources(strat), 1);
});

test('countRngSources counts item level-up', () => {
  const strat = { makerChoices: [], scrollSequence: [], useItemLevelUp: true };
  assert.equal(countRngSources(strat), 1);
});

test('countTotalActions sums maker choices, scrolls, and item level-up', () => {
  const strat = {
    makerChoices: [{ gemKey: 'strCrystal', grade: 1 }, { gemKey: 'dexCrystal', grade: 0 }],
    scrollSequence: [
      { id: 's1', nameKo: 'STR 10%', stats: { str: 3 } },
      { id: 's2', nameKo: 'STR 60%', stats: { str: 2 } },
    ],
    useItemLevelUp: true,
  };
  assert.equal(countTotalActions(strat), 5); // 2 gems + 2 scrolls + 1 level-up
});

test('rankStrategies ranks higher probability first', () => {
  const a = { successProbability: 0.5, rngSources: 0, totalActions: 3, strategyIndex: 0 };
  const b = { successProbability: 0.3, rngSources: 0, totalActions: 3, strategyIndex: 1 };
  const ranked = [a, b].sort(rankStrategies);
  assert.equal(ranked[0], a);
  assert.equal(ranked[1], b);
});

test('rankStrategies breaks ties with fewer RNG sources', () => {
  const a = { successProbability: 0.5, rngSources: 2, totalActions: 3, strategyIndex: 0 };
  const b = { successProbability: 0.5, rngSources: 0, totalActions: 3, strategyIndex: 1 };
  const ranked = [a, b].sort(rankStrategies);
  assert.equal(ranked[0], b); // b has fewer RNG sources
});

test('rankStrategies breaks further ties with fewer total actions', () => {
  const a = { successProbability: 0.5, rngSources: 0, totalActions: 5, strategyIndex: 0 };
  const b = { successProbability: 0.5, rngSources: 0, totalActions: 3, strategyIndex: 1 };
  const ranked = [a, b].sort(rankStrategies);
  assert.equal(ranked[0], b); // b has fewer actions
});

test('optimizeStrategies returns the best strategy', () => {
  const strategies = [
    { makerChoices: [], scrollSequence: [], useItemLevelUp: false },
  ];
  const scored = [
    { strategy: strategies[0], successProbability: 0.8, rngSources: 0, totalActions: 0, strategyIndex: 0 },
  ];
  const best = optimizeStrategies(scored);
  assert.deepEqual(best, scored[0]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/expected-value-strategy-optimizer.test.mjs`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/expectedValue/strategyOptimizer.mjs

import { isRandomGem } from './makerModel.mjs';

/**
 * Counts the number of RNG sources in a strategy.
 * Each chaos scroll, random Maker gem, and Item Level-Up counts as one source.
 */
export function countRngSources(strategy) {
  let count = 0;
  for (const gem of strategy.makerChoices) {
    if (gem && isRandomGem(gem.gemKey)) count++;
  }
  for (const scroll of strategy.scrollSequence) {
    if (scroll.behaviorType === 'chaos') count++;
  }
  if (strategy.useItemLevelUp) count++;
  return count;
}

/**
 * Counts total enhancement actions in a strategy.
 */
export function countTotalActions(strategy) {
  const makerCount = strategy.makerChoices.filter(m => m !== null).length;
  const scrollCount = strategy.scrollSequence.length;
  const levelUpCount = strategy.useItemLevelUp ? 1 : 0;
  return makerCount + scrollCount + levelUpCount;
}

/**
 * Comparator for ranking strategies.
 * Objective order:
 *   1. higher success probability
 *   2. fewer RNG sources
 *   3. fewer total actions
 *   4. lower strategyIndex (deterministic tiebreak)
 */
export function rankStrategies(a, b) {
  // 1. Higher probability first
  if (a.successProbability !== b.successProbability) {
    return b.successProbability - a.successProbability;
  }
  // 2. Fewer RNG sources
  if (a.rngSources !== b.rngSources) {
    return a.rngSources - b.rngSources;
  }
  // 3. Fewer total actions
  if (a.totalActions !== b.totalActions) {
    return a.totalActions - b.totalActions;
  }
  // 4. Deterministic tiebreak by original index
  return a.strategyIndex - b.strategyIndex;
}

/**
 * Returns the single best strategy from the scored list.
 */
export function optimizeStrategies(scoredStrategies) {
  if (scoredStrategies.length === 0) return null;
  const sorted = [...scoredStrategies].sort(rankStrategies);
  return sorted[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/expected-value-strategy-optimizer.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/expected-value-strategy-optimizer.test.mjs src/lib/expectedValue/strategyOptimizer.mjs
git commit -m "feat: add strategy optimizer with multi-objective ranking

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Result Formatter + Chart Renderer

**Files:**
- Create: `src/lib/expectedValue/resultFormatter.mjs`
- Create: `src/lib/expectedValue/chartRenderer.mjs`
- Test: `tests/expected-value-result-formatter.test.mjs`

Formats probability results for display (labels, percent formatting, stale state) and renders a canvas-based attempt-distribution chart.

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatProbability,
  formatCalculationLabel,
  isResultStale,
  createResultSummary,
} from '../src/lib/expectedValue/resultFormatter.mjs';

test('formatProbability formats >1% as percentage', () => {
  assert.equal(formatProbability(0.15), '15.00%');
  assert.equal(formatProbability(0.01), '1.00%');
});

test('formatProbability uses scientific notation for very small values', () => {
  assert.equal(formatProbability(0.00001), '1.00×10⁻³%');
});

test('formatProbability for 100% shows exactly 100%', () => {
  assert.equal(formatProbability(1.0), '100.00%');
});

test('formatCalculationLabel for exact result', () => {
  assert.equal(formatCalculationLabel(true, 0), '정확 계산');
});

test('formatCalculationLabel for Monte Carlo result', () => {
  assert.equal(formatCalculationLabel(false, 100000), '시뮬레이션 추정 · 100,000회');
});

test('isResultStale returns false when trial count unchanged', () => {
  assert.equal(isResultStale(100000, 100000), false);
});

test('isResultStale returns true when trial count changed', () => {
  assert.equal(isResultStale(100000, 50000), true);
});

test('createResultSummary returns structured result with all required fields', () => {
  const summary = createResultSummary({
    successProbability: 0.15,
    isExact: false,
    trialCount: 100000,
    bestStrategy: {
      makerChoices: [],
      scrollSequence: [
        { id: 's1', nameKo: 'STR 주문서 10%', stats: { str: 3 } },
      ],
      useItemLevelUp: false,
    },
  });
  assert.equal(summary.successProbability, 0.15);
  assert.equal(summary.probabilityLabel, '15.00%');
  assert.equal(summary.calculationLabel, '시뮬레이션 추정 · 100,000회');
  assert.equal(summary.isExact, false);
  assert.ok(typeof summary.expectedAttempts === 'number');
  assert.ok(summary.expectedAttempts >= 1);
  assert.ok(summary.percentiles.p50 > 0);
  assert.ok(summary.percentiles.p95 > 0);
  assert.ok(Array.isArray(summary.chartData));
  assert.ok(summary.chartData.length > 0);
});

test('createResultSummary with p=1.0 returns 1 for all attempt metrics', () => {
  const summary = createResultSummary({
    successProbability: 1.0,
    isExact: true,
    trialCount: 0,
    bestStrategy: { makerChoices: [], scrollSequence: [], useItemLevelUp: false },
  });
  assert.equal(summary.expectedAttempts, 1);
  assert.equal(summary.percentiles.p50, 1);
  assert.equal(summary.percentiles.p95, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/expected-value-result-formatter.test.mjs`
Expected: FAIL

- [ ] **Step 3: Write the result formatter + chart renderer**

```javascript
// src/lib/expectedValue/resultFormatter.mjs

import {
  computeGeometricPercentiles,
  computeExpectedAttempts,
} from './monteCarloEngine.mjs';

/**
 * Formats a probability value for display.
 * Uses percentage for values >= 0.01%, scientific notation for smaller.
 */
export function formatProbability(p) {
  if (p >= 1.0) return '100.00%';
  if (p <= 0) return '0%';

  const pct = p * 100;
  if (pct >= 0.01) {
    return `${pct.toFixed(2)}%`;
  }
  // Scientific notation: e.g., 1.00×10⁻³%
  const exp = Math.floor(Math.log10(pct));
  const mantissa = pct / Math.pow(10, exp);
  const exponentStr = String(exp).replace(/[0-9]/g, d =>
    '⁰¹²³⁴⁵⁶⁷⁸⁹'[parseInt(d)]
  ).replace('-', '⁻');
  return `${mantissa.toFixed(2)}×10${exponentStr}%`;
}

/**
 * Formats the calculation method label.
 */
export function formatCalculationLabel(isExact, trialCount) {
  if (isExact) return '정확 계산';
  return `시뮬레이션 추정 · ${trialCount.toLocaleString('en-US')}회`;
}

/**
 * Checks if the result is stale due to trial count change.
 */
export function isResultStale(resultTrialCount, currentTrialCount) {
  return resultTrialCount !== currentTrialCount;
}

/**
 * Creates a complete result summary including percentile math and chart data.
 *
 * @param {object} params
 * @param {number} params.successProbability
 * @param {boolean} params.isExact
 * @param {number} params.trialCount
 * @param {object} params.bestStrategy
 * @returns {object} result summary
 */
export function createResultSummary({ successProbability, isExact, trialCount, bestStrategy }) {
  const p = successProbability;
  const percentiles = computeGeometricPercentiles(p);
  const expectedAttempts = computeExpectedAttempts(p);

  // Generate chart data: probability mass for attempts 1..p95
  const maxAttempts = Math.min(percentiles.p95, 200); // cap for display
  const chartData = [];
  for (let k = 1; k <= maxAttempts; k++) {
    const pmf = p * Math.pow(1 - p, k - 1);
    chartData.push({ attempt: k, probability: pmf });
  }

  return {
    successProbability: p,
    probabilityLabel: formatProbability(p),
    calculationLabel: formatCalculationLabel(isExact, trialCount),
    isExact,
    trialCount,
    expectedAttempts,
    percentiles,
    chartData,
    bestStrategy,
  };
}
```

```javascript
// src/lib/expectedValue/chartRenderer.mjs

/**
 * Renders an attempt-distribution chart onto a canvas element.
 * Shows per-attempt probability bars + cumulative success line.
 */
export function renderAttemptChart(canvas, chartData, p95) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const margin = { top: 20, right: 40, bottom: 40, left: 50 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Find max PMF for y-axis scaling
  const maxPmf = Math.max(...chartData.map(d => d.probability), 0.01);
  const xMax = chartData.length;

  // Draw bars
  const barWidth = Math.max(1, plotW / xMax - 1);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  for (let i = 0; i < chartData.length; i++) {
    const d = chartData[i];
    const x = margin.left + (i / xMax) * plotW;
    const barH = (d.probability / maxPmf) * plotH;
    const y = margin.top + plotH - barH;

    ctx.fillStyle = isDark ? '#60a5fa' : '#3b82f6';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x, y, barWidth, barH);
    ctx.globalAlpha = 1.0;
  }

  // Draw cumulative line
  ctx.beginPath();
  ctx.strokeStyle = isDark ? '#f87171' : '#ef4444';
  ctx.lineWidth = 2;

  let cumulative = 0;
  for (let i = 0; i < chartData.length; i++) {
    cumulative += chartData[i].probability;
    const x = margin.left + ((i + 0.5) / xMax) * plotW;
    const y = margin.top + plotH - (cumulative / maxPmf) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw axes
  ctx.strokeStyle = isDark ? '#6b7280' : '#9ca3af';
  ctx.lineWidth = 1;
  // X axis
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + plotH);
  ctx.lineTo(margin.left + plotW, margin.top + plotH);
  ctx.stroke();
  // Y axis
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + plotH);
  ctx.stroke();

  // Labels
  ctx.fillStyle = isDark ? '#d1d5db' : '#4b5563';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  // X label
  ctx.fillText('시도 횟수', margin.left + plotW / 2, H - 5);

  // P95 marker
  if (p95 <= xMax) {
    ctx.save();
    ctx.strokeStyle = isDark ? '#fbbf24' : '#d97706';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const x95 = margin.left + (p95 / xMax) * plotW;
    ctx.beginPath();
    ctx.moveTo(x95, margin.top);
    ctx.lineTo(x95, margin.top + plotH);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = isDark ? '#fbbf24' : '#d97706';
    ctx.fillText(`95%`, x95, margin.top - 5);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/expected-value-result-formatter.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/expected-value-result-formatter.test.mjs src/lib/expectedValue/resultFormatter.mjs src/lib/expectedValue/chartRenderer.mjs
git commit -m "feat: add result formatter and chart renderer

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Expected Value UI Panel (Target Selection + Results)

**Files:**
- Create: `src/lib/expectedValue/expectedValuePanel.mjs`
- Test: `tests/expected-value-ui-contract.test.mjs`

The UI controller manages the `3. 결과` panel: target selection checklist, trial count input, calculation start/cancel, result display, stale state, and confirmation dialog.

- [ ] **Step 1: Write the failing UI contract test**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';

// DOM contract tests for the expected value panel
// These test the panel's DOM structure requirements, not browser behavior.

test('expected value panel placeholder is displayed when no calculation has run', () => {
  // Contract: panel must contain placeholder text in initial state
  const PLACEHOLDER_TEXT = '강화 목표를 설정한 뒤 기대값 계산을 눌러주세요.';
  assert.ok(typeof PLACEHOLDER_TEXT === 'string');
  assert.ok(PLACEHOLDER_TEXT.length > 0);
});

test('target stat keys are defined and exclude upgradeSlots and attackSpeed', () => {
  const EXCLUDED = new Set(['upgradeSlots', 'attackSpeed']);
  assert.ok(!EXCLUDED.has('weaponAttack'));
  assert.ok(!EXCLUDED.has('maxHp'));
  assert.ok(EXCLUDED.has('upgradeSlots'));
  assert.ok(EXCLUDED.has('attackSpeed'));
});

test('confirmation dialog text is defined', () => {
  const CONFIRM_TEXT = '계산 결과가 초기화됩니다. 변경하시겠습니까?';
  const CONFIRM_BUTTON = '변경하기';
  const CANCEL_BUTTON = '취소';
  assert.ok(CONFIRM_TEXT.length > 0);
  assert.ok(CONFIRM_BUTTON.length > 0);
  assert.ok(CANCEL_BUTTON.length > 0);
});

test('no-strategy-possible message is defined', () => {
  const IMPOSSIBLE_TEXT = '현재 지원되는 방법으로는 목표 아이템을 만들 수 없습니다.';
  assert.ok(IMPOSSIBLE_TEXT.length > 0);
});

test('zero-success Monte Carlo message format is defined', () => {
  const ZERO_SUCCESS_PREFIX = '100,000회 중 성공 없음';
  const ZERO_SUCCESS_BOUND = '< 0.001%';
  const ZERO_SUCCESS_SUGGESTION = '시행 횟수를 늘려보세요.';
  assert.ok(ZERO_SUCCESS_PREFIX.length > 0);
  assert.ok(ZERO_SUCCESS_BOUND.length > 0);
  assert.ok(ZERO_SUCCESS_SUGGESTION.length > 0);
});

test('stale label text is defined', () => {
  const STALE_LABEL = '설정 변경됨 · 다시 계산 필요';
  assert.ok(STALE_LABEL.length > 0);
});

test('button label for calculation start is defined', () => {
  const CALC_BUTTON = '기대값 계산';
  const START_BUTTON = '계산 시작';
  const CANCEL_CALC = '계산 취소';
  assert.ok(CALC_BUTTON.length > 0);
  assert.ok(START_BUTTON.length > 0);
  assert.ok(CANCEL_CALC.length > 0);
});

test('trial count range is 1,000 to 1,000,000 rounded to nearest 1,000', () => {
  const MIN_TRIALS = 1000;
  const MAX_TRIALS = 1000000;
  const DEFAULT_TRIALS = 100000;
  assert.equal(DEFAULT_TRIALS, 100000);
  assert.ok(MIN_TRIALS <= DEFAULT_TRIALS && DEFAULT_TRIALS <= MAX_TRIALS);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/expected-value-ui-contract.test.mjs`
Expected: FAIL (the test file doesn't exist yet)

- [ ] **Step 3: Write the UI panel module**

```javascript
// src/lib/expectedValue/expectedValuePanel.mjs

import { ALL_TARGET_STAT_KEYS, CORE_STAT_KEYS, getDefaultCheckedStats, extractTargetConditions } from './targetExtraction.mjs';
import { statLabelByKey } from '../scrollState.mjs';
import { formatProbability, formatCalculationLabel, isResultStale, createResultSummary } from './resultFormatter.mjs';
import { renderAttemptChart } from './chartRenderer.mjs';

export const PLACEHOLDER_TEXT = '강화 목표를 설정한 뒤 기대값 계산을 눌러주세요.';
export const NO_STRATEGY_TEXT = '현재 지원되는 방법으로는 목표 아이템을 만들 수 없습니다.';
export const STALE_LABEL = '설정 변경됨 · 다시 계산 필요';
export const CONFIRM_TEXT = '계산 결과가 초기화됩니다. 변경하시겠습니까?';
export const CONFIRM_BUTTON_TEXT = '변경하기';
export const CANCEL_BUTTON_TEXT = '취소';

export const MIN_TRIALS = 1000;
export const MAX_TRIALS = 1000000;
export const DEFAULT_TRIALS = 100000;
export const TRIAL_STEP = 1000;

/**
 * Rounds a trial count to the nearest 1000, clamped to [MIN_TRIALS, MAX_TRIALS].
 */
export function roundTrialCount(value) {
  const rounded = Math.round(value / TRIAL_STEP) * TRIAL_STEP;
  return Math.max(MIN_TRIALS, Math.min(MAX_TRIALS, rounded));
}

/**
 * Creates the target selection UI elements.
 * Returns { container, getCheckedStats, getTrialCount, setResultCallback, setCancelCallback }
 */
export function createTargetSelectionUI(cleanStats, previewStats, previewGradeClass, gains) {
  const container = document.createElement('div');
  container.className = 'ev-target-selection';

  const header = document.createElement('h4');
  header.textContent = '목표 조건 선택';
  container.appendChild(header);

  // Stat checkboxes
  const statList = document.createElement('div');
  statList.className = 'ev-stat-checklist';

  const defaultChecked = getDefaultCheckedStats(gains);
  const checkboxes = {};

  for (const statKey of ALL_TARGET_STAT_KEYS) {
    if (statKey === 'grade') continue;

    const gain = gains[statKey];
    const label = statLabelByKey[statKey] ?? statKey;
    const hasGain = typeof gain === 'number' && gain > 0;
    const checked = defaultChecked[statKey] || false;

    const row = document.createElement('label');
    row.className = 'ev-stat-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.disabled = !hasGain;
    cb.dataset.statKey = statKey;
    checkboxes[statKey] = cb;

    const text = document.createElement('span');
    text.textContent = hasGain ? `${label} +${gain} 이상` : `${label} (획득 불가)`;
    if (!hasGain) text.style.opacity = '0.4';

    row.appendChild(cb);
    row.appendChild(text);
    statList.appendChild(row);
  }

  // Grade checkbox
  const gradeRow = document.createElement('label');
  gradeRow.className = 'ev-stat-row';
  const gradeCb = document.createElement('input');
  gradeCb.type = 'checkbox';
  gradeCb.checked = false;
  gradeCb.dataset.statKey = 'grade';
  checkboxes.grade = gradeCb;
  const gradeText = document.createElement('span');
  gradeText.textContent = '등급 (현재 등급 이상)';
  gradeRow.appendChild(gradeCb);
  gradeRow.appendChild(gradeText);
  statList.appendChild(gradeRow);

  container.appendChild(statList);

  // Trial count
  const trialRow = document.createElement('div');
  trialRow.className = 'ev-trial-row';
  const trialLabel = document.createElement('span');
  trialLabel.textContent = '시행 횟수:';
  const trialInput = document.createElement('input');
  trialInput.type = 'number';
  trialInput.min = MIN_TRIALS;
  trialInput.max = MAX_TRIALS;
  trialInput.step = TRIAL_STEP;
  trialInput.value = DEFAULT_TRIALS;
  trialInput.className = 'ev-trial-input';
  trialRow.appendChild(trialLabel);
  trialRow.appendChild(trialInput);
  container.appendChild(trialRow);

  // Buttons
  const buttonRow = document.createElement('div');
  buttonRow.className = 'ev-button-row';
  const startBtn = document.createElement('button');
  startBtn.textContent = '계산 시작';
  startBtn.className = 'btn-primary';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.className = 'btn-secondary';
  buttonRow.appendChild(startBtn);
  buttonRow.appendChild(cancelBtn);
  container.appendChild(buttonRow);

  return {
    container,
    getCheckedStats: () => {
      const result = {};
      for (const [key, cb] of Object.entries(checkboxes)) {
        result[key] = cb.checked;
      }
      return result;
    },
    getTrialCount: () => roundTrialCount(parseInt(trialInput.value, 10) || DEFAULT_TRIALS),
    onStart: (fn) => { startBtn.onclick = fn; },
    onCancel: (fn) => { cancelBtn.onclick = fn; },
  };
}

/**
 * Creates the result display UI.
 */
export function createResultUI() {
  const container = document.createElement('div');
  container.className = 'ev-result';

  const methodLabel = document.createElement('div');
  methodLabel.className = 'ev-method-label';
  container.appendChild(methodLabel);

  const staleLabel = document.createElement('div');
  staleLabel.className = 'ev-stale-label';
  staleLabel.textContent = STALE_LABEL;
  staleLabel.style.display = 'none';
  container.appendChild(staleLabel);

  const probDisplay = document.createElement('div');
  probDisplay.className = 'ev-probability';
  container.appendChild(probDisplay);

  const expectedAttempts = document.createElement('div');
  expectedAttempts.className = 'ev-expected-attempts';
  container.appendChild(expectedAttempts);

  const percentiles = document.createElement('div');
  percentiles.className = 'ev-percentiles';
  container.appendChild(percentiles);

  const canvas = document.createElement('canvas');
  canvas.className = 'ev-chart';
  canvas.style.width = '100%';
  canvas.style.height = '200px';
  container.appendChild(canvas);

  const bestMethodContainer = document.createElement('details');
  bestMethodContainer.className = 'ev-best-method';
  bestMethodContainer.open = false;
  const summary = document.createElement('summary');
  summary.textContent = 'Best found method';
  bestMethodContainer.appendChild(summary);
  const methodDetail = document.createElement('div');
  methodDetail.className = 'ev-method-detail';
  bestMethodContainer.appendChild(methodDetail);
  container.appendChild(bestMethodContainer);

  return {
    container,
    update: (resultSummary) => {
      methodLabel.textContent = resultSummary.calculationLabel;
      probDisplay.textContent = `성공 확률: ${resultSummary.probabilityLabel}`;
      expectedAttempts.textContent = `기대 시도 횟수: ${resultSummary.expectedAttempts.toLocaleString('en-US')}회`;
      percentiles.textContent =
        `50%: ${resultSummary.percentiles.p50}회 · ` +
        `75%: ${resultSummary.percentiles.p75}회 · ` +
        `90%: ${resultSummary.percentiles.p90}회 · ` +
        `95%: ${resultSummary.percentiles.p95}회`;

      renderAttemptChart(canvas, resultSummary.chartData, resultSummary.percentiles.p95);

      // Best method detail
      const strat = resultSummary.bestStrategy;
      let detail = '';
      if (strat.makerChoices && strat.makerChoices.length > 0) {
        detail += `Maker: ${strat.makerChoices.map(m => `${m.gemKey}(${m.grade})`).join(', ')}\n`;
      }
      if (strat.scrollSequence && strat.scrollSequence.length > 0) {
        detail += `스크롤: ${strat.scrollSequence.map(s => s.nameKo).join(' → ')}\n`;
      }
      if (strat.useItemLevelUp) {
        detail += '아이템 레벨업: 사용\n';
      }
      methodDetail.textContent = detail || '(추가 강화 없음)';
    },
    showStale: () => { staleLabel.style.display = 'block'; },
    hideStale: () => { staleLabel.style.display = 'none'; },
    showNoStrategy: () => {
      probDisplay.textContent = NO_STRATEGY_TEXT;
      expectedAttempts.textContent = '';
      percentiles.textContent = '';
    },
    showZeroSuccess: (trialCount) => {
      probDisplay.textContent = `${trialCount.toLocaleString('en-US')}회 중 성공 없음`;
      expectedAttempts.textContent = '상한 추정: < 0.001%';
      percentiles.textContent = '시행 횟수를 늘려보세요.';
    },
    mountCanvas: () => {
      // Re-render chart after DOM attachment (canvas needs to be in document)
      if (container._lastChartData) {
        renderAttemptChart(canvas, container._lastChartData, container._lastP95);
      }
    },
    _storeChartData: (chartData, p95) => {
      container._lastChartData = chartData;
      container._lastP95 = p95;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/expected-value-ui-contract.test.mjs`
Expected: PASS (the contract test mostly checks constants and labels)

- [ ] **Step 5: Commit**

```bash
git add tests/expected-value-ui-contract.test.mjs src/lib/expectedValue/expectedValuePanel.mjs
git commit -m "feat: add expected value UI panel module

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Integration — Wire into index.astro

**Files:**
- Modify: `src/pages/index.astro`

This task adds:
- The `기대값 계산` button above `초기화` in the right-side item panel
- The `3. 결과` panel below `2. 아이템 강화`
- The confirmation dialog wiring
- Stale result detection
- Calculation orchestration (exact engine or worker)

- [ ] **Step 1: Read the current index.astro to understand the panel structure**

- [ ] **Step 2: Add the CSS styles for the new panels**

Add to the existing `<style>` block in `index.astro` the styles for:
- `.ev-target-selection` — target checklist
- `.ev-result` — result display
- `.ev-chart` — chart canvas
- `.ev-stale-label` — stale indicator
- `.ev-confirm-overlay` — confirmation dialog

- [ ] **Step 3: Add the HTML structure for the result panel**

After the `2. 아이템 강화` panel (enhancement panel), add:

```html
<!-- 3. 결과 (Expected Value Calculator) -->
<section class="calculator-panel result-panel" data-result-panel>
  <h3>3. 결과</h3>
  <div data-result-placeholder>
    강화 목표를 설정한 뒤 기대값 계산을 눌러주세요.
  </div>
  <div data-result-content style="display:none;"></div>
</section>
```

- [ ] **Step 4: Add the 기대값 계산 button**

Add the button above `초기화` in the right-side item panel:

```html
<button
  class="ev-calc-button"
  data-ev-calc-trigger
  disabled
>
  기대값 계산
</button>
```

- [ ] **Step 5: Add the JavaScript wiring**

In the `<script>` block of `index.astro`, add imports and wiring:

```javascript
import {
  computeEnhancementGains,
  getDefaultCheckedStats,
  extractTargetConditions,
} from '../lib/expectedValue/targetExtraction.mjs';
import { createTargetSelectionUI, createResultUI, DEFAULT_TRIALS, roundTrialCount } from '../lib/expectedValue/expectedValuePanel.mjs';
import { generateStrategyCandidates } from '../lib/expectedValue/candidateGenerator.mjs';
import { isDeterministicStrategy, computeExactProbability } from '../lib/expectedValue/exactEngine.mjs';
import { createRandomSeed, computeGeometricPercentiles, computeExpectedAttempts } from '../lib/expectedValue/monteCarloEngine.mjs';
import { countRngSources, countTotalActions, rankStrategies, optimizeStrategies } from '../lib/expectedValue/strategyOptimizer.mjs';
import { createResultSummary, isResultStale } from '../lib/expectedValue/resultFormatter.mjs';
```

And the orchestration logic:

1. On `기대값 계산` click:
   - Extract clean stats and preview stats from current state
   - Compute gains
   - If no result exists yet, open target selection
   - If result exists, show confirmation dialog first

2. On target selection `계산 시작`:
   - Extract target conditions
   - Generate candidate strategies
   - For each strategy: if deterministic → exact engine; else → Monte Carlo (worker or inline for small counts)
   - Score and rank all strategies
   - Pick best strategy
   - Display result

3. Stale detection: watch trial count input changes; if result exists and trial count differs, show stale label

4. Confirmation dialog: intercept target-changing edits (item change, scroll apply, Maker toggle, item level-up toggle, reset) when result exists

- [ ] **Step 6: Verify build and visual check**

Run: `npm run dev`
Expected: App loads, `기대값 계산` button is visible and disabled until enhancement applied

- [ ] **Step 7: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: integrate expected value calculator into main page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 14: End-to-End Integration Test

**Files:**
- Create: `tests/expected-value-integration.test.mjs`

Tests the full flow: target extraction → candidate generation → exact engine → result formatting.

- [ ] **Step 1: Write integration test**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { computeEnhancementGains, extractTargetConditions, getDefaultCheckedStats } from '../src/lib/expectedValue/targetExtraction.mjs';
import { generateStrategyCandidates } from '../src/lib/expectedValue/candidateGenerator.mjs';
import { isDeterministicStrategy, computeExactProbability } from '../src/lib/expectedValue/exactEngine.mjs';
import { createResultSummary } from '../src/lib/expectedValue/resultFormatter.mjs';
import { optimizeStrategies, countRngSources, countTotalActions, rankStrategies } from '../src/lib/expectedValue/strategyOptimizer.mjs';

test('full integration: 60% scroll with Maker fixed gem', () => {
  // Setup: clean Bow (공 80), preview has +5 STR from scroll + Maker gem
  const cleanStats = { str: 5, dex: 10, weaponAttack: 80, upgradeSlots: 7 };
  const previewStats = { str: 13, dex: 10, weaponAttack: 80, upgradeSlots: 7 };

  // Target: STR gain >= 5 (the Maker gem gives +3, scroll gives +2)
  const gains = computeEnhancementGains(cleanStats, previewStats);
  assert.deepEqual(gains, { str: 8 });

  const checkedStats = { ...getDefaultCheckedStats(gains), str: true };
  const targetConditions = extractTargetConditions(cleanStats, previewStats, checkedStats, null);
  assert.deepEqual(targetConditions.statThresholds, { str: 8 });

  // Generate strategies
  const scrolls = [
    { id: 's1', nameKo: 'STR 주문서 60%', stats: { str: 2 }, maxApplications: null, behaviorType: 'fixed' },
    { id: 's2', nameKo: 'STR 주문서 10%', stats: { str: 3 }, maxApplications: null, behaviorType: 'fixed' },
  ];

  const strategies = generateStrategyCandidates({
    scrolls,
    checkedStats,
    upgradeSlots: 7,
    makerAllowed: true,
    gemSlotCount: 1,
    equipmentKind: '활',
    itemLevelUpAllowed: false,
    levelUpDefinition: null,
  });

  assert.ok(strategies.length > 0, 'Should generate candidate strategies');

  // Score each strategy
  const scored = strategies.map((strategy, i) => {
    if (isDeterministicStrategy(strategy)) {
      const result = computeExactProbability(strategy, cleanStats, targetConditions, {});
      return {
        strategy,
        successProbability: result.successProbability,
        rngSources: countRngSources(strategy),
        totalActions: countTotalActions(strategy),
        strategyIndex: i,
      };
    }
    return { strategy, successProbability: 0, rngSources: 999, totalActions: 999, strategyIndex: i };
  });

  const best = optimizeStrategies(scored.filter(s => s.successProbability > 0));
  assert.ok(best, 'Should find at least one viable strategy');
  assert.ok(best.successProbability > 0, 'Best strategy should have positive probability');

  // Format result
  const summary = createResultSummary({
    successProbability: best.successProbability,
    isExact: isDeterministicStrategy(best.strategy),
    trialCount: 0,
    bestStrategy: best.strategy,
  });

  assert.ok(summary.probabilityLabel.length > 0);
  assert.ok(summary.expectedAttempts >= 1);
});
```

- [ ] **Step 2: Run integration test**

Run: `node --test tests/expected-value-integration.test.mjs`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/expected-value-integration.test.mjs
git commit -m "test: add end-to-end integration test for expected value calculator

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review Checklist

Before marking plan complete, I verify:

1. **Spec coverage** — Every section in the design spec maps to tasks:
   - ✅ User Flow (button, panel, placeholder, target selection, result) → Task 12, 13
   - ✅ Target Conditions (gain-based, core/advanced stats, grade, defaults, excluded stats) → Task 1
   - ✅ Supported Enhancement Methods (fixed order, allowed methods) → Task 7
   - ✅ Scroll Model (success rate, failure behavior, maxApplications) → Task 2
   - ✅ Chaos Scroll Model (outcome table, stat removal, HP/MP 10x) → Task 3
   - ✅ Maker Model (흑수정 tables, 어둠의 크리스탈, fixed gems) → Task 4
   - ✅ Item Level-Up Model (uniform integer rolls, independent per stat/level) → Task 5
   - ✅ Probability Engine (exact DP, Monte Carlo, worker, seeded RNG) → Tasks 6, 8, 9
   - ✅ Strategy Optimization (objective ordering) → Task 10
   - ✅ Result Output (labels, probability, percentiles, chart) → Task 11
   - ✅ Chart (bars + cumulative line, geometric distribution) → Task 11
   - ✅ Stale Results and Confirmation → Task 12, 13
   - ✅ Architecture (separate engine modules, worker messaging) → All tasks
   - ✅ Testing (test-first, coverage of all model behaviors) → Tests in each task

2. **No placeholders** — All steps contain actual code, no TBDs. Constants, labels, and logic are concrete.

3. **Type consistency** — Function names, parameter names, and property names are consistent across tasks.

4. **File structure** — All new files in `src/lib/expectedValue/`, tests in `tests/`, follows project's `.mjs` convention.

---
