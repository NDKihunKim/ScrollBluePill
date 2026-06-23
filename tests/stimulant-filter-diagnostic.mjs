import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSecondaryFilterModel,
  createInitialSecondarySelections,
  getFacetOptions,
  getVisibleStrategyIndexes,
} from '../src/lib/deconstruction/resultFilters.mjs';

function makeStrategy(scrolls, stimulant, gems, itemLevelUp) {
  return {
    scrolls,
    stimulant,
    gems,
    itemLevelUp,
    sourceTypes: [
      ...(scrolls.length > 0 ? ['scrolls'] : []),
      ...(stimulant ? ['stimulant'] : []),
      ...(gems.length > 0 ? ['gems'] : []),
      ...(itemLevelUp ? ['itemLevelUp'] : []),
    ],
    priorityRank: 0,
    totalStats: {},
  };
}

test('stimulant range slider correctly filters strategies by stats', () => {
  // Realistic scenario: all target keys are present (some may be 0),
  // matching how solveStimulantResidual produces stats
  const strategies = [
    makeStrategy([], { stats: { str: 5, dex: 3 } }, [], null),
    makeStrategy([], { stats: { str: 1, dex: 0 } }, [], null),
    makeStrategy([], null, [], null),
    makeStrategy([], { stats: { str: 0, dex: 4 } }, [], null),
  ];

  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);

  // Step 1: Before any stimulant panel render, stimulantRanges is empty
  const emptyRanges = null;
  const initialVisible = getVisibleStrategyIndexes(model, selections, emptyRanges, null);
  assert.equal(initialVisible.length, 4, 'all strategies visible initially');

  // Step 2: Simulate renderStimulantPanel populating stimulantRanges
  const options = getFacetOptions(model, selections, 'stimulant');
  const stimulantRanges = new Map();
  for (const option of options) {
    if (option.key === 'stimulant:none') continue;
    const stats = option.stats;
    if (!stats) continue;
    for (const [key, value] of Object.entries(stats)) {
      if (!Number.isFinite(value)) continue;
      if (!stimulantRanges.has(key)) {
        stimulantRanges.set(key, { min: value, max: value });
      } else {
        const r = stimulantRanges.get(key);
        r.min = Math.min(r.min, value);
        r.max = Math.max(r.max, value);
      }
    }
  }

  // Default ranges should show all strategies
  const defaultVisible = getVisibleStrategyIndexes(
    model, selections,
    stimulantRanges.size > 0 ? stimulantRanges : null, null
  );
  assert.equal(defaultVisible.length, 4, 'default ranges show all');

  // Step 3: User moves slider - narrow STR to [3,5]
  stimulantRanges.set('str', { min: 3, max: 5 });
  const strFiltered = getVisibleStrategyIndexes(
    model, selections, stimulantRanges, null
  );
  // Strategy 0 (str=5, dex=3): str=5 in [3,5] -> pass -> INCLUDED
  // Strategy 1 (str=1, dex=0): str=1 < 3 -> EXCLUDED
  // Strategy 2 (no stimulant): -> INCLUDED
  // Strategy 3 (str=0, dex=4): str=0 < 3 -> EXCLUDED
  assert.equal(strFiltered.length, 2);
  assert.ok(strFiltered.includes(0), 'strategy 0 visible');
  assert.ok(strFiltered.includes(2), 'strategy 2 (no stim) visible');
  assert.equal(strFiltered.includes(1), false, 'strategy 1 hidden');
  assert.equal(strFiltered.includes(3), false, 'strategy 3 hidden');

  // Step 4: Reset STR, narrow DEX to [1,3]
  stimulantRanges.set('str', { min: 0, max: 5 });
  stimulantRanges.set('dex', { min: 1, max: 3 });
  const dexFiltered = getVisibleStrategyIndexes(
    model, selections, stimulantRanges, null
  );
  // Strategy 0 (str=5, dex=3): dex=3 in [1,3] -> INCLUDED
  // Strategy 1 (str=1, dex=0): dex=0 < 1 -> EXCLUDED
  // Strategy 2 (no stimulant): -> INCLUDED
  // Strategy 3 (str=0, dex=4): dex=4 > 3 -> EXCLUDED
  assert.equal(dexFiltered.length, 2);
  assert.ok(dexFiltered.includes(0), 'strategy 0 visible');
  assert.ok(dexFiltered.includes(2), 'strategy 2 (no stim) visible');
});

test('strategy without stimulant always passes stimulantInRange', () => {
  const strategies = [
    makeStrategy([], { stats: { str: 1 } }, [], null),
    makeStrategy([], null, [], null),
  ];
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);

  // An impossible range should only exclude the stimulant strategy
  const extremeRange = new Map([['str', { min: 100, max: 200 }]]);
  const filtered = getVisibleStrategyIndexes(model, selections, extremeRange, null);
  assert.equal(filtered.length, 1);
  assert.ok(filtered.includes(1), 'no-stim strategy visible');
});

