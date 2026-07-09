/**
 * Canonical state vector representation for DP engine.
 *
 * States are stat-key → value maps. The canonical key is a pipe-delimited
 * string of "key:value" pairs in a fixed iteration order, which guarantees
 * identical keys for identical stat vectors regardless of construction history.
 *
 * Stats with value ≤ 0 or non-finite values are omitted from the key.
 */

/** Fixed iteration order for deterministic key generation. */
const STAT_KEY_ORDER = [
  'weaponAttack', 'magicAttack',
  'str', 'dex', 'int', 'luk',
  'maxHp', 'maxMp',
  'weaponDefense', 'magicDefense',
  'accuracy', 'avoidability',
  'speed', 'jump',
  'upgradeSlots', 'attackSpeed',
];

/**
 * Convert a stat vector to a canonical string key.
 *
 * Only stats with finite, positive values are included.
 * Keys are emitted in STAT_KEY_ORDER for determinism.
 *
 * @param {Record<string, number>} stats
 * @returns {string}
 */
export function canonicalize(stats) {
  if (!stats || typeof stats !== 'object') return '';

  const parts = [];
  for (const key of STAT_KEY_ORDER) {
    const value = stats[key];
    if (Number.isFinite(value) && value > 0) {
      parts.push(`${key}:${value}`);
    }
  }
  return parts.join('|');
}

/**
 * Parse a canonical key back into a stat vector object.
 *
 * @param {string} key - Canonical key produced by canonicalize()
 * @returns {Record<string, number>}
 */
export function parseStateKey(key) {
  if (!key || typeof key !== 'string') return {};

  const result = {};
  const segments = key.split('|');
  for (const segment of segments) {
    const colonIndex = segment.indexOf(':');
    if (colonIndex === -1) continue;
    const k = segment.slice(0, colonIndex);
    const v = Number(segment.slice(colonIndex + 1));
    if (Number.isFinite(v)) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Apply stat modifications encoded in a modKey to a base state.
 *
 * The modKey is a pipe-delimited string of "key:newValue" pairs representing
 * the NEW absolute value for each stat (not a delta). This is used to
 * reconstruct the full state after a per-stat expansion pass.
 *
 * @param {Record<string, number>} baseState - The base state object
 * @param {string} modKey - Modification key (may be empty string for no changes)
 * @returns {Record<string, number>} New state with modifications applied
 */
export function applyModifications(baseState, modKey) {
  if (!modKey) return { ...baseState };

  const result = { ...baseState };
  const segments = modKey.split('|');
  for (const segment of segments) {
    const colonIndex = segment.indexOf(':');
    if (colonIndex === -1) continue;
    const k = segment.slice(0, colonIndex);
    const v = Number(segment.slice(colonIndex + 1));
    if (Number.isFinite(v) && v > 0) {
      result[k] = v;
    } else {
      // Stat removed (value ≤ 0 after delta)
      delete result[k];
    }
  }
  return result;
}
