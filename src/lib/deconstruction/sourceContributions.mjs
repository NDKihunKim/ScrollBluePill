import { HP_MP_KEYS } from '../enhancementState.mjs';
import { GEM_GRADES, GEM_TYPES, isWeaponKind } from '../makerData.mjs';
import {
  BLACK_AMETHYST_TABLES,
  DARK_CRYSTAL_TABLES,
  getFixedGemStats,
  isFixedGem,
} from '../expectedValue/makerModel.mjs';
import { addVectors, projectVector, vectorKey } from './statVectors.mjs';

const WEAPON_ONLY_STIM_KEYS = new Set(['weaponAttack', 'magicAttack']);

export function solveStimulantResidual(residual, targetKeys, { isWeapon = true, bounds = null, cleanStats = null } = {}) {
  const stats = {};
  let hasNonZero = false;
  for (const key of targetKeys) {
    const value = residual[key] || 0;
    const baseLimit = HP_MP_KEYS.has(key) ? 50 : 5;
    const step = HP_MP_KEYS.has(key) ? 10 : 1;
    const boundRange = bounds?.[key];
    const boundMin = boundRange && Number.isFinite(boundRange.min)
      ? Math.max(-baseLimit, Math.min(baseLimit, boundRange.min))
      : -baseLimit;
    // Stimulant can only affect stats that exist on the clean item with a
    // positive base value — same rule as the stimulant bounds UI.
    const statExistsOnBase = cleanStats && Number.isFinite(cleanStats[key]) && cleanStats[key] > 0;
    if (!statExistsOnBase && value !== 0) return null;
    const effectiveMin = statExistsOnBase ? boundMin : 0;
    const effectiveMax = boundRange && Number.isFinite(boundRange.max)
      ? Math.max(-baseLimit, Math.min(baseLimit, boundRange.max))
      : baseLimit;
    // 촉진제 can only affect weaponAttack/magicAttack on weapons
    if (!isWeapon && WEAPON_ONLY_STIM_KEYS.has(key) && value !== 0) return null;
    if (value < effectiveMin || value > effectiveMax || value % step !== 0) return null;
    stats[key] = value;
    if (value !== 0) hasNonZero = true;
  }
  // Reject zero-only stimulants — they don't contribute anything meaningful
  if (!hasNonZero) return null;
  return stats;
}

/**
 * Enumerate possible stimulant stat vectors within the given bounds.
 *
 * Used to try stimulant as a primary contributor (before scrolls) so that
 * strategies combining stimulant + chaos scrolls are generated even when
 * chaos alone would otherwise cover the entire target.
 *
 * Caps enumeration at ~5000 combos; beyond that, samples 0/min/max per key.
 *
 * @param {object} opts
 * @param {string[]} opts.targetKeys
 * @param {object|null} opts.bounds - Per-key {min, max}
 * @param {object|null} opts.cleanStats - Clean item stats
 * @param {boolean} opts.isWeapon
 * @returns {Array<{stats: Record<string,number>}>}
 */
export function enumerateStimulantContributions({ targetKeys, bounds, cleanStats, isWeapon }) {
  const MAX_COMBOS = 5000;

  // Compute possible values for each target key
  const perKeyValues = {};
  let totalCombos = 1;
  let useSampling = false;

  for (const key of targetKeys) {
    const baseLimit = HP_MP_KEYS.has(key) ? 50 : 5;
    const step = HP_MP_KEYS.has(key) ? 10 : 1;
    const boundRange = bounds?.[key];

    const statExistsOnBase = cleanStats && Number.isFinite(cleanStats[key]) && cleanStats[key] > 0;
    if (!statExistsOnBase) {
      perKeyValues[key] = [0];
      continue;
    }

    if (!isWeapon && WEAPON_ONLY_STIM_KEYS.has(key)) {
      perKeyValues[key] = [0];
      continue;
    }

    const boundMin = boundRange && Number.isFinite(boundRange.min)
      ? Math.max(-baseLimit, Math.min(baseLimit, boundRange.min))
      : -baseLimit;
    const boundMax = boundRange && Number.isFinite(boundRange.max)
      ? Math.max(-baseLimit, Math.min(baseLimit, boundRange.max))
      : baseLimit;

    const count = Math.floor((boundMax - boundMin) / step) + 1;
    totalCombos *= Math.max(1, count);

    if (totalCombos > MAX_COMBOS) {
      useSampling = true;
    }

    const values = [];
    for (let v = boundMin; v <= boundMax; v += step) {
      values.push(v);
    }
    perKeyValues[key] = values;
  }

  // Sampling fallback when full enumeration is too large
  if (useSampling) {
    for (const key of targetKeys) {
      const allValues = perKeyValues[key];
      if (allValues.length <= 3) continue;
      const mid = Math.floor(allValues.length / 2);
      perKeyValues[key] = [allValues[0], allValues[mid], allValues[allValues.length - 1]];
    }
  }

  // Cartesian product (filtering out zero-only entries)
  const results = [];
  function visit(idx, current) {
    if (idx === targetKeys.length) {
      if (targetKeys.some((k) => current[k] !== 0)) {
        results.push({ stats: { ...current } });
      }
      return;
    }
    const key = targetKeys[idx];
    for (const value of perKeyValues[key]) {
      current[key] = value;
      visit(idx + 1, current);
    }
  }
  visit(0, Object.fromEntries(targetKeys.map((k) => [k, 0])));
  return results;
}

