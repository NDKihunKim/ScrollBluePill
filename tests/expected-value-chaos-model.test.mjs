import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAOS_SUCCESS_RATE,
  CHAOS_HPMP_MULTIPLIER,
  CHAOS_OUTCOME_TABLE,
  buildChaosCumulativeTable,
  rollChaosStatDelta,
  filterPositiveStats,
  applyChaosToStats,
} from '../src/lib/expectedValue/chaosModel.mjs';

// --- constants ---

test('CHAOS_SUCCESS_RATE is 0.6', () => {
  assert.equal(CHAOS_SUCCESS_RATE, 0.6);
});

test('CHAOS_HPMP_MULTIPLIER is 10', () => {
  assert.equal(CHAOS_HPMP_MULTIPLIER, 10);
});

test('CHAOS_OUTCOME_TABLE probabilities sum to approximately 1.0', () => {
  const sum = CHAOS_OUTCOME_TABLE.reduce((acc, entry) => acc + entry.probability, 0);
  assert.ok(Math.abs(sum - 1.0) < 0.001);
});

// --- buildChaosCumulativeTable ---

test('buildChaosCumulativeTable produces cumulative probabilities ending near 1.0', () => {
  const table = buildChaosCumulativeTable();

  assert.equal(table.length, CHAOS_OUTCOME_TABLE.length);

  // Last entry cumulative should be ~1.0
  const last = table[table.length - 1];
  assert.ok(Math.abs(last.cumulative - 1.0) < 0.001);
  assert.equal(last.delta, -5);

  // Each cumulative entry should be >= previous
  for (let i = 1; i < table.length; i++) {
    assert.ok(table[i].cumulative >= table[i - 1].cumulative,
      `Entry ${i} cumulative ${table[i].cumulative} < previous ${table[i - 1].cumulative}`);
  }

  // First entry cumulative should match first probability
  assert.equal(table[0].cumulative, CHAOS_OUTCOME_TABLE[0].probability);
});

test('buildChaosCumulativeTable returns cached table on subsequent calls', () => {
  const table1 = buildChaosCumulativeTable();
  const table2 = buildChaosCumulativeTable();

  assert.equal(table1, table2, 'Should return the same array reference (cached)');
});

// --- rollChaosStatDelta ---

test('rollChaosStatDelta returns +5 for very low random value (near 0)', () => {
  assert.equal(rollChaosStatDelta(0), 5);
  assert.equal(rollChaosStatDelta(0.005), 5);
});

test('rollChaosStatDelta returns -5 for very high random value (near 1)', () => {
  assert.equal(rollChaosStatDelta(0.999), -5);
  assert.equal(rollChaosStatDelta(0.98), -5);
});

test('rollChaosStatDelta returns 0 for middle random value (~0.5)', () => {
  assert.equal(rollChaosStatDelta(0.5), 0);
});

test('rollChaosStatDelta returns 4 near the boundary of delta 5/4', () => {
  // delta 5 cumulative = 0.0099, so values >= 0.0099 give delta 4
  assert.equal(rollChaosStatDelta(0.0099), 4);
  assert.equal(rollChaosStatDelta(0.01), 4);
});

test('rollChaosStatDelta returns delta -5 for value near 1.0', () => {
  // Delta -5 cumulative starts at 0.9506, so values >= 0.9506 give delta -5
  assert.equal(rollChaosStatDelta(0.96), -5);
  assert.equal(rollChaosStatDelta(0.9999999), -5);
});

// --- filterPositiveStats ---

test('filterPositiveStats keeps only stats > 0 and excludes metadata keys', () => {
  const stats = {
    str: 10,
    dex: 0,
    int: -3,
    luk: 5,
    upgradeSlots: 7,
    attackSpeed: 5,
    weaponAttack: 50,
  };

  const result = filterPositiveStats(stats);

  assert.deepEqual(result, {
    str: 10,
    luk: 5,
    weaponAttack: 50,
  });
});

test('filterPositiveStats returns empty object for empty input', () => {
  assert.deepEqual(filterPositiveStats({}), {});
});

test('filterPositiveStats excludes upgradeSlots and attackSpeed even if positive', () => {
  const stats = {
    upgradeSlots: 7,
    attackSpeed: 6,
    str: 1,
  };

  const result = filterPositiveStats(stats);

  assert.deepEqual(result, { str: 1 });
});

// --- applyChaosToStats ---

test('applyChaosToStats with empty stats returns empty object', () => {
  const result = applyChaosToStats({}, () => 0.5);
  assert.deepEqual(result, {});
});

test('applyChaosToStats rolls each positive stat independently', () => {
  const stats = { str: 10, dex: 10 };
  let callCount = 0;
  const mockRng = () => {
    callCount++;
    // First call -> delta 5 (cumulative 0.0099), second call -> delta 0 (cumulative 0.6674, but 0.0099 < 0.5 < 0.6674)
    return callCount === 1 ? 0.0 : 0.5;
  };

  const result = applyChaosToStats(stats, mockRng);

  assert.equal(callCount, 2, 'RNG should be called once per positive stat');
  assert.deepEqual(result, { str: 15, dex: 10 });
});

test('applyChaosToStats removes stats that drop to <= 0', () => {
  const stats = { str: 1, dex: 10 };
  const mockRng = () => 0.999; // delta -5 for both

  const result = applyChaosToStats(stats, mockRng);

  // str: 1 + (-5) = -4 <= 0 -> removed
  // dex: 10 + (-5) = 5 > 0 -> kept
  assert.deepEqual(result, { dex: 5 });
});

test('applyChaosToStats applies 10x multiplier to HP/MP deltas', () => {
  const stats = { maxHp: 50, str: 10 };
  let callCount = 0;
  const mockRng = () => {
    callCount++;
    return 0.0; // delta 5 for both
  };

  const result = applyChaosToStats(stats, mockRng);

  // maxHp: 50 + (5 * 10) = 100
  // str: 10 + (5 * 1) = 15
  assert.deepEqual(result, { maxHp: 100, str: 15 });
});

test('applyChaosToStats filters zero/negative stats before rolling', () => {
  const stats = {
    str: 10,
    dex: 0,
    int: -5,
    upgradeSlots: 7,
  };

  const mockRng = () => 0.0; // delta 5

  const result = applyChaosToStats(stats, mockRng);

  // Only str > 0, dex=0 and int=-5 are excluded, upgradeSlots is excluded
  assert.deepEqual(result, { str: 15 });
});
