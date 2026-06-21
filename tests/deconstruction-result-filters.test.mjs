import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RESULT_SOURCE_ORDER,
  buildSecondaryFilterModel,
  createInitialSecondarySelections,
  getFacetOptions,
  getVisibleStrategyIndexes,
  getStrategySecondaryOptions,
} from '../src/lib/deconstruction/resultFilters.mjs';

const strategies = [
  {
    sourceTypes: ['scrolls', 'gems'],
    scrolls: [
      { id: 1001, nameKo: '힘 주문서', stats: { str: 1 } },
      { id: 1002, nameKo: '민첩 주문서', stats: { dex: 1 } },
    ],
    stimulant: null,
    gems: [{ gemKey: 'strCrystal', nameKo: '힘의 크리스탈', gradeIndex: 2, stats: { str: 5 } }],
    itemLevelUp: null,
  },
  {
    sourceTypes: ['scrolls', 'gems'],
    scrolls: [{ id: 1002, nameKo: '민첩 주문서', stats: { dex: 1 } }],
    stimulant: null,
    gems: [{ gemKey: 'dexCrystal', nameKo: '민첩의 크리스탈', gradeIndex: 1, stats: { dex: 3 } }],
    itemLevelUp: null,
  },
  {
    sourceTypes: ['stimulant'],
    scrolls: [],
    stimulant: { stats: { str: 3, dex: -1, maxHp: 0 } },
    gems: [],
    itemLevelUp: null,
  },
  {
    sourceTypes: ['itemLevelUp'],
    scrolls: [],
    stimulant: null,
    gems: [],
    itemLevelUp: { levelCount: 5, stats: { str: 3, dex: 2 } },
  },
];

test('normalizes source-specific identities and labels', () => {
  const mixed = getStrategySecondaryOptions(strategies[0]);
  assert.deepEqual(mixed.scrolls.map(({ key }) => key), ['scroll:1001', 'scroll:1002']);
  assert.deepEqual(mixed.gems.map(({ key }) => key), ['gem:strCrystal:2']);
  assert.equal(mixed.gems[0].label, '힘의 크리스탈 상급');

  const stimulant = getStrategySecondaryOptions(strategies[2]);
  assert.deepEqual(stimulant.stimulant.map(({ key }) => key), ['stimulant:dex:-1|str:3']);
  assert.equal(stimulant.stimulant[0].label, 'STR +3, DEX -1');

  const level = getStrategySecondaryOptions(strategies[3]);
  assert.deepEqual(level.itemLevelUp.map(({ key }) => key), ['level:dex:2|str:3']);
  assert.equal(level.itemLevelUp[0].label, '5회 총합 — STR +3, DEX +2');
});

test('builds a global strategy universe and selects every option initially', () => {
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);

  assert.deepEqual(RESULT_SOURCE_ORDER, ['scrolls', 'stimulant', 'gems', 'itemLevelUp']);
  assert.deepEqual(model.entries.map(({ strategyIndex }) => strategyIndex), [0, 1, 2, 3]);
  assert.deepEqual([...selections.get('scrolls')].sort(), ['scroll:1001', 'scroll:1002']);
  assert.deepEqual([...selections.get('gems')].sort(), ['gem:dexCrystal:1', 'gem:strCrystal:2']);
  assert.deepEqual([...selections.get('stimulant')], ['stimulant:dex:-1|str:3']);
  assert.deepEqual([...selections.get('itemLevelUp')], ['level:dex:2|str:3']);
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [0, 1, 2, 3]);
});

test('unchecked enhancements globally exclude only strategies that use them', () => {
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);

  selections.get('scrolls').delete('scroll:1001');
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [1, 2, 3]);

  selections.get('gems').delete('gem:dexCrystal:1');
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [2, 3]);
});

test('other facet selections move incompatible options to the disabled tail', () => {
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);
  selections.get('gems').delete('gem:strCrystal:2');

  const scrollOptions = getFacetOptions(model, selections, 'scrolls');
  assert.deepEqual(scrollOptions.map(({ key, available }) => ({ key, available })), [
    { key: 'scroll:1002', available: true },
    { key: 'scroll:1001', available: false },
  ]);
  assert.equal(selections.get('scrolls').has('scroll:1001'), true);
});

test('an emptied facet remains recoverable while other facets become unavailable', () => {
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);
  selections.get('scrolls').clear();

  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [2, 3]);
  assert.ok(getFacetOptions(model, selections, 'scrolls').every(({ available }) => available));
  assert.ok(getFacetOptions(model, selections, 'gems').every(({ available }) => !available));
});

test('facet option ordering is deterministic when strategy input order changes', () => {
  const forward = buildSecondaryFilterModel(strategies);
  const reversed = buildSecondaryFilterModel([...strategies].reverse());
  const forwardSelections = createInitialSecondarySelections(forward);
  const reversedSelections = createInitialSecondarySelections(reversed);

  for (const source of RESULT_SOURCE_ORDER) {
    assert.deepEqual(
      getFacetOptions(forward, forwardSelections, source).map(({ key }) => key),
      getFacetOptions(reversed, reversedSelections, source).map(({ key }) => key),
      source,
    );
  }
});

test('facet option ordering breaks sort-key ties by option key', () => {
  const collisions = ['alphaCrystal', 'zetaCrystal'].map((gemKey) => ({
    gems: [{ gemKey, nameKo: '같은 이름', gradeIndex: 1 }],
  }));
  const expected = ['gem:alphaCrystal:1', 'gem:zetaCrystal:1'];

  for (const input of [collisions, [...collisions].reverse()]) {
    const model = buildSecondaryFilterModel(input);
    const selections = createInitialSecondarySelections(model);
    assert.deepEqual(
      getFacetOptions(model, selections, 'gems').map(({ key }) => key),
      expected,
    );
  }
});
