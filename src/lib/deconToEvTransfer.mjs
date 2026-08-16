/**
 * Cross-page state transfer: Deconstruction → Expected-Value.
 *
 * ## Payload lifecycle
 *
 * 1. **Written** when the user clicks "기대값 계산으로 보내기" on the
 *    deconstruction page.  A single localStorage key holds the latest
 *    transfer — each new transfer overwrites the previous one.
 *
 * 2. **Read** when the expected-value page loads.  The payload is NOT
 *    deleted on read (it persists so other tabs can also consume it).
 *
 * 3. **Dedup** — each payload carries a `transferId` (UUID).  The EV page
 *    records the last-applied id in its own sessionStorage.  On reload
 *    the same id is skipped so the transfer isn't re-applied.
 *
 * 4. **Staleness** — payloads older than STALE_WINDOW_MS (5 min) are
 *    treated as stale and ignored, preventing a direct visit from picking
 *    up a days-old transfer.
 *
 * 5. **Cleanup** — no explicit cleanup.  Stale payloads sit in localStorage
 *    until the next transfer overwrites them, and are always ignored by
 *    the staleness check.
 *
 * Chaos aggregate stat totals are split into per-scroll integer values using
 * integer division with remainder so individual values differ by at most 1
 * and sum exactly to the aggregate total.
 */

import { computeGemSlotCount } from './makerData.mjs';

/** localStorage key for the transfer payload. */
export const DECON_TO_EV_KEY = 'deconToEv:v1';

/** sessionStorage key for per-tab dedup tracking. */
const APPLIED_KEY = 'evAppliedTransfer:v1';

/** Payloads older than this window are treated as stale (5 minutes). */
const STALE_WINDOW_MS = 5 * 60 * 1000;

/** Generate a unique transfer identifier. */
function generateTransferId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  // Fallback: timestamp + random
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
 * @param {object} [opts] - Optional slot-state metadata
 * @param {number} [opts.totalAppliedScrolls] - Total scrolls applied (successful + failed)
 * @returns {object} Serialisable payload
 */
