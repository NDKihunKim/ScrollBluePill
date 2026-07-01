import { GEM_GRADES, STAT_KEY_RANK, statLabelByKey } from '../makerData.mjs';

export const RESULT_SOURCE_ORDER = ['scrolls', 'stimulant', 'gems', 'itemLevelUp'];
export const STIMULANT_NONE_KEY = 'stimulant:none';

const canonicalStats = (stats = {}) => Object.entries(stats)
  .filter(([, value]) => Number.isFinite(value) && value !== 0)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => `${key}:${value}`)
  .join('|') || 'none';

const orderedStats = (stats = {}) => Object.entries(stats)
  .filter(([, value]) => Number.isFinite(value) && value !== 0)
  .sort(([left], [right]) =>
    (STAT_KEY_RANK[left] ?? 999) - (STAT_KEY_RANK[right] ?? 999)
    || left.localeCompare(right));

const formatStats = (stats) => {
  const parts = orderedStats(stats).map(([key, value]) =>
    `${statLabelByKey[key] ?? key} ${value > 0 ? '+' : ''}${value}`);
  return parts.join(', ') || '변화 없음';
};

/**
 * Strip the equipment prefix from chaos scroll names.
 * "장갑 혼돈의 주문서" → "혼돈의 주문서"
 * "장갑 민첩의 주문서" → unchanged (not a chaos scroll)
 */
export function simplifyScrollDisplayName(nameKo) {
  const match = String(nameKo ?? '').match(/(혼돈의 주문서.*)$/);
  return match ? match[1] : nameKo;
}

const stimulantSortGroup = (stats) => {
  const values = Object.values(stats ?? {}).filter((value) => Number.isFinite(value) && value !== 0);
  if (values.length === 0) return 1;
  return values.every((value) => value < 0) ? 0 : 2;
};

const stimulantKey = (stats) => {
  const statsKey = canonicalStats(stats);
  return `stimulant:${statsKey === 'none' ? 'stats:none' : statsKey}`;
};

const uniqueOptions = (options) => [...new Map(options.map((option) => [option.key, option])).values()];

const SCROLL_RATE_ORDER = { '100': 0, '60': 1, '10': 2 };
const getScrollRateOrder = (name) => {
  for (const [rate, order] of Object.entries(SCROLL_RATE_ORDER)) {
    if (name.includes(rate + '%')) return order;
  }
  return 3; // Chaos or unknown
};
const stemName = (n) => String(n ?? '').replace(/(\d+)%$/, '').trimEnd();
const getScrollPrimaryStatRank = (scroll) => {
  const stats = scroll.stats ?? {};
  const sorted = Object.keys(STAT_KEY_RANK).sort((a, b) => (STAT_KEY_RANK[a] ?? 999) - (STAT_KEY_RANK[b] ?? 999));
  for (const key of sorted) {
    if (Number.isFinite(stats[key]) && stats[key] !== 0) return STAT_KEY_RANK[key] ?? 999;
  }
  return 999;
};
const getScrollStatKeys = (stats) => Object.entries(stats ?? {})
  .filter(([, v]) => Number.isFinite(v) && v > 0)
  .map(([k]) => k);
const buildScrollSortKey = (scroll) => {
  const isChaos = scroll.behavior_type === 'chaos';
  const stem = stemName(scroll.nameKo ?? '');
  return String(getScrollPrimaryStatRank(scroll)).padStart(3, '0')
    + ':' + stem
    + ':' + String(getScrollRateOrder(scroll.nameKo ?? '')).padStart(2, '0')
    + ':' + (isChaos ? '1' : '0');
};

export function getStrategySecondaryOptions(strategy) {
  const scrolls = uniqueOptions((strategy.scrolls ?? []).map((scroll) => ({
    source: 'scrolls',
    key: `scroll:${scroll.id}`,
    label: simplifyScrollDisplayName(scroll.nameKo) ?? String(scroll.id),
    iconId: scroll.behavior_type === 'chaos' ? 2049100 : scroll.id,
    stats: { ...scroll.stats },
    statKeys: getScrollStatKeys(scroll.stats),
    behaviorType: scroll.behavior_type ?? 'normal',
    sortKey: buildScrollSortKey(scroll),
  })));
  let stimulant = [];
  if (strategy.stimulant === null) {
    stimulant = [{
      source: 'stimulant',
      key: STIMULANT_NONE_KEY,
      label: '+0',
      sortGroup: 1,
      sortKey: '+0',
    }];
  } else if (strategy.stimulant) {
    stimulant = [{
      source: 'stimulant',
      key: stimulantKey(strategy.stimulant.stats),
      label: formatStats(strategy.stimulant.stats),
      sortGroup: stimulantSortGroup(strategy.stimulant.stats),
      sortKey: formatStats(strategy.stimulant.stats),
      stats: { ...strategy.stimulant.stats },
    }];
  }
  const gems = uniqueOptions((strategy.gems ?? []).map((gem) => ({
    source: 'gems',
    key: `gem:${gem.gemKey}:${gem.gradeIndex}`,
    label: `${gem.nameKo ?? gem.gemKey} ${GEM_GRADES[gem.gradeIndex] ?? ''}`.trim(),
    gemKey: gem.gemKey,
    gradeIndex: gem.gradeIndex,
    sortKey: (gem.nameKo ?? gem.gemKey) + ':' + String(gem.gradeIndex),
  })));
  const itemLevelUp = strategy.itemLevelUp ? [{
    source: 'itemLevelUp',
    key: `level:${canonicalStats(strategy.itemLevelUp.stats)}`,
    label: `${strategy.itemLevelUp.levelCount}회 총합 — ${formatStats(strategy.itemLevelUp.stats)}`,
    sortKey: formatStats(strategy.itemLevelUp.stats),
    stats: { ...strategy.itemLevelUp.stats },
    levelCount: strategy.itemLevelUp.levelCount,
  }] : [];

  return { scrolls, stimulant, gems, itemLevelUp };
}

