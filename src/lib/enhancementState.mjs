import {
  createScrollState as _createScrollState,
  applyScroll as _applyScroll,
  revertToSlot as _revertToSlot,
  resetState as _resetScrollState,
  computeAppliedScrollCount as _scrollAppliedCount,
  computeRemainingSlots as _scrollRemainingSlots,
} from './scrollState.mjs';
import { computeGemSlotCount, getGemTypeByKey } from './makerData.mjs';

export const HP_MP_KEYS = new Set(['maxHp', 'maxMp']);
export const MATERIAL_MODE_MANUAL = 'manual';
export const MATERIAL_MODE_PROBABILITY = 'probability';

function normalizeMaterialMode(mode) {
  return mode === MATERIAL_MODE_PROBABILITY ? MATERIAL_MODE_PROBABILITY : MATERIAL_MODE_MANUAL;
}

export function createItemLevelUpSlots(levelUpDefinition = null) {
  const slotCount = Number.isInteger(levelUpDefinition?.maxLevelUps)
    ? levelUpDefinition.maxLevelUps
    : 0;
  return new Array(slotCount).fill(null);
}

export function createEnhancementState(
  upgradeSlots,
  requiredLevel,
  levelUpDefinition = null,
  requiredJobs = [],
) {
  const scrollState = _createScrollState(upgradeSlots);
  const gemSlotCount = computeGemSlotCount(requiredLevel, requiredJobs);
  const gemSlots = new Array(gemSlotCount).fill(null);
  const makerActive = false;
  const stimulantSlot = null;
  const itemLevelUpSlots = createItemLevelUpSlots(levelUpDefinition);
  const itemLevelUpSlotCount = itemLevelUpSlots.length;

  return {
    scrollState,
    gemSlots,
    gemSlotCount,
    makerActive,
    stimulantSlot,
    itemLevelUpSlots,
    itemLevelUpSlotCount,
    itemLevelUpMode: MATERIAL_MODE_MANUAL,
    itemLevelUpAggregate: null,
  };
}

export function activateMaker(state) {
  state.makerActive = true;
}

export function deactivateMaker(state) {
  state.makerActive = false;
  for (let i = 0; i < state.gemSlots.length; i++) {
    state.gemSlots[i] = null;
  }
  clearStimulant(state);
}

export function applyStimulant(state, stats, mode = MATERIAL_MODE_MANUAL) {
  if (!stats || typeof stats !== 'object') {
    return false;
  }

  const normalizedStats = {};
  for (const [key, value] of Object.entries(stats)) {
    if (Number.isFinite(value)) {
      normalizedStats[key] = value;
    }
  }

  state.stimulantSlot = {
    stats: normalizedStats,
    mode: normalizeMaterialMode(mode),
  };
  return true;
}

export function clearStimulant(state) {
  state.stimulantSlot = null;
}

export function applyItemLevelUp(state, slotIndex, stats) {
  if (slotIndex < 0 || slotIndex >= state.itemLevelUpSlotCount) {
    return false;
  }

  const normalizedStats = {};
  for (const [key, value] of Object.entries(stats ?? {})) {
    if (Number.isFinite(value)) {
      normalizedStats[key] = value;
    }
  }

  state.itemLevelUpSlots[slotIndex] = { stats: normalizedStats };
  // Manual edits pin per-slot stats — the transferred aggregate semantics
  // (probability over all roll combinations) no longer apply.
  state.itemLevelUpAggregate = null;
  return true;
}

export function applyItemLevelUpMode(state, mode) {
  state.itemLevelUpMode = normalizeMaterialMode(mode);
}

export function clearItemLevelUpSlot(state, slotIndex) {
  if (slotIndex < 0 || slotIndex >= state.itemLevelUpSlotCount) {
    return;
  }
  state.itemLevelUpSlots[slotIndex] = null;
  state.itemLevelUpAggregate = null;
}

export function resetItemLevelUps(state) {
  for (let i = 0; i < state.itemLevelUpSlots.length; i++) {
    state.itemLevelUpSlots[i] = null;
  }
  state.itemLevelUpAggregate = null;
}

export function computeItemLevelUpCardMeta(state, levelUpDefinition = null) {
  const maxLevelUps = Number.isInteger(levelUpDefinition?.maxLevelUps)
    ? levelUpDefinition.maxLevelUps
    : 0;
  if (!state || maxLevelUps <= 0) {
    return null;
  }

  const filledCount = (state.itemLevelUpSlots ?? []).filter((slot) => slot !== null).length;
  const isMax = filledCount >= maxLevelUps;

  return {
    itemLevel: isMax ? 'MAX' : String(filledCount + 1),
    itemExp: isMax ? 'MAX' : '0 %',
  };
}

