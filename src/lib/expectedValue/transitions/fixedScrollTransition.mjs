/**
 * Fixed (non-chaos) scroll transition.
 *
 * Binary branching: success (apply fixed stats) vs failure (state unchanged).
 */

import { canonicalize } from '../stateVector.mjs';

/** @type {number} Minimum probability to include a branch in the DP map. */
const PRUNE_THRESHOLD = 1e-12;

/**
 * Accumulate a probability mass for a state into the next DP map.
 * Merges with existing entries that share the same canonical key.
 *
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
 * Apply a fixed (non-chaos) scroll as a transition over all DP states.
 *
 * @param {Map<string, { state: Record<string, number>, prob: number }>} dp - Current DP map
 * @param {object} scroll - Scroll definition with `stats` and `success_rate`
 * @returns {Map<string, { state: Record<string, number>, prob: number }>} New DP map
 */
export function applyFixedScrollTransition(dp, scroll) {
  const nextDp = new Map();
  const scrollStats = scroll.stats || {};
  const successRate = Number.isFinite(scroll.success_rate) ? scroll.success_rate : 1.0;

  // Skip scrolls with no meaningful stats
  const hasStats = Object.values(scrollStats).some(v => Number.isFinite(v) && v !== 0);
  if (!hasStats) {
    // No-op: copy all states unchanged
    for (const [key, entry] of dp) {
      nextDp.set(key, { state: { ...entry.state }, prob: entry.prob });
    }
    return nextDp;
  }

  for (const [, entry] of dp) {
    const { state, prob } = entry;

    // Success branch: apply scroll stats
    if (successRate > 0) {
      const successState = { ...state };
      for (const [k, v] of Object.entries(scrollStats)) {
        if (Number.isFinite(v) && v !== 0) {
          successState[k] = (successState[k] ?? 0) + v;
        }
      }
      accumulate(nextDp, successState, prob * successRate);
    }

    // Failure branch: state unchanged
    if (successRate < 1.0) {
      accumulate(nextDp, state, prob * (1 - successRate));
    }
  }

  return nextDp;
}
