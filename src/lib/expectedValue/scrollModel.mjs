/** Matches a percent value (e.g. "10%", "100%") in scroll names */
export const SCROLL_PERCENT_PATTERN = /(\d+)%/;

/**
 * Parses the success rate from a scroll name.
 * Returns a float 0–1. Defaults to 1.0 (100%) if no percent suffix found.
 * @param {string} nameKo - the Korean scroll name (e.g. "공격력의 주문서 10%")
 * @returns {number} success rate 0–1
 */
export function parseScrollSuccessRate(nameKo) {
  if (nameKo == null || typeof nameKo !== 'string') {
    return 1.0;
  }

  const match = nameKo.match(SCROLL_PERCENT_PATTERN);

  if (!match) {
    return 1.0;
  }

  const percent = parseInt(match[1], 10);
  const rate = percent / 100;

  return Math.max(0, Math.min(1, rate));
}
