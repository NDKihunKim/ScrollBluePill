const statLabelByKey = {
  str: 'STR',
  dex: 'DEX',
  int: 'INT',
  luk: 'LUK',
  maxHp: '최대HP',
  maxMp: '최대MP',
  weaponAttack: '공격력',
  magicAttack: '마력',
  weaponDefense: '물리방어력',
  magicDefense: '마법방어력',
  accuracy: '명중률',
  avoidability: '회피율',
  speed: '이동속도',
  jump: '점프력',
};

export function createScrollState(upgradeSlots) {
  const slotCount = Math.max(0, Number.isFinite(upgradeSlots) ? upgradeSlots : 0);
  const slots = new Array(slotCount).fill(null);
  let currentSlot = 0;

  return { slots, currentSlot, slotCount };
}

export function applyScroll(state, scroll) {
  if (state.currentSlot >= state.slotCount) {
    return false;
  }

  state.slots[state.currentSlot] = scroll;
  state.currentSlot += 1;
  return true;
}

export function revertToSlot(state, slotIndex) {
  if (slotIndex < 0 || slotIndex >= state.slotCount) {
    return;
  }

  for (let i = slotIndex + 1; i < state.slotCount; i++) {
    state.slots[i] = null;
  }
  state.currentSlot = slotIndex + 1;
}

export function resetState(state) {
  for (let i = 0; i < state.slotCount; i++) {
    state.slots[i] = null;
  }
  state.currentSlot = 0;
}

export function rebuildSlotState(state, newUpgradeSlots) {
  const newSlotCount = Math.max(0, Number.isFinite(newUpgradeSlots) ? newUpgradeSlots : 0);
  const newSlots = new Array(newSlotCount).fill(null);

  for (let i = 0; i < Math.min(state.slots.length, newSlotCount); i++) {
    newSlots[i] = state.slots[i];
  }

  const newCurrentSlot = Math.min(state.currentSlot, newSlotCount);

  state.slots = newSlots;
  state.slotCount = newSlotCount;
  state.currentSlot = newCurrentSlot;
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

  for (let i = 0; i < state.slotCount; i++) {
    const scroll = state.slots[i];
    if (!scroll?.stats) {
      continue;
    }

    for (const [key, value] of Object.entries(scroll.stats)) {
      if (Number.isFinite(value)) {
        accumulated[key] = (accumulated[key] ?? 0) + value;
      }
    }
  }

  return accumulated;
}

export function formatScrollStatLine(scroll) {
  if (!scroll?.stats) {
    return '';
  }

  return Object.entries(scroll.stats)
    .filter(([, value]) => Number.isFinite(value))
    .map(([key, value]) => {
      const label = statLabelByKey[key] ?? key;
      return value > 0 ? `${label} +${value}` : `${label} ${value}`;
    })
    .join(', ');
}

export function computeAppliedScrollCount(state) {
  return state.slots.filter((slot) => slot !== null).length;
}

export function computeRemainingSlots(state) {
  return state.slotCount - computeAppliedScrollCount(state);
}
