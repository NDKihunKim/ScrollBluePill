import { applyChaosToStats, CHAOS_SUCCESS_RATE } from './chaosModel.mjs';
import { satisfiesTargets } from './exactEngine.mjs';
import { computeGemContribution } from './makerModel.mjs';
import { parseScrollSuccessRate } from './scrollModel.mjs';

/**
 * Creates a deterministic pseudorandom number generator using Mulberry32.
 *
 * @param {number} seed - A 32-bit integer seed
 * @returns {() => number} A function that returns uniform [0, 1) values
 */
export function createSeededRng(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a random 32-bit seed.
 * Uses crypto.getRandomValues in browser environments,
 * falls back to Math.random elsewhere.
 *
 * @returns {number} A 32-bit unsigned integer
 */
export function createRandomSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0];
  }
  return (Math.random() * 4294967296) | 0;
}

/** Default trial count for Monte Carlo simulations */
export const DEFAULT_TRIAL_COUNT = 100000;

export const GEOMETRIC_PERCENTILE_KEYS = ['p50', 'p75', 'p90', 'p95'];

/**
 * Runs a Monte Carlo simulation with seeded RNG.
 * @param {(rng: () => number) => boolean} simulateOneTrial
 * @param {number} trialCount
 * @param {number} seed
 * @returns {{ successCount: number, totalTrials: number, isZeroSuccess: boolean }}
 */
export function runMonteCarloSimulation(simulateOneTrial, trialCount, seed) {
  const rng = createSeededRng(seed);
  let successCount = 0;
  for (let i = 0; i < trialCount; i++) {
    if (simulateOneTrial(rng)) {
      successCount++;
    }
  }
  return {
    successCount,
    totalTrials: trialCount,
    isZeroSuccess: successCount === 0,
  };
}

function addStats(target, stats) {
  for (const [key, value] of Object.entries(stats ?? {})) {
    if (Number.isFinite(value)) {
      target[key] = (target[key] ?? 0) + value;
    }
  }
}

function inferMakerChoiceGrade(choice) {
  if (Number.isInteger(choice?.grade)) return choice.grade;

  if (choice?.gemKey === 'blackAmethyst') {
    const maxAbsValue = Math.max(
      0,
      ...Object.values(choice.stats ?? {})
        .filter(Number.isFinite)
        .map((value) => Math.abs(value)),
    );
    if (maxAbsValue >= 3) return 2;
    if (maxAbsValue === 2) return 1;
    return 0;
  }

  return 0;
}

function isChaosScroll(scroll) {
  return scroll?.behavior_type === 'chaos' || scroll?.behaviorType === 'chaos';
}

function getScrollSuccessRate(scroll) {
  const name = scroll?.nameKo ?? '';
  if (isChaosScroll(scroll) && !/%/.test(name)) {
    return CHAOS_SUCCESS_RATE;
  }
  return parseScrollSuccessRate(name);
}

function simulateStrategyTrial(strategy, cleanStats, targetConditions, rng) {
  const { makerChoices = [], scrollSequence = [] } = strategy || {};
  const state = { ...cleanStats };

  for (const choice of makerChoices) {
    if (!choice?.gemKey) continue;

    const gemStats = computeGemContribution(
      choice.gemKey,
      inferMakerChoiceGrade(choice),
      cleanStats,
      rng,
    );
    addStats(state, gemStats);
  }

  for (const scroll of scrollSequence) {
    if (!scroll) continue;
    if (rng() >= getScrollSuccessRate(scroll)) continue;

    if (isChaosScroll(scroll)) {
      const chaosState = applyChaosToStats(state, rng);
      for (const [key, value] of Object.entries(chaosState)) {
        state[key] = value;
      }
    } else {
      addStats(state, scroll.stats);
    }
  }

  return satisfiesTargets(state, cleanStats, targetConditions);
}

/**
 * Runs a seeded Monte Carlo simulation for a full enhancement strategy.
 *
 * This wraps the lower-level trial-function runner used by tests and callers
 * that already provide their own trial function.
 *
 * @param {{ makerChoices: Array<object>, scrollSequence: Array<object>, useItemLevelUp: boolean }} strategy
 * @param {Record<string, number>} cleanStats
 * @param {{ statThresholds: Record<string, number>, gradeThreshold: number|null }} targetConditions
 * @param {number} trialCount
 * @param {number} seed
 * @returns {{ successCount: number, totalTrials: number, isZeroSuccess: boolean, successProbability: number }}
 */
export function runStrategyMonteCarloSimulation(strategy, cleanStats, targetConditions, trialCount, seed) {
  const result = runMonteCarloSimulation(
    (rng) => simulateStrategyTrial(strategy, cleanStats, targetConditions, rng),
    trialCount,
    seed,
  );

  return {
    ...result,
    successProbability: result.totalTrials > 0 ? result.successCount / result.totalTrials : 0,
  };
}

/**
 * Computes attempt-count percentiles from a geometric distribution.
 * All values are rounded up (Math.ceil) to whole clean-item attempts.
 * @param {number} p - per-clean-item success probability [0, 1]
 * @returns {{ p50: number, p75: number, p90: number, p95: number }}
 */
export function computeGeometricPercentiles(p) {
  if (p >= 1.0) return { p50: 1, p75: 1, p90: 1, p95: 1 };
  if (p <= 0) return { p50: Infinity, p75: Infinity, p90: Infinity, p95: Infinity };
  return {
    p50: computeAttemptsForPercentile(p, 0.50),
    p75: computeAttemptsForPercentile(p, 0.75),
    p90: computeAttemptsForPercentile(p, 0.90),
    p95: computeAttemptsForPercentile(p, 0.95),
  };
}

/**
 * Returns the number of clean-item attempts needed to reach at least the given
 * cumulative probability q (inverse geometric CDF, rounded up).
 *
 * @param {number} p - Per-trial success probability [0, 1]
 * @param {number} q - Target cumulative probability [0, 1)
 * @returns {number} Attempts needed (Infinity when p <= 0)
 */
export function computeAttemptsForPercentile(p, q) {
  if (p >= 1.0) return 1;
  if (p <= 0) return Infinity;
  if (q <= 0) return 0;
  return Math.ceil(Math.log(1 - q) / Math.log(1 - p));
}

/**
 * Computes expected number of clean-item attempts (geometric mean, rounded up).
 * @param {number} p - per-clean-item success probability [0, 1]
 * @returns {number}
 */
export function computeExpectedAttempts(p) {
  if (p >= 1.0) return 1;
  if (p <= 0) return Infinity;
  return Math.ceil(1 / p);
}

/**
 * Computes the cumulative probability of at least one success in n independent
 * trials given a per-trial success probability p.
 *
 * P(X ≥ 1) = 1 − (1 − p)^n
 *
 * @param {number} p - Per-trial success probability [0, 1]
 * @param {number} n - Number of attempts (clamped to ≥ 0)
 * @returns {number} Cumulative probability [0, 1]
 */
export function computeCumulativeProbability(p, n) {
  if (p >= 1.0) return 1;
  if (p <= 0) return 0;
  const attempts = Math.max(0, Math.round(n));
  if (attempts <= 0) return 0;
  return 1 - Math.pow(1 - p, attempts);
}
