/**
 * Chaos scroll transition.
 *
 * 60% success rate. On success, each positive stat gets an independent
 * delta roll from the CHAOS_OUTCOME_TABLE (-5..+5, asymmetric distribution).
 * HP/MP stats get delta ×10 multiplier. Stats driven to ≤ 0 are removed.
 *
 * To prevent state explosion on items with many positive stats (e.g. Zakum
 * Helmet with 10+), three limits are applied:
 *   1. Only the first MAX_EXPANDED_STATS stats are expanded per input state.
 *   2. Per-stat beam pruning caps intermediate branches at MAX_BRANCHES.
 *   3. When the DP exceeds MAX_FULL_EXPAND_INPUT states, only the top
 *      MAX_FULL_EXPAND_INPUT states are fully expanded; the remainder keep
 *      their state unchanged.
 *
 * These approximations trade joint-distribution accuracy for tractability.
 */

import { canonicalize, applyModifications } from '../stateVector.mjs';
import { CHAOS_SUCCESS_RATE, CHAOS_OUTCOME_TABLE } from '../chaosModel.mjs';
import { HP_MP_KEYS } from '../../enhancementState.mjs';

/** Minimum probability to retain a branch during expansion. */
const PRUNE_THRESHOLD = 1e-12;
/** Maximum intermediate branches before beam pruning kicks in. */
const MAX_BRANCHES = 2000;
/** Maximum positive stats to expand in the per-stat sequential expansion. */
const MAX_EXPANDED_STATS = 5;
/** Maximum DP input states to fully expand. When exceeded, only the top
 *  states are expanded; the tail gets "state unchanged" accumulation. */
const MAX_FULL_EXPAND_INPUT = 500;
/** DP size threshold for intermediate beam pruning during accumulation. */
const DP_BEAM_LIMIT = 300000;
/** Metadata keys excluded from chaos delta application. */
const METADATA_KEYS = new Set(['upgradeSlots', 'attackSpeed']);

/**
 * Beam-prune a Map by probability, keeping only the top-K entries.
 *
 * @template V
 * @param {Map<string, V>} map - Map to prune
 * @param {number} maxSize - Maximum entries to retain
 * @param {function(V): number} getProb - Extract probability from value
 * @returns {Map<string, V>}
 */
function beamPruneMap(map, maxSize, getProb) {
  if (map.size <= maxSize) return map;
  const sorted = [...map.entries()].sort((a, b) => getProb(b[1]) - getProb(a[1]));
  return new Map(sorted.slice(0, maxSize));
}

/**
 * Accumulate a probability into the next DP map, merging with existing entries.
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
 * Beam-prune a probability-branch Map, keeping only the top-K entries.
 *
 * @param {Map<string, number>} branches - Map of modKey → probability
 * @param {number} maxBranches - Maximum branches to retain
 * @returns {Map<string, number>}
 */
function beamPruneBranches(branches, maxBranches) {
  return beamPruneMap(branches, maxBranches, (p) => p);
}

/**
 * Get positive stats from a state, excluding metadata keys.
 *
 * @param {Record<string, number>} state
 * @returns {Record<string, number>}
 */
function getPositiveStats(state) {
  const result = {};
  for (const [key, value] of Object.entries(state)) {
    if (METADATA_KEYS.has(key)) continue;
    if (Number.isFinite(value) && value > 0) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Apply chaos scroll transition across all DP states.
 *
 * @param {Map<string, { state: Record<string, number>, prob: number }>} dp
 * @param {object} _scroll - Scroll definition (unused; chaos uses global outcome table)
 * @returns {Map<string, { state: Record<string, number>, prob: number }>}
 */
export function applyChaosScrollTransition(dp, _scroll) {
  let nextDp = new Map();

  // Determine which input states get full expansion vs. simplified treatment.
  const entries = [...dp.values()];
  let fullExpand = entries;
  let tailEntries = [];

  if (entries.length > MAX_FULL_EXPAND_INPUT) {
    entries.sort((a, b) => b.prob - a.prob);
    fullExpand = entries.slice(0, MAX_FULL_EXPAND_INPUT);
    tailEntries = entries.slice(MAX_FULL_EXPAND_INPUT);
  }

  // --- Full expansion: per-stat sequential expansion for top states ---
  for (const entry of fullExpand) {
    const { state, prob } = entry;
    const positiveStats = getPositiveStats(state);
    const statEntries = Object.entries(positiveStats);

    // Failure branch (40%): state unchanged
    if (CHAOS_SUCCESS_RATE < 1.0) {
      accumulate(nextDp, state, prob * (1 - CHAOS_SUCCESS_RATE));
    }

    if (statEntries.length === 0) {
      if (CHAOS_SUCCESS_RATE > 0) {
        accumulate(nextDp, state, prob * CHAOS_SUCCESS_RATE);
      }
      continue;
    }

    // Success branch: expand first MAX_EXPANDED_STATS stats
    const expandCount = Math.min(statEntries.length, MAX_EXPANDED_STATS);
    let branches = new Map();
    branches.set('', prob * CHAOS_SUCCESS_RATE);

    for (let i = 0; i < expandCount; i++) {
      const [statKey, value] = statEntries[i];
      const nextBranches = new Map();
      const multiplier = HP_MP_KEYS.has(statKey) ? 10 : 1;

      for (const [modKey, modProb] of branches) {
        for (const outcome of CHAOS_OUTCOME_TABLE) {
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

      if (branches.size > MAX_BRANCHES) {
        branches = beamPruneBranches(branches, MAX_BRANCHES);
      }
    }

    // Flatten success branches into nextDp
    for (const [modKey, branchProb] of branches) {
      if (branchProb <= PRUNE_THRESHOLD) continue;
      const newState = applyModifications(state, modKey);
      accumulate(nextDp, newState, branchProb);
    }

    // If nextDp grows too large, beam-prune it to prevent OOM during
    // accumulation of subsequent input states.
    if (nextDp.size > DP_BEAM_LIMIT) {
      nextDp = beamPruneMap(nextDp, MAX_FULL_EXPAND_INPUT * MAX_BRANCHES / 2,
        (entry) => entry.prob);
    }
  }

  // --- Tail states: accumulate as unchanged (both success + failure) ---
  // This preserves total probability mass while avoiding exponential
  // state explosion from the long tail of low-probability states.
  for (const entry of tailEntries) {
    accumulate(nextDp, entry.state, entry.prob);
  }

  return nextDp;
}
