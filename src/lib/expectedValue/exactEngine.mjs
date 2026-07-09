/**
 * Unified exact probability engine for enhancement strategies.
 *
 * Computes the exact success probability for any enhancement strategy
 * (including previously Monte-Carlo-only mechanics like chaos scrolls,
 * random gems, stimulant, and item level-up) using dynamic programming
 * over a stochastic transition graph.
 *
 * Each mechanic is a transition function (DP map) → (DP map). States
 * with identical stat vectors are merged after each transition.
 * Probability-threshold and beam pruning control state explosion.
 */

import { canonicalize } from './stateVector.mjs';
import { pruneByProbability, beamPrune, PRUNE_THRESHOLD, MAX_STATE_COUNT } from './pruning.mjs';
import { parseScrollSuccessRate } from './scrollModel.mjs';
import { isFixedGem, isRandomGem, getFixedGemStats } from './makerModel.mjs';
import { applyFixedScrollTransition } from './transitions/fixedScrollTransition.mjs';
import { applyChaosScrollTransition } from './transitions/chaosScrollTransition.mjs';
import { applyFixedGemTransition } from './transitions/fixedGemTransition.mjs';
import { applyRandomGemTransition } from './transitions/randomGemTransition.mjs';
import { applyStimulantTransition } from './transitions/stimulantTransition.mjs';
import { applyLevelUpTransition } from './transitions/levelUpTransition.mjs';

// ---------------------------------------------------------------------------
// isDeterministicStrategy — kept as a utility, no longer a code-path branch
// ---------------------------------------------------------------------------

/**
 * Check whether a strategy contains any random elements.
 *
 * NOTE: With the unified engine, this function is informational only.
 * The engine handles both deterministic and non-deterministic strategies
 * through the same DP pipeline. This remains exported for tests and
 * diagnostic purposes.
 *
 * @param {{ makerChoices: Array<{ gemKey: string, grade: number }>, scrollSequence: Array<object>, useItemLevelUp: boolean, useStimulant: boolean }} strategy
 * @returns {boolean}
 */
