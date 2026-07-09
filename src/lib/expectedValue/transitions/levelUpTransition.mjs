/**
 * Item level-up transition.
 *
 * Each level-up applies an independent uniform discrete roll per stat
 * within the configured [min, max] ranges. Multiple levels compound
 * additively (sum of independent rolls).
 *
 * Uses per-stat sequential expansion with intermediate merging.
 */

import { canonicalize } from '../stateVector.mjs';
import { normalizeItemLevelUpRange } from '../../itemLevelUpData.mjs';

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
 * Apply a single level-up transition across all DP states.
 *
 * Each stat in `ranges` gets an independent uniform roll within [min, max].
 * Only non-zero deltas are included; zero deltas leave the stat unchanged.
 *
 * @param {Map<string, { state: Record<string, number>, prob: number }>} dp
 * @param {Record<string, { min: number, max: number }>} ranges - Stat ranges per level
 * @returns {Map<string, { state: Record<string, number>, prob: number }>}
 */
export function applyLevelUpTransition(dp, ranges) {
  if (!ranges || typeof ranges !== 'object') return dp;

  // Filter to valid ranges
  const validEntries = [];
  for (const [statKey, range] of Object.entries(ranges)) {
    const normalized = normalizeItemLevelUpRange(range);
    if (normalized && normalized.min <= normalized.max) {
      validEntries.push([statKey, normalized]);
    }
  }

  if (validEntries.length === 0) return dp;

  const nextDp = new Map();

  for (const [, entry] of dp) {
    const { state, prob } = entry;

    let branches = new Map();
    branches.set('', prob);

    for (const [statKey, range] of validEntries) {
      const nextBranches = new Map();
      const count = range.max - range.min + 1;
      const uniformProb = 1 / count;

      for (const [modKey, modProb] of branches) {
        for (let delta = range.min; delta <= range.max; delta++) {
          const combinedProb = modProb * uniformProb;
          if (combinedProb <= PRUNE_THRESHOLD) continue;

          if (delta === 0) {
            // No change to this stat — carry forward existing modKey
            const existing = nextBranches.get(modKey);
            if (existing !== undefined) {
              nextBranches.set(modKey, existing + combinedProb);
            } else {
              nextBranches.set(modKey, combinedProb);
            }
          } else {
            const baseValue = state[statKey] ?? 0;
            const newValue = baseValue + delta;
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
      }
      branches = nextBranches;
    }

    // Flatten
    for (const [modKey, branchProb] of branches) {
      if (branchProb <= PRUNE_THRESHOLD) continue;

      if (!modKey) {
        // No changes at all
        accumulate(nextDp, state, branchProb);
        continue;
      }

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