function enumerateRangeVectors(ranges, targetKeys) {
  const results = [];

  function visit(index, current) {
    if (index === targetKeys.length) {
      results.push({ ...current });
      return;
    }
    const key = targetKeys[index];
    const range = ranges[key] ?? { min: 0, max: 0 };
    for (let value = range.min; value <= range.max; value++) {
      current[key] = value;
      visit(index + 1, current);
    }
  }

  visit(0, {});
  return results;
}

function withinBounds(stats, bounds, targetKeys) {
  return targetKeys.every((key) => {
    const range = bounds[key] ?? { min: -Infinity, max: Infinity };
    return stats[key] >= range.min && stats[key] <= range.max;
  });
}

export function enumerateItemLevelContributions({
  levelUpDefinition,
  targetKeys,
  bounds,
  appliedLevelCount = 0,
  perSlotRanges = null,
  exactLevelCount = null,
  totalRanges = null,
}) {
  const maxLevelUps = levelUpDefinition?.maxLevelUps;
  if (!Number.isInteger(maxLevelUps) || maxLevelUps <= 0) return [];

  if (Number.isFinite(exactLevelCount)) {
    const levelCount = Math.max(0, Math.min(maxLevelUps, Math.trunc(exactLevelCount)));
    if (levelCount <= 0) return [];
    const ranges = {};
    for (const key of targetKeys) {
      const defRange = levelUpDefinition.statRanges?.[key] ?? { min: 0, max: 0 };
      const totalMin = defRange.min * levelCount;
      const totalMax = defRange.max * levelCount;
      const requested = totalRanges?.[key];
      ranges[key] = {
        min: requested && Number.isFinite(requested.min)
          ? Math.max(totalMin, Math.min(totalMax, requested.min))
          : totalMin,
        max: requested && Number.isFinite(requested.max)
          ? Math.max(totalMin, Math.min(totalMax, requested.max))
          : totalMax,
      };
      if (ranges[key].min > ranges[key].max) {
        ranges[key] = { min: ranges[key].max, max: ranges[key].min };
      }
    }
    return enumerateRangeVectors(ranges, targetKeys)
      .filter((stats) => withinBounds(stats, bounds, targetKeys))
      .map((stats) => ({ levelCount, stats }));
  }

  const remainingLevels = maxLevelUps - (Number.isFinite(appliedLevelCount) ? Math.max(0, Math.trunc(appliedLevelCount)) : 0);
  if (remainingLevels <= 0) return [];

  const defaultRanges = levelUpDefinition.statRanges ?? {};
  let previous = [{ stats: Object.fromEntries(targetKeys.map((key) => [key, 0])) }];

  for (let levelCount = 1; levelCount <= remainingLevels; levelCount++) {
    const seen = new Map();
    const slotIndex = levelCount - 1;
    const slotRanges = perSlotRanges?.[slotIndex];
    let effectiveRanges = defaultRanges;
    if (slotRanges) {
      effectiveRanges = {};
      for (const key of targetKeys) {
        const defRange = defaultRanges[key] ?? { min: 0, max: 0 };
        effectiveRanges[key] = {
          min: slotRanges[key] && Number.isFinite(slotRanges[key].min)
            ? Math.max(defRange.min, Math.min(defRange.max, slotRanges[key].min))
            : defRange.min,
          max: slotRanges[key] && Number.isFinite(slotRanges[key].max)
            ? Math.max(defRange.min, Math.min(defRange.max, slotRanges[key].max))
            : defRange.max,
        };
      }
    }
    const oneLevel = enumerateRangeVectors(effectiveRanges, targetKeys);
    for (const base of previous) {
      for (const outcome of oneLevel) {
        const stats = addVectors(base.stats, outcome, targetKeys);
        if (levelCount === remainingLevels && !withinBounds(stats, bounds, targetKeys)) continue;
        seen.set(vectorKey(stats, targetKeys), { levelCount, stats });
      }
    }
    previous = [...seen.values()].sort((left, right) =>
      vectorKey(left.stats, targetKeys).localeCompare(vectorKey(right.stats, targetKeys)),
    );
  }

  return previous;
}

