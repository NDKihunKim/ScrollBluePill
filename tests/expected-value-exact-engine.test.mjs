import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDeterministicStrategy,
  computeExactProbability,
} from '../src/lib/expectedValue/exactEngine.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScroll(nameKo, stats = {}, behaviorType = 'fixed') {
  return { nameKo, stats, behavior_type: behaviorType };
}

function makeGem(gemKey, grade) {
  return { gemKey, grade };
}

// ---------------------------------------------------------------------------
// isDeterministicStrategy
// ---------------------------------------------------------------------------

test('isDeterministicStrategy returns true for fixed scrolls + fixed gems', () => {
  const strategy = {
    makerChoices: [makeGem('diamond', 1), makeGem('strCrystal', 0)],
    scrollSequence: [
      makeScroll('공격력의 주문서 60%', { weaponAttack: 5 }),
      makeScroll('방어력의 주문서 100%', { weaponDefense: 3 }),
    ],
    useItemLevelUp: false,
  };
  assert.equal(isDeterministicStrategy(strategy), true);
});

test('isDeterministicStrategy returns false if chaos scroll present', () => {
  const strategy = {
    makerChoices: [makeGem('diamond', 1)],
    scrollSequence: [
      makeScroll('혼돈의 주문서', {}, 'chaos'),
    ],
    useItemLevelUp: false,
  };
  assert.equal(isDeterministicStrategy(strategy), false);
});

test('isDeterministicStrategy returns false with random Maker gems (blackAmethyst)', () => {
  const strategy = {
    makerChoices: [makeGem('blackAmethyst', 1)],
    scrollSequence: [
      makeScroll('공격력의 주문서 100%', { weaponAttack: 5 }),
    ],
    useItemLevelUp: false,
  };
  assert.equal(isDeterministicStrategy(strategy), false);
});

test('isDeterministicStrategy returns false with item level-up', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [],
    useItemLevelUp: true,
  };
  assert.equal(isDeterministicStrategy(strategy), false);
});

test('isDeterministicStrategy treats manual variable gem stats as deterministic', () => {
  const strategy = {
    makerChoices: [
      { gemKey: 'darkCrystal', stats: { str: 3 }, mode: 'manual' },
    ],
    scrollSequence: [],
    useItemLevelUp: false,
    useStimulant: false,
  };

  assert.equal(isDeterministicStrategy(strategy), true);
});

test('isDeterministicStrategy treats missing-mode variable gem stats as deterministic', () => {
  const strategy = {
    makerChoices: [
      { gemKey: 'darkCrystal', stats: { str: 3 } },
    ],
    scrollSequence: [],
    useItemLevelUp: false,
    useStimulant: false,
  };

  assert.equal(isDeterministicStrategy(strategy), true);
});

test('isDeterministicStrategy treats probability variable gem stats as random', () => {
  const strategy = {
    makerChoices: [
      { gemKey: 'darkCrystal', stats: { str: 3 }, mode: 'probability' },
    ],
    scrollSequence: [],
    useItemLevelUp: false,
    useStimulant: false,
  };

  assert.equal(isDeterministicStrategy(strategy), false);
});

// ---------------------------------------------------------------------------
// computeExactProbability
// ---------------------------------------------------------------------------

test('computeExactProbability returns 1.0 for empty strategy with no target thresholds', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [],
    useItemLevelUp: false,
  };
  const cleanStats = { str: 10 };
  const targetConditions = { statThresholds: {}, gradeThreshold: null };

  const prob = computeExactProbability(strategy, cleanStats, targetConditions);
  assert.equal(prob, 1.0);
});

test('computeExactProbability applies manual variable gem stats to baseline', () => {
  const strategy = {
    makerChoices: [
      { gemKey: 'darkCrystal', stats: { str: 3 }, mode: 'manual' },
    ],
    scrollSequence: [],
    useItemLevelUp: false,
    useStimulant: false,
  };
  const cleanStats = { str: 10 };
  const targetConditions = { statThresholds: { str: 3 }, gradeThreshold: null };

  const prob = computeExactProbability(strategy, cleanStats, targetConditions);
  assert.equal(prob, 1);
});

