import { isRandomGem } from './makerModel.mjs';

/**
 * Counts the number of RNG (random) sources in a strategy.
 *
 * RNG sources include:
 * - Each random Maker gem (blackAmethyst, darkCrystal)
 * - Each chaos scroll (behavior_type === 'chaos')
 * - Item level-up (if useItemLevelUp is true)
 *
 * @param {{ makerChoices: Array<{ gemKey: string }>, scrollSequence: Array<object>, useItemLevelUp: boolean }} strategy
 * @returns {number}
 */
export function countRngSources(strategy) {
  const { makerChoices = [], scrollSequence = [], useItemLevelUp = false } = strategy || {};
  let count = 0;

  // Count random Maker gems
  for (const choice of makerChoices) {
    if (!choice || !choice.gemKey) continue;
    if (isRandomGem(choice.gemKey)) count++;
  }

  // Count chaos scrolls
  for (const scroll of scrollSequence) {
    if (scroll && scroll.behavior_type === 'chaos') count++;
  }

  // Count item level-up
  if (useItemLevelUp) count++;

  return count;
}

/**
 * Counts the total number of enhancement actions in a strategy.
 *
 * Actions include:
 * - Each Maker gem choice
 * - Each scroll in the scroll sequence
 * - Item level-up (if useItemLevelUp is true)
 *
 * @param {{ makerChoices: Array<*>, scrollSequence: Array<*>, useItemLevelUp: boolean }} strategy
 * @returns {number}
 */
export function countTotalActions(strategy) {
  const { makerChoices = [], scrollSequence = [], useItemLevelUp = false } = strategy || {};
  let count = 0;

  count += makerChoices.length;
  count += scrollSequence.length;
  if (useItemLevelUp) count++;

  return count;
}

/**
 * Comparator function for sorting strategies by multi-objective criteria.
 *
 * Sort order (first is best):
 * 1. Higher successProbability first (descending)
 * 2. Fewer rngSources first (ascending)
 * 3. Fewer totalActions first (ascending)
 * 4. Lower strategyIndex first (ascending -- deterministic tiebreak)
 *
 * @param {{ successProbability: number, rngSources: number, totalActions: number, strategyIndex: number }} a
 * @param {{ successProbability: number, rngSources: number, totalActions: number, strategyIndex: number }} b
 * @returns {number} Negative if a should sort before b, positive if b before a
 */
export function rankStrategies(a, b) {
  // 1. Higher probability first
  if (b.successProbability !== a.successProbability) {
    return b.successProbability - a.successProbability;
  }

  // 2. Fewer RNG sources first
  if (a.rngSources !== b.rngSources) {
    return a.rngSources - b.rngSources;
  }

  // 3. Fewer total actions first
  if (a.totalActions !== b.totalActions) {
    return a.totalActions - b.totalActions;
  }

  // 4. Lower strategyIndex first (deterministic tiebreak)
  return a.strategyIndex - b.strategyIndex;
}

/**
 * Selects the single best strategy from an array of scored strategies.
 *
 * Uses rankStrategies to sort and returns the first (best) entry.
 *
 * @param {Array<{ strategy: object, successProbability: number, rngSources: number, totalActions: number, strategyIndex: number }>} scoredStrategies
 * @returns {object|null} The best strategy object, or null if the array is empty
 */
export function optimizeStrategies(scoredStrategies) {
  if (!Array.isArray(scoredStrategies) || scoredStrategies.length === 0) {
    return null;
  }

  // Sort by rankStrategies comparator (best first)
  const sorted = [...scoredStrategies].sort(rankStrategies);

  // Return the full scored entry (the best strategy)
  return sorted[0];
}
