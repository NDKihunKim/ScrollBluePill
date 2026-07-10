/**
 * Geometric distribution math utilities.
 *
 * These functions model the number of independent Bernoulli trials
 * needed to achieve at least one success, given a per-trial success
 * probability p. All values are rounded up (Math.ceil) to whole
 * clean-item attempts.
 *
 * Previously this file also contained the Monte Carlo simulation runner.
 * That code has been removed in favor of the unified exact DP engine at
 * exactEngine.mjs. Only the geometric math layer remains here.
 */

export const GEOMETRIC_PERCENTILE_KEYS = ['p50', 'p75', 'p90', 'p95'];

/**
 * Computes attempt-count percentiles from a geometric distribution.
 * All values are rounded up (Math.ceil) to whole clean-item attempts.
 *
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
  return Math.ceil(Math.log(1 - q) / Math.log1p(-p));
}

/**
 * Computes expected number of clean-item attempts (geometric mean, rounded up).
 *
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
  return -Math.expm1(attempts * Math.log1p(-p));
}
