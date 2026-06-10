import {
  createScrollState as _createScrollState,
  applyScroll as _applyScroll,
  revertToSlot as _revertToSlot,
  resetState as _resetScrollState,
  computeAppliedScrollCount as _scrollAppliedCount,
  computeRemainingSlots as _scrollRemainingSlots,
} from './scrollState.mjs';
import { computeGemSlotCount, getGemTypeByKey } from './makerData.mjs';

const HP_MP_KEYS = new Set(['maxHp', 'maxMp']);

export function createEnhancementState(upgradeSlots, requiredLevel) {
  const scrollState = _createScrollState(upgradeSlots);
  const gemSlotCount = computeGemSlotCount(requiredLevel);
  const gemSlots = new Array(gemSlotCount).fill(null);
  const makerActive = false;

  return { scrollState, gemSlots, gemSlotCount, makerActive };
}

export function activateMaker(state) {
  state.makerActive = true;
}

export function deactivateMaker(state) {
  state.makerActive = false;
  for (let i = 0; i < state.gemSlots.length; i++) {
    state.gemSlots[i] = null;
  }
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

    const statKey = gem.stat;
    const value = gem.values[gemSlot.gradeIndex];
    if (statKey && Number.isFinite(value)) {
      accumulated[statKey] = (accumulated[statKey] ?? 0) + value;
    }
  }

  return accumulated;
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

    const value = gem.values[gemSlot.gradeIndex];
    if (!Number.isFinite(value)) continue;

    if (HP_MP_KEYS.has(gem.stat)) {
      totalAddedConstants += Math.round(value / 10);
    } else {
      totalAddedConstants += value;
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
}

export function computeAppliedScrollCount(state) {
  return _scrollAppliedCount(state.scrollState);
}

export function computeRemainingSlots(state) {
  return _scrollRemainingSlots(state.scrollState);
}
