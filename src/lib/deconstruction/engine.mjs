import { HP_MP_KEYS } from '../enhancementState.mjs';

/**
 * Parse the success probability from a scroll's nameKo.
 * @param {object} scroll
 * @returns {number} Probability between 0 and 1.
 */
function parseScrollProbability(scroll) {
  if (!scroll?.nameKo) return 1.0;
  const match = scroll.nameKo.match(/(\d+)%/);
  if (!match) return 1.0;
  const pct = parseInt(match[1], 10);
  if (Number.isNaN(pct)) return 1.0;
  return pct / 100;
}

/**
 * Check whether a scroll is a chaos-type scroll (random delta values).
 * @param {object} scroll
 * @returns {boolean}
 */
function isChaosScroll(scroll) {
  return scroll.behavior_type === 'chaos';
}

/**
 * Get the delta range for a single stat key when a chaos scroll is applied.
 * @param {string} statKey
 * @returns {{min: number, max: number}}
 */
function getChaosRange(statKey) {
  if (HP_MP_KEYS.has(statKey)) return { min: -50, max: 50 };
  return { min: -5, max: 5 };
}

/**
 * Generate all possible delta permutations for a chaos scroll's stats.
 * Yields objects mapping statKey to integer delta within the allowed range.
 * Caps at `limit` permutations.
 *
 * @param {object} stats  The scroll's stats object (keys = stat names)
 * @param {number} [limit=500]
 * @yields {object}
 */
