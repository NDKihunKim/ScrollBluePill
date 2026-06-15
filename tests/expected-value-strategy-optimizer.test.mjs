import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countRngSources,
  countTotalActions,
  rankStrategies,
  optimizeStrategies,
} from '../src/lib/expectedValue/strategyOptimizer.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScroll(nameKo, stats = {}, behaviorType) {
  const scroll = { nameKo, stats };
  if (behaviorType) {
    scroll.behavior_type = behaviorType;
  }
  return scroll;
}

function makeGem(gemKey, grade) {
  return { gemKey, grade };
}

// ---------------------------------------------------------------------------
// countRngSources
// ---------------------------------------------------------------------------

test('countRngSources returns 0 for deterministic strategy (fixed gem + fixed scroll)', () => {
  const strategy = {
    makerChoices: [makeGem('diamond', 1), makeGem('strCrystal', 0)],
    scrollSequence: [
      makeScroll('공격력의 주문서 100%', { weaponAttack: 5 }),
      makeScroll('방어력의 주문서 100%', { weaponDefense: 3 }),
    ],
    useItemLevelUp: false,
  };
  assert.equal(countRngSources(strategy), 0);
});

test('countRngSources counts chaos scrolls', () => {
  const strategy = {
    makerChoices: [makeGem('diamond', 1)],
    scrollSequence: [
      makeScroll('혼돈의 주문서', {}, 'chaos'),
    ],
    useItemLevelUp: false,
  };
  assert.equal(countRngSources(strategy), 1);
});

test('countRngSources counts random Maker gems', () => {
  const strategy = {
    makerChoices: [makeGem('blackAmethyst', 1)],
    scrollSequence: [],
    useItemLevelUp: false,
  };
  assert.equal(countRngSources(strategy), 1);
});

test('countRngSources counts item level-up', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [],
    useItemLevelUp: true,
  };
  assert.equal(countRngSources(strategy), 1);
});

test('countRngSources counts multiple RNG sources', () => {
  const strategy = {
    makerChoices: [makeGem('blackAmethyst', 1)],
    scrollSequence: [
      makeScroll('혼돈의 주문서', {}, 'chaos'),
    ],
    useItemLevelUp: true,
  };
  assert.equal(countRngSources(strategy), 3);
});

// ---------------------------------------------------------------------------
// countTotalActions
// ---------------------------------------------------------------------------

test('countTotalActions sums maker choices, scrolls, and item level-up', () => {
  const strategy = {
    makerChoices: [makeGem('diamond', 1), makeGem('strCrystal', 0)],
    scrollSequence: [
      makeScroll('공격력의 주문서 100%', { weaponAttack: 5 }),
    ],
    useItemLevelUp: true,
  };
  // 2 maker choices + 1 scroll + 1 level-up = 4
  assert.equal(countTotalActions(strategy), 4);
});

test('countTotalActions returns 0 for empty strategy', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [],
    useItemLevelUp: false,
  };
  assert.equal(countTotalActions(strategy), 0);
});

test('countTotalActions counts maker choices and scrolls without level-up', () => {
  const strategy = {
    makerChoices: [makeGem('diamond', 1)],
    scrollSequence: [
      makeScroll('공격력의 주문서 100%', { weaponAttack: 5 }),
      makeScroll('방어력의 주문서 100%', { weaponDefense: 3 }),
    ],
    useItemLevelUp: false,
  };
  // 1 maker choice + 2 scrolls = 3
  assert.equal(countTotalActions(strategy), 3);
});

// ---------------------------------------------------------------------------
// rankStrategies
// ---------------------------------------------------------------------------

test('rankStrategies ranks higher probability first', () => {
  const a = { successProbability: 0.5, rngSources: 0, totalActions: 1, strategyIndex: 0 };
  const b = { successProbability: 0.8, rngSources: 0, totalActions: 1, strategyIndex: 1 };

  // b has higher probability, so b should sort before a
  const sorted = [a, b].sort(rankStrategies);
  assert.equal(sorted[0], b);
  assert.equal(sorted[1], a);
});

