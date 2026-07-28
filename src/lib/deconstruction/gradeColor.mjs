import { HP_MP_KEYS } from '../enhancementState.mjs';

/**
 * Grade tiers derived from the MapleStory item color system.
 * Thresholds match computeGradeColor() in enhancementState.mjs.
 *
 * Each tier maps a range of "total added constants" (sum of stat deltas,
 * with HP/MP values divided by 10) to a color name.
 */
export const GRADE_TIERS = [
  { key: 'gray',   name: '회색',   color: '#9e9e9e', min: -Infinity, max: -1 },
  { key: 'white',  name: '하얀색', color: '#ffffff', min: 0,         max: 0 },
  { key: 'orange', name: '주황색', color: '#ff8c00', min: 1,         max: 5 },
  { key: 'blue',   name: '파란색', color: '#3366ff', min: 6,         max: 22 },
  { key: 'purple', name: '보라색', color: '#9933ff', min: 23,        max: 39 },
  { key: 'yellow', name: '노란색', color: '#ffd700', min: 40,        max: 56 },
  { key: 'green',  name: '초록색', color: '#33cc33', min: 57,        max: 73 },
  { key: 'red',    name: '빨간색', color: '#ff3333', min: 74,        max: Infinity },
];

/**
 * Compute the grade tier for a set of stat deltas (e.g. a strategy's totalStats).
 *
 * Uses the same algorithm as computeGradeColor() in enhancementState.mjs:
 * HP/MP values are divided by 10 before summing; all other stats are summed
 * directly.  The total is then matched against GRADE_TIERS thresholds.
 *
 * @param {Record<string, number>} totalStats  Flat stat delta object (e.g. {str: 5, dex: -2})
 * @returns {{ key: string, name: string, color: string, min: number, max: number }}
 */
export function computeGradeTier(totalStats) {
  // When totalStats is unavailable (e.g. minimal mock strategies in tests),
  // default to the zero-delta (white) tier.
  if (!totalStats || typeof totalStats !== 'object') {
    return GRADE_TIERS[1]; // white / 하얀색
  }

  let totalAddedConstants = 0;

  for (const [key, value] of Object.entries(totalStats)) {
    if (!Number.isFinite(value)) continue;

    if (HP_MP_KEYS.has(key)) {
      totalAddedConstants += Math.round(value / 10);
    } else {
      totalAddedConstants += value;
    }
  }

  for (const tier of GRADE_TIERS) {
    if (totalAddedConstants >= tier.min && totalAddedConstants <= tier.max) {
      return tier;
    }
  }

  // Fallback — should never be reached
  return GRADE_TIERS[0];
}

/**
 * Convenience wrapper that computes the grade color for a set of stat
 * deltas, counting only positive contributions (the deconstruction
 * page's display convention: deltas represent what the user wants to
 * add, so negative/zero values don't affect the color).
 *
 * @param {Record<string, number>} deltas
 * @returns {string} CSS color
 */
export function computeGradeColor(deltas) {
  if (!deltas || typeof deltas !== 'object') return GRADE_TIERS[1].color;

  const positiveOnly = {};
  for (const [key, value] of Object.entries(deltas)) {
    if (Number.isFinite(value) && value > 0) {
      positiveOnly[key] = value;
    }
  }
  return computeGradeTier(positiveOnly).color;
}
