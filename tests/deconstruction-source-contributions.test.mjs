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
