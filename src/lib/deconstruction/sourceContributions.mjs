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
    previous = [...seen.values()].sort((a, b) =>
      vectorKey(a.stats, targetKeys).localeCompare(vectorKey(b.stats, targetKeys)),
    );
    results.push(...previous);
  }
  return results;
}
