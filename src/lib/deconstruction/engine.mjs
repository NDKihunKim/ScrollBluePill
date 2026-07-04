import { HP_MP_KEYS } from '../enhancementState.mjs';
import { computeGemSlotCount, GEM_GRADES, GEM_TYPES, isWeaponKind } from '../makerData.mjs';
import { statLabelByKey } from '../makerData.mjs';
import {
  addVectors,
  isExactVector,
  projectVector,
  subtractVectors,
  vectorKey,
} from './statVectors.mjs';
import {
  enumerateGemContributions,
  enumerateItemLevelContributions,
  solveStimulantResidual,
} from './sourceContributions.mjs';

const MAX_DISPLAY_STRATEGIES = 10000;
const OVERFLOW_TOTAL = 10001;

/**
 * Check whether a scroll is a chaos-type scroll (random delta values).
 */
function isChaosScroll(scroll) {
  return scroll.behavior_type === 'chaos';
}

function parseScrollRate(nameKo) {
  if (/혼돈|chaos/i.test(nameKo)) return 'chaos';
  const match = nameKo.match(/(\d+)%/);
  return match ? match[1] : null;
}

function filterScrollsByRate(scrolls, rateFilter) {
  if (!rateFilter) return scrolls;
  if (rateFilter.size === 0) return [];
  return scrolls.filter((s) => {
    const rate = parseScrollRate(s.nameKo);
    return rate !== null && rateFilter.has(rate);
  });
}

function getChaosRange(statKey) {
  if (HP_MP_KEYS.has(statKey)) return { min: -50, max: 50 };
  return { min: -5, max: 5 };
}

function* generateChaosDeltas(stats, targetKeys, chaosBounds = null, limit = 100000, targetDeltas = null, cleanStats = null) {
  // Only enumerate deltas for keys the user actually targets.
  // A chaos scroll may have 6-10 stat keys; without filtering we'd hit
  // the limit before reaching the relevant keys.

  // Build the stat key pool: scroll's native stats + chaosBounds-introduced keys.
  const scrollPoolKeys = Object.keys(stats).filter((k) => targetKeys.includes(k));
  const boundsIntroducedKeys = chaosBounds
    ? Object.keys(chaosBounds).filter((k) =>
        targetKeys.includes(k) &&
        !scrollPoolKeys.includes(k) &&
        Number.isFinite(chaosBounds[k]?.min) &&
        Number.isFinite(chaosBounds[k]?.max),
      )
    : [];
  const allCandidateKeys = [...scrollPoolKeys, ...boundsIntroducedKeys];

  // Prune: skip keys where target delta is 0 AND the item has no base stat to protect.
  // Chaos moving a stat from 0→±5 that the user doesn't want changed wastes slots.
  const statKeys = allCandidateKeys.filter((k) => {
    const delta = targetDeltas?.[k] ?? 0;
    if (delta !== 0) return true;                       // user wants this changed — keep
    const base = cleanStats?.[k];
    if (Number.isFinite(base) && base > 0) return true;  // item has a stat to protect — keep
    return false;                                        // delta=0 AND base≤0 — skip
  });

  if (statKeys.length === 0) return;

  const ranges = statKeys.map((key) => {
    // For bounds-introduced keys, use the bounds as the authoritative range
    // (clamped to the standard chaos range as a safety floor/ceiling).
    const defaultRange = getChaosRange(key);
    const min = chaosBounds?.[key] && Number.isFinite(chaosBounds[key].min)
      ? Math.max(defaultRange.min, chaosBounds[key].min)
      : defaultRange.min;
    const max = chaosBounds?.[key] && Number.isFinite(chaosBounds[key].max)
      ? Math.min(defaultRange.max, chaosBounds[key].max)
      : defaultRange.max;
    const values = [];
    // Prioritise useful deltas: 0 first (neutral), then +1..+max (gains).
    values.push(0);
    for (let v = 1; v <= max; v++) {
      if (v >= min) values.push(v);
    }
    // Only include negative deltas when the user wants to reduce this stat.
    // For positive targets, negative chaos values are pure waste — they force
    // extra positive applications to compensate, creating strictly worse strategies.
    const targetDelta = targetDeltas?.[key] ?? 0;
    if (targetDelta < 0) {
      for (let v = -1; v >= min; v--) {
        if (v <= max) values.push(v);
      }
    }
    return { key, values };
  });

  let count = 0;

  function* dfs(idx, current) {
    if (count >= limit) return;
    if (idx === statKeys.length) {
      count++;
      yield { ...current };
      return;
    }
    const { key, values } = ranges[idx];
    for (const v of values) {
      current[key] = v;
      yield* dfs(idx + 1, current);
    }
  }

  yield* dfs(0, {});
}