test('getVisibleStrategyIndexes includes no-stim strategies when some are filtered', () => {
  const strategies = [
    makeStrategy([], { stats: { str: 5 } }, [], null),
    makeStrategy([], null, [], null),
    makeStrategy([], null, [], null),
    makeStrategy([], { stats: { str: 3 } }, [], null),
  ];
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);

  // Filter to only show str >= 8
  const range = new Map([['str', { min: 8, max: 15 }]]);
  const filtered = getVisibleStrategyIndexes(model, selections, range, null);
  // Only no-stim strategies pass
  assert.equal(filtered.length, 2);
  assert.ok(filtered.includes(1));
  assert.ok(filtered.includes(2));
});

test('slider move must trigger applyFilters and update DOM correctly', () => {
  // This validates the critical integration path:
  // model -> getVisibleStrategyIndexes -> result indexes -> DOM cards
  const strategies = [
    makeStrategy([], { stats: { str: 10, dex: 5 } }, [], null),
    makeStrategy([], { stats: { str: 2, dex: 1 } }, [], null),
    makeStrategy([], null, [], null),
  ];

  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);

  // Simulate controller's stimulantRanges population
  const options = getFacetOptions(model, selections, 'stimulant');
  const stimulantRanges = new Map();
  for (const option of options) {
    if (option.key === 'stimulant:none') continue;
    const stats = option.stats;
    if (!stats) continue;
    for (const [key, value] of Object.entries(stats)) {
      if (!Number.isFinite(value)) continue;
      if (!stimulantRanges.has(key)) {
        stimulantRanges.set(key, { min: value, max: value });
      } else {
        const r = stimulantRanges.get(key);
        r.min = Math.min(r.min, value);
        r.max = Math.max(r.max, value);
      }
    }
  }

  // Simulate moving str min slider to 8
  stimulantRanges.set('str', { min: 8, max: 10 });

  // Get visible indexes (as getVisibleStrategyIndexes would be called from applyFilters)
  const visibleIndexes = new Set(getVisibleStrategyIndexes(
    model, selections,
    stimulantRanges.size > 0 ? stimulantRanges : null,
    null
  ));

  // Simulate what applyFilters does to DOM cards
  const mockCards = [
    { dataset: { strategyIndex: '0' }, hidden: false }, // str=10: in range
    { dataset: { strategyIndex: '1' }, hidden: false }, // str=2: out of range
    { dataset: { strategyIndex: '2' }, hidden: false }, // no stim: always visible
  ];

  for (const card of mockCards) {
    const idx = Number.parseInt(card.dataset.strategyIndex, 10);
    card.hidden = !visibleIndexes.has(idx);
  }

  assert.equal(mockCards[0].hidden, false, 'card 0 stays visible');
  assert.equal(mockCards[1].hidden, true, 'card 1 hidden');
  assert.equal(mockCards[2].hidden, false, 'card 2 stays visible');
});

test('strategy with missing stat keys (not zero) passes range check for missing stats', () => {
  // Edge case: a strategy's stimulant genuinely lacks a stat key that
  // appears in the ranges (from other strategies). Should not be
  // penalized with value=0 for that stat.
  const strategies = [
    makeStrategy([], { stats: { STR: 5 } }, [], null),        // has STR, no DEX
    makeStrategy([], { stats: { DEX: 3 } }, [], null),        // has DEX, no STR
    makeStrategy([], { stats: { STR: 8, DEX: 1 } }, [], null), // has both
  ];

  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);

  const options = getFacetOptions(model, selections, 'stimulant');

  // Build ranges from options (like renderStimulantPanel does)
  const stimulantRanges = new Map();
  for (const option of options) {
    if (option.key === 'stimulant:none') continue;
    const stats = option.stats;
    if (!stats) continue;
    for (const [key, value] of Object.entries(stats)) {
      if (!Number.isFinite(value)) continue;
      if (!stimulantRanges.has(key)) {
        stimulantRanges.set(key, { min: value, max: value });
      } else {
        const r = stimulantRanges.get(key);
        r.min = Math.min(r.min, value);
        r.max = Math.max(r.max, value);
      }
    }
  }

  // Default ranges should include all strategies
  const defaultVisible = getVisibleStrategyIndexes(
    model, selections, stimulantRanges.size > 0 ? stimulantRanges : null, null
  );
  assert.equal(defaultVisible.length, 3,
    'default ranges should show all strategies (missing stats skipped)');
});