// ---- Gem contribution helpers ----

const uniqueValues = (table) => [...new Set(table.map(({ value }) => value))].sort((a, b) => a - b);

function enumerateIndependentStats(keys, values) {
  const results = [];
  function visit(index, stats) {
    if (index === keys.length) return void results.push({ ...stats });
    for (const value of values) {
      stats[keys[index]] = value;
      visit(index + 1, stats);
    }
  }
  visit(0, {});
  return results;
}

function buildGemOutcomeOptions({ equipmentKind, cleanStats, targetKeys, gemFilter = null }) {
  const options = [];
  for (const gem of GEM_TYPES) {
    if (gem.weaponOnly && !isWeaponKind(equipmentKind)) continue;
    for (let gradeIndex = 0; gradeIndex < GEM_GRADES.length; gradeIndex++) {
      // Pre-filter: skip this gem+grade if not in the whitelist
      if (gemFilter && !gemFilter.has(`${gem.key}:${gradeIndex}`)) continue;
      if (isFixedGem(gem.key)) {
        const stats = projectVector(getFixedGemStats(gem.key, gradeIndex), targetKeys);
        // Skip gems that contribute nothing to any checked target key
        if (Object.values(stats).every((v) => v === 0)) continue;
        options.push({
          gemKey: gem.key,
          nameKo: gem.nameKo,
          gradeIndex,
          stats,
        });
        continue;
      }
      const gradeKey = ['low', 'mid', 'high'][gradeIndex];
      const table = gem.key === 'blackAmethyst'
        ? BLACK_AMETHYST_TABLES[gradeKey]
        : DARK_CRYSTAL_TABLES[gradeKey];
      const keys = gem.variableKeys.filter(
        (key) => targetKeys.includes(key) && Number.isFinite(cleanStats[key]),
      );
      // Skip this gem entirely when none of its variable keys overlap with target keys
      if (keys.length === 0) continue;
      for (const stats of enumerateIndependentStats(keys, uniqueValues(table))) {
        const projected = projectVector(stats, targetKeys);
        // Skip individual outcomes that add nothing to any checked target key
        if (Object.values(projected).every((v) => v === 0)) continue;
        options.push({ gemKey: gem.key, nameKo: gem.nameKo, gradeIndex, stats: projected });
      }
    }
  }
  return options;
}

function compareGemEntries(left, right) {
  const key = (entry) => entry.gems
    .map((gem) => `${gem.gemKey}:${gem.gradeIndex}:${JSON.stringify(gem.stats)}`)
    .sort()
    .join('|');
  return key(left).localeCompare(key(right));
}

export function enumerateGemContributions({
  gemSlotCount,
  equipmentKind,
  cleanStats,
  targetKeys,
  bounds,
  gemFilter = null,
}) {
  if (!Number.isInteger(gemSlotCount) || gemSlotCount <= 0) return [];
  const options = buildGemOutcomeOptions({ equipmentKind, cleanStats, targetKeys, gemFilter });
  const results = [];
  const seen = new Set();

  function visit(startIndex, gems, stats) {
    if (gems.length > 0 && withinBounds(stats, bounds, targetKeys)) {
      const key = `${gems.map((gem) => `${gem.gemKey}:${gem.gradeIndex}:${vectorKey(gem.stats, targetKeys)}`).sort().join('|')}::${vectorKey(stats, targetKeys)}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ gems: gems.map((gem) => ({ ...gem })), stats: { ...stats } });
      }
    }
    if (gems.length === gemSlotCount) return;
    for (let index = startIndex; index < options.length; index++) {
      const option = options[index];
      if (gems.some((gem) => gem.gemKey === option.gemKey)) continue;
      visit(index + 1, [...gems, option], addVectors(stats, option.stats, targetKeys));
    }
  }

  visit(0, [], Object.fromEntries(targetKeys.map((key) => [key, 0])));
  return results.sort(compareGemEntries);
}