export function buildSecondaryFilterModel(strategies) {
  const entries = strategies.map((strategy, strategyIndex) => {
    const optionsBySource = getStrategySecondaryOptions(strategy);
    // Count how many times each scroll appears in this strategy
    const scrollCounts = new Map();
    for (const scroll of (strategy.scrolls ?? [])) {
      const key = `scroll:${scroll.id}`;
      scrollCounts.set(key, (scrollCounts.get(key) || 0) + 1);
    }
    return { strategyIndex, strategy, optionsBySource, scrollCounts };
  });

  const optionsBySource = new Map();
  for (const source of RESULT_SOURCE_ORDER) {
    const options = entries.flatMap((entry) => entry.optionsBySource[source]);
    optionsBySource.set(source, uniqueOptions(options));
  }
  return { entries, optionsBySource };
}

export function createInitialSecondarySelections(model) {
  return new Map([...model.optionsBySource].map(([source, options]) => [
    source,
    new Set(options.map(({ key }) => key)),
  ]));
}

function optionIsAllowed(source, option, checked) {
  return checked instanceof Set && (
    checked.has(option.key)
    || (source === 'stimulant' && checked.size === 0 && option.key === STIMULANT_NONE_KEY)
  );
}

function entryMatches(entry, selections, ignoredSource = null) {
  return Object.entries(entry.optionsBySource).every(([source, options]) => {
    if (source === ignoredSource || options.length === 0) return true;
    const checked = selections.get(source);
    return options.every((option) => optionIsAllowed(source, option, checked));
  });
}

export function getFacetOptions(model, selections, source) {
  const availableKeys = new Set(
    model.entries
      .filter((entry) => entryMatches(entry, selections, source))
      .flatMap((entry) => entry.optionsBySource[source].map(({ key }) => key)),
  );
  return (model.optionsBySource.get(source) ?? [])
    .map((option) => ({ ...option, available: availableKeys.has(option.key) }))
    .sort((left, right) =>
      Number(right.available) - Number(left.available)
      || (left.sortGroup ?? 0) - (right.sortGroup ?? 0)
      || left.sortKey.localeCompare(right.sortKey)
      || left.key.localeCompare(right.key));
}

function stimulantInRange(entry, ranges) {
  if (!ranges || ranges.size === 0) return true;
  const stimStats = entry.strategy.stimulant?.stats;
  if (!stimStats) return true;
  for (const [statKey, { min, max }] of ranges) {
    if (!Object.hasOwn(stimStats, statKey)) continue;
    const value = stimStats[statKey];
    if (value < min || value > max) return false;
  }
  return true;
}

function itemLevelUpInRange(entry, ranges) {
  if (!ranges || ranges.size === 0) return true;
  const levelStats = entry.strategy.itemLevelUp?.stats;
  if (!levelStats) return true;
  for (const [statKey, { min, max }] of ranges) {
    const value = levelStats[statKey] ?? 0;
    if (value < min || value > max) return false;
  }
  return true;
}

function scrollCountInRange(entry, ranges) {
  if (!ranges || ranges.size === 0) return true;
  for (const [scrollKey, { min, max }] of ranges) {
    const count = entry.scrollCounts?.get(scrollKey) ?? 0;
    if (count < min || count > max) return false;
  }
  return true;
}

function chaosDeltaInRange(entry, chaosRanges) {
  if (!chaosRanges || chaosRanges.size === 0) return true;
  for (const scroll of (entry.strategy.scrolls ?? [])) {
    if (scroll.behavior_type !== 'chaos') continue;
    const scrollRanges = chaosRanges.get(`scroll:${scroll.id}`);
    if (!scrollRanges) continue;
    for (const [statKey, { min, max }] of scrollRanges) {
      const value = scroll.stats?.[statKey] ?? 0;
      if (value < min || value > max) return false;
    }
  }
  return true;
}

export function getVisibleStrategyIndexes(
  model, selections,
  stimulantRanges = null, itemLevelUpRanges = null, scrollCountRanges = null, chaosDeltaRanges = null,
) {
  return model.entries
    .filter((entry) =>
      entryMatches(entry, selections)
      && stimulantInRange(entry, stimulantRanges)
      && itemLevelUpInRange(entry, itemLevelUpRanges)
      && scrollCountInRange(entry, scrollCountRanges)
      && chaosDeltaInRange(entry, chaosDeltaRanges))
    .map(({ strategyIndex }) => strategyIndex);
}
