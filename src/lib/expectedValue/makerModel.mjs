import { getGemTypeByKey } from '../makerData.mjs';
import { rollChaosStatDelta } from './chaosModel.mjs';

/**
 * Probability tables for 흑수정 (Black Amethyst) by grade.
 * Each entry has a stat delta value and its probability.
 */
export const BLACK_AMETHYST_TABLES = {
  low: [
    { value: -1, probability: 0.3 },
    { value: 0, probability: 0.4 },
    { value: 1, probability: 0.3 },
  ],
  mid: [
    { value: -2, probability: 0.12 },
    { value: -1, probability: 0.22 },
    { value: 0, probability: 0.32 },
    { value: 1, probability: 0.22 },
    { value: 2, probability: 0.12 },
  ],
  high: [
    { value: -3, probability: 0.05 },
    { value: -2, probability: 0.1 },
    { value: -1, probability: 0.2 },
    { value: 0, probability: 0.3 },
    { value: 1, probability: 0.2 },
    { value: 2, probability: 0.1 },
    { value: 3, probability: 0.05 },
  ],
};

/**
 * Probability tables for Dark Crystal (어둠의 크리스탈) by grade.
 * 하급: ±2, 중급: ±3 (same shape as 흑수정), 상급: ±5 (chaos scroll distribution)
 */
export const DARK_CRYSTAL_TABLES = {
  low: [
    { value: -2, probability: 0.08 },
    { value: -1, probability: 0.22 },
    { value: 0, probability: 0.4 },
    { value: 1, probability: 0.22 },
    { value: 2, probability: 0.08 },
  ],
  mid: [
    { value: -3, probability: 0.05 },
    { value: -2, probability: 0.1 },
    { value: -1, probability: 0.2 },
    { value: 0, probability: 0.3 },
    { value: 1, probability: 0.2 },
    { value: 2, probability: 0.1 },
    { value: 3, probability: 0.05 },
  ],
  high: [
    { value: -5, probability: 0.0494 },
    { value: -4, probability: 0.0297 },
    { value: -3, probability: 0.0365 },
    { value: -2, probability: 0.08 },
    { value: -1, probability: 0.137 },
    { value: 0, probability: 0.1838 },
    { value: 1, probability: 0.1931 },
    { value: 2, probability: 0.1587 },
    { value: 3, probability: 0.1021 },
    { value: 4, probability: 0.0198 },
    { value: 5, probability: 0.0099 },
  ],
};

const FIXED_GEM_KEYS = new Set([
  'diamond',
  'sapphire',
  'strCrystal',
  'dexCrystal',
  'intCrystal',
  'lukCrystal',
  'garnet',
  'opal',
  'amethyst',
  'aquamarine',
  'topaz',
  'emerald',
]);

const RANDOM_GEM_KEYS = new Set(['blackAmethyst', 'darkCrystal']);

const GRADE_INDEX_TO_KEY = ['low', 'mid', 'high'];
const MAX_GRADE_INDEX = GRADE_INDEX_TO_KEY.length - 1;

/**
 * Check if a gem key identifies a fixed-value gem (deterministic stat outcome).
 *
 * @param {string} gemKey - The gem type key
 * @returns {boolean}
 */
export function isFixedGem(gemKey) {
  return FIXED_GEM_KEYS.has(gemKey);
}

/**
 * Check if a gem key identifies a random-outcome gem (variable stat outcome).
 *
 * @param {string} gemKey - The gem type key
 * @returns {boolean}
 */
export function isRandomGem(gemKey) {
  return RANDOM_GEM_KEYS.has(gemKey);
}

/**
 * Get the deterministic stat contribution for a fixed gem by grade.
 *
 * @param {string} gemKey - The fixed gem type key
 * @param {number} gradeIndex - Grade index (0 = low, 1 = mid, 2 = high)
 * @returns {Record<string, number>|null} Stat key → value map, or null if invalid
 */
