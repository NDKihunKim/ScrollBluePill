import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BLACK_AMETHYST_TABLES,
  isFixedGem,
  isRandomGem,
  getFixedGemStats,
  rollBlackAmethystStats,
  rollDarkCrystalStats,
  computeGemContribution,
} from '../src/lib/expectedValue/makerModel.mjs';

// --- isFixedGem ---

test('isFixedGem returns true for diamond', () => {
  assert.equal(isFixedGem('diamond'), true);
});

test('isFixedGem returns true for strCrystal', () => {
  assert.equal(isFixedGem('strCrystal'), true);
});

test('isFixedGem returns true for garnet', () => {
  assert.equal(isFixedGem('garnet'), true);
});

test('isFixedGem returns false for blackAmethyst', () => {
  assert.equal(isFixedGem('blackAmethyst'), false);
});

test('isFixedGem returns false for darkCrystal', () => {
  assert.equal(isFixedGem('darkCrystal'), false);
});

// --- isRandomGem ---

test('isRandomGem returns true for blackAmethyst', () => {
  assert.equal(isRandomGem('blackAmethyst'), true);
});

test('isRandomGem returns true for darkCrystal', () => {
  assert.equal(isRandomGem('darkCrystal'), true);
});

test('isRandomGem returns false for diamond', () => {
  assert.equal(isRandomGem('diamond'), false);
});

test('isRandomGem returns false for strCrystal', () => {
  assert.equal(isRandomGem('strCrystal'), false);
});

test('isRandomGem returns false for garnet', () => {
  assert.equal(isRandomGem('garnet'), false);
});

// --- getFixedGemStats ---

test('getFixedGemStats returns correct values for diamond grade 0 (low)', () => {
  const stats = getFixedGemStats('diamond', 0);
  assert.deepEqual(stats, { weaponAttack: 1 });
});

test('getFixedGemStats returns correct values for diamond grade 1 (mid)', () => {
  const stats = getFixedGemStats('diamond', 1);
  assert.deepEqual(stats, { weaponAttack: 2 });
});

test('getFixedGemStats returns correct values for diamond grade 2 (high)', () => {
  const stats = getFixedGemStats('diamond', 2);
  assert.deepEqual(stats, { weaponAttack: 3 });
});

test('getFixedGemStats returns correct values for strCrystal grade 0 (low)', () => {
  const stats = getFixedGemStats('strCrystal', 0);
  assert.deepEqual(stats, { str: 1 });
});

test('getFixedGemStats returns correct values for strCrystal grade 1 (mid)', () => {
  const stats = getFixedGemStats('strCrystal', 1);
  assert.deepEqual(stats, { str: 3 });
});

test('getFixedGemStats returns correct values for strCrystal grade 2 (high)', () => {
  const stats = getFixedGemStats('strCrystal', 2);
  assert.deepEqual(stats, { str: 5 });
});

test('getFixedGemStats returns correct values for topaz grade 0 (low)', () => {
  const stats = getFixedGemStats('topaz', 0);
  assert.deepEqual(stats, { maxHp: 10 });
});

test('getFixedGemStats returns correct values for topaz grade 1 (mid)', () => {
  const stats = getFixedGemStats('topaz', 1);
  assert.deepEqual(stats, { maxHp: 20 });
});

test('getFixedGemStats returns correct values for topaz grade 2 (high)', () => {
  const stats = getFixedGemStats('topaz', 2);
  assert.deepEqual(stats, { maxHp: 30 });
});

test('getFixedGemStats returns null for non-fixed gem (blackAmethyst)', () => {
  assert.equal(getFixedGemStats('blackAmethyst', 0), null);
});

test('getFixedGemStats returns null for non-fixed gem (darkCrystal)', () => {
  assert.equal(getFixedGemStats('darkCrystal', 0), null);
});

test('getFixedGemStats returns null for unknown gem key', () => {
  assert.equal(getFixedGemStats('nonexistent', 0), null);
});

test('getFixedGemStats returns null for invalid grade index', () => {
  assert.equal(getFixedGemStats('diamond', -1), null);
});

test('getFixedGemStats returns null for out-of-range grade index', () => {
  assert.equal(getFixedGemStats('diamond', 5), null);
});

