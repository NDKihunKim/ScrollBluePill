/**
 * Formats a number using Korean large-number units (만, 억, 조, 경, 해).
 *
 * Rules:
 *   < 10,000       → raw number with commas (e.g. "9,999", "0")
 *   1만 ~ 9,999만   → X.XX만  (e.g. "12.69만", "500만", "1.2만")
 *   1억 ~ 9,999억   → X.XX억  (e.g. "12.69억", "500억")
 *   1조 ~ 9,999조   → X.XX조
 *   1경 ~ 9,999경   → X.XX경
 *   ≥ 1해          → X.XX해
 *
 * Decimals: up to 2 decimal places, trailing zeros stripped.
 *   "12.60억" → "12.6억"
 *   "12.00억" → "12억"
 *
 * Unlike English compact units (k/m/b), Korean units represent powers
 * of 10,000 rather than 1,000, which makes them more natural for
 * Korean users reading large numbers.
 *
 * @param {number} value - The number to format
 * @returns {string} Korean-unit-formatted string
 */
export function formatKoreanNumber(value) {
  if (!Number.isFinite(value)) return '0';
  if (value === 0) return '0';

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs < 10_000) {
    return sign + abs.toLocaleString('en-US');
  }

  if (abs < 100_000_000) {
    // 만 range: 10,000 ~ 99,999,999
    const man = abs / 10_000;
    return sign + stripTrailingZeros(man.toFixed(2)) + '만';
  }

  if (abs < 1_000_000_000_000) {
    // 억 range: 100,000,000 ~ 999,999,999,999
    const eok = abs / 100_000_000;
    return sign + stripTrailingZeros(eok.toFixed(2)) + '억';
  }

  if (abs < 10_000_000_000_000_000) {
    // 조 range: 1,000,000,000,000 ~ 9,999,999,999,999,999
    const jo = abs / 1_000_000_000_000;
    return sign + stripTrailingZeros(jo.toFixed(2)) + '조';
  }

  if (abs < 100_000_000_000_000_000_000) {
    // 경 range: 10,000,000,000,000,000 ~ 99,999,999,999,999,999,999
    const gyeong = abs / 10_000_000_000_000_000;
    return sign + stripTrailingZeros(gyeong.toFixed(2)) + '경';
  }

  // 해 range: ≥ 100,000,000,000,000,000,000
  const hae = abs / 100_000_000_000_000_000_000;
  return sign + stripTrailingZeros(hae.toFixed(2)) + '해';
}

/**
 * Strips trailing zeros after the decimal point, then the decimal
 * point itself if the result is a whole number.
 *
 * "12.60" → "12.6"
 * "12.00" → "12"
 * "12.34" → "12.34"
 *
 * @param {string} formatted - A number string from toFixed(2)
 * @returns {string}
 */
function stripTrailingZeros(formatted) {
  return formatted.replace(/\.?0+$/, '');
}

/**
 * Parses a Korean-unit-formatted string back to a raw number.
 * Inverse of formatKoreanNumber.
 *
 * Handles:
 *   "12.69억"  → 1_269_000_000
 *   "500만"    → 5_000_000
 *   "1.2만"    → 12_000
 *   "5,000"    → 5_000
 *   "0"        → 0
 *
 * Unit multipliers: 만 = 10⁴, 억 = 10⁸, 조 = 10¹², 경 = 10¹⁶, 해 = 10²⁰.
 * Commas, spaces, and the 회 suffix are stripped before parsing.
 *
 * @param {string} formatted - A Korean-unit string or raw numeric string
 * @returns {number} The parsed number, or NaN if unparseable
 */
export function parseKoreanNumber(formatted) {
  if (typeof formatted !== 'string') return NaN;

  // Strip the 회 suffix and whitespace
  let s = formatted.replace(/회/g, '').trim();
  if (s === '' || s === '0') return 0;

  // Remove commas
  s = s.replace(/,/g, '');

  // Try unit-based parsing first
  const unitPattern = /^(-?[\d.]+)\s*(만|억|조|경|해)$/;
  const unitMatch = s.match(unitPattern);
  if (unitMatch) {
    const numPart = parseFloat(unitMatch[1]);
    if (!Number.isFinite(numPart)) return NaN;
    const unit = unitMatch[2];
    if (unit === '만') return numPart * 10_000;
    if (unit === '억') return numPart * 100_000_000;
    if (unit === '조') return numPart * 1_000_000_000_000;
    if (unit === '경') return numPart * 10_000_000_000_000_000;
    if (unit === '해') return numPart * 100_000_000_000_000_000_000;
  }

  // Fallback: plain numeric string
  const plain = parseFloat(s);
  if (Number.isFinite(plain)) return plain;

  return NaN;
}