export function serializeDeconStrategy(strategy, itemId, { totalAppliedScrolls } = {}) {
  const totalApplied = totalAppliedScrolls ?? strategy.scrolls?.length ?? 0;
  return {
    v: 1,
    itemId,
    transferId: generateTransferId(),
    transferredAt: new Date().toISOString(),
    strategy: {
      scrolls: (strategy.scrolls ?? []).map((s) => ({
        id: s.id,
        nameKo: s.nameKo,
        stats: { ...s.stats },
        behavior_type: s.behavior_type ?? 'fixed',
        ...(s.isAggregate ? { isAggregate: true, aggregateCount: s.aggregateCount } : {}),
      })),
      totalAppliedScrolls: totalApplied,
      stimulant: strategy.stimulant
        ? {
            stats: { ...strategy.stimulant.stats },
            ...(strategy.stimulant.mode != null ? { mode: strategy.stimulant.mode } : {}),
          }
        : null,
      gems: (strategy.gems ?? []).map((g) => ({
        gemKey: g.gemKey,
        nameKo: g.nameKo,
        gradeIndex: g.gradeIndex,
        stats: { ...g.stats },
        ...(g.mode != null ? { mode: g.mode } : {}),
      })),
      itemLevelUp: strategy.itemLevelUp
        ? {
            levelCount: strategy.itemLevelUp.levelCount,
            stats: { ...strategy.itemLevelUp.stats },
            ...(strategy.itemLevelUp.mode != null ? { mode: strategy.itemLevelUp.mode } : {}),
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
 * @param {object} [slotState] - Optional slot-state metadata ({ totalAppliedScrolls })
 */
export function writeDeconTransfer(strategy, itemId, slotState) {
  try {
    const payload = serializeDeconStrategy(strategy, itemId, slotState);
    localStorage.setItem(DECON_TO_EV_KEY, JSON.stringify(payload));
  } catch {
    // localStorage unavailable or full — silently continue navigation
  }
}

/**
 * Reads the transfer payload from localStorage (non-destructive).
 *
 * Deduplication: records the last-applied `transferId` in sessionStorage
 * (per-tab) so refreshes don't re-apply the same transfer.
 *
 * Staleness: payloads older than STALE_WINDOW_MS are treated as stale
 * and ignored, preventing a direct visit from picking up a days-old
 * transfer.  The stale payload stays in localStorage until the next
 * transfer overwrites it.
 *
 * @returns {object|null} The parsed payload, or null if absent, stale,
 *   already applied, or invalid.
 */
export function consumeDeconTransfer() {
  try {
    const raw = localStorage.getItem(DECON_TO_EV_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw);
    if (!payload || !payload.v || payload.v < 1 || !Number.isInteger(payload.itemId)) {
      return null;
    }

    // ── Staleness check ──────────────────────────────────────────────
    if (payload.transferredAt) {
      const elapsed = Date.now() - new Date(payload.transferredAt).getTime();
      if (!Number.isFinite(elapsed) || elapsed > STALE_WINDOW_MS) {
        return null; // stale — ignore without deleting
      }
    }
    // Old payloads without transferredAt: still accepted for backward
    // compatibility (they'll be overwritten by the next transfer).

    // ── Dedup (per-tab, survives refresh) ─────────────────────────────
    if (payload.transferId) {
      try {
        const lastApplied = sessionStorage.getItem(APPLIED_KEY);
        if (lastApplied === payload.transferId) {
          return null; // already applied in this tab
        }
        sessionStorage.setItem(APPLIED_KEY, payload.transferId);
      } catch {
        // sessionStorage unavailable — proceed without dedup
      }
    }

    return payload;
  } catch {
    try { localStorage.removeItem(DECON_TO_EV_KEY); } catch { /* ignore */ }
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

  // Pad remaining consumed slots with failed-scroll entries so the
  // expected-value page shows the same applied-slot count the
  // deconstruction page intended (successful + failed scrolls).
  const totalApplied = strategy.totalAppliedScrolls ?? currentSlot;
  while (currentSlot < totalApplied && currentSlot < slotCount) {
    scrollSlots[currentSlot] = {
      id: '__failed_scroll__',
      nameKo: '실패한 주문서',
      equipmentKind: item.equipmentKind,
      behavior_type: 'fixed',
      stats: {},
    };
    currentSlot++;
  }

  // ── Gem slots ──────────────────────────────────────────────────────
  const gemSlotCount = computeGemSlotCount(item.requiredLevel ?? 0, item.requiredJobs ?? []);
  const gemSlots = new Array(gemSlotCount).fill(null);
  const hasGems = strategy.gems && strategy.gems.length > 0;
  if (hasGems) {
    for (let i = 0; i < Math.min(gemSlotCount, strategy.gems.length); i++) {
      const gem = strategy.gems[i];
      gemSlots[i] = {
        gemKey: gem.gemKey,
        gradeIndex: gem.gradeIndex,
        stats: { ...gem.stats },
        mode: gem.mode ?? 'manual',
      };
    }
  }

  // ── Maker active state ─────────────────────────────────────────────
  const hasStimulant = strategy.stimulant !== null && strategy.stimulant !== undefined;
  const makerActive = hasGems || hasStimulant;

  // ── Stimulant slot ─────────────────────────────────────────────────
  const stimulantSlot = hasStimulant
    ? { stats: { ...strategy.stimulant.stats }, mode: strategy.stimulant.mode ?? 'probability' }
    : null;

  // ── Item level-up slots ────────────────────────────────────────────
  const maxLevelUps =
    levelUpDefinition && Number.isInteger(levelUpDefinition.maxLevelUps)
      ? levelUpDefinition.maxLevelUps
      : (strategy.itemLevelUp?.levelCount ?? 0);
  const itemLevelUpSlots = new Array(maxLevelUps).fill(null);

  // Remaining (not yet applied) levels as an aggregate for the exact
  // probability computation.  The decon strategy pins the TOTAL of
  // `levelCount` uniform rolls, so the EV probability must convolve the
  // rolls — multiplying per-slot shares would undercount combinations.
  let itemLevelUpAggregate = null;

  if (strategy.itemLevelUp) {
    const il = strategy.itemLevelUp;
    const appliedCount = Math.max(0, il.appliedLevelCount ?? 0);
    const appliedStats = il.appliedStats ?? {};

    // Strategy stats include the applied portion — subtract it to get the
    // aggregate of the remaining levels (applied stats are deterministic).
    const remainingStats = {};
    const statKeys = new Set([...Object.keys(il.stats ?? {}), ...Object.keys(appliedStats)]);
    for (const key of statKeys) {
      remainingStats[key] = (il.stats?.[key] ?? 0) - (appliedStats[key] ?? 0);
    }
    const remainingCount = Math.max(0, (il.levelCount ?? 0) - appliedCount);

    // Pre-applied levels are deterministic — distribute their stats evenly
    // across the first slots (same even-distribution pattern as chaos).
    if (appliedCount > 0) {
      const appliedSlots = distributeStatTotals(appliedStats, appliedCount);
      for (let i = 0; i < appliedSlots.length && i < maxLevelUps; i++) {
        itemLevelUpSlots[i] = { stats: { ...appliedSlots[i] } };
      }
    }

    // Implement each remaining level as its own slot.  The per-slot stats
    // are an even split of the aggregate for display only; probability uses
    // the aggregate (itemLevelUpAggregate) so the split choice never biases
    // the EV result.
    if (remainingCount > 0) {
      const remainingSlots = distributeStatTotals(remainingStats, remainingCount);
      for (let i = 0; i < remainingSlots.length && appliedCount + i < maxLevelUps; i++) {
        itemLevelUpSlots[appliedCount + i] = { stats: { ...remainingSlots[i] } };
      }
      itemLevelUpAggregate = { levelCount: remainingCount, stats: { ...remainingStats } };
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
    itemLevelUpMode: strategy.itemLevelUp?.mode ?? 'probability',
    itemLevelUpAggregate,
  };
}