export function applyGem(state, slotIndex, gemKey, gradeIndex) {
  if (slotIndex < 0 || slotIndex >= state.gemSlotCount) {
    return false;
  }

  for (let i = 0; i < state.gemSlots.length; i++) {
    if (i !== slotIndex && state.gemSlots[i]?.gemKey === gemKey) {
      return false;
    }
  }

  state.gemSlots[slotIndex] = { gemKey, gradeIndex };
  return true;
}

export function applyVariableGem(
  state,
  slotIndex,
  gemKey,
  stats,
  mode = MATERIAL_MODE_MANUAL,
  gradeIndex = 0,
) {
  if (slotIndex < 0 || slotIndex >= state.gemSlotCount) {
    return false;
  }

  for (let i = 0; i < state.gemSlots.length; i++) {
    if (i !== slotIndex && state.gemSlots[i]?.gemKey === gemKey) {
      return false;
    }
  }

  const gem = getGemTypeByKey(gemKey);
  if (!gem || gem.behavior !== 'variable') {
    return false;
  }

  const normalizedStats = {};
  for (const [key, value] of Object.entries(stats ?? {})) {
    if (Number.isFinite(value)) {
      normalizedStats[key] = value;
    }
  }

  state.gemSlots[slotIndex] = {
    gemKey,
    stats: normalizedStats,
    mode: normalizeMaterialMode(mode),
    gradeIndex,
  };
  return true;
}

export function revertGemSlot(state, slotIndex) {
  if (slotIndex < 0 || slotIndex >= state.gemSlotCount) {
    return;
  }
  state.gemSlots[slotIndex] = null;
}

export function resetGems(state) {
  for (let i = 0; i < state.gemSlots.length; i++) {
    state.gemSlots[i] = null;
  }
  clearStimulant(state);
}

export function isGemSlotAvailable(state, gemKey) {
  for (let i = 0; i < state.gemSlots.length; i++) {
    if (state.gemSlots[i]?.gemKey === gemKey) {
      return false;
    }
  }
  return true;
}

export function computeAccumulatedStats(baseStats, state) {
  const accumulated = {};

  if (baseStats) {
    for (const [key, value] of Object.entries(baseStats)) {
      if (Number.isFinite(value)) {
        accumulated[key] = value;
      }
    }
  }

  const { scrollState } = state;

  for (let i = 0; i < scrollState.slotCount; i++) {
    const scroll = scrollState.slots[i];
    if (!scroll?.stats) continue;

    for (const [key, value] of Object.entries(scroll.stats)) {
      if (Number.isFinite(value)) {
        accumulated[key] = (accumulated[key] ?? 0) + value;
      }
    }
  }

  for (let i = 0; i < state.gemSlots.length; i++) {
    const gemSlot = state.gemSlots[i];
    if (!gemSlot) continue;

    const gem = getGemTypeByKey(gemSlot.gemKey);
    if (!gem) continue;

    if (gem.behavior === 'variable') {
      for (const [key, value] of Object.entries(gemSlot.stats ?? {})) {
        if (Number.isFinite(value)) {
          accumulated[key] = (accumulated[key] ?? 0) + value;
        }
      }
    } else {
      const statKey = gem.stat;
      const value = gem.values[gemSlot.gradeIndex];
      if (statKey && Number.isFinite(value)) {
        accumulated[statKey] = (accumulated[statKey] ?? 0) + value;
      }
    }
  }

  if (state.stimulantSlot?.stats) {
    for (const [key, value] of Object.entries(state.stimulantSlot.stats)) {
      if (Number.isFinite(value)) {
        accumulated[key] = (accumulated[key] ?? 0) + value;
      }
    }
  }

  for (const slot of state.itemLevelUpSlots ?? []) {
    if (!slot?.stats) continue;
    for (const [key, value] of Object.entries(slot.stats)) {
      if (Number.isFinite(value)) {
        accumulated[key] = (accumulated[key] ?? 0) + value;
      }
    }
  }

  return accumulated;
}