// --- BLACK_AMETHYST_TABLES ---

test('BLACK_AMETHYST_TABLES has three grade entries', () => {
  assert.equal(Object.keys(BLACK_AMETHYST_TABLES).length, 3);
  assert.ok('low' in BLACK_AMETHYST_TABLES);
  assert.ok('mid' in BLACK_AMETHYST_TABLES);
  assert.ok('high' in BLACK_AMETHYST_TABLES);
});

test('BLACK_AMETHYST_TABLES low grade probabilities sum to 1', () => {
  const sum = BLACK_AMETHYST_TABLES.low.reduce((acc, entry) => acc + entry.probability, 0);
  assert.ok(Math.abs(sum - 1) < 0.001);
});

test('BLACK_AMETHYST_TABLES mid grade probabilities sum to 1', () => {
  const sum = BLACK_AMETHYST_TABLES.mid.reduce((acc, entry) => acc + entry.probability, 0);
  assert.ok(Math.abs(sum - 1) < 0.001);
});

test('BLACK_AMETHYST_TABLES high grade probabilities sum to 1', () => {
  const sum = BLACK_AMETHYST_TABLES.high.reduce((acc, entry) => acc + entry.probability, 0);
  assert.ok(Math.abs(sum - 1) < 0.001);
});

// --- rollBlackAmethystStats ---

test('rollBlackAmethystStats low grade with RNG 0 returns lowest value', () => {
  const rng = () => 0;
  const stats = rollBlackAmethystStats('low', ['weaponAttack'], rng);
  assert.equal(stats.weaponAttack, -1);
});

test('rollBlackAmethystStats low grade with RNG just below cumulative midpoint returns 0', () => {
  // low table: [-1:0.25, 0:0.50(→cumulative 0.75), 1:0.25]
  // RNG 0.25 → cumulative 0.25 for -1, so this is < 0.25 → -1
  // To get 0, need RNG in [0.25, 0.75)
  const rng = () => 0.5;
  const stats = rollBlackAmethystStats('low', ['weaponAttack'], rng);
  assert.equal(stats.weaponAttack, 0);
});

test('rollBlackAmethystStats low grade with RNG near 1 returns highest value', () => {
  const rng = () => 0.9;
  const stats = rollBlackAmethystStats('low', ['weaponAttack'], rng);
  assert.equal(stats.weaponAttack, 1);
});

test('rollBlackAmethystStats rolls both weaponAttack and magicAttack independently', () => {
  let callCount = 0;
  const rng = () => {
    callCount++;
    // First call → weaponAttack: 0 (RNG 0.5 in [0.25, 0.75))
    // Second call → magicAttack: 1 (RNG 0.9 >= 0.75)
    if (callCount === 1) return 0.5;
    return 0.9;
  };

  const stats = rollBlackAmethystStats('low', ['weaponAttack', 'magicAttack'], rng);
  assert.equal(stats.weaponAttack, 0);
  assert.equal(stats.magicAttack, 1);
  assert.equal(callCount, 2);
});

test('rollBlackAmethystStats mid grade with RNG 0 returns -2', () => {
  const rng = () => 0;
  const stats = rollBlackAmethystStats('mid', ['weaponAttack'], rng);
  assert.equal(stats.weaponAttack, -2);
});

test('rollBlackAmethystStats high grade with RNG 0 returns -3', () => {
  const rng = () => 0;
  const stats = rollBlackAmethystStats('high', ['weaponAttack'], rng);
  assert.equal(stats.weaponAttack, -3);
});

// --- rollDarkCrystalStats ---

