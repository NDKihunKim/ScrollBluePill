/**
 * Stimulant (촉진제) transition.
 *
 * 90% success rate. On success, each positive stat gets an independent
 * delta from 0..+5 (weighted, no negatives). HP/MP get delta ×10.
 * Stats driven to ≤ 0 are removed.
 *
 * Uses per-stat sequential expansion with intermediate pruning.
 */

import { canonicalize, applyModifications } from '../stateVector.mjs';
import { HP_MP_KEYS } from '../../enhancementState.mjs';

/** Stimulant success rate: 90% */
export const STIMULANT_SUCCESS_RATE = 0.9;

/** Stimulant outcome table: 0..+5 weighted distribution */
export const STIMULANT_OUTCOME_TABLE = [
  { delta: 5, probability: 0.022 },
  { delta: 4, probability: 0.054 },
  { delta: 3, probability: 0.128 },
  { delta: 2, probability: 0.242 },
  { delta: 1, probability: 0.352 },
  { delta: 0, probability: 0.202 },
];

const PRUNE_THRESHOLD = 1e-12;
const METADATA_KEYS = new Set(['upgradeSlots', 'attackSpeed']);

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
 * Apply stimulant transition across all DP states.
 *
 * @param {Map<string, { state: Record<string, number>, prob: number }>} dp
 * @returns {Map<string, { state: Record<string, number>, prob: number }>}
 */
export function applyStimulantTransition(dp) {
  const nextDp = new Map();

  for (const [, entry] of dp) {
    const { state, prob } = entry;

    // Failure branch (10%): state unchanged
    accumulate(nextDp, state, prob * (1 - STIMULANT_SUCCESS_RATE));

    // Collect positive stats (exclude metadata)
    const positiveEntries = [];
    for (const [key, value] of Object.entries(state)) {
      if (METADATA_KEYS.has(key)) continue;
      if (Number.isFinite(value) && value > 0) {
        positiveEntries.push([key, value]);
      }
    }

    // If no positive stats, success is a no-op
    if (positiveEntries.length === 0) {
      accumulate(nextDp, state, prob * STIMULANT_SUCCESS_RATE);
      continue;
    }

    // Success branch (90%): per-stat sequential expansion
    let branches = new Map();
    branches.set('', prob * STIMULANT_SUCCESS_RATE);

    for (const [statKey, value] of positiveEntries) {
      const nextBranches = new Map();
      const multiplier = HP_MP_KEYS.has(statKey) ? 10 : 1;

      for (const [modKey, modProb] of branches) {
        for (const outcome of STIMULANT_OUTCOME_TABLE) {
          const newValue = value + outcome.delta * multiplier;
          const combinedProb = modProb * outcome.probability;
          if (combinedProb <= PRUNE_THRESHOLD) continue;

          const newModKey = newValue > 0
            ? (modKey ? modKey + '|' : '') + `${statKey}:${newValue}`
            : modKey;

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
      const newState = applyModifications(state, modKey);
      accumulate(nextDp, newState, branchProb);
    }
  }

  return nextDp;
}
