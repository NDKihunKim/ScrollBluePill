import { computeGeometricPercentiles, computeExpectedAttempts, computeAttemptsForPercentile } from './monteCarloEngine.mjs';

/** @type {Record<string, string>} */
const SUPERSCRIPT_MAP = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
};

/**
 * Converts a numeric string (with optional minus sign) to superscript Unicode chars.
 * @param {string|number} n
 * @returns {string}
 */
function toSuperscript(n) {
  return String(n)
    .split('')
    .map((ch) => SUPERSCRIPT_MAP[ch] || ch)
    .join('');
}

/**
 * Formats a probability value as a human-readable percentage string.
 *
 * - p >= 1.0 → "100.00%"
 * - p <= 0   → "0%"
 * - p * 100 >= 0.01 → "X.XX%"
 * - Otherwise → scientific notation, e.g. "1.00×10⁻³%"
 *
 * @param {number} p - Probability value in [0, 1]
 * @returns {string}
 */
export function formatProbability(p) {
  if (p >= 1.0) return '100.00%';
  if (p <= 0) return '0%';

  const pct = p * 100;

  if (pct >= 0.01) {
    return pct.toFixed(2) + '%';
  }

  // Scientific notation: pct < 0.01
  const exp = Math.floor(Math.log10(pct));
  const coeff = pct / Math.pow(10, exp);
  const formattedCoeff = coeff.toFixed(2);

  return `${formattedCoeff}×10${toSuperscript(exp)}%`;
}

/**
 * Creates a complete result summary for display, including chart data.
 *
 * All results are exact (no more Monte Carlo path), so isExact and
 * trialCount parameters have been removed.
 *
 * @param {object} params
 * @param {number} params.successProbability - The probability of success [0, 1]
 * @param {object} [params.bestStrategy] - Optional best strategy data
 * @returns {{ successProbability: number, probabilityLabel: string, expectedAttempts: number, percentiles: { p50: number, p75: number, p90: number, p95: number }, chartData: Array<{ percentile: number, attempts: number }>, bestStrategy: object | undefined }}
 */
export function createResultSummary({ successProbability, bestStrategy }) {
  const percentiles = computeGeometricPercentiles(successProbability);
  const expectedAttempts = computeExpectedAttempts(successProbability);
  const probabilityLabel = formatProbability(successProbability);

  // Generate inverse CDF chart data: percentile (X) → attempts (Y)
  const p95 = percentiles.p95;
  const maxAttempts = Number.isFinite(p95) ? Math.max(p95, 50) : 200;
  const chartData = [];

  for (let qPct = 0; qPct <= 99; qPct++) {
    const q = qPct / 100;
    const attempts = computeAttemptsForPercentile(successProbability, q);
    if (Number.isFinite(attempts) && attempts <= maxAttempts * 3) {
      chartData.push({ percentile: qPct, attempts });
    }
  }

  return {
    successProbability,
    probabilityLabel,
    expectedAttempts,
    percentiles,
    chartData,
    bestStrategy,
  };
}
