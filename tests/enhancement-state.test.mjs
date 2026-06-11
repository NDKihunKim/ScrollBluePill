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
