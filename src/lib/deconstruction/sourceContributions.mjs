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

export function solveStimulantResidual(residual, targetKeys, { isWeapon = true } = {}) {
  const stats = {};
  let hasNonZero = false;
  for (const key of targetKeys) {
    const value = residual[key] || 0;
    const limit = HP_MP_KEYS.has(key) ? 50 : 5;
    const step = HP_MP_KEYS.has(key) ? 10 : 1;
    // 촉진제 can only affect weaponAttack/magicAttack on weapons
    if (!isWeapon && WEAPON_ONLY_STIM_KEYS.has(key) && value !== 0) return null;
    if (value < -limit || value > limit || value % step !== 0) return null;
    stats[key] = value;
    if (value !== 0) hasNonZero = true;
  }
  // Reject zero-only stimulants — they don't contribute anything meaningful
  if (!hasNonZero) return null;
  return stats;
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

export function enumerateItemLevelContributions({ levelUpDefinition, targetKeys, bounds }) {
  if (!Number.isInteger(levelUpDefinition?.maxLevelUps) || levelUpDefinition.maxLevelUps <= 0) return [];
  const oneLevel = enumerateRangeVectors(levelUpDefinition.statRanges ?? {}, targetKeys);
  const results = [];
  let previous = [{ stats: Object.fromEntries(targetKeys.map((key) => [key, 0])) }];

  for (let levelCount = 1; levelCount <= levelUpDefinition.maxLevelUps; levelCount++) {
    const seen = new Map();
    for (const base of previous) {
      for (const outcome of oneLevel) {
        const stats = addVectors(base.stats, outcome, targetKeys);
        if (!withinBounds(stats, bounds, targetKeys)) continue;
        seen.set(vectorKey(stats, targetKeys), { levelCount, stats });
      }
    }
    previous = [...seen.values()].sort((a, b) =>
      vectorKey(a.stats, targetKeys).localeCompare(vectorKey(b.stats, targetKeys)),
    );
    results.push(...previous);
  }
  return results;
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

function buildGemOutcomeOptions({ equipmentKind, cleanStats, targetKeys }) {
  const options = [];
  for (const gem of GEM_TYPES) {
    if (gem.weaponOnly && !isWeaponKind(equipmentKind)) continue;
    for (let gradeIndex = 0; gradeIndex < GEM_GRADES.length; gradeIndex++) {
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
}) {
  if (!Number.isInteger(gemSlotCount) || gemSlotCount <= 0) return [];
  const options = buildGemOutcomeOptions({ equipmentKind, cleanStats, targetKeys });
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