/**
 * Generate all exact-count scroll states that could contribute to the target.
 * Each scroll state has { scrolls, stats } where scrolls is an array of applied
 * scroll entries and stats is the total stat vector.
 */
function* enumerateExactCountScrollStates({
  scrolls: allScrolls,
  targetKeys,
  targetDeltas,
  successfulScrollCount,
  correctionBounds,
  chaosStatBounds = null,
  cleanStats = null,
}) {
  const requiredScrollCount = (() => {
    try {
      const n = Number(successfulScrollCount);
      return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    } catch {
      return 0;
    }
  })();
  if (requiredScrollCount === 0) return [];

  // Filter scrolls to those touching at least one checked key.
  // Chaos scrolls always pass — they can affect any stat and carry
  // zero-valued stats in the data (engine uses getChaosRange for deltas).
  const relevantScrolls = allScrolls.filter((s) =>
    isChaosScroll(s) || targetKeys.some((k) => (s.stats?.[k] || 0) !== 0),
  );
  if (relevantScrolls.length === 0) {
    console.log('[chaos-debug] enumerateExactCountScrollStates: no relevant scrolls touch targetKeys', targetKeys);
    return [];
  }

  const fixedScrolls = relevantScrolls
    .filter((s) => !isChaosScroll(s))
    .sort((a, b) => a.id - b.id);

  const chaosScrolls = relevantScrolls
    .filter((s) => isChaosScroll(s))
    .sort((a, b) => a.id - b.id);

  console.log('[chaos-debug] enumerateExactCountScrollStates:', {
    requiredScrollCount,
    targetKeys,
    targetDeltas,
    totalScrolls: allScrolls.length,
    relevantScrolls: relevantScrolls.length,
    fixedScrolls: fixedScrolls.length,
    chaosScrollsRaw: chaosScrolls.length,
    chaosStatBounds,
  });

  // Build deduplicated chaos entries with min/max per key for pruning.
  // Each unique delta vector gets used count-based (like fixed scrolls)
  // instead of one-at-a-time — otherwise a 378-entry pool × 6–9 slots
  // creates a combinatorially impossible search space.
  const chaosPoolRaw = [];
  for (const cs of chaosScrolls) {
    for (const deltas of generateChaosDeltas(cs.stats, targetKeys, chaosStatBounds, 100000, targetDeltas, cleanStats)) {
      chaosPoolRaw.push({ baseScroll: cs, deltas });
    }
  }

  // Deduplicate by delta vector key, then sort by useful contribution
  // (sum of positive deltas descending) so the DFS finds valid combos faster.
  const chaosSeen = new Map();
  const chaosPool = [];
  for (const entry of chaosPoolRaw) {
    const key = targetKeys.map((k) => `${k}:${entry.deltas[k] || 0}`).join(',');
    if (!chaosSeen.has(key)) {
      chaosSeen.set(key, true);
      chaosPool.push(entry);
    }
  }
  chaosPool.sort((a, b) => {
    const aScore = targetKeys.reduce((s, k) => s + Math.max(0, a.deltas[k] || 0), 0);
    const bScore = targetKeys.reduce((s, k) => s + Math.max(0, b.deltas[k] || 0), 0);
    return bScore - aScore;
  });

  console.log('[chaos-debug] chaos pool:', {
    rawCount: chaosPoolRaw.length,
    uniqueCount: chaosPool.length,
    sampleEntries: chaosPool.slice(0, 3).map(e => ({
      baseId: e.baseScroll.id,
      deltas: e.deltas,
    })),
  });

  // Pre-compute min/max per key across chaos pool for pruning
  const chaosMins = Object.fromEntries(targetKeys.map((k) => [k, Infinity]));
  const chaosMaxs = Object.fromEntries(targetKeys.map((k) => [k, -Infinity]));
  for (const { deltas } of chaosPool) {
    for (const k of targetKeys) {
      const v = deltas[k] || 0;
      if (v < chaosMins[k]) chaosMins[k] = v;
      if (v > chaosMaxs[k]) chaosMaxs[k] = v;
    }
  }

  console.log('[chaos-debug] chaos per-key ranges:', {
    mins: chaosMins,
    maxs: chaosMaxs,
  });

  function canReachTarget(fixedIdx, remainingApps, currentStats) {
    for (const key of targetKeys) {
      let minPerApp = remainingApps === 0 ? 0 : Infinity;
      let maxPerApp = remainingApps === 0 ? 0 : -Infinity;

      for (let i = fixedIdx; i < fixedScrolls.length; i++) {
        const value = fixedScrolls[i].stats?.[key] || 0;
        minPerApp = Math.min(minPerApp, value);
        maxPerApp = Math.max(maxPerApp, value);
      }
      if (Number.isFinite(chaosMins[key])) {
        minPerApp = Math.min(minPerApp, chaosMins[key]);
        maxPerApp = Math.max(maxPerApp, chaosMaxs[key]);
      }

      if (!Number.isFinite(minPerApp)) return false;

      const correction = correctionBounds[key] ?? { min: 0, max: 0 };
      const current = currentStats[key] || 0;
      const minReachable = current + remainingApps * minPerApp + correction.min;
      const maxReachable = current + remainingApps * maxPerApp + correction.max;
      const target = targetDeltas[key] ?? 0;
      if (target < minReachable || target > maxReachable) return false;
    }
    return true;
  }

  let dfsNodeCount = 0;
  function* dfs(fixedIdx, remainingApps, currentStats, chosen) {
    dfsNodeCount++;
    if (dfsNodeCount % 5000 === 0) {
      console.log('[chaos-debug] DFS progress:', {
        nodes: dfsNodeCount,
        remainingApps,
        chosenLen: chosen.length,
        currentStats,
        fixedIdx,
      });
    }
    if (!canReachTarget(fixedIdx, remainingApps, currentStats)) return;
    if (remainingApps === 0 && chosen.length === requiredScrollCount) {
      console.log('[chaos-debug] DFS found scroll state:', {
        nodes: dfsNodeCount,
        scrollCount: chosen.length,
        stats: currentStats,
        scrollBreakdown: chosen.map(s => ({ id: s.id, chaos: s.behavior_type === 'chaos', stats: s.stats })),
      });
      yield {
        scrolls: [...chosen],
        stats: { ...currentStats },
      };
      return;
    }
    if (remainingApps <= 0 || chosen.length >= requiredScrollCount) return;

    // Try fixed scrolls
    for (let i = fixedIdx; i < fixedScrolls.length; i++) {
      const scroll = fixedScrolls[i];
      const stats = scroll.stats;

      let maxUses = remainingApps;
      for (const k of targetKeys) {
        const delta = stats[k] || 0;
        const remaining = targetDeltas[k] - (currentStats[k] || 0);
        if (delta > 0 && remaining > 0) {
          maxUses = Math.min(maxUses, Math.floor(remaining / delta));
        }
      }

      if (maxUses <= 0) continue;

      for (let count = maxUses; count >= 1; count--) {
        const newStats = { ...currentStats };
        for (const [k, v] of Object.entries(stats)) {
          if (Number.isFinite(v) && targetKeys.includes(k)) {
            newStats[k] = (newStats[k] || 0) + v * count;
          }
        }
        const newChosen = [...chosen];
        for (let c = 0; c < count; c++) {
          newChosen.push({
            id: scroll.id,
            nameKo: scroll.nameKo,
            stats: { ...stats },
          });
        }
        yield* dfs(i + 1, remainingApps - count, newStats, newChosen);
      }
    }

    // Try chaos scrolls — count-based (like fixed scrolls) to avoid
    // combinatorial explosion from per-entry branching.
    if (chaosPool.length > 0) {
      for (const entry of chaosPool) {
        const { baseScroll: cs, deltas } = entry;

        // Guard: bounds-introduced keys (not in the scroll's native stat pool)
        // can only modify stats that already exist on the item.  They cannot
        // create a stat from zero — a fixed scroll must establish it first.
        const nativeStats = cs.stats;
        if (Object.keys(deltas).some(
          (k) => !(k in (nativeStats ?? {})) && (currentStats[k] || 0) <= 0,
        )) {
          continue;
        }

        // Compute max uses of this delta vector — bounded by positive deltas
        // that would overshoot their target keys.
        let maxUses = remainingApps;
        for (const k of targetKeys) {
          const delta = deltas[k] || 0;
          const remaining = targetDeltas[k] - (currentStats[k] || 0);
          if (delta > 0 && remaining > 0) {
            maxUses = Math.min(maxUses, Math.floor(remaining / delta));
          }
        }

        if (maxUses <= 0) continue;

        for (let count = maxUses; count >= 1; count--) {
          const newStats = { ...currentStats };
          for (const [k, v] of Object.entries(deltas)) {
            if (targetKeys.includes(k)) {
              newStats[k] = (newStats[k] || 0) + v * count;
            }
          }
          const newChosen = [...chosen];
          for (let c = 0; c < count; c++) {
            newChosen.push({
              ...cs,
              stats: { ...deltas },
            });
          }
          yield* dfs(fixedIdx, remainingApps - count, newStats, newChosen);
        }
      }
    }
  }

  yield* dfs(0, requiredScrollCount, Object.fromEntries(targetKeys.map((k) => [k, 0])), []);
}

