/**
 * Direct outcome probability computation for scroll sequences.
 *
 * Computes the exact probability that every scroll in a sequence produces
 * EXACTLY its user-specified outcome (scroll.stats). This is the product of
 * independent per-scroll probabilities — no DP engine, no threshold checking,
 * no cumulative stat aggregation.
 *
 * For fixed scrolls: P = success_rate (stats are deterministic on success).
 * For chaos scrolls: P = success_rate × Π P(delta = scroll.stats[key]) per stat.
 *   HP/MP stats use the ×10 multiplier: the stored value is divided by 10
 *   to recover the raw delta before table lookup.
 */

import { CHAOS_SUCCESS_RATE, CHAOS_OUTCOME_TABLE } from './chaosModel.mjs';
import { parseScrollSuccessRate } from './scrollModel.mjs';
import { HP_MP_KEYS } from '../enhancementState.mjs';

/** HP/MP multiplier applied to chaos scroll deltas for hp/mp stats. */
const CHAOS_HPMP_MULTIPLIER = 10;

/**
 * Look up a delta in an outcome table, returning its probability.
 *
 * @param {Array<{ delta: number, probability: number }>} table - Outcome table
 * @param {number} delta - Target delta value
 * @returns {number} Probability of the delta, or 0 if not found
 */
function lookupOutcomeProbability(table, delta) {
  const entry = table.find((o) => o.delta === delta);
  return entry ? entry.probability : 0;
}

/**
 * Compute the probability that a single scroll produces exactly its
 * specified outcome.
 *
 * @param {object} scroll - Scroll entry from the enhancement state
 * @param {Set<string>|null} statFilter - If non-null, only these stat keys
 *   affect the probability. If null, all keys in scroll.stats are used.
 * @returns {number} Probability in [0, 1]
 */
function singleScrollProbability(scroll, statFilter) {
  const stats = scroll.stats;

  // Empty or missing stats: trivially satisfied
  if (!stats || Object.keys(stats).length === 0) {
    return 1.0;
  }

  // Check if any stat in the filter is present — if not, this scroll
  // contributes nothing to the filtered probability
  if (statFilter && statFilter.size > 0) {
    const hasFilteredStat = Object.keys(stats).some((k) => statFilter.has(k));
    if (!hasFilteredStat) return 1.0;
  }

  if (scroll.behavior_type === 'chaos') {
    return chaosScrollProbability(scroll, statFilter);
  }

  return fixedScrollProbability(scroll);
}

/**
 * Compute the probability of a chaos scroll producing its exact specified stats.
 *
 * @param {object} scroll - Chaos scroll entry
 * @param {Set<string>|null} statFilter - Stat key filter
 * @returns {number}
 */
function chaosScrollProbability(scroll, statFilter) {
  const successRate = Number.isFinite(scroll.success_rate)
    ? scroll.success_rate
    : CHAOS_SUCCESS_RATE;

  let prob = successRate;
  const stats = scroll.stats ?? {};

  for (const [key, storedValue] of Object.entries(stats)) {
    // Skip stats not in the filter (if filter is active)
    if (statFilter && statFilter.size > 0 && !statFilter.has(key)) continue;

    if (!Number.isFinite(storedValue)) continue;

    let delta;
    if (HP_MP_KEYS.has(key)) {
      // HP/MP: stored value = delta × 10. Recover raw delta.
      delta = storedValue / CHAOS_HPMP_MULTIPLIER;
      // Must be integer delta
      if (!Number.isInteger(delta)) return 0;
    } else {
      delta = storedValue;
    }

    const outcomeProb = lookupOutcomeProbability(CHAOS_OUTCOME_TABLE, delta);
    if (outcomeProb === 0) return 0;

    prob *= outcomeProb;
  }

  return prob;
}

/**
 * Compute the probability of a fixed (non-chaos) scroll producing its stats.
 *
 * Fixed scroll outcomes are deterministic on success — the probability is
 * simply the scroll's success rate.
 *
 * @param {object} scroll - Fixed scroll entry
 * @returns {number}
 */
function fixedScrollProbability(scroll) {
  if (Number.isFinite(scroll.success_rate)) {
    return scroll.success_rate;
  }

  // Parse from the scroll name (e.g. "STR 주문서 60%" → 0.6)
  if (scroll.nameKo) {
    return parseScrollSuccessRate(scroll.nameKo);
  }

  // Fallback: unknown scroll type with no success rate → assume 1.0
  return 1.0;
}

/**
 * Compute the exact probability that ALL scrolls in the sequence produce
 * EXACTLY their user-specified outcomes.
 *
 * Each scroll is treated independently — the total probability is the
 * product of per-scroll probabilities. This is the exact-outcome semantics:
 * every scroll must hit its specified stats exactly.
 *
 * @param {Array<object>} scrollSequence - Ordered array of scroll entries
 * @param {object} [options]
 * @param {Set<string>|null} [options.statFilter=null] - If provided, only
 *   these stat keys affect the probability. Stats not in the filter are
 *   ignored. If omitted or null, ALL stats in each scroll are used.
 * @returns {number} Probability in [0, 1]
 */
export function computeDirectOutcomeProbability(scrollSequence, options = {}) {
  if (!scrollSequence || scrollSequence.length === 0) {
    return 1.0;
  }

  const { statFilter = null } = options;

  let totalProb = 1.0;

  for (const scroll of scrollSequence) {
    if (!scroll) continue;
    totalProb *= singleScrollProbability(scroll, statFilter);

    // Early exit: once probability hits 0, further multiplication won't help
    if (totalProb === 0) return 0;
  }

  return Math.max(0, Math.min(1, totalProb));
}

/**
 * Determine whether the exact-outcome computation mode can be used for a
 * given strategy.
 *
 * Exact-outcome mode requires that every random element has explicitly
 * specified outcomes (per-stat deltas). It returns false if any probability-
 * mode random element is present:
 *   - Stimulant in probability mode
 *   - Item level-up in probability mode
 *   - Random Maker gem in probability mode
 *   - Chaos scroll with empty or missing stats
 *
 * @param {object} strategy - { scrollSequence, makerChoices, useStimulant, useItemLevelUp }
 * @returns {boolean}
 */
export function canUseExactOutcome(strategy) {
  const {
    scrollSequence = [],
    makerChoices = [],
    useItemLevelUp = false,
    useStimulant = false,
  } = strategy || {};

  // Probability-mode random elements: must have explicitly specified outcomes
  if (useStimulant) return false;
  if (useItemLevelUp) return false;

  for (const choice of makerChoices) {
    if (!choice || !choice.gemKey) continue;
    // Manual mode = user pre-specified stats → OK
    // Probability mode = random outcome → not OK for exact-outcome
    if (choice.stats && choice.mode === 'probability') return false;
  }

  // Chaos scrolls must have explicitly specified stat deltas
  for (const scroll of scrollSequence) {
    if (!scroll) continue;
    if (scroll.behavior_type === 'chaos') {
      const stats = scroll.stats ?? {};
      if (Object.keys(stats).length === 0) return false;
    }
  }

  return true;
}
