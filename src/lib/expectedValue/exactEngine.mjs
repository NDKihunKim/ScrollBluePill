import { parseScrollSuccessRate } from './scrollModel.mjs';
import { isFixedGem, isRandomGem, getFixedGemStats } from './makerModel.mjs';

/**
 * Determines whether a strategy is purely deterministic.
 *
 * A deterministic strategy has no random elements:
 * - No random Maker gems (blackAmethyst, darkCrystal)
 * - No chaos scrolls
 * - No item level-up
 *
 * @param {{ makerChoices: Array<{ gemKey: string, grade: number }>, scrollSequence: Array<object>, useItemLevelUp: boolean }} strategy
 * @returns {boolean}
 */
export function isDeterministicStrategy(strategy) {
  const { makerChoices = [], scrollSequence = [], useItemLevelUp = false, useStimulant = false } = strategy || {};

  // Item level-up is non-deterministic
  if (useItemLevelUp) return false;

  // Stimulant has 90% success rate and random chaos deltas
  if (useStimulant) return false;

  // Check scrolls for chaos behavior
  for (const scroll of scrollSequence) {
    if (scroll.behavior_type === 'chaos') return false;
  }

  // Check Maker choices for random gems
  for (const choice of makerChoices) {
    if (!choice || !choice.gemKey) continue;
    if (choice.stats && choice.mode !== 'probability') continue;
    if (isRandomGem(choice.gemKey)) return false;
  }

  return true;
}

/**
 * Computes the exact success probability for a deterministic strategy using DP.
 *
 * Algorithm:
 * 1. Apply fixed Maker stats to clean stats to get baseline state
 * 2. DP: iterate through scrolls, branching on success/failure
 * 3. Sum probabilities of final states that satisfy target conditions
 *
 * @param {{ makerChoices: Array<{ gemKey: string, grade: number }>, scrollSequence: Array<object>, useItemLevelUp: boolean }} strategy
 * @param {Record<string, number>} cleanStats - Base item stats
 * @param {{ statThresholds: Record<string, number>, gradeThreshold: number|null }} targetConditions
 * @returns {number} Probability 0-1
 */
export function computeExactProbability(strategy, cleanStats, targetConditions) {
  const { makerChoices = [], scrollSequence = [] } = strategy || {};

  // 1. Apply fixed Maker stats to clean stats to get baseline state
  const baseline = { ...cleanStats };

  for (const choice of makerChoices) {
    if (!choice || !choice.gemKey) continue;

    if (choice.stats && choice.mode !== 'probability') {
      for (const [key, value] of Object.entries(choice.stats)) {
        if (Number.isFinite(value)) {
          baseline[key] = (baseline[key] ?? 0) + value;
        }
      }
      continue;
    }

    if (!isFixedGem(choice.gemKey)) continue;

    const gemStats = getFixedGemStats(choice.gemKey, choice.grade);
    if (!gemStats) continue;

    for (const [key, value] of Object.entries(gemStats)) {
      if (Number.isFinite(value)) {
        baseline[key] = (baseline[key] ?? 0) + value;
      }
    }
  }

  // 2. DP: process each scroll
  // dp: Map<JSON-stringified state, probability>
  let dp = new Map();
  dp.set(JSON.stringify(baseline), 1.0);

  for (const scroll of scrollSequence) {
    const scrollName = scroll.nameKo;
    const scrollStats = scroll.stats || {};
    const successRate = parseScrollSuccessRate(scrollName);

    // If successRate is 0, the scroll can never succeed, so only the failure branch
    if (successRate <= 0) {
      const newDp = new Map();
      for (const [stateJson, prob] of dp) {
        const failureProb = prob;
        newDp.set(stateJson, (newDp.get(stateJson) ?? 0) + failureProb);
      }
      dp = newDp;
      continue;
    }

    const newDp = new Map();

    for (const [stateJson, prob] of dp) {
      if (prob <= 0) continue;

      const state = JSON.parse(stateJson);

      // Success branch: apply scroll stats
      const successState = { ...state };
      for (const [key, value] of Object.entries(scrollStats)) {
        if (Number.isFinite(value)) {
          successState[key] = (successState[key] ?? 0) + value;
        }
      }
      const successKey = JSON.stringify(successState);
      newDp.set(successKey, (newDp.get(successKey) ?? 0) + prob * successRate);

      // Failure branch: keep state unchanged (only if scroll can fail)
      if (successRate < 1.0) {
        const failureProb = prob * (1 - successRate);
        newDp.set(stateJson, (newDp.get(stateJson) ?? 0) + failureProb);
      }
    }

    dp = newDp;
  }

  // 4. Sum probabilities of states that satisfy target conditions
  let totalProb = 0;

  for (const [stateJson, prob] of dp) {
    if (prob <= 0) continue;

    const state = JSON.parse(stateJson);
    if (satisfiesTargets(state, cleanStats, targetConditions)) {
      totalProb += prob;
    }
  }

  // Clamp to [0, 1] to handle floating-point edge cases
  return Math.max(0, Math.min(1, totalProb));
}

/**
 * Check if an enhancement state satisfies all target conditions.
 *
 * @param {Record<string, number>} state - Enhanced state (after Maker + scrolls)
 * @param {Record<string, number>} cleanStats - Base clean item stats
 * @param {{ statThresholds: Record<string, number>, gradeThreshold: number|null }} targetConditions
 * @returns {boolean}
 */
export function satisfiesTargets(state, cleanStats, targetConditions) {
  const { statThresholds = {}, gradeThreshold } = targetConditions || {};

  // Check each stat threshold: gain >= threshold
  for (const [key, threshold] of Object.entries(statThresholds)) {
    const cleanVal = cleanStats && Number.isFinite(cleanStats[key]) ? cleanStats[key] : 0;
    const stateVal = state && Number.isFinite(state[key]) ? state[key] : 0;
    const gain = stateVal - cleanVal;

    if (gain < threshold) return false;
  }

  // gradeThreshold: skip for now (grade calculation needs item context not in scope yet)
  // Return true regardless

  return true;
}
