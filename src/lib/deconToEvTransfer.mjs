/**
 * Cross-page state transfer: Deconstruction → Expected-Value.
 *
 * Writes a strategy payload to localStorage, navigates, and the destination
 * page reconstructs a full enhancement state matching the strategy.
 *
 * Chaos aggregate stat totals are split into per-scroll integer values using
 * integer division with remainder so individual values differ by at most 1
 * and sum exactly to the aggregate total.
 */

import { computeGemSlotCount } from './makerData.mjs';

/** localStorage key used for the one-shot transfer payload. */
export const DECON_TO_EV_KEY = 'deconToEv:v1';

// ── Chaos even-distribution helpers ──────────────────────────────────────

/**
 * Distributes a single integer total evenly across `count` slots.
 *
 * Uses integer division with remainder: the first `remainder` entries
 * receive `base + 1` (preserving sign), the rest receive `base`.
 *
 * @param {number} total - The aggregate value to distribute
 * @param {number} count - Number of slots to distribute across
 * @returns {number[]} Array of `count` integer values summing to `total`
 */
export function distributeEvenTotal(total, count) {
  if (!Number.isInteger(count) || count <= 0) return [];
  if (!Number.isFinite(total)) return new Array(count).fill(0);
  if (total === 0) return new Array(count).fill(0);

  const sign = total >= 0 ? 1 : -1;
  const absTotal = Math.abs(total);
  const base = Math.floor(absTotal / count);
  const remainder = absTotal % count;

  const result = [];
  for (let i = 0; i < count; i++) {
    const extra = i < remainder ? 1 : 0;
    result.push((base + extra) * sign);
  }
  return result;
}

/**
 * Distributes aggregate chaos scroll stats across N individual scrolls.
 *
 * Each stat key is distributed independently. This means a chaos scroll
 * entry like { str: 10, dex: 6 } across 3 scrolls becomes:
 *   [{ str: 4, dex: 2 }, { str: 3, dex: 2 }, { str: 3, dex: 2 }]
 *
 * @param {Record<string,number>} aggregateStats - Total stats per key
 * @param {number} count - Number of chaos scrolls
 * @returns {Array<Record<string,number>>} Array of `count` per-scroll stat objects
 */
export function distributeStatTotals(aggregateStats, count) {
  if (!Number.isInteger(count) || count <= 0) return [];

  // Pre-build per-stat distribution arrays
  const perKey = {};
  for (const [key, totalValue] of Object.entries(aggregateStats)) {
    if (!Number.isFinite(totalValue)) continue;
    perKey[key] = distributeEvenTotal(totalValue, count);
  }

  // Transpose: per-key arrays → per-slot objects
  const result = [];
  for (let i = 0; i < count; i++) {
    const slot = {};
    for (const [key, values] of Object.entries(perKey)) {
      if (values[i] !== 0) {
        slot[key] = values[i];
      }
    }
    result.push(slot);
  }
  return result;
}

// ── Payload serialization / deserialization ──────────────────────────────

/**
 * Builds the transfer payload from a deconstruction strategy.
 *
 * @param {object} strategy - Strategy object from deconstruction engine's buildResult()
 * @param {number} itemId - ID of the item the strategy targets
 * @returns {object} Serialisable payload
 */
export function serializeDeconStrategy(strategy, itemId) {
  return {
    v: 1,
    itemId,
    strategy: {
      scrolls: (strategy.scrolls ?? []).map((s) => ({
        id: s.id,
        nameKo: s.nameKo,
        stats: { ...s.stats },
        behavior_type: s.behavior_type ?? 'fixed',
        ...(s.isAggregate
          ? { isAggregate: true, aggregateCount: s.aggregateCount }
          : {}),
      })),
      stimulant: strategy.stimulant
        ? { stats: { ...strategy.stimulant.stats } }
        : null,
      gems: (strategy.gems ?? []).map((g) => ({
        gemKey: g.gemKey,
        nameKo: g.nameKo,
        gradeIndex: g.gradeIndex,
        stats: { ...g.stats },
      })),
      itemLevelUp: strategy.itemLevelUp
        ? {
            levelCount: strategy.itemLevelUp.levelCount,
            stats: { ...strategy.itemLevelUp.stats },
            ...(strategy.itemLevelUp.appliedLevelCount != null
              ? {
                  appliedLevelCount: strategy.itemLevelUp.appliedLevelCount,
                  appliedStats: strategy.itemLevelUp.appliedStats
                    ? { ...strategy.itemLevelUp.appliedStats }
                    : {},
                }
              : {}),
          }
        : null,
      sourceTypes: [...(strategy.sourceTypes ?? [])],
    },
  };
}

/**
 * Writes the transfer payload to localStorage and navigates to the
 * expected-value page.
 *
 * @param {object} strategy - Strategy from deconstruction engine
 * @param {number} itemId - Item ID
 */
