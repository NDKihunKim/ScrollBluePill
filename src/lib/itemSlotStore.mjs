const STORAGE_PREFIX = 'itemSlots:v1:';
export const MAX_SLOTS = 4;

/**
 * Read all slots for a page from localStorage.
 * @param {string} page - 'deconstruction' or 'expectedValue'
 * @returns {Array<{item: object, savedAt: string, pageState: object}|null>}
 */
export function readSlots(page) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + page);
    if (!raw) return Array(MAX_SLOTS).fill(null);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return Array(MAX_SLOTS).fill(null);
    // Normalize to exactly MAX_SLOTS
    const slots = Array(MAX_SLOTS).fill(null);
    for (let i = 0; i < Math.min(MAX_SLOTS, parsed.length); i++) {
      slots[i] = parsed[i] ?? null;
    }
    return slots;
  } catch {
    return Array(MAX_SLOTS).fill(null);
  }
}

/**
 * Write all slots for a page to localStorage.
 * @param {string} page
 * @param {Array<object|null>} slots
 */
export function writeSlots(page, slots) {
  try {
    localStorage.setItem(STORAGE_PREFIX + page, JSON.stringify(slots));
  } catch (e) {
    console.error('itemSlotStore: failed to write slots', e);
  }
}

/**
 * Save to a specific slot index.
 * @param {string} page
 * @param {number} slotIndex
 * @param {object} item - the item being saved
 * @param {object} pageState - page-specific calculation state
 * @returns {boolean}
 */
export function saveToSlot(page, slotIndex, item, pageState) {
  const slots = readSlots(page);
  if (slotIndex < 0 || slotIndex >= MAX_SLOTS) return false;
  slots[slotIndex] = {
    item: {
      id: item.id,
      nameKo: item.nameKo,
      equipmentKind: item.equipmentKind,
      requiredLevel: item.requiredLevel,
      iconId: item.id,
    },
    savedAt: new Date().toISOString(),
    pageState,
  };
  writeSlots(page, slots);
  return true;
}

/**
 * Clear a specific slot.
 * @param {string} page
 * @param {number} slotIndex
 */
export function clearSlot(page, slotIndex) {
  const slots = readSlots(page);
  if (slotIndex < 0 || slotIndex >= MAX_SLOTS) return;
  slots[slotIndex] = null;
  writeSlots(page, slots);
}

/**
 * Find which slot (if any) matches the given page state.
 * @param {string} page
 * @param {object} pageState
 * @returns {number} slot index or -1
 */
export function findMatchingSlot(page, pageState) {
  const slots = readSlots(page);
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s) continue;
    if (s.item.id === pageState.itemId) {
      // Deep compare pageState via JSON serialization
      if (JSON.stringify(s.pageState) === JSON.stringify(pageState)) {
        return i;
      }
    }
  }
  return -1;
}
