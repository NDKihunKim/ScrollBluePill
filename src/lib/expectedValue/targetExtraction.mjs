export const CORE_STAT_KEYS = new Set([
  'weaponAttack', 'magicAttack', 'str', 'dex', 'int', 'luk',
]);

export const ADVANCED_STAT_KEYS = new Set([
  'maxHp', 'maxMp', 'weaponDefense', 'magicDefense',
  'accuracy', 'avoidability', 'speed', 'jump',
]);

export const ALL_TARGET_STAT_KEYS = new Set([
  ...CORE_STAT_KEYS,
  ...ADVANCED_STAT_KEYS,
]);

/**
 * Compute enhancement gains from clean base stats to preview (enhanced) stats.
 * Only returns stats in ALL_TARGET_STAT_KEYS where previewTotal - cleanBase != 0.
 * Missing clean stats are treated as 0.
 *
 * @param {Record<string, number>} cleanStats - Clean base item stats
 * @param {Record<string, number>} previewStats - Enhanced preview item stats
 * @returns {Record<string, number>} Map of statKey to positive/negative gain
 */
export function computeEnhancementGains(cleanStats, previewStats) {
  const gains = {};

  for (const [key, previewValue] of Object.entries(previewStats)) {
    if (!ALL_TARGET_STAT_KEYS.has(key)) continue;
    if (!Number.isFinite(previewValue)) continue;

    const cleanValue = Number.isFinite(cleanStats[key]) ? cleanStats[key] : 0;
    const gain = previewValue - cleanValue;

    if (gain !== 0) {
      gains[key] = gain;
    }
  }

  return gains;
}

/**
 * Produce default checked-state map from computed gains.
 * Core stats are checked only when gain > 0.
 * Advanced stats are always unchecked.
 * Grade is unchecked by default.
 *
 * @param {Record<string, number>} gains - Enhancement gains from computeEnhancementGains
 * @returns {{ [statKey: string]: boolean, grade: boolean }}
 */
export function getDefaultCheckedStats(gains) {
  const checked = { grade: false };

  for (const key of ALL_TARGET_STAT_KEYS) {
    if (CORE_STAT_KEYS.has(key)) {
      checked[key] = (gains[key] ?? 0) > 0;
    } else {
      checked[key] = false;
    }
  }

  return checked;
}

/**
 * Extract target conditions (stat thresholds and grade threshold) from
 * enhancement context. Only includes stats that are both checked AND
 * have positive gain. Grade threshold is included only when grade is checked.
 *
 * @param {Record<string, number>} cleanStats - Clean base item stats
 * @param {Record<string, number>} previewStats - Enhanced preview item stats
 * @param {{ [statKey: string]: boolean, grade: boolean }} checkedStats - Which conditions are checked
 * @param {number|null} previewGradeClass - The grade class value of the preview item
 * @returns {{ statThresholds: Record<string, number>, gradeThreshold: number|null }}
 */
export function extractTargetConditions(cleanStats, previewStats, checkedStats, previewGradeClass) {
  const gains = computeEnhancementGains(cleanStats, previewStats);
  const statThresholds = {};

  for (const [key, gain] of Object.entries(gains)) {
    if (checkedStats[key] && gain > 0) {
      statThresholds[key] = gain;
    }
  }

  const gradeThreshold = checkedStats.grade ? previewGradeClass : null;

  return { statThresholds, gradeThreshold };
}
