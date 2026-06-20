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

const MAX_DISPLAY_STRATEGIES = 1000;
const OVERFLOW_TOTAL = 1001;

/**
 * Check whether a scroll is a chaos-type scroll (random delta values).
 */
function isChaosScroll(scroll) {
  return scroll.behavior_type === 'chaos';
}

function getChaosRange(statKey) {
  if (HP_MP_KEYS.has(statKey)) return { min: -50, max: 50 };
  return { min: -5, max: 5 };
}

function* generateChaosDeltas(stats, limit = 500) {
  const statKeys = Object.keys(stats);
  if (statKeys.length === 0) return;

  const ranges = statKeys.map((key) => {
    const { min, max } = getChaosRange(key);
    const values = [];
    for (let v = min; v <= max; v++) values.push(v);
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

  // Filter scrolls to those touching at least one checked key
  const relevantScrolls = allScrolls.filter((s) =>
    targetKeys.some((k) => (s.stats?.[k] || 0) !== 0),
  );
  if (relevantScrolls.length === 0) return [];

  const fixedScrolls = relevantScrolls
    .filter((s) => !isChaosScroll(s))
    .sort((a, b) => a.id - b.id);

  const chaosScrolls = relevantScrolls
    .filter((s) => isChaosScroll(s))
    .sort((a, b) => a.id - b.id);

  const chaosPool = [];
  for (const cs of chaosScrolls) {
    for (const deltas of generateChaosDeltas(cs.stats)) {
      chaosPool.push({ baseScroll: cs, deltas });
    }
  }

  function* dfs(fixedIdx, remainingApps, currentStats, chosen) {
    if (remainingApps === 0 && chosen.length === requiredScrollCount) {
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

    // Try chaos scrolls
    if (chaosPool.length > 0) {
      for (const entry of chaosPool) {
        const { baseScroll: cs, deltas } = entry;
        const newStats = { ...currentStats };
        for (const [k, v] of Object.entries(deltas)) {
          if (targetKeys.includes(k)) {
            newStats[k] = (newStats[k] || 0) + v;
          }
        }
        const chaosApp = {
          ...cs,
          stats: { ...deltas },
        };
        yield* dfs(fixedIdx, remainingApps - 1, newStats, [...chosen, chaosApp]);
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
 * Build a strategy result object.
 */
function buildResult({ scrolls, stimulant, gems, itemLevelUp, priorityRank, targetKeys }) {
  const scrollEntries = scrolls.map((s) => ({
    id: s.id,
    nameKo: s.nameKo,
    stats: { ...s.stats },
  }));

  const hasStimulant = stimulant !== null;
  const hasItemLevelUp = itemLevelUp !== null;

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
  if (itemLevelUp) addStats(itemLevelUp.stats);

  return {
    scrolls: scrollEntries,
    stimulant,
    gems,
    itemLevelUp,
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
 * @param {object}          opts.allowedSources         Optional source permissions
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
}) {
  const strategies = [];
  let tooManyResults = false;
  const seenKeys = new Set();

  if (targetKeys.length === 0) {
    return { strategies: [], total: 0, tooManyResults: false };
  }

  const normCount = (() => {
    try {
      const n = Number(successfulScrollCount);
      return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    } catch {
      return 0;
    }
  })();

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
    stimulantBounds[k] = { min: -limit, max: limit };
    gemBounds[k] = { min: -Infinity, max: Infinity };
  }
  const itemBounds = {};
  for (const k of targetKeys) {
    itemBounds[k] = { min: -Infinity, max: Infinity };
  }

  // Compute gem slot count using Maker system level thresholds
  //  0 for <48, 1 for 48-77, 2 for 78-105, 3 for 106+
  const gemSlotCount = computeGemSlotCount(requiredLevel);

  // Generate fallback contributions
  const gemContributions = normalizedAllowedSources.gems
    ? enumerateGemContributions({
        gemSlotCount,
        equipmentKind,
        cleanStats,
        targetKeys,
        bounds: gemBounds,
      })
    : [];

  const itemLevelContributions = normalizedAllowedSources.itemLevelUp
    ? enumerateItemLevelContributions({
        levelUpDefinition,
        targetKeys,
        bounds: itemBounds,
      })
    : [];

  const scrolls = scrollsByEquipmentKind.get(equipmentKind) ?? [];

  const equipmentIsWeapon = isWeaponKind(equipmentKind);
  const stimulantOpts = { isWeapon: equipmentIsWeapon };

  // Generate exact-count scroll states
  const effectiveScrollStates = normalizedAllowedSources.scrolls && normCount > 0
    ? enumerateExactCountScrollStates({
        scrolls,
        targetKeys,
        targetDeltas,
        successfulScrollCount: normCount,
        correctionBounds: stimulantBounds,
      })
    : (normCount === 0
      ? [{ scrolls: [], stats: Object.fromEntries(targetKeys.map((k) => [k, 0])) }]
      : []);

  const targetVector = targetKeys.reduce((acc, k) => {
    acc[k] = targetDeltas[k] ?? 0;
    return acc;
  }, {});

  function addResult(parts) {
    if (tooManyResults) return;
    const result = buildResult({ ...parts, targetKeys });
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

  for (const ss of effectiveScrollStates) {
    const residual = subtractVectors(targetVector, ss.stats, targetKeys);

    // Tier 0: scroll-only
    if (normalizedAllowedSources.scrolls && isExactVector(ss.stats, targetVector, targetKeys)) {
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
      const stimStats = solveStimulantResidual(residual, targetKeys, stimulantOpts);
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
        const stimStats = solveStimulantResidual(afterGems, targetKeys, stimulantOpts);
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
        const stimStats = solveStimulantResidual(afterLevel, targetKeys, stimulantOpts);
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
          const stimStats = solveStimulantResidual(afterBoth, targetKeys, stimulantOpts);
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

  return tooManyResults
    ? { strategies: [], total: OVERFLOW_TOTAL, tooManyResults: true }
    : { strategies, total: strategies.length, tooManyResults: false };
}