function* generateChaosDeltas(stats, limit = 500) {
  const statKeys = Object.keys(stats);
  if (statKeys.length === 0) return;

  // Build the range of values for each stat key
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
 * Build a canonical deduplication key for a list of scroll usages.
 * Fixed scrolls are sorted by id; for chaos scrolls the per-application
 * deltas are also encoded so different delta permutations stay distinct.
 *
 * @param {Array<object>} scrolls
 * @returns {string}
 */
function canonicalKey(scrolls) {
  return scrolls
    .map((s) => {
      const statKeys = Object.keys(s.stats).sort();
      const statPart = statKeys
        .map((k) => `${k}:${s.stats[k]}`)
        .join(',');
      return `${s.id}[${statPart}]`;
    })
    .sort()
    .join('|');
}

/**
 * Build a strategy object in the required output format.
 *
 * @param {Array<object>} chosenScrolls  Each element is the scroll object,
 *        except for chaos scrolls whose `.stats` has been replaced with the
 *        specific delta values used in this application.
 * @returns {object}
 */
function buildStrategy(chosenScrolls) {
  const scrollEntries = chosenScrolls.map((s) => ({
    id: s.id,
    nameKo: s.nameKo,
    stats: { ...s.stats },
  }));

  const probability = chosenScrolls.reduce(
    (prod, s) => prod * parseScrollProbability(s),
    1.0,
  );

  // Compute total stats contributed by all scrolls
  const totalStats = {};
  for (const s of chosenScrolls) {
    for (const [k, v] of Object.entries(s.stats)) {
      if (Number.isFinite(v)) {
        totalStats[k] = (totalStats[k] || 0) + v;
      }
    }
  }

  return {
    scrolls: scrollEntries,
    gems: [],
    hasStimulant: false,
    hasItemLevelUp: false,
    probability,
    approach: ['주문서'],
    totalStats,
  };
}

/**
 * Enumerate all scroll-only strategies that produce exactly `targetDeltas`.
 *
 * @param {object} opts
 * @param {object}          opts.targetDeltas           Desired net stat deltas
 *        (e.g. { weaponAttack: 2, str: 1 })
 * @param {number}          opts.upgradeSlots           Number of available
 *        enhancement slots on the item
 * @param {string}          opts.equipmentKind          Equipment kind key
 * @param {Map<string,Array<object>>} opts.scrollsByEquipmentKind  Map of
 *        equipment kind -> scroll array
 * @returns {{ strategies: Array<object>, total: number, truncated: boolean }}
 */
export function enumerateStrategies({
  targetDeltas,
  upgradeSlots,
  equipmentKind,
  scrollsByEquipmentKind,
}) {
  const scrolls = scrollsByEquipmentKind.get(equipmentKind);
  if (!scrolls || scrolls.length === 0) {
    return { strategies: [], total: 0, truncated: false };
  }

  // Only consider stat keys that have a positive target delta
  const targetKeys = Object.keys(targetDeltas).filter(
    (k) => targetDeltas[k] > 0,
  );
  if (targetKeys.length === 0) {
    return { strategies: [], total: 0, truncated: false };
  }

  const MAX_STRATEGIES = 200;
  const strategies = [];
  let truncated = false;
  const seenKeys = new Set();

  // --- Separate scrolls into fixed and chaos pools ---
  const fixedScrolls = scrolls
    .filter((s) => !isChaosScroll(s))
    .sort((a, b) => a.id - b.id);

  const chaosScrolls = scrolls
    .filter((s) => isChaosScroll(s))
    .sort((a, b) => a.id - b.id);

  // Pre-compute chaos delta permutations (avoid re-generating inside recursion)
  const chaosPool = [];
  for (const cs of chaosScrolls) {
    for (const deltas of generateChaosDeltas(cs.stats)) {
      chaosPool.push({
        baseScroll: cs,
        deltas,
      });
    }
  }

  // How many zero-valued target keys exist (for checking total match)
  const allTargetKeys = Object.keys(targetDeltas).filter(
    (k) => targetDeltas[k] !== 0,
  );

  /**
   * Check whether exactly matching the target without any overflow.
   * Non-targeted stats must not be added by scrolls (except for stats that
   * are zero in the target — fixed scrolls with extras are excluded unless
   * the extra stat is also zero in the target).
   */
  function isExactMatch(deltas) {
    return allTargetKeys.every((k) => (deltas[k] || 0) === 0);
  }

  /**
   * Recursive DFS that tries count-based fixed scrolls and single chaos
   * scroll entries.
   *
   * @param {number} fixedIdx    Index into fixedScrolls to start from
   * @param {number} remainingSlots  Available enhancement slots
   * @param {object} remainingDeltas  Remaining stats needed {key: value}
   * @param {Array<object>} chosen  Scrolls selected so far
   * @returns {boolean}  true if we should stop (hit cap)
   */
  function dfs(fixedIdx, remainingSlots, remainingDeltas, chosen) {
    // Check exact match
    if (isExactMatch(remainingDeltas)) {
      const strategy = buildStrategy(chosen);
      const key = canonicalKey(chosen);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        strategies.push(strategy);
        if (strategies.length >= MAX_STRATEGIES) {
          truncated = true;
          return true;
        }
      }
      return;
    }

    // Dead end: any remaining positive delta with no more slots
    const anyRemaining = allTargetKeys.some(
      (k) => (remainingDeltas[k] || 0) > 0,
    );
    if (remainingSlots <= 0 && anyRemaining) return;

    // Dead end: remaining slots but all deltas are already zero or negative
    // (this means we've exceeded the target, which shouldn't happen with
    // proper pruning but guard anyway)
    const allNonPositive = allTargetKeys.every(
      (k) => (remainingDeltas[k] || 0) <= 0,
    );
    if (allNonPositive && remainingSlots > 0) {
      // Check exact match one more time (handles chaos scrolls adding
      // negative values that could bring things back to zero)
      if (isExactMatch(remainingDeltas)) {
        const strategy = buildStrategy(chosen);
        const key = canonicalKey(chosen);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          strategies.push(strategy);
          if (strategies.length >= MAX_STRATEGIES) {
            truncated = true;
            return true;
          }
        }
      }
      return;
    }

    // --- Try fixed scrolls (count-based) ---
    for (let i = fixedIdx; i < fixedScrolls.length; i++) {
      const scroll = fixedScrolls[i];
      const stats = scroll.stats;

      // Calculate max uses: bounded by remaining slots and target deltas
      let maxUses = remainingSlots;

      for (const k of allTargetKeys) {
        const delta = stats[k] || 0;
        const remaining = remainingDeltas[k] || 0;
        if (delta > 0 && remaining > 0) {
          maxUses = Math.min(
            maxUses,
            Math.floor(remaining / delta),
          );
        } else if (delta > 0 && remaining <= 0) {
          maxUses = 0; // would overshoot this stat
          break;
        }
        // If delta < 0 (negative values from a chaos-like fixed scroll),
        // it adds to target — allow it (maxUses unchanged)
      }

      if (maxUses <= 0) continue;

      for (let count = maxUses; count >= 1; count--) {
        const newDeltas = { ...remainingDeltas };
        for (const [k, v] of Object.entries(stats)) {
          if (Number.isFinite(v)) {
            newDeltas[k] = (newDeltas[k] || 0) - v * count;
          }
        }

        const newChosen = [...chosen];
        for (let c = 0; c < count; c++) {
          newChosen.push(scroll);
        }

        if (dfs(i + 1, remainingSlots - count, newDeltas, newChosen)) {
          return true;
        }
      }
    }

    // --- Try chaos scrolls (one application at a time) ---
    if (chaosPool.length > 0 && remainingSlots > 0) {
      for (const entry of chaosPool) {
        const { baseScroll: cs, deltas } = entry;

        // Check that the chaos deltas don't exceed remaining deltas
        const valid = allTargetKeys.every((k) => {
          const remaining = remainingDeltas[k] || 0;
          const d = deltas[k] || 0;
          // Chaos delta should not exceed remaining target
          return d <= remaining;
        });

        if (!valid) continue;

        const newDeltas = { ...remainingDeltas };
        for (const [k, v] of Object.entries(deltas)) {
          newDeltas[k] = (newDeltas[k] || 0) - v;
        }

        // Clone the scroll but replace stats with the specific deltas
        const chaosApplication = {
          ...cs,
          stats: { ...deltas },
        };

        const newChosen = [...chosen, chaosApplication];

        if (dfs(fixedIdx, remainingSlots - 1, newDeltas, newChosen)) {
          return true;
        }
      }
    }

    return false;
  }

  // Handle edge case: negative target deltas mean we need negative stats.
  // In the current model we only handle positive target deltas. If any
  // target delta is negative, we still attempt enumeration though the
  // pruning will naturally filter.
  dfs(0, upgradeSlots, { ...targetDeltas }, []);

  return {
    strategies,
    total: strategies.length,
    truncated,
  };
}