export function isDeterministicStrategy(strategy) {
  const { makerChoices = [], scrollSequence = [], useItemLevelUp = false, useStimulant = false } = strategy || {};

  if (useItemLevelUp) return false;
  if (useStimulant) return false;

  for (const scroll of scrollSequence) {
    if (scroll.behavior_type === 'chaos') return false;
  }

  for (const choice of makerChoices) {
    if (!choice || !choice.gemKey) continue;
    if (choice.stats && choice.mode !== 'probability') continue;
    if (isRandomGem(choice.gemKey)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// satisfiesTargets
// ---------------------------------------------------------------------------

/**
 * Check if an enhancement state satisfies all target conditions.
 *
 * @param {Record<string, number>} state - Enhanced state (after all transitions)
 * @param {Record<string, number>} cleanStats - Base clean item stats
 * @param {{ statThresholds: Record<string, number>, gradeThreshold: number|null }} targetConditions
 * @returns {boolean}
 */
export function satisfiesTargets(state, cleanStats, targetConditions) {
  const { statThresholds = {} } = targetConditions || {};

  for (const [key, threshold] of Object.entries(statThresholds)) {
    const cleanVal = cleanStats && Number.isFinite(cleanStats[key]) ? cleanStats[key] : 0;
    const stateVal = state && Number.isFinite(state[key]) ? state[key] : 0;
    const gain = stateVal - cleanVal;

    if (gain < threshold) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Unified DP Engine
// ---------------------------------------------------------------------------

/**
 * Compute the exact success probability for any enhancement strategy.
 *
 * The strategy is decomposed into an ordered sequence of transitions:
 *   1. Fixed Maker gems (deterministic stat bonuses)
 *   2. Random Maker gems (blackAmethyst, darkCrystal)
 *   3. Stimulant (optional, 90% success + delta distribution)
 *   4. Scrolls (fixed + chaos, in sequence)
 *   5. Item level-ups (optional, per-level uniform rolls)
 *
 * After each scroll transition, the DP map is pruned by probability
 * threshold. If the state count exceeds MAX_STATE_COUNT, beam pruning
 * keeps the highest-probability states.
 *
 * @param {object} strategy - { makerChoices, scrollSequence, useItemLevelUp, useStimulant, levelUpRanges, levelUpCount }
 * @param {Record<string, number>} cleanStats - Clean base item stats
 * @param {{ statThresholds: Record<string, number> }} targetConditions
 * @param {object} [options]
 * @param {number} [options.probabilityThreshold=1e-12]
 * @param {number} [options.maxStateCount=250000]
 * @returns {number} Success probability in [0, 1]
 */
export function computeExactProbability(strategy, cleanStats, targetConditions, options = {}) {
  const {
    probabilityThreshold = PRUNE_THRESHOLD,
    maxStateCount = MAX_STATE_COUNT,
  } = options;

  const { makerChoices = [], scrollSequence = [], useItemLevelUp = false, useStimulant = false } = strategy || {};

  // 1. Build baseline from clean stats + fixed maker gems
  const baseline = { ...cleanStats };

  // Separate fixed and random maker choices
  const fixedChoices = [];
  const randomChoices = [];

  for (const choice of makerChoices) {
    if (!choice || !choice.gemKey) continue;

    // Manual mode (or no mode) with pre-rolled stats: apply directly to baseline
    if (choice.stats) {
      const mode = choice.mode ?? 'manual';
      if (mode !== 'probability') {
        for (const [key, value] of Object.entries(choice.stats)) {
          if (Number.isFinite(value)) {
            baseline[key] = (baseline[key] ?? 0) + value;
          }
        }
        continue;
      }
    }

    if (isFixedGem(choice.gemKey)) {
      fixedChoices.push(choice);
    } else if (isRandomGem(choice.gemKey)) {
      randomChoices.push(choice);
    }
  }

  // Apply fixed gem stats directly to the baseline
  for (const choice of fixedChoices) {
    const gemStats = getFixedGemStats(choice.gemKey, choice.grade);
    if (!gemStats) continue;
    for (const [key, value] of Object.entries(gemStats)) {
      if (Number.isFinite(value)) {
        baseline[key] = (baseline[key] ?? 0) + value;
      }
    }
  }

  // 2. Initialize DP with the baseline as the only state
  /** @type {Map<string, { state: Record<string, number>, prob: number }>} */
  let dp = new Map();
  dp.set(canonicalize(baseline), { state: { ...baseline }, prob: 1.0 });

  // 3. Apply random maker gem transitions
  for (const choice of randomChoices) {
    dp = applyRandomGemTransition(dp, choice, cleanStats);
  }

  // 4. Apply stimulant transition
  if (useStimulant) {
    dp = applyStimulantTransition(dp);
  }

  // 5. Apply scroll transitions (with pruning after each)
  for (const scroll of scrollSequence) {
    if (!scroll) continue;

    if (scroll.behavior_type === 'chaos') {
      dp = applyChaosScrollTransition(dp, scroll);
    } else {
      // Set success_rate on the scroll object for the transition
      if (!Number.isFinite(scroll.success_rate)) {
        scroll.success_rate = parseScrollSuccessRate(scroll.nameKo);
      }
      dp = applyFixedScrollTransition(dp, scroll);
    }

    // Prune after each scroll to control state explosion
    const pruned = pruneByProbability(dp, probabilityThreshold);
    dp = pruned.dp;

    if (dp.size > maxStateCount) {
      const beamed = beamPrune(dp, maxStateCount);
      dp = beamed.dp;
    }
  }

  // 6. Apply item level-up transitions
  if (useItemLevelUp) {
    const levelUpRanges = strategy.levelUpRanges;
    const levelUpCount = strategy.levelUpCount ?? 1;

    if (levelUpRanges && levelUpCount > 0) {
      for (let i = 0; i < levelUpCount; i++) {
        dp = applyLevelUpTransition(dp, levelUpRanges);
      }

      // Final prune after level-ups
      const pruned = pruneByProbability(dp, probabilityThreshold);
      dp = pruned.dp;
    }
  }

  // 7. Sum probabilities of states satisfying target conditions
  let totalProb = 0;
  for (const [, entry] of dp) {
    if (satisfiesTargets(entry.state, cleanStats, targetConditions)) {
      totalProb += entry.prob;
    }
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, totalProb));
}
