import { isFixedGem, isRandomGem } from './makerModel.mjs';
import { GEM_TYPES, GEM_GRADES, getGemTypeByKey, isWeaponKind } from '../makerData.mjs';

// ---------------------------------------------------------------------------
// Pruning constants
// ---------------------------------------------------------------------------
const MAX_SCROLL_CANDIDATES = 1000;
const MAX_MAKER_CANDIDATES = 30000;
const MAX_STRATEGIES = 5000;

// ---------------------------------------------------------------------------
// pruneUselessScrolls
// ---------------------------------------------------------------------------

/**
 * Removes scrolls that cannot contribute to target conditions.
 *
 * A scroll is useful if:
 *  - It has no stats at all (always removed)
 *  - It affects at least one stat that is checked in checkedStats, OR
 *  - The grade flag is checked in checkedStats (any stat contributes to grade)
 *
 * @param {Array<object>} scrolls - Array of scroll objects (each has `id`, `stats`, etc.)
 * @param {Object<string, boolean>} checkedStats - Map of stat keys to checked state
 * @returns {Array<object>} Filtered scrolls
 */
export function pruneUselessScrolls(scrolls, checkedStats) {
  if (!Array.isArray(scrolls)) return [];

  const statKeys = Object.keys(checkedStats).filter(k => k !== 'grade' && checkedStats[k]);
  const gradeChecked = checkedStats?.grade === true;

  return scrolls.filter(scroll => {
    // Scrolls with no stats are always removed
    if (!scroll.stats || Object.keys(scroll.stats).length === 0) {
      return false;
    }

    // If grade is checked, any stat contributes
    if (gradeChecked) {
      return true;
    }

    // Check if any scroll stat overlaps with a checked stat
    if (statKeys.length === 0) {
      return false;
    }

    const scrollStatKeys = Object.keys(scroll.stats);
    return scrollStatKeys.some(statKey => statKeys.includes(statKey));
  });
}

// ---------------------------------------------------------------------------
// generateScrollCandidates
// ---------------------------------------------------------------------------

/**
 * Generates all possible scroll sequences (including empty and partial).
 *
 * Uses recursion: at each slot, either stop or pick a scroll and continue.
 * Enforces maxApplications limits per scroll.
 *
 * @param {Array<object>} scrolls - Available scrolls (already pruned)
 * @param {Object<string, boolean>} checkedStats - Checked stats map
 * @param {number} upgradeSlots - Number of upgrade slots available
 * @returns {Array<Array<object>>} Array of scroll sequences
 */
export function generateScrollCandidates(scrolls, checkedStats, upgradeSlots) {
  if (!Array.isArray(scrolls) || scrolls.length === 0 || upgradeSlots <= 0) {
    return [[]];
  }

  const results = [];

  /**
   * Recursively build scroll sequences.
   *
   * @param {number} slotIndex - Current slot index (0-based)
   * @param {Map<number, number>} usedCount - Map of scroll id → application count so far
   * @param {Array<object>} currentSequence - Sequence built so far
   */
  function recurse(slotIndex, usedCount, currentSequence) {
    // Prune: stop if we've hit the cap
    if (results.length >= MAX_SCROLL_CANDIDATES) {
      return;
    }

    // Stopping here is always valid — record the current sequence
    results.push([...currentSequence]);

    // If we've used all slots, we can't continue
    if (slotIndex >= upgradeSlots) {
      return;
    }

    // Try each scroll
    for (const scroll of scrolls) {
      // Check maxApplications constraint
      if (scroll.maxApplications != null) {
        const applied = usedCount.get(scroll.id) ?? 0;
        if (applied >= scroll.maxApplications) {
          continue;
        }
      }

      // Apply this scroll and recurse
      const newUsedCount = new Map(usedCount);
      newUsedCount.set(scroll.id, (newUsedCount.get(scroll.id) ?? 0) + 1);

      currentSequence.push(scroll);
      recurse(slotIndex + 1, newUsedCount, currentSequence);
      currentSequence.pop();

      // Prune: check cap after recursing
      if (results.length >= MAX_SCROLL_CANDIDATES) {
        return;
      }
    }
  }

  recurse(0, new Map(), []);

  return results;
}

// ---------------------------------------------------------------------------
// generateMakerCandidates
// ---------------------------------------------------------------------------

/**
 * Returns all possible gem slot configurations.
 *
 * @param {number} gemSlotCount - Number of gem slots (0-3)
 * @param {string} equipmentKind - Equipment kind to filter weapon-only gems
 * @returns {Array<Array<object|null>>} Array of gem slot configurations
 */
