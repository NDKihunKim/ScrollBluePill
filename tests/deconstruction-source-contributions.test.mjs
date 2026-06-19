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