test('computeExactProbability applies missing-mode variable gem stats to baseline', () => {
  const strategy = {
    makerChoices: [
      { gemKey: 'darkCrystal', stats: { str: 3 } },
    ],
    scrollSequence: [],
    useItemLevelUp: false,
    useStimulant: false,
  };
  const cleanStats = { str: 10 };
  const targetConditions = { statThresholds: { str: 3 }, gradeThreshold: null };

  const prob = computeExactProbability(strategy, cleanStats, targetConditions);
  assert.equal(prob, 1);
});

test('computeExactProbability single 60% scroll gives 0.6', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [
      makeScroll('테스트 주문서 60%', { str: 5 }),
    ],
    useItemLevelUp: false,
  };
  const cleanStats = { str: 0 };
  // Target: str gain >= 5 (scroll gives +5 on success)
  const targetConditions = { statThresholds: { str: 5 }, gradeThreshold: null };

  const prob = computeExactProbability(strategy, cleanStats, targetConditions);
  assert.equal(prob, 0.6);
});

test('computeExactProbability two independent 10% scrolls gives ~0.19', () => {
  // At least one scroll must succeed: 1 - (0.9 * 0.9) = 0.19
  const strategy = {
    makerChoices: [],
    scrollSequence: [
      makeScroll('테스트 주문서 10%', { str: 1 }),
      makeScroll('테스트 주문서 10%', { str: 1 }),
    ],
    useItemLevelUp: false,
  };
  const cleanStats = { str: 0 };
  // Target: str gain >= 1 (at least one scroll succeeds)
  const targetConditions = { statThresholds: { str: 1 }, gradeThreshold: null };

  const prob = computeExactProbability(strategy, cleanStats, targetConditions);
  assert.ok(Math.abs(prob - 0.19) < 0.001, `expected ~0.19, got ${prob}`);
});

test('computeExactProbability 100% scroll gives 1.0', () => {
  const strategy = {
    makerChoices: [],
    scrollSequence: [
      makeScroll('테스트 주문서 100%', { str: 3 }),
    ],
    useItemLevelUp: false,
  };
  const cleanStats = { str: 0 };
  const targetConditions = { statThresholds: {}, gradeThreshold: null };

  const prob = computeExactProbability(strategy, cleanStats, targetConditions);
  assert.equal(prob, 1.0);
});

test('computeExactProbability fixed Maker + scroll where Maker already meets target gives 1.0', () => {
  // diamond grade 1 gives weaponAttack +2, target is weaponAttack >= 2
  // Scroll outcome doesn't matter — Maker alone already satisfies target
  const strategy = {
    makerChoices: [makeGem('diamond', 1)],
    scrollSequence: [
      makeScroll('테스트 주문서 60%', { weaponAttack: 5 }),
    ],
    useItemLevelUp: false,
  };
  const cleanStats = { weaponAttack: 0 };
  const targetConditions = { statThresholds: { weaponAttack: 2 }, gradeThreshold: null };

  const prob = computeExactProbability(strategy, cleanStats, targetConditions);
  assert.equal(prob, 1.0);
});

test('computeExactProbability Maker does not fully meet target, scroll needed gives correct probability', () => {
  // diamond grade 0 gives weaponAttack +1, target is weaponAttack >= 3
  // scroll 60% gives weaponAttack +2 — need scroll to succeed (prob = 0.6)
  const strategy = {
    makerChoices: [makeGem('diamond', 0)],
    scrollSequence: [
      makeScroll('테스트 주문서 60%', { weaponAttack: 2 }),
    ],
    useItemLevelUp: false,
  };
  const cleanStats = { weaponAttack: 0 };
  const targetConditions = { statThresholds: { weaponAttack: 3 }, gradeThreshold: null };

  const prob = computeExactProbability(strategy, cleanStats, targetConditions);
  assert.equal(prob, 0.6);
});

test('computeExactProbability strategy that cannot meet target returns 0.0', () => {
  // Max possible weaponAttack gain: diamond grade 0 (+1) + scroll (+5) = 6
  // Target: weaponAttack >= 100 — impossible
  const strategy = {
    makerChoices: [makeGem('diamond', 0)],
    scrollSequence: [
      makeScroll('테스트 주문서 60%', { weaponAttack: 5 }),
    ],
    useItemLevelUp: false,
  };
  const cleanStats = { weaponAttack: 0 };
  const targetConditions = { statThresholds: { weaponAttack: 100 }, gradeThreshold: null };

  const prob = computeExactProbability(strategy, cleanStats, targetConditions);
  assert.equal(prob, 0.0);
});
