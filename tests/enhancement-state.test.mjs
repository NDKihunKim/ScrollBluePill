import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEnhancementState,
  activateMaker,
  deactivateMaker,
  applyGem,
  applyScroll,
  applyStimulant,
  clearStimulant,
  resetState,
  computeAccumulatedStats,
  computeGradeColor,
  computeRemainingSlots,
  computeStatBreakdown,
} from '../src/lib/enhancementState.mjs';

// --- stat breakdown tests ---

test('stat breakdown separates original, maker, scroll, and total values', () => {
  const state = createEnhancementState(7, 80);

  assert.equal(applyScroll(state, {
    id: 2040000,
    nameKo: '테스트 주문서',
    stats: { str: 5, dex: -2 },
  }), true);

  assert.deepEqual(
    computeStatBreakdown({ str: 15, dex: 10, upgradeSlots: 7 }, state),
    {
      str: { original: 15, maker: 0, scroll: 5, total: 20 },
      dex: { original: 10, maker: 0, scroll: -2, total: 8 },
      upgradeSlots: { original: 7, maker: 0, scroll: 0, total: 7 },
    },
  );
});

test('stat breakdown includes maker gems and stimulant in maker total', () => {
  const state = createEnhancementState(7, 80);
  activateMaker(state);

  // strCrystal grade 0 = +1 STR
  assert.equal(applyGem(state, 0, 'strCrystal', 0), true);
  // stimulant: +2 STR, -1 DEX
  assert.equal(applyStimulant(state, { str: 2, dex: -1 }), true);
  assert.equal(applyScroll(state, {
    id: 2040001,
    nameKo: '테스트 주문서',
    stats: { str: 5, dex: 3 },
  }), true);

  // maker STR = gem(1) + stimulant(2) = 3
  // maker DEX = gem(0) + stimulant(-1) = -1
  assert.deepEqual(
    computeStatBreakdown({ str: 15, dex: 10, upgradeSlots: 7 }, state),
    {
      str: { original: 15, maker: 3, scroll: 5, total: 23 },
      dex: { original: 10, maker: -1, scroll: 3, total: 12 },
      upgradeSlots: { original: 7, maker: 0, scroll: 0, total: 7 },
    },
  );
});

test('applyStimulant sets stimulantSlot on state', () => {
  const state = createEnhancementState(7, 80);
  assert.equal(applyStimulant(state, { str: 3, int: -1 }), true);
  assert.deepEqual(state.stimulantSlot, { stats: { str: 3, int: -1 } });
});

test('clearStimulant removes stimulantSlot', () => {
  const state = createEnhancementState(7, 80);
  applyStimulant(state, { str: 3 });
  clearStimulant(state);
  assert.equal(state.stimulantSlot, null);
});

test('computeAccumulatedStats includes stimulant contributions', () => {
  const state = createEnhancementState(7, 80);
  applyStimulant(state, { str: 2, dex: -1 });
  applyScroll(state, {
    id: 2040000,
    nameKo: '테스트 주문서',
    stats: { str: 5 },
  });

  const accumulated = computeAccumulatedStats({ str: 15, dex: 10 }, state);
  // STR = 15 + 5(scroll) + 2(stim) = 22
  // DEX = 10 + 0(scroll) + (-1)(stim) = 9
  assert.deepEqual(accumulated, { str: 22, dex: 9 });
});

// --- maker stimulant lifecycle tests ---

test('enhancement state initializes and clears maker stimulant separately from gem slots', () => {
  const state = createEnhancementState(7, 80);

  assert.equal(state.stimulantSlot, null);
  assert.equal(computeRemainingSlots(state), 7);

  activateMaker(state);
  assert.equal(applyStimulant(state, { str: 0, dex: -3, maxHp: 5 }), true);
  assert.deepEqual(state.stimulantSlot, { stats: { str: 0, dex: -3, maxHp: 5 } });
  assert.equal(computeRemainingSlots(state), 7);

  clearStimulant(state);
  assert.equal(state.stimulantSlot, null);

  assert.equal(applyStimulant(state, { str: 2 }), true);
  deactivateMaker(state);
  assert.equal(state.stimulantSlot, null);
});

test('maker stimulant contributes zero, negative, and positive deltas to accumulated stats', () => {
  const state = createEnhancementState(7, 80);

  assert.equal(applyStimulant(state, { str: 0, dex: -3, luk: 5 }), true);

  assert.deepEqual(
    computeAccumulatedStats({ str: 10, dex: 8, luk: 1, upgradeSlots: 7 }, state),
    { str: 10, dex: 5, luk: 6, upgradeSlots: 7 },
  );
});

test('maker stimulant grade color includes stimulant deltas', () => {
  const state = createEnhancementState(7, 80);

  assert.equal(applyStimulant(state, { str: 2, dex: 2, luk: 2 }), true);

  assert.equal(computeGradeColor(state), '#3366ff');

  resetState(state);
  assert.equal(state.stimulantSlot, null);
  assert.equal(computeGradeColor(state), '#ffffff');
});

test('maxHp and maxMp use 10x scale — applied at 50, grade color divides by 10', () => {
  const state = createEnhancementState(7, 80);

  // Simulate what the chaos/stimulant stepper would produce: +50 for HP, -30 for MP
  assert.equal(applyStimulant(state, { maxHp: 50, maxMp: -30 }), true);
  assert.equal(applyScroll(state, {
    id: 2040000,
    nameKo: '테스트 주문서',
    stats: { maxHp: 20, str: 5 },
  }), true);

  // Accumulated: HP = 50(stim) + 20(scroll) = 70, MP = -30
  assert.deepEqual(
    computeAccumulatedStats({ maxHp: 100, maxMp: 80, str: 15 }, state),
    { maxHp: 170, maxMp: 50, str: 20 },
  );

  // Breakdown
  assert.deepEqual(
    computeStatBreakdown({ maxHp: 100, maxMp: 80, str: 15, upgradeSlots: 7 }, state),
    {
      maxHp: { original: 100, maker: 50, scroll: 20, total: 170 },
      maxMp: { original: 80, maker: -30, scroll: 0, total: 50 },
      str: { original: 15, maker: 0, scroll: 5, total: 20 },
      upgradeSlots: { original: 7, maker: 0, scroll: 0, total: 7 },
    },
  );

  // Grade color: HP+MP contribute (50-30+20) / 10 = 4, plus STR 5 = 9 total → #3366ff
  assert.equal(computeGradeColor(state), '#3366ff');
});
