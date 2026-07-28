import { debug } from './debug.mjs';

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
    debug('itemSlotStore: failed to write slots', e);
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
/**
 * Pick only the canonical fields used for slot matching.
 * This keeps comparison backward-compatible when the saved state
 * format evolves (e.g. Panel 3 fields removed from the save).
 */
function canonicalizePageState(pageState) {
  if (!pageState) return null;
  // Normalize deconDeltas: strip zero entries and enforce key order from
  // deconStatKeys so JSON.stringify produces the same string regardless of
  // the raw delta object's key insertion order.  Without this, old saves
  // (which stored zeros) or saves with different key orders never match
  // and the star stays unfilled.
  const deltas = {};
  const rawDeltas = pageState.deconDeltas ?? {};
  const statKeys = pageState.deconStatKeys ?? [];
  // Iterate statKeys first so key order matches buildDeconPageState
  for (const key of statKeys) {
    const value = rawDeltas[key];
    if (value !== 0 && Number.isFinite(value)) deltas[key] = value;
  }
  // Defensive: include any non-zero delta keys not listed in statKeys
  for (const key of Object.keys(rawDeltas)) {
    if (!(key in deltas)) {
      const value = rawDeltas[key];
      if (value !== 0 && Number.isFinite(value)) deltas[key] = value;
    }
  }
  return {
    itemId: pageState.itemId,
    deconDeltas: deltas,
    successfulScrollCount: pageState.successfulScrollCount ?? 0,
    deconStatKeys: [...statKeys],
    remainingSlots: pageState.remainingSlots ?? 0,
    appliedLevelCount: pageState.appliedLevelCount ?? 0,
    // Include enhancementState so different scroll/gem/stimulant configs
    // for the same item are treated as distinct saves (expected-value page).
    enhancementState: pageState.enhancementState ?? null,
  };
}

export function findMatchingSlot(page, pageState) {
  const slots = readSlots(page);
  const currentCanon = canonicalizePageState(pageState);
  const currentJson = JSON.stringify(currentCanon);
  if (import.meta.env.DEV) {
    debug('findMatchingSlot', {
      page,
      itemId: pageState.itemId,
      deconDeltas: pageState.deconDeltas,
      deconStatKeys: pageState.deconStatKeys,
      currentCanon,
      slots: slots.filter(Boolean).map((s, i) => {
        const savedCanon = canonicalizePageState(s.pageState);
        return {
          index: i,
          itemId: s.item.id,
          nameKo: s.item.nameKo,
          savedCanon,
          match: s.item.id === pageState.itemId && JSON.stringify(savedCanon) === currentJson,
        };
      }),
    });
  }
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s) continue;
    if (s.item.id === pageState.itemId) {
      const savedCanon = canonicalizePageState(s.pageState);
      const savedJson = JSON.stringify(savedCanon);
      if (savedJson === currentJson) {
        return i;
      }
    }
  }
  return -1;
}
