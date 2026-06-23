import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enumerateGemContributions,
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

test('item-level contributions include only deduplicated maximum-level totals', () => {
  const results = enumerateItemLevelContributions({
    levelUpDefinition: { maxLevelUps: 2, statRanges: { str: { min: 0, max: 1 } } },
    targetKeys: ['str'],
    bounds: { str: { min: 0, max: 2 } },
  });

  assert.deepEqual(results, [
    { levelCount: 2, stats: { str: 0 } },
    { levelCount: 2, stats: { str: 1 } },
    { levelCount: 2, stats: { str: 2 } },
  ]);
  assert.ok(results.every(({ levelCount }) => levelCount === 2));
});

test('item-level totals use each item definition maximum and stat ranges', () => {
  const reverse = enumerateItemLevelContributions({
    levelUpDefinition: { maxLevelUps: 3, statRanges: { str: { min: 1, max: 1 } } },
    targetKeys: ['str'],
    bounds: { str: { min: -Infinity, max: Infinity } },
  });
  const timeless = enumerateItemLevelContributions({
    levelUpDefinition: { maxLevelUps: 5, statRanges: { dex: { min: 0, max: 1 } } },
    targetKeys: ['dex'],
    bounds: { dex: { min: 0, max: 5 } },
  });

  assert.deepEqual(reverse, [{ levelCount: 3, stats: { str: 3 } }]);
  assert.equal(timeless.length, 6);
  assert.ok(timeless.every(({ levelCount }) => levelCount === 5));
  assert.deepEqual(timeless.map(({ stats }) => stats.dex), [0, 1, 2, 3, 4, 5]);
});

test('item-level exact count limits totals to the inputted item level count', () => {
  const results = enumerateItemLevelContributions({
    levelUpDefinition: { maxLevelUps: 5, statRanges: { str: { min: 0, max: 2 } } },
    targetKeys: ['str'],
    bounds: { str: { min: -Infinity, max: Infinity } },
    exactLevelCount: 1,
  });

  assert.deepEqual(results, [
    { levelCount: 1, stats: { str: 0 } },
    { levelCount: 1, stats: { str: 1 } },
    { levelCount: 1, stats: { str: 2 } },
  ]);
});

test('item-level total ranges constrain exact-count totals', () => {
  const results = enumerateItemLevelContributions({
    levelUpDefinition: { maxLevelUps: 5, statRanges: { str: { min: 0, max: 2 } } },
    targetKeys: ['str'],
    bounds: { str: { min: -Infinity, max: Infinity } },
    exactLevelCount: 3,
    totalRanges: { str: { min: 2, max: 4 } },
  });

  assert.deepEqual(results, [
    { levelCount: 3, stats: { str: 2 } },
    { levelCount: 3, stats: { str: 3 } },
    { levelCount: 3, stats: { str: 4 } },
  ]);
});

test('missing level-up definitions produce no contributions', () => {
  assert.deepEqual(enumerateItemLevelContributions({
    levelUpDefinition: null,
    targetKeys: ['str'],
    bounds: { str: { min: -5, max: 5 } },
  }), []);
});

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

test('gems that contribute nothing to target keys are excluded from enumeration', () => {
  // When targeting only weaponAttack, gems like topaz (maxHp), amethyst (speed),
  // aquamarine (jump), garnet (accuracy), opal (avoidability), emerald (maxMp)
  // should never appear because they contribute zero to weaponAttack.
  const results = enumerateGemContributions({
    gemSlotCount: 3,
    equipmentKind: '장갑',
    cleanStats: { weaponAttack: 0, str: 10, dex: 10, int: 10, luk: 10 },
    targetKeys: ['weaponAttack'],
    bounds: { weaponAttack: { min: -Infinity, max: Infinity } },
  });

  const allGemKeys = new Set(results.flatMap((entry) => entry.gems.map((gem) => gem.gemKey)));
  // Only gems that can contribute to weaponAttack on a glove: str/dex/int/luk crystals
  // (via darkCrystal) and no weapon-only gems.
  // Non-contributing gems like topaz, amethyst, aquamarine, garnet, opal, emerald
  // must NOT appear.
  const forbiddenKeys = ['topaz', 'amethyst', 'aquamarine', 'garnet', 'opal', 'emerald'];
  for (const key of forbiddenKeys) {
    assert.ok(!allGemKeys.has(key), `gem ${key} should be excluded when target is only weaponAttack`);
  }
});

test('gems that contribute to at least one target key are included even if they contribute zero to others', () => {
  // Target both weaponAttack and STR. strCrystal contributes to STR (not weaponAttack)
  // so it should be included because it helps with at least one target.
  const results = enumerateGemContributions({
    gemSlotCount: 2,
    equipmentKind: '장갑',
    cleanStats: { weaponAttack: 0, str: 10 },
    targetKeys: ['weaponAttack', 'str'],
    bounds: {
      weaponAttack: { min: -Infinity, max: Infinity },
      str: { min: -Infinity, max: Infinity },
    },
  });

  const allGemKeys = new Set(results.flatMap((entry) => entry.gems.map((gem) => gem.gemKey)));
  // strCrystal contributes to STR so it should be present
  assert.ok(allGemKeys.has('strCrystal'), 'strCrystal should be included because it contributes to STR');
  // topaz contributes to maxHp (neither target) so it should NOT appear
  assert.ok(!allGemKeys.has('topaz'), 'topaz should be excluded because it contributes to neither weaponAttack nor STR');
});