test('rollDarkCrystalStats rolls each of STR/DEX/INT/LUK present on clean item', () => {
  const cleanStats = { str: 10, dex: 8, int: 5, luk: 3 };
  let callCount = 0;

  // Since rollChaosStatDelta is called with our RNG values, we need to
  // provide RNG such that we get predictable deltas.
  // rollChaosStatDelta(0) returns 5 (delta 5 with first cumulative 0.0099)
  // Actually wait - the chaos table starts with delta 5 at cumulative 0.0099
  // So RNG 0 < 0.0099 → delta 5
  // We'll use very specific values for deterministic outcomes.
  const rng = () => {
    callCount++;
    // Return 0 so we get delta 5 for each stat
    return 0;
  };

  const result = rollDarkCrystalStats(cleanStats, rng);
  assert.equal(callCount, 4, 'should call RNG once per stat (STR/DEX/INT/LUK)');
  assert.equal(result.str, 15, 'str 10 + 5 = 15');
  assert.equal(result.dex, 13, 'dex 8 + 5 = 13');
  assert.equal(result.int, 10, 'int 5 + 5 = 10');
  assert.equal(result.luk, 8, 'luk 3 + 5 = 8');
});

test('rollDarkCrystalStats does not create stats absent from clean base', () => {
  const cleanStats = { str: 10, dex: 8 };
  const rng = () => 0; // delta 5

  const result = rollDarkCrystalStats(cleanStats, rng);

  assert.equal(result.str, 15);
  assert.equal(result.dex, 13);
  assert.ok(!('int' in result), 'int should not be present');
  assert.ok(!('luk' in result), 'luk should not be present');
});

test('rollDarkCrystalStats handles empty clean stats', () => {
  const cleanStats = {};
  const rng = () => 0;

  const result = rollDarkCrystalStats(cleanStats, rng);

  assert.deepEqual(result, {});
});

test('rollDarkCrystalStats handles single stat present', () => {
  const cleanStats = { str: 10 };
  let callCount = 0;
  // Use RNG such that rollChaosStatDelta returns 0 (no change)
  // delta 0 has cumulative 0.1931+0.1838 of earlier entries = 0.3769, then
  // Wait, let me recalculate the chaos table cumulatives:
  // delta 5: prob 0.0099, cum 0.0099
  // delta 4: prob 0.0198, cum 0.0297
  // delta 3: prob 0.1021, cum 0.1318
  // delta 2: prob 0.1587, cum 0.2905
  // delta 1: prob 0.1931, cum 0.4836
  // delta 0: prob 0.1838, cum 0.6674
  // ... etc
  // So RNG 0.5 gives delta 1 (since 0.4836 < 0.5 < 0.6674... wait no, 0.4836 < 0.5, then 0.5 < 0.6674, so delta 0)
  // Actually let me check: position of delta 1 has cumulative 0.4836, position of delta 0 has cumulative 0.6674
  // So RNG 0.5 → 0.4836 < 0.5 < 0.6674 → delta 0
  const rng = () => 0.5;

  const result = rollDarkCrystalStats(cleanStats, rng);
  assert.equal(result.str, 10, 'str should remain unchanged');
});

// --- computeGemContribution ---

test('computeGemContribution dispatches fixed gem (diamond)', () => {
  const result = computeGemContribution('diamond', 0, {}, () => 0);
  assert.deepEqual(result, { weaponAttack: 1 });
});

test('computeGemContribution dispatches fixed gem (strCrystal)', () => {
  const result = computeGemContribution('strCrystal', 1, {}, () => 0);
  assert.deepEqual(result, { str: 3 });
});

test('computeGemContribution dispatches blackAmethyst', () => {
  const rng = () => 0; // lowest roll
  const result = computeGemContribution('blackAmethyst', 'low', {}, rng);
  assert.deepEqual(result, { weaponAttack: -1, magicAttack: -1 });
});

test('computeGemContribution dispatches blackAmethyst with grade index', () => {
  // Grade index 0 should map to 'low'
  const rng = () => 0; // lowest roll
  const result = computeGemContribution('blackAmethyst', 0, {}, rng);
  assert.deepEqual(result, { weaponAttack: -1, magicAttack: -1 });
});

test('computeGemContribution dispatches darkCrystal', () => {
  const cleanStats = { str: 10, dex: 8 };
  const rng = () => 0; // delta 5
  const result = computeGemContribution('darkCrystal', 0, cleanStats, rng);
  assert.equal(result.str, 15);
  assert.equal(result.dex, 13);
});

test('computeGemContribution returns null for unknown gem key', () => {
  const result = computeGemContribution('nonexistent', 0, {}, () => 0);
  assert.equal(result, null);
});