export function computeStatBreakdown(baseStats, state) {
  const breakdown = {};

  const ensureEntry = (key) => {
    if (!breakdown[key]) {
      breakdown[key] = { original: 0, maker: 0, scroll: 0, total: 0 };
    }
    return breakdown[key];
  };

  if (baseStats) {
    for (const [key, value] of Object.entries(baseStats)) {
      if (!Number.isFinite(value)) continue;
      const entry = ensureEntry(key);
      entry.original += value;
      entry.total += value;
    }
  }

  const { scrollState } = state;

  for (let i = 0; i < scrollState.slotCount; i++) {
    const scroll = scrollState.slots[i];
    if (!scroll?.stats) continue;

    for (const [key, value] of Object.entries(scroll.stats)) {
      if (!Number.isFinite(value)) continue;
      const entry = ensureEntry(key);
      entry.scroll += value;
      entry.total += value;
    }
  }

  for (let i = 0; i < state.gemSlots.length; i++) {
    const gemSlot = state.gemSlots[i];
    if (!gemSlot) continue;

    const gem = getGemTypeByKey(gemSlot.gemKey);
    if (!gem) continue;

    if (gem.behavior === 'variable') {
      for (const [key, value] of Object.entries(gemSlot.stats ?? {})) {
        if (!Number.isFinite(value)) continue;
        const entry = ensureEntry(key);
        entry.maker += value;
        entry.total += value;
      }
    } else {
      const statKey = gem.stat;
      const value = gem.values[gemSlot.gradeIndex];
      if (!statKey || !Number.isFinite(value)) continue;

      const entry = ensureEntry(statKey);
      entry.maker += value;
      entry.total += value;
    }
  }

  if (state.stimulantSlot?.stats) {
    for (const [key, value] of Object.entries(state.stimulantSlot.stats)) {
      if (!Number.isFinite(value)) continue;
      const entry = ensureEntry(key);
      entry.maker += value;
      entry.total += value;
    }
  }

  for (const slot of state.itemLevelUpSlots ?? []) {
    if (!slot?.stats) continue;
    for (const [key, value] of Object.entries(slot.stats)) {
      if (!Number.isFinite(value)) continue;
      const entry = ensureEntry(key);
      entry.maker += value;
      entry.total += value;
    }
  }

  return breakdown;
}

export function computeGradeColor(state) {
  let totalAddedConstants = 0;

  const { scrollState } = state;

  for (let i = 0; i < scrollState.slotCount; i++) {
    const scroll = scrollState.slots[i];
    if (!scroll?.stats) continue;

    for (const [key, value] of Object.entries(scroll.stats)) {
      if (!Number.isFinite(value)) continue;

      if (HP_MP_KEYS.has(key)) {
        totalAddedConstants += Math.round(value / 10);
      } else {
        totalAddedConstants += value;
      }
    }
  }

  for (let i = 0; i < state.gemSlots.length; i++) {
    const gemSlot = state.gemSlots[i];
    if (!gemSlot) continue;

    const gem = getGemTypeByKey(gemSlot.gemKey);
    if (!gem) continue;

    if (gem.behavior === 'variable') {
      for (const [key, value] of Object.entries(gemSlot.stats ?? {})) {
        if (!Number.isFinite(value)) continue;

        if (HP_MP_KEYS.has(key)) {
          totalAddedConstants += Math.round(value / 10);
        } else {
          totalAddedConstants += value;
        }
      }
    } else {
      const value = gem.values[gemSlot.gradeIndex];
      if (!Number.isFinite(value)) continue;

      if (HP_MP_KEYS.has(gem.stat)) {
        totalAddedConstants += Math.round(value / 10);
      } else {
        totalAddedConstants += value;
      }
    }
  }

  if (state.stimulantSlot?.stats) {
    for (const [key, value] of Object.entries(state.stimulantSlot.stats)) {
      if (!Number.isFinite(value)) continue;

      if (HP_MP_KEYS.has(key)) {
        totalAddedConstants += Math.round(value / 10);
      } else {
        totalAddedConstants += value;
      }
    }
  }

  for (const slot of state.itemLevelUpSlots ?? []) {
    if (!slot?.stats) continue;
    for (const [key, value] of Object.entries(slot.stats)) {
      if (!Number.isFinite(value)) continue;
      if (HP_MP_KEYS.has(key)) {
        totalAddedConstants += Math.round(value / 10);
      } else {
        totalAddedConstants += value;
      }
    }
  }

  if (totalAddedConstants < 0) return '#9e9e9e';
  if (totalAddedConstants === 0) return '#ffffff';
  if (totalAddedConstants <= 5) return '#ff8c00';
  if (totalAddedConstants <= 22) return '#3366ff';
  if (totalAddedConstants <= 39) return '#9933ff';
  if (totalAddedConstants <= 56) return '#ffd700';
  if (totalAddedConstants <= 73) return '#33cc33';
  return '#ff3333';
}

// Re-export scroll helpers (delegate to inner scrollState)

export function applyScroll(state, scroll) {
  return _applyScroll(state.scrollState, scroll);
}

export function revertToSlot(state, slotIndex) {
  _revertToSlot(state.scrollState, slotIndex);
}

export function resetState(state) {
  _resetScrollState(state.scrollState);
  resetGems(state);
  deactivateMaker(state);
  resetItemLevelUps(state);
}

export function computeAppliedScrollCount(state) {
  return _scrollAppliedCount(state.scrollState);
}

export function computeRemainingSlots(state) {
  return _scrollRemainingSlots(state.scrollState);
}