/**
 * Build a canonical deduplication key for a complete strategy.
 */
function strategyCanonicalKey({ scrolls, stimulant, gems, itemLevelUp }, targetKeys) {
  const scrollPart = scrolls
    .map((s) => {
      const statKeys = Object.keys(s.stats).sort();
      const statPart = statKeys.map((k) => `${k}:${s.stats[k]}`).join(',');
      return `${s.id}[${statPart}]`;
    })
    .sort()
    .join('|');

  const stimPart = stimulant ? `stim:${vectorKey(stimulant.stats, targetKeys)}` : 'stim:none';

  const gemPart = gems
    .map((g) => `${g.gemKey}:${g.gradeIndex}:${vectorKey(g.stats, targetKeys)}`)
    .sort()
    .join('|') || 'gems:none';

  const levelPart = itemLevelUp
    ? `level:${itemLevelUp.levelCount}:${vectorKey(itemLevelUp.stats, targetKeys)}`
    : 'level:none';

  return `${scrollPart}|${stimPart}|${gemPart}|${levelPart}`;
}

/**
 * Compute a spread score for chaos scroll contributions across target keys.
 * Lower score = more evenly distributed chaos delta across stats.
 * Returns -1 when no chaos scrolls are present (ranks above chaos strategies).
 */
function chaosSpreadScore(strategy, targetKeys) {
  let chaosCount = 0;
  const chaosTotals = Object.fromEntries(targetKeys.map((k) => [k, 0]));

  for (const scroll of strategy.scrolls) {
    if (scroll.behavior_type === 'chaos') {
      chaosCount++;
      for (const key of targetKeys) {
        chaosTotals[key] += scroll.stats[key] || 0;
      }
    }
  }

  if (chaosCount === 0) return -1;

  const values = targetKeys.map((k) => chaosTotals[k]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

  return variance;
}

/**
 * Build a strategy result object.
 */
function buildResult({ scrolls, stimulant, gems, itemLevelUp, priorityRank, targetKeys, appliedLevelStats: applyApplied }) {
  const appliedLevelCount = applyApplied?.levelCount ?? 0;
  const appliedStats = applyApplied?.stats ?? {};

  const scrollEntries = scrolls.map((s) => ({
    id: s.id,
    nameKo: s.nameKo,
    stats: { ...s.stats },
    behavior_type: s.behavior_type,
  }));

  const hasStimulant = stimulant !== null;

  // Merge remaining level-up with applied level stats
  let mergedItemLevelUp = null;
  if (itemLevelUp || appliedLevelCount > 0) {
    const remainingStats = itemLevelUp?.stats ?? {};
    const remainingCount = itemLevelUp?.levelCount ?? 0;
    const mergedStats = {};
    for (const key of targetKeys) {
      const v = (remainingStats[key] ?? 0) + (appliedStats[key] ?? 0);
      mergedStats[key] = v;
    }
    mergedItemLevelUp = {
      levelCount: remainingCount + appliedLevelCount,
      stats: mergedStats,
      ...(appliedLevelCount > 0 ? { appliedLevelCount, appliedStats: { ...appliedStats } } : {}),
    };
  }
  const hasItemLevelUp = mergedItemLevelUp !== null;

  const sourceTypes = [];
  if (scrolls.length > 0) sourceTypes.push('scrolls');
  if (hasStimulant) sourceTypes.push('stimulant');
  if (gems.length > 0) sourceTypes.push('gems');
  if (hasItemLevelUp) sourceTypes.push('itemLevelUp');

  const approach = [sourceTypes.length === 1 && sourceTypes[0] === 'scrolls' ? '주문서' : '복합'];

  // Compute total stats
  const totalStats = {};
  const addStats = (sourceStats) => {
    for (const [k, v] of Object.entries(sourceStats)) {
      if (Number.isFinite(v)) {
        totalStats[k] = (totalStats[k] || 0) + v;
      }
    }
  };

  for (const s of scrollEntries) addStats(s.stats);
  if (stimulant) addStats(stimulant.stats);
  for (const g of gems) addStats(g.stats);
  if (mergedItemLevelUp) addStats(mergedItemLevelUp.stats);

  return {
    scrolls: scrollEntries,
    stimulant,
    gems,
    itemLevelUp: mergedItemLevelUp,
    hasStimulant,
    hasItemLevelUp,
    sourceTypes,
    priorityRank,
    approach,
    totalStats,
  };
}

/**
 * Enumerate all strategies that produce exactly `targetDeltas` across checked keys.
 *
 * @param {object} opts
 * @param {object}          opts.targetDeltas           Desired net stat deltas per checked key
 * @param {string[]}        opts.targetKeys             Checked stat keys
 * @param {number}          opts.successfulScrollCount  Exact number of successful scrolls
 * @param {string}          opts.equipmentKind          Equipment kind key
 * @param {number}          opts.requiredLevel          Required level of the item
 * @param {object}          opts.cleanStats             Base item stats (before enhancement)
 * @param {Map<string,Array>} opts.scrollsByEquipmentKind  Scrolls grouped by equipment kind
 * @param {object|null}     opts.levelUpDefinition      Item level-up definition or null
 * @param {{ levelCount: number, stats: Record<string,number> }|null} opts.appliedLevelStats  Total stats from already-applied level-ups
 * @param {object}          opts.allowedSources         Optional source permissions
 * @param {Set<string>|null}    opts.scrollRateFilter       Allowed scroll rates: '100','60','10','chaos' (null=all)
 * @param {object|null}        opts.stimulantStatBounds     Per-key min/max for stimulant (null=default -5/+5)
 * @param {Array<object>|null} opts.levelUpSlotStatRanges   Per-slot stat ranges for remaining level-ups (null=use definition)
 * @param {number|null}        opts.levelUpExactLevelCount  Exact total item level-up count to enumerate
 * @param {object|null}        opts.levelUpTotalStatRanges  Per-key total min/max for exact item level-ups
 * @returns {{ strategies: Array, total: number, tooManyResults: boolean }}
 */
export function enumerateStrategies({
  targetDeltas,
  targetKeys = Object.keys(targetDeltas),
  successfulScrollCount,
  equipmentKind,
  requiredLevel = 0,
  cleanStats = {},
  scrollsByEquipmentKind,
  levelUpDefinition = null,
  allowedSources,
  scrollRateFilter = null,
  stimulantStatBounds = null,
  chaosStatBounds = null,
  levelUpSlotStatRanges = null,
  levelUpExactLevelCount = null,
  levelUpTotalStatRanges = null,
  appliedLevelStats: appliedLevelStatsRaw = null,
  gemFilter = null,
  requiredJobs = [],
}) {
  const strategies = [];
  let tooManyResults = false;
  const seenKeys = new Set();

  if (targetKeys.length === 0) {
    return { strategies: [], total: 0, tooManyResults: false };
  }

  console.log('[chaos-debug] enumerateStrategies called:', {
    targetKeys,
    targetDeltas,
    successfulScrollCount,
    equipmentKind,
    scrollRateFilter: scrollRateFilter ? [...scrollRateFilter] : null,
    stimulantStatBounds,
    chaosStatBounds,
    allowedSources,
  });

  const normCount = (() => {
    try {
      const n = Number(successfulScrollCount);
      return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    } catch {
      return 0;
    }
  })();

  const exactLevelCount = Number.isFinite(levelUpExactLevelCount)
    ? Math.max(0, Math.trunc(levelUpExactLevelCount))
    : null;

  // ── Applied level-up stats ──────────────────────────────────────────
  // When the item already has level-ups applied, their total stat
  // contribution is subtracted from the target deltas so the strategy
  // engine only searches for the remainder.  The applied stats are then
  // added back as a fixed source in every result that uses itemLevelUp.
  const appliedLevelStats = (() => {
    if (exactLevelCount !== null) return null;
    if (!appliedLevelStatsRaw) return null;
    const levelCount = Number.isFinite(appliedLevelStatsRaw.levelCount)
      ? Math.max(0, Math.trunc(appliedLevelStatsRaw.levelCount))
      : 0;
    if (levelCount <= 0) return null;
    const stats = {};
    let hasNonZero = false;
    for (const [key, value] of Object.entries(appliedLevelStatsRaw.stats ?? {})) {
      if (Number.isFinite(value) && targetKeys.includes(key)) {
        stats[key] = value;
        if (value !== 0) hasNonZero = true;
      }
    }
    return { levelCount, stats };
  })();
  const appliedLevelCount = appliedLevelStats?.levelCount ?? 0;
  const appliedStats = appliedLevelStats?.stats ?? {};

  // Effective target: what scrolls + stimulant + gems + remaining level-ups must cover
  const effectiveTargetDeltas = { ...targetDeltas };
  for (const [key, value] of Object.entries(appliedStats)) {
    if (targetKeys.includes(key)) {
      effectiveTargetDeltas[key] = (effectiveTargetDeltas[key] ?? 0) - value;
    }
  }

  const normalizedAllowedSources = {
    scrolls: allowedSources?.scrolls ?? true,
    stimulant: allowedSources?.stimulant ?? true,
    gems: allowedSources?.gems ?? true,
    itemLevelUp: allowedSources?.itemLevelUp ?? true,
  };

  if (!normalizedAllowedSources.scrolls && normCount > 0) {
    return { strategies: [], total: 0, tooManyResults: false };
  }

  // Normalize bounds for fallback generation
  const stimulantBounds = {};
  const gemBounds = {};
  for (const k of targetKeys) {
    const limit = HP_MP_KEYS.has(k) ? 50 : 5;
    // Stimulant can only affect stats that exist on the clean item with a
    // positive base value — same rule as the stimulant bounds UI.
    const statExistsOnBase = cleanStats && Number.isFinite(cleanStats[k]) && cleanStats[k] > 0;
    stimulantBounds[k] = statExistsOnBase ? { min: -limit, max: limit } : { min: 0, max: 0 };
    gemBounds[k] = { min: -Infinity, max: Infinity };
  }
  const itemBounds = {};
  for (const k of targetKeys) {
    itemBounds[k] = { min: -Infinity, max: Infinity };
  }

  // Compute gem slot count using Maker system level thresholds
  //  0 for <48, 1 for 48-77, 2 for 78-105, 3 for 106+
  const gemSlotCount = computeGemSlotCount(requiredLevel, requiredJobs);

  // Generate fallback contributions
  const gemContributions = normalizedAllowedSources.gems
    ? enumerateGemContributions({
        gemSlotCount,
        equipmentKind,
        cleanStats,
        targetKeys,
        bounds: gemBounds,
        gemFilter,
      })
    : [];

  const itemLevelContributions = normalizedAllowedSources.itemLevelUp
    ? enumerateItemLevelContributions({
        levelUpDefinition,
        targetKeys,
        bounds: itemBounds,
        appliedLevelCount,
        perSlotRanges: levelUpSlotStatRanges,
        exactLevelCount,
        totalRanges: levelUpTotalStatRanges,
      })
    : [];

  function computeCorrectionBounds(targetKeys, { includeStimulant, includeGems, includeItemLevelUp }) {
    const bounds = {};
    for (const key of targetKeys) {
      let min = 0;
      let max = 0;

      if (includeStimulant) {
        min += Math.min(0, stimulantBounds[key].min);
        max += Math.max(0, stimulantBounds[key].max);
      }
      if (includeGems) {
        const values = gemContributions.map((c) => c.stats[key] || 0);
        min += Math.min(0, ...values);
        max += Math.max(0, ...values);
      }
      if (includeItemLevelUp) {
        const values = itemLevelContributions.map((c) => c.stats[key] || 0);
        min += Math.min(0, ...values);
        max += Math.max(0, ...values);
      }

      bounds[key] = { min, max };
    }
    return bounds;
  }

  const correctionBounds = computeCorrectionBounds(targetKeys, {
    includeStimulant: normalizedAllowedSources.stimulant,
    includeGems: normalizedAllowedSources.gems,
    includeItemLevelUp: normalizedAllowedSources.itemLevelUp,
  });

  const scrollCorrectionBounds = computeCorrectionBounds(targetKeys, {
    includeStimulant: normalizedAllowedSources.stimulant,
    includeGems: normalizedAllowedSources.gems,
    includeItemLevelUp: false,
  });

  const rawScrolls = scrollsByEquipmentKind.get(equipmentKind) ?? [];
  const scrolls = scrollRateFilter ? filterScrollsByRate(rawScrolls, scrollRateFilter) : rawScrolls;

  const equipmentIsWeapon = isWeaponKind(equipmentKind);
  const stimulantOpts = { isWeapon: equipmentIsWeapon, cleanStats };

  // Generate exact-count scroll states against the effective (post-applied-stats) target
  const effectiveScrollStates = normalizedAllowedSources.scrolls && normCount > 0
    ? enumerateExactCountScrollStates({
        scrolls,
        targetKeys,
        targetDeltas: effectiveTargetDeltas,
        successfulScrollCount: normCount,
        correctionBounds,
        chaosStatBounds,
        cleanStats,
      })
    : (normCount === 0
      ? [{ scrolls: [], stats: Object.fromEntries(targetKeys.map((k) => [k, 0])) }]
      : []);

  let effectiveScrollStatesSeen = 0;

  // Full target vector (original, for exact-match verification)
  const targetVector = targetKeys.reduce((acc, k) => {
    acc[k] = targetDeltas[k] ?? 0;
    return acc;
  }, {});

  function addResult(parts) {
    if (tooManyResults) return;
    const result = buildResult({ ...parts, targetKeys, appliedLevelStats });
    // Verify total stats match target exactly on checked keys
    if (!isExactVector(result.totalStats, targetVector, targetKeys)) return;
    const key = strategyCanonicalKey(result, targetKeys);
    if (seenKeys.has(key)) return;
    if (strategies.length >= MAX_DISPLAY_STRATEGIES) {
      tooManyResults = true;
      return;
    }
    seenKeys.add(key);
    strategies.push(result);
  }

  if (normalizedAllowedSources.itemLevelUp && itemLevelContributions.length > 0) {
    // itemLevelUp outer loop — levelUp is base layer, scroll/stim/gems fill remainder
    for (const ilc of itemLevelContributions) {
      if (tooManyResults) break;
      const remainingTarget = subtractVectors(effectiveTargetDeltas, ilc.stats, targetKeys);
      const scrollStates = normalizedAllowedSources.scrolls && normCount > 0
        ? enumerateExactCountScrollStates({
            scrolls,
            targetKeys,
            targetDeltas: remainingTarget,
            successfulScrollCount: normCount,
            correctionBounds: scrollCorrectionBounds,
            chaosStatBounds,
            cleanStats,
          })
        : (normCount === 0
          ? [{ scrolls: [], stats: Object.fromEntries(targetKeys.map((k) => [k, 0])) }]
          : []);
      for (const ss of scrollStates) {
        if (tooManyResults) break;
        const residual = subtractVectors(remainingTarget, ss.stats, targetKeys);

        // Tier A (0): scroll-only fills remainingTarget
        if (normalizedAllowedSources.scrolls
            && isExactVector(ss.stats, remainingTarget, targetKeys)) {
          addResult({
            scrolls: ss.scrolls,
            stimulant: null,
            gems: [],
            itemLevelUp: ilc,
            priorityRank: 0,
          });
        }

        // Tier B (1): scroll + stimulant
        if (normalizedAllowedSources.stimulant && !tooManyResults) {
          const stimStats = solveStimulantResidual(residual, targetKeys, { ...stimulantOpts, bounds: stimulantStatBounds });
          if (stimStats) {
            addResult({
              scrolls: ss.scrolls,
              stimulant: { stats: stimStats },
              gems: [],
              itemLevelUp: ilc,
              priorityRank: 1,
            });
          }
        }

        // Tier C (2): scroll + gems
        if (normalizedAllowedSources.gems && !tooManyResults) {
          for (const gc of gemContributions) {
            if (tooManyResults) break;
            if (isExactVector(gc.stats, residual, targetKeys)) {
              addResult({
                scrolls: ss.scrolls,
                stimulant: null,
                gems: gc.gems,
                itemLevelUp: ilc,
                priorityRank: 2,
              });
            }
          }
        }

        // Tier D (4): scroll + stimulant + gems
        if (normalizedAllowedSources.stimulant && normalizedAllowedSources.gems
          && !tooManyResults) {
          for (const gc of gemContributions) {
            if (tooManyResults) break;
            const afterGems = subtractVectors(residual, gc.stats, targetKeys);
            const stimStats = solveStimulantResidual(afterGems, targetKeys, { ...stimulantOpts, bounds: stimulantStatBounds });
            if (stimStats) {
              addResult({
                scrolls: ss.scrolls,
                stimulant: { stats: stimStats },
                gems: gc.gems,
                itemLevelUp: ilc,
                priorityRank: 4,
              });
            }
          }
        }

        if (tooManyResults) break;
      }
    }
  } else {
    // EXISTING loop verbatim — copy of the current for loop, do not modify
    for (const ss of effectiveScrollStates) {
      effectiveScrollStatesSeen++;
      if (effectiveScrollStatesSeen > 150000) {
        console.log('[chaos-debug] HIT 150k scroll state limit — tooManyResults set to true. strategies so far:', strategies.length);
        tooManyResults = true;
        break;
      }
      if (tooManyResults) break;
      const residual = subtractVectors(effectiveTargetDeltas, ss.stats, targetKeys);

      // Tier 0: scroll-only (scrolls cover the entire effective target)
      if (normalizedAllowedSources.scrolls
          && isExactVector(ss.stats, effectiveTargetDeltas, targetKeys)) {
        addResult({
          scrolls: ss.scrolls,
          stimulant: null,
          gems: [],
          itemLevelUp: null,
          priorityRank: 0,
        });
      }

      // Tier 1: scroll + stimulant
      if (normalizedAllowedSources.stimulant && !tooManyResults) {
        const stimStats = solveStimulantResidual(residual, targetKeys, { ...stimulantOpts, bounds: stimulantStatBounds });
        if (stimStats) {
          addResult({
            scrolls: ss.scrolls,
            stimulant: { stats: stimStats },
            gems: [],
            itemLevelUp: null,
            priorityRank: 1,
          });
        }
      }

      // Tier 2: scroll + gems
      if (normalizedAllowedSources.gems && !tooManyResults) {
        for (const gc of gemContributions) {
          if (tooManyResults) break;
          if (isExactVector(gc.stats, residual, targetKeys)) {
            addResult({
              scrolls: ss.scrolls,
              stimulant: null,
              gems: gc.gems,
              itemLevelUp: null,
              priorityRank: 2,
            });
          }
        }
      }

      // Tier 3: scroll + itemLevelUp
      if (normalizedAllowedSources.itemLevelUp && !tooManyResults) {
        for (const ilc of itemLevelContributions) {
          if (tooManyResults) break;
          if (isExactVector(ilc.stats, residual, targetKeys)) {
            addResult({
              scrolls: ss.scrolls,
              stimulant: null,
              gems: [],
              itemLevelUp: ilc,
              priorityRank: 3,
            });
          }
        }
      }

      // Tier 4: scroll + stimulant + gems
      if (normalizedAllowedSources.stimulant && normalizedAllowedSources.gems
        && !tooManyResults) {
        for (const gc of gemContributions) {
          if (tooManyResults) break;
          const afterGems = subtractVectors(residual, gc.stats, targetKeys);
          const stimStats = solveStimulantResidual(afterGems, targetKeys, { ...stimulantOpts, bounds: stimulantStatBounds });
          if (stimStats) {
            addResult({
              scrolls: ss.scrolls,
              stimulant: { stats: stimStats },
              gems: gc.gems,
              itemLevelUp: null,
              priorityRank: 4,
            });
          }
        }
      }

      // Tier 5: scroll + stimulant + itemLevelUp
      if (normalizedAllowedSources.stimulant && normalizedAllowedSources.itemLevelUp
        && !tooManyResults) {
        for (const ilc of itemLevelContributions) {
          if (tooManyResults) break;
          const afterLevel = subtractVectors(residual, ilc.stats, targetKeys);
          const stimStats = solveStimulantResidual(afterLevel, targetKeys, { ...stimulantOpts, bounds: stimulantStatBounds });
          if (stimStats) {
            addResult({
              scrolls: ss.scrolls,
              stimulant: { stats: stimStats },
              gems: [],
              itemLevelUp: ilc,
              priorityRank: 5,
            });
          }
        }
      }

      // Tier 6: scroll + gems + itemLevelUp
      if (normalizedAllowedSources.gems && normalizedAllowedSources.itemLevelUp
        && !tooManyResults) {
        for (const gc of gemContributions) {
          if (tooManyResults) break;
          for (const ilc of itemLevelContributions) {
            if (tooManyResults) break;
            const combined = addVectors(gc.stats, ilc.stats, targetKeys);
            if (isExactVector(combined, residual, targetKeys)) {
              addResult({
                scrolls: ss.scrolls,
                stimulant: null,
                gems: gc.gems,
                itemLevelUp: ilc,
                priorityRank: 6,
              });
            }
          }
        }
      }

      // Tier 7: scroll + stimulant + gems + itemLevelUp
      if (normalizedAllowedSources.stimulant && normalizedAllowedSources.gems
        && normalizedAllowedSources.itemLevelUp && !tooManyResults) {
        for (const gc of gemContributions) {
          if (tooManyResults) break;
          for (const ilc of itemLevelContributions) {
            if (tooManyResults) break;
            const afterBoth = subtractVectors(residual, addVectors(gc.stats, ilc.stats, targetKeys), targetKeys);
            const stimStats = solveStimulantResidual(afterBoth, targetKeys, { ...stimulantOpts, bounds: stimulantStatBounds });
            if (stimStats) {
              addResult({
                scrolls: ss.scrolls,
                stimulant: { stats: stimStats },
                gems: gc.gems,
                itemLevelUp: ilc,
                priorityRank: 7,
              });
            }
          }
        }
      }

      if (tooManyResults) break;
    }
  }

  console.log('[chaos-debug] total strategies found:', strategies.length, 'tooManyResults:', tooManyResults, 'scrollStatesSeen:', effectiveScrollStatesSeen);

  // Sort strategies within each priority tier:
  //   1. priorityRank ascending (existing tier system)
  //   2. Non-chaos strategies first (chaosSpreadScore === -1)
  //   3. Chaos strategies by spread evenness (lower variance = more even)
  strategies.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    const aScore = chaosSpreadScore(a, targetKeys);
    const bScore = chaosSpreadScore(b, targetKeys);
    if (aScore !== bScore) return aScore - bScore;
    return 0;
  });

  return tooManyResults
    ? { strategies: [], total: OVERFLOW_TOTAL, tooManyResults: true }
    : { strategies, total: strategies.length, tooManyResults: false };
}