test('rankStrategies breaks ties with fewer RNG sources', () => {
  const a = { successProbability: 0.8, rngSources: 2, totalActions: 1, strategyIndex: 0 };
  const b = { successProbability: 0.8, rngSources: 1, totalActions: 1, strategyIndex: 1 };

  // Same probability, b has fewer RNG sources, so b should sort before a
  const sorted = [a, b].sort(rankStrategies);
  assert.equal(sorted[0], b);
  assert.equal(sorted[1], a);
});

test('rankStrategies breaks further ties with fewer total actions', () => {
  const a = { successProbability: 0.8, rngSources: 1, totalActions: 3, strategyIndex: 0 };
  const b = { successProbability: 0.8, rngSources: 1, totalActions: 1, strategyIndex: 1 };

  // Same probability, same RNG sources, b has fewer total actions, so b before a
  const sorted = [a, b].sort(rankStrategies);
  assert.equal(sorted[0], b);
  assert.equal(sorted[1], a);
});

test('rankStrategies uses strategyIndex for deterministic tiebreak', () => {
  const a = { successProbability: 0.8, rngSources: 1, totalActions: 2, strategyIndex: 5 };
  const b = { successProbability: 0.8, rngSources: 1, totalActions: 2, strategyIndex: 3 };

  // Everything equal except strategyIndex, lower index (3) should sort before higher (5)
  const sorted = [a, b].sort(rankStrategies);
  assert.equal(sorted[0], b);
  assert.equal(sorted[1], a);
});

test('rankStrategies handles full comparison chain', () => {
  // Items sorted best to worst:
  // Item 0: prob=0.9, rng=0, actions=2, index=5  (best: highest prob, no RNG)
  // Item 1: prob=0.8, rng=1, actions=1, index=2  (lower prob)
  // Item 2: prob=0.8, rng=2, actions=1, index=1  (same prob, more RNG)
  // Item 3: prob=0.8, rng=2, actions=3, index=0  (same prob, same RNG, more actions)
  // Item 4: prob=0.8, rng=2, actions=3, index=4  (same everything, higher index)
  const items = [
    { successProbability: 0.8, rngSources: 2, totalActions: 3, strategyIndex: 4 },
    { successProbability: 0.9, rngSources: 0, totalActions: 2, strategyIndex: 5 },
    { successProbability: 0.8, rngSources: 1, totalActions: 1, strategyIndex: 2 },
    { successProbability: 0.8, rngSources: 2, totalActions: 1, strategyIndex: 1 },
    { successProbability: 0.8, rngSources: 2, totalActions: 3, strategyIndex: 0 },
  ].sort(rankStrategies);

  assert.equal(items[0].strategyIndex, 5);  // best: prob=0.9
  assert.equal(items[1].strategyIndex, 2);  // prob=0.8, rng=1
  assert.equal(items[2].strategyIndex, 1);  // prob=0.8, rng=2, actions=1
  assert.equal(items[3].strategyIndex, 0);  // prob=0.8, rng=2, actions=3, index=0
  assert.equal(items[4].strategyIndex, 4);  // prob=0.8, rng=2, actions=3, index=4
});

// ---------------------------------------------------------------------------
// optimizeStrategies
// ---------------------------------------------------------------------------

test('optimizeStrategies returns the best strategy', () => {
  const scored = [
    { strategy: { id: 'a' }, successProbability: 0.5, rngSources: 1, totalActions: 2, strategyIndex: 0 },
    { strategy: { id: 'b' }, successProbability: 0.9, rngSources: 0, totalActions: 1, strategyIndex: 1 },
    { strategy: { id: 'c' }, successProbability: 0.7, rngSources: 2, totalActions: 3, strategyIndex: 2 },
  ];

  const best = optimizeStrategies(scored);
  assert.notEqual(best, null);
  assert.equal(best.strategy.id, 'b');
});

test('optimizeStrategies returns null for empty array', () => {
  assert.equal(optimizeStrategies([]), null);
});
