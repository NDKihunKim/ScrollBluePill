import { computeGeometricPercentiles, computeExpectedAttempts } from './monteCarloEngine.mjs';

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
 * Formats a label describing how the calculation was performed.
 *
 * @param {boolean} isExact - Whether the result is from exact computation
 * @param {number} trialCount - Number of simulation trials (ignored when isExact)
 * @returns {string}
 */
export function formatCalculationLabel(isExact, trialCount) {
  if (isExact) return '정확 계산';
  return `시뮬레이션 추정 · ${trialCount.toLocaleString('en-US')}회`;
}

/**
 * Checks whether a previously computed result is stale based on trial count.
 *
 * @param {number} resultTrialCount - Trial count used when the result was computed
 * @param {number} currentTrialCount - Current trial count setting
 * @returns {boolean}
 */
export function isResultStale(resultTrialCount, currentTrialCount) {
  return resultTrialCount !== currentTrialCount;
}

/**
 * Creates a complete result summary for display, including chart data.
 *
 * @param {object} params
 * @param {number} params.successProbability - The probability of success [0, 1]
 * @param {boolean} params.isExact - Whether this is an exact computation
 * @param {number} params.trialCount - Number of simulation trials
 * @param {object} [params.bestStrategy] - Optional best strategy data
 * @returns {{ successProbability: number, probabilityLabel: string, calculationLabel: string, isExact: boolean, trialCount: number, expectedAttempts: number, percentiles: { p50: number, p75: number, p90: number, p95: number }, chartData: Array<{ attempt: number, probability: number }>, bestStrategy: object | undefined }}
 */
export function createResultSummary({ successProbability, isExact, trialCount, bestStrategy }) {
  const percentiles = computeGeometricPercentiles(successProbability);
  const expectedAttempts = computeExpectedAttempts(successProbability);
  const probabilityLabel = formatProbability(successProbability);
  const calculationLabel = formatCalculationLabel(isExact, trialCount);

  // Generate chart data: PMF of the geometric distribution
  // up to p95 (capped at 200 data points)
  const p95 = percentiles.p95;
  const maxAttempts = Math.min(p95, 200);
  const chartData = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const probability =
      successProbability * Math.pow(1 - successProbability, attempt - 1);
    chartData.push({ attempt, probability });
  }

  return {
    successProbability,
    probabilityLabel,
    calculationLabel,
    isExact,
    trialCount,
    expectedAttempts,
    percentiles,
    chartData,
    bestStrategy,
  };
}