export function getFixedGemStats(gemKey, gradeIndex) {
  if (!isFixedGem(gemKey)) return null;
  if (!Number.isInteger(gradeIndex) || gradeIndex < 0 || gradeIndex > MAX_GRADE_INDEX) return null;

  const gem = getGemTypeByKey(gemKey);
  if (!gem || !gem.stat || !Array.isArray(gem.values)) return null;

  if (gradeIndex >= gem.values.length) return null;

  return { [gem.stat]: gem.values[gradeIndex] };
}

/**
 * Select a value from a probability table using a uniform random value.
 *
 * @param {Array<{ value: number, probability: number }>} table - Probability table
 * @param {number} rngValue - Uniform random value in [0, 1)
 * @returns {number} The selected value
 */
function selectFromTable(table, rngValue) {
  let cumulative = 0;

  for (const entry of table) {
    cumulative += entry.probability;
    if (rngValue < cumulative) {
      return entry.value;
    }
  }

  // Fallback for floating-point precision edge case
  return table[table.length - 1].value;
}

/**
 * Roll stat deltas for Black Amethyst (흑수정) across the given stat keys.
 * Each stat is rolled independently using a fresh call to rng().
 *
 * @param {string} gradeKey - Grade key ('low', 'mid', 'high')
 * @param {string[]} statKeys - Array of stat keys to roll for
 * @param {() => number} rng - Function returning uniform random [0, 1) per call
 * @returns {Record<string, number>} Map of stat key → rolled delta value
 */
export function rollBlackAmethystStats(gradeKey, statKeys, rng) {
  const table = BLACK_AMETHYST_TABLES[gradeKey];
  if (!table) return {};

  const result = {};

  for (const statKey of statKeys) {
    const rngValue = rng();
    result[statKey] = selectFromTable(table, rngValue);
  }

  return result;
}

/**
 * Roll stat changes for Dark Crystal (어둠의 크리스탈).
 * Uses the chaos -5..+5 outcome table independently for each of STR/DEX/INT/LUK
 * that is present on the clean base stats.
 *
 * @param {Record<string, number>} cleanStats - Clean base item stats
 * @param {() => number} rng - Function returning uniform random [0, 1) per call
 * @returns {Record<string, number>} Updated stats with chaos deltas applied
 */
export function rollDarkCrystalStats(gradeKey, cleanStats, rng) {
  const table = DARK_CRYSTAL_TABLES[gradeKey];
  if (!table) return {};

  const DARK_KEYS = ['str', 'dex', 'int', 'luk'];
  const result = {};

  for (const key of DARK_KEYS) {
    if (Number.isFinite(cleanStats[key])) {
      const rngValue = rng();
      const delta = selectFromTable(table, rngValue);
      if (delta !== 0) {
        result[key] = delta;
      }
    }
  }

  return result;
}

/**
 * Compute the stat contribution of a gem given its type, grade, clean item stats,
 * and an RNG source. Dispatches to the appropriate handler based on gem type.
 *
 * @param {string} gemKey - The gem type key
 * @param {number|string} grade - Grade index (0-2) or grade key ('low', 'mid', 'high')
 * @param {Record<string, number>} cleanStats - Clean base item stats
 * @param {() => number} rng - Function returning uniform random [0, 1) per call
 * @returns {Record<string, number>|null} Stat contribution map, or null for unknown gems
 */
export function computeGemContribution(gemKey, grade, cleanStats, rng) {
  if (isFixedGem(gemKey)) {
    const gradeIndex = typeof grade === 'number' ? grade : GRADE_INDEX_TO_KEY.indexOf(grade);
    return getFixedGemStats(gemKey, gradeIndex);
  }

  if (gemKey === 'blackAmethyst') {
    const gradeKey = typeof grade === 'number' ? GRADE_INDEX_TO_KEY[grade] : grade;
    if (!gradeKey) return null;
    const allKeys = ['weaponAttack', 'magicAttack'];
    const statKeys = allKeys.filter((k) => Number.isFinite(cleanStats[k]));
    return rollBlackAmethystStats(gradeKey, statKeys, rng);
  }

  if (gemKey === 'darkCrystal') {
    const gradeKey = typeof grade === 'number' ? GRADE_INDEX_TO_KEY[grade] : grade;
    if (!gradeKey) return null;
    return rollDarkCrystalStats(gradeKey, cleanStats, rng);
  }

  return null;
}
