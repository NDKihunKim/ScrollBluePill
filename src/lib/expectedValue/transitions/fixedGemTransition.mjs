/**
 * Fixed (deterministic) Maker gem transition.
 *
 * Fixed gems apply a known stat bonus based on gem type and grade.
 * No randomness — each input state maps to exactly one output state.
 */

import { canonicalize } from '../stateVector.mjs';
import { isFixedGem, getFixedGemStats } from '../makerModel.mjs';

/**
 * Apply a fixed gem transition across all DP states.
 *
 * This is a simple 1:1 mapping — no branching, no probability split.
 *
 * @param {Map<string, { state: Record<string, number>, prob: number }>} dp
 * @param {object} choice - { gemKey, grade }
 * @returns {Map<string, { state: Record<string, number>, prob: number }>}
 */
export function applyFixedGemTransition(dp, choice) {
  if (!choice || !choice.gemKey || !isFixedGem(choice.gemKey)) {
    // Not a fixed gem — pass through unchanged
    return dp;
  }

  const gemStats = getFixedGemStats(choice.gemKey, choice.grade);
  if (!gemStats) {
    // Invalid gem/grade — pass through unchanged
    return dp;
  }

  const nextDp = new Map();

  for (const [, entry] of dp) {
    const { state, prob } = entry;
    const newState = { ...state };

    for (const [key, value] of Object.entries(gemStats)) {
      if (Number.isFinite(value)) {
        newState[key] = (newState[key] ?? 0) + value;
      }
    }

    const key = canonicalize(newState);
    const existing = nextDp.get(key);
    if (existing) {
      existing.prob += prob;
    } else {
      nextDp.set(key, { state: newState, prob });
    }
  }

  return nextDp;
}
