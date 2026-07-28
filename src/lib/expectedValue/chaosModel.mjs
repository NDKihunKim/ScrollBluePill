import { HP_MP_KEYS } from '../enhancementState.mjs';

export const CHAOS_SUCCESS_RATE = 0.6; // 60% success rate for 혼돈의 주문서 60%

export const CHAOS_HPMP_MULTIPLIER = 10;

export const CHAOS_OUTCOME_TABLE = [
  { delta: 5, probability: 0.0099 },
  { delta: 4, probability: 0.0198 },
  { delta: 3, probability: 0.1021 },
  { delta: 2, probability: 0.1587 },
  { delta: 1, probability: 0.1931 },
  { delta: 0, probability: 0.1838 },
  { delta: -1, probability: 0.137 },
  { delta: -2, probability: 0.08 },
  { delta: -3, probability: 0.0365 },
  { delta: -4, probability: 0.0297 },
  { delta: -5, probability: 0.0494 },
];

/** @type {Array<{ delta: number, cumulative: number }>|null} */
let _cumulativeTable = null;

/**
 * Build cumulative probability array for binary-search lookup.
 * Cached after first call — subsequent calls return the same reference.
 *
 * @returns {Array<{ delta: number, cumulative: number }>}
 */
export function buildChaosCumulativeTable() {
  if (_cumulativeTable) {
    return _cumulativeTable;
  }

  let running = 0;
  _cumulativeTable = CHAOS_OUTCOME_TABLE.map((entry) => {
    running += entry.probability;
    return { delta: entry.delta, cumulative: running };
  });

  return _cumulativeTable;
}

/**
 * Given a uniform random value [0, 1), return the corresponding delta
 * from the cumulative outcome table.
 *
 * @param {number} randomValue - Uniform random value in [0, 1)
 * @returns {number} The stat delta for this roll
 */
export function rollChaosStatDelta(randomValue) {
  const table = buildChaosCumulativeTable();

  for (const entry of table) {
    if (randomValue < entry.cumulative) {
      return entry.delta;
    }
  }

  // Fallback for edge case: if randomValue is at or above last cumulative
  // (shouldn't happen with [0, 1) input), return the last delta
  return table[table.length - 1].delta;
}

/** @type {Set<string>} */
const METADATA_KEYS = new Set(['upgradeSlots', 'attackSpeed']);

/**
 * Filter stats to only positive values, excluding metadata keys.
 *
 * @param {Record<string, number>} stats - Full item stats
 * @returns {Record<string, number>} Filtered stats with only positive values
 */
export function filterPositiveStats(stats) {
  const result = {};

  for (const [key, value] of Object.entries(stats)) {
    if (METADATA_KEYS.has(key)) continue;
    if (value > 0) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Apply chaos scroll outcomes to each positive stat independently.
 *
 * 1. Filter stats to positive (excluding metadata keys)
 * 2. For each stat: roll delta using rng(), multiply by CHAOS_HPMP_MULTIPLIER for HP/MP keys
 * 3. Apply delta to stat value
 * 4. If resulting value <= 0, remove the stat entirely from result
 * 5. Return resulting stats object
 *
 * @param {Record<string, number>} stats - Full item stats
 * @param {() => number} rng - Function returning uniform random [0, 1) per call
 * @returns {Record<string, number>} Stats after chaos application
 */
export function applyChaosToStats(stats, rng) {
  const positiveStats = filterPositiveStats(stats);
  const result = {};

  for (const [key, value] of Object.entries(positiveStats)) {
    const randomValue = rng();
    const delta = rollChaosStatDelta(randomValue);
    const multiplier = HP_MP_KEYS.has(key) ? CHAOS_HPMP_MULTIPLIER : 1;
    const newValue = value + delta * multiplier;

    if (newValue > 0) {
      result[key] = newValue;
    }
  }

  return result;
}