export function writeDeconTransfer(strategy, itemId) {
  try {
    const payload = serializeDeconStrategy(strategy, itemId);
    localStorage.setItem(DECON_TO_EV_KEY, JSON.stringify(payload));
  } catch {
    // localStorage unavailable or full — silently continue navigation
  }
}

/**
 * Reads and atomically deletes the transfer payload from localStorage.
 *
 * @returns {object|null} The parsed payload, or null if none exists or data is invalid
 */
export function consumeDeconTransfer() {
  try {
    const raw = localStorage.getItem(DECON_TO_EV_KEY);
    if (!raw) return null;

    // Delete immediately so refreshes don't re-apply
    localStorage.removeItem(DECON_TO_EV_KEY);

    const payload = JSON.parse(raw);
    if (!payload || payload.v !== 1 || !Number.isInteger(payload.itemId)) {
      return null;
    }
    return payload;
  } catch {
    try {
      localStorage.removeItem(DECON_TO_EV_KEY);
    } catch {
      // best effort
    }
    return null;
  }
}

// ── Enhancement state construction ───────────────────────────────────────

/**
 * Builds a complete enhancement state object from a deconstruction strategy
 * payload, ready to be passed to window.__evSetState().
 *
 * @param {object} strategy - The strategy portion of the transfer payload
 * @param {object} item - Full item object from the expected-value item index
 * @param {object|null} levelUpDefinition - Item level-up definition for this item
 * @returns {object} enhancementState compatible with restoreEnhancementState
 */
export function buildEnhancementStateFromStrategy(strategy, item, levelUpDefinition) {
  const slotCount = item.stats?.upgradeSlots ?? 0;
  const scrollSlots = new Array(slotCount).fill(null);
  let currentSlot = 0;

  for (const scroll of strategy.scrolls ?? []) {
    if (currentSlot >= slotCount) break;

    if (scroll.isAggregate && scroll.aggregateCount > 0) {
      const perSlotArr = distributeStatTotals(scroll.stats, scroll.aggregateCount);
      for (const perStats of perSlotArr) {
        if (currentSlot >= slotCount) break;
        scrollSlots[currentSlot] = {
          id: scroll.id,
          nameKo: scroll.nameKo,
          equipmentKind: item.equipmentKind,
          behavior_type: 'chaos',
          stats: { ...perStats },
        };
        currentSlot++;
      }
    } else {
      scrollSlots[currentSlot] = {
        id: scroll.id,
        nameKo: scroll.nameKo,
        equipmentKind: item.equipmentKind,
        behavior_type: scroll.behavior_type || 'fixed',
        stats: { ...scroll.stats },
      };
      currentSlot++;
    }
  }

  // ── Gem slots ──────────────────────────────────────────────────────
  const gemSlotCount = computeGemSlotCount(
    item.requiredLevel ?? 0,
    item.requiredJobs ?? [],
  );
  const gemSlots = new Array(gemSlotCount).fill(null);
  const hasGems = strategy.gems && strategy.gems.length > 0;
  if (hasGems) {
    for (let i = 0; i < Math.min(gemSlotCount, strategy.gems.length); i++) {
      const gem = strategy.gems[i];
      gemSlots[i] = {
        gemKey: gem.gemKey,
        gradeIndex: gem.gradeIndex,
        stats: { ...gem.stats },
        mode: 'manual',
      };
    }
  }

  // ── Maker active state ─────────────────────────────────────────────
  const hasStimulant = strategy.stimulant !== null && strategy.stimulant !== undefined;
  const makerActive = hasGems || hasStimulant;

  // ── Stimulant slot ─────────────────────────────────────────────────
  const stimulantSlot = hasStimulant
    ? { stats: { ...strategy.stimulant.stats }, mode: 'manual' }
    : null;

  // ── Item level-up slots ────────────────────────────────────────────
  const maxLevelUps =
    levelUpDefinition && Number.isInteger(levelUpDefinition.maxLevelUps)
      ? levelUpDefinition.maxLevelUps
      : strategy.itemLevelUp?.levelCount ?? 0;
  const itemLevelUpSlots = new Array(maxLevelUps).fill(null);

  if (strategy.itemLevelUp) {
    const il = strategy.itemLevelUp;
    const appliedCount = il.appliedLevelCount ?? 0;

    // Fill pre-applied slots with their specific stats
    if (il.appliedStats) {
      for (let i = 0; i < appliedCount && i < maxLevelUps; i++) {
        itemLevelUpSlots[i] = { stats: { ...il.appliedStats } };
      }
    }

    // Place remaining stats in the first non-applied slot
    const firstRemaining = appliedCount;
    if (firstRemaining < maxLevelUps) {
      itemLevelUpSlots[firstRemaining] = { stats: { ...il.stats } };
    }
  }

  return {
    scrollState: { slots: scrollSlots, currentSlot, slotCount },
    gemSlots,
    gemSlotCount,
    makerActive,
    stimulantSlot,
    itemLevelUpSlots,
    itemLevelUpSlotCount: maxLevelUps,
    itemLevelUpMode: 'manual',
  };
}