export function generateMakerCandidates(gemSlotCount, equipmentKind) {
  if (!Number.isInteger(gemSlotCount) || gemSlotCount <= 0) {
    return [[]];
  }

  const isWeapon = isWeaponKind(equipmentKind);

  // Filter gems by weaponOnly restriction
  const availableGems = GEM_TYPES.filter(gem => {
    if (gem.weaponOnly && !isWeapon) return false;
    return true;
  });

  // Build all gem + grade combinations
  const gemOptions = [];
  for (const gem of availableGems) {
    for (let grade = 0; grade <= 2; grade++) {
      gemOptions.push({ gemKey: gem.key, grade });
    }
  }

  const results = [];
  const usedKeys = new Set();

  /**
   * Recursively fill gem slots.
   *
   * @param {number} slotIndex - Current slot index
   * @param {Array<object|null>} currentSlots - Current slot configuration
   */
  function fill(slotIndex, currentSlots) {
    // Prune: stop if we've hit the cap
    if (results.length >= MAX_MAKER_CANDIDATES) {
      return;
    }

    if (slotIndex >= gemSlotCount) {
      results.push([...currentSlots]);
      return;
    }

    // Option 1: skip this slot (null)
    currentSlots[slotIndex] = null;
    fill(slotIndex + 1, currentSlots);

    // Option 2: fill with a gem (no duplicate keys allowed)
    for (const option of gemOptions) {
      if (usedKeys.has(option.gemKey)) {
        continue;
      }

      usedKeys.add(option.gemKey);
      currentSlots[slotIndex] = { gemKey: option.gemKey, grade: option.grade };
      fill(slotIndex + 1, currentSlots);
      usedKeys.delete(option.gemKey);

      // Prune: check cap
      if (results.length >= MAX_MAKER_CANDIDATES) {
        return;
      }
    }
  }

  fill(0, new Array(gemSlotCount).fill(null));

  return results;
}

// ---------------------------------------------------------------------------
// generateStrategyCandidates
// ---------------------------------------------------------------------------

/**
 * Generates all viable enhancement strategy candidates.
 *
 * Cross-product of maker candidates x scroll candidates x item level-up flag.
 *
 * @param {object} options
 * @param {Array<object>} options.scrolls - All available scrolls (will be pruned internally)
 * @param {Object<string, boolean>} options.checkedStats - Checked stats map
 * @param {number} options.upgradeSlots - Number of upgrade slots
 * @param {boolean} options.makerAllowed - Whether maker enhancements are allowed
 * @param {number} options.gemSlotCount - Number of gem slots
 * @param {string} options.equipmentKind - Equipment kind string
 * @param {boolean} options.itemLevelUpAllowed - Whether item level-up is allowed
 * @param {object|null} options.levelUpDefinition - Level-up definition object
 * @returns {Array<{makerChoices: Array<object>, scrollSequence: Array<object>, useItemLevelUp: boolean}>}
 */
export function generateStrategyCandidates(options) {
  const {
    scrolls,
    checkedStats,
    upgradeSlots,
    makerAllowed,
    gemSlotCount,
    equipmentKind,
    itemLevelUpAllowed,
    levelUpDefinition,
  } = options;

  // 1. Prune useless scrolls
  const usefulScrolls = pruneUselessScrolls(scrolls, checkedStats);

  // 2. Generate maker candidates
  let makerCandidates;

  if (!makerAllowed) {
    // Only empty maker choices
    makerCandidates = [[]];
  } else {
    const raw = generateMakerCandidates(gemSlotCount, equipmentKind);
    // Filter out null entries from each configuration for strategy storage
    makerCandidates = raw.map(config => config.filter(slot => slot !== null));
  }

  // 3. Generate scroll candidates
  const scrollCandidates = generateScrollCandidates(usefulScrolls, checkedStats, upgradeSlots);

  // 4. Determine level-up options
  const levelUpOptions = itemLevelUpAllowed ? [true, false] : [false];

  // 5. Cross-product with caps
  const strategies = [];

  for (const makerChoice of makerCandidates) {
    if (strategies.length >= MAX_STRATEGIES) break;

    for (const scrollSeq of scrollCandidates) {
      if (strategies.length >= MAX_STRATEGIES) break;

      for (const useItemLevelUp of levelUpOptions) {
        if (strategies.length >= MAX_STRATEGIES) break;

        strategies.push({
          makerChoices: makerChoice,
          scrollSequence: scrollSeq,
          useItemLevelUp,
        });
      }
    }
  }

  return strategies;
}
