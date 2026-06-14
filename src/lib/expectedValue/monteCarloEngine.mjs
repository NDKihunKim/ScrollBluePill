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

/**
 * Computes attempt-count percentiles from a geometric distribution.
 * All values are rounded up (Math.ceil) to whole clean-item attempts.
 * @param {number} p - per-clean-item success probability [0, 1]
 * @returns {{ p50: number, p75: number, p90: number, p95: number }}
 */
export function computeGeometricPercentiles(p) {
  if (p >= 1.0) return { p50: 1, p75: 1, p90: 1, p95: 1 };
  if (p <= 0) return { p50: Infinity, p75: Infinity, p90: Infinity, p95: Infinity };
  const percentile = (q) => Math.ceil(Math.log(1 - q) / Math.log(1 - p));
  return {
    p50: percentile(0.50),
    p75: percentile(0.75),
    p90: percentile(0.90),
    p95: percentile(0.95),
  };
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
