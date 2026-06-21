import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RESULT_SOURCE_ORDER,
  buildSecondaryFilterModel,
  createInitialSecondarySelections,
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

test('builds only the exact primary source universe and selects every option initially', () => {
  const model = buildSecondaryFilterModel(strategies, new Set(['scrolls', 'gems']));
  const selections = createInitialSecondarySelections(model);

  assert.deepEqual(RESULT_SOURCE_ORDER, ['scrolls', 'stimulant', 'gems', 'itemLevelUp']);
  assert.deepEqual(model.entries.map(({ strategyIndex }) => strategyIndex), [0, 1]);
  assert.deepEqual([...selections.get('scrolls')].sort(), ['scroll:1001', 'scroll:1002']);
  assert.deepEqual([...selections.get('gems')].sort(), ['gem:dexCrystal:1', 'gem:strCrystal:2']);
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [0, 1]);
});

test('unchecked enhancements exclude every strategy that uses them', () => {
  const model = buildSecondaryFilterModel(strategies, new Set(['scrolls', 'gems']));
  const selections = createInitialSecondarySelections(model);

  selections.get('scrolls').delete('scroll:1001');
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [1]);

  selections.get('gems').delete('gem:dexCrystal:1');
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), []);
});
