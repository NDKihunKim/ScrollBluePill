/**
 * DP state pruning and complexity estimation utilities.
 *
 * Provides:
 * - Probability-threshold pruning (drop states below a threshold)
 * - Beam pruning (keep top-K states by probability)
 * - Complexity estimation for user feedback
 */

/**
 * Default probability threshold: states below this are pruned.
 * 1e-12 means states that only matter at 1-in-a-trillion scales.
 */
export const PRUNE_THRESHOLD = 1e-12;

/** Maximum DP state count before beam pruning kicks in. */
export const MAX_STATE_COUNT = 250_000;

/**
 * Prune DP entries below a probability threshold.
 *
 * @param {Map<string, { state: Record<string, number>, prob: number }>} dp
 * @param {number} [threshold=PRUNE_THRESHOLD]
 * @returns {{ dp: Map<string, { state: Record<string, number>, prob: number }>, prunedMass: number }}
 */
export function pruneByProbability(dp, threshold = PRUNE_THRESHOLD) {
  const nextDp = new Map();
  let prunedMass = 0;

  for (const [key, entry] of dp) {
    if (entry.prob >= threshold) {
      nextDp.set(key, entry);
    } else {
      prunedMass += entry.prob;
    }
  }

  return { dp: nextDp, prunedMass };
}

/**
 * Beam-prune to keep only the top-K states by probability.
 *
 * @param {Map<string, { state: Record<string, number>, prob: number }>} dp
 * @param {number} [maxCount=MAX_STATE_COUNT]
 * @returns {{ dp: Map<string, { state: Record<string, number>, prob: number }>, prunedMass: number }}
 */
export function beamPrune(dp, maxCount = MAX_STATE_COUNT) {
  if (dp.size <= maxCount) return { dp, prunedMass: 0 };

  const entries = [...dp.values()];
  entries.sort((a, b) => b.prob - a.prob);

  const nextDp = new Map();
  let prunedMass = 0;

  for (let i = 0; i < maxCount; i++) {
    const entry = entries[i];
    const { state } = entry;
    // Re-canonicalize to get the key
    const parts = [];
    for (const key of ['weaponAttack', 'magicAttack', 'str', 'dex', 'int', 'luk', 'maxHp', 'maxMp', 'weaponDefense', 'magicDefense', 'accuracy', 'avoidability', 'speed', 'jump', 'upgradeSlots', 'attackSpeed']) {
      const value = state[key];
      if (Number.isFinite(value) && value > 0) {
        parts.push(`${key}:${value}`);
      }
    }
    nextDp.set(parts.join('|'), entry);
  }

  for (let i = maxCount; i < entries.length; i++) {
    prunedMass += entries[i].prob;
  }

  return { dp: nextDp, prunedMass };
}

/**
 * Estimate the branching complexity of a strategy.
 *
 * Returns an approximate upper bound on the number of distinct DP states
 * before merging. Used for UX (warn if heavy) and for tuning pruning
 * aggressiveness.
 *
 * @param {object} strategy
 * @param {number} positiveStatCount - Number of positive stats on the clean item
 * @returns {number} Estimated maximum distinct states
 */
export function estimateBranchingFactor(strategy, positiveStatCount = 4) {
  let totalStates = 1;
  const { makerChoices = [], scrollSequence = [], useStimulant = false, useItemLevelUp = false } = strategy || {};

  // Random gems
  for (const choice of makerChoices) {
    if (!choice || !choice.gemKey) continue;
    if (choice.stats && choice.mode !== 'probability') continue;

    if (choice.gemKey === 'blackAmethyst') {
      const outcomes = { low: 3, mid: 5, high: 7 }[choice.gradeKey ?? 'low'] ?? 5;
      totalStates *= Math.pow(outcomes, Math.min(2, positiveStatCount));
    } else if (choice.gemKey === 'darkCrystal') {
      const outcomes = { low: 5, mid: 7, high: 11 }[choice.gradeKey ?? 'low'] ?? 7;
      totalStates *= Math.pow(outcomes, Math.min(4, positiveStatCount));
    }
    totalStates = Math.min(totalStates, 1_000_000);
  }

  // Stimulant
  if (useStimulant) {
    totalStates *= Math.pow(6, Math.min(positiveStatCount, 4));
    totalStates = Math.min(totalStates, 1_000_000);
  }

  // Scrolls
  for (const scroll of scrollSequence) {
    if (!scroll) continue;
    if (scroll.behavior_type === 'chaos') {
      totalStates *= Math.pow(11, Math.min(positiveStatCount, 4));
    } else {
      totalStates *= 2; // binary success/failure
    }
    totalStates = Math.min(totalStates, 1_000_000);
  }

  // Item level-up
  if (useItemLevelUp) {
    // Rough estimate: ~3 stats with range width ~4
    totalStates *= Math.pow(4, Math.min(3, positiveStatCount));
    totalStates = Math.min(totalStates, 1_000_000);
  }

  return totalStates;
}

/**
 * Classify a strategy's computational complexity.
 *
 * @param {object} strategy
 * @param {number} positiveStatCount
 * @returns {{ level: 'simple' | 'moderate' | 'heavy', estimatedStates: number }}
 */
export function getComputationMode(strategy, positiveStatCount = 4) {
  const estimated = estimateBranchingFactor(strategy, positiveStatCount);
  if (estimated < 50_000) return { level: 'simple', estimatedStates: estimated };
  if (estimated < 1_000_000) return { level: 'moderate', estimatedStates: estimated };
  return { level: 'heavy', estimatedStates: estimated };
}
