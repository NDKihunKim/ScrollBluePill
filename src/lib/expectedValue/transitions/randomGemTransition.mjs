/**
 * Random Maker gem transition (Black Amethyst, Dark Crystal).
 *
 * Each stat gets an independent roll from a grade-dependent probability table.
 * Uses per-stat sequential expansion with intermediate merging.
 */

import { canonicalize } from '../stateVector.mjs';
import { BLACK_AMETHYST_TABLES, DARK_CRYSTAL_TABLES } from '../makerModel.mjs';

const GRADE_INDEX_TO_KEY = ['low', 'mid', 'high'];
const PRUNE_THRESHOLD = 1e-12;

/**
 * @param {Map<string, { state: Record<string, number>, prob: number }>} nextDp
 * @param {Record<string, number>} state
 * @param {number} prob
 */
function accumulate(nextDp, state, prob) {
  if (prob <= PRUNE_THRESHOLD) return;
  const key = canonicalize(state);
  const existing = nextDp.get(key);
  if (existing) {
    existing.prob += prob;
  } else {
    nextDp.set(key, { state: { ...state }, prob });
  }
}

/**
 * Apply a random gem transition across all DP states.
 *
 * @param {Map<string, { state: Record<string, number>, prob: number }>} dp
 * @param {object} choice - { gemKey, grade }
 * @param {Record<string, number>} cleanStats - Clean base item stats (determines which stats are affected)
 * @returns {Map<string, { state: Record<string, number>, prob: number }>}
 */
export function applyRandomGemTransition(dp, choice, cleanStats) {
  if (!choice || !choice.gemKey) return dp;

  // Determine table and affected stat keys
  let table;
  let statKeys;

  const gradeKey = typeof choice.grade === 'number'
    ? GRADE_INDEX_TO_KEY[choice.grade] ?? 'low'
    : (choice.grade ?? 'low');

  if (choice.gemKey === 'blackAmethyst') {
    table = BLACK_AMETHYST_TABLES[gradeKey];
    statKeys = ['weaponAttack', 'magicAttack'].filter(k => Number.isFinite(cleanStats[k]));
  } else if (choice.gemKey === 'darkCrystal') {
    table = DARK_CRYSTAL_TABLES[gradeKey];
    statKeys = ['str', 'dex', 'int', 'luk'].filter(k => Number.isFinite(cleanStats[k]));
  } else {
    // Not a random gem — pass through
    return dp;
  }

  if (!table || statKeys.length === 0) return dp;

  const nextDp = new Map();

  for (const [, entry] of dp) {
    const { state, prob } = entry;

    // Sequential per-stat expansion
    let branches = new Map();
    branches.set('', prob);

    for (const statKey of statKeys) {
      const nextBranches = new Map();
      const baseValue = state[statKey] ?? 0;

      for (const [modKey, modProb] of branches) {
        for (const outcome of table) {
          const newValue = baseValue + outcome.value;
          const combinedProb = modProb * outcome.probability;
          if (combinedProb <= PRUNE_THRESHOLD) continue;

          const newModKey = modKey
            ? `${modKey}|${statKey}:${newValue}`
            : `${statKey}:${newValue}`;

          const existing = nextBranches.get(newModKey);
          if (existing !== undefined) {
            nextBranches.set(newModKey, existing + combinedProb);
          } else {
            nextBranches.set(newModKey, combinedProb);
          }
        }
      }
      branches = nextBranches;
    }

    // Flatten
    for (const [modKey, branchProb] of branches) {
      if (branchProb <= PRUNE_THRESHOLD) continue;

      const newState = { ...state };
      const segments = modKey.split('|');
      for (const seg of segments) {
        const ci = seg.indexOf(':');
        if (ci === -1) continue;
        const k = seg.slice(0, ci);
        const v = Number(seg.slice(ci + 1));
        if (Number.isFinite(v)) {
          newState[k] = v;
        }
      }

      accumulate(nextDp, newState, branchProb);
    }
  }

  return nextDp;
}
