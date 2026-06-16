import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEnhancementState,
  activateMaker,
  deactivateMaker,
  applyGem,
  applyVariableGem,
  applyScroll,
  applyStimulant,
  clearStimulant,
  resetState,
  computeAccumulatedStats,
  computeGradeColor,
  computeRemainingSlots,
  computeStatBreakdown,
  createItemLevelUpSlots,
  applyItemLevelUp,
  clearItemLevelUpSlot,
  computeItemLevelUpCardMeta,
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
  assert.deepEqual(state.stimulantSlot, { stats: { str: 3, int: -1 }, mode: 'manual' });
});

test('applyStimulant stores manual and probability modes', () => {
  const state = createEnhancementState(7, 80);

  applyStimulant(state, { str: 2 }, 'manual');
  assert.deepEqual(state.stimulantSlot, {
    stats: { str: 2 },
    mode: 'manual',
  });

  applyStimulant(state, { str: 4 }, 'probability');
  assert.deepEqual(state.stimulantSlot, {
    stats: { str: 4 },
    mode: 'probability',
  });
});

test('applyStimulant defaults missing mode to manual', () => {
  const state = createEnhancementState(7, 80);

  applyStimulant(state, { dex: 1 });

  assert.equal(state.stimulantSlot.mode, 'manual');
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
  assert.deepEqual(state.stimulantSlot, { stats: { str: 0, dex: -3, maxHp: 5 }, mode: 'manual' });
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

// --- variable gem tests ---

test('applyVariableGem stores stats on gem slot', () => {
  const state = createEnhancementState(7, 80);
  assert.equal(applyVariableGem(state, 0, 'darkCrystal', { str: 3, dex: -1, int: 0, luk: 5 }), true);
  assert.deepEqual(state.gemSlots[0], {
    gemKey: 'darkCrystal',
    stats: { str: 3, dex: -1, int: 0, luk: 5 },
    mode: 'manual',
    gradeIndex: 0,
  });
});

test('applyVariableGem stores manual and probability modes', () => {
  const state = createEnhancementState(7, 80);

  assert.equal(applyVariableGem(state, 0, 'darkCrystal', { str: 3 }, 'manual'), true);
  assert.deepEqual(state.gemSlots[0], {
    gemKey: 'darkCrystal',
    stats: { str: 3 },
    mode: 'manual',
    gradeIndex: 0,
  });

  assert.equal(applyVariableGem(state, 0, 'darkCrystal', { str: 5 }, 'probability'), true);
  assert.deepEqual(state.gemSlots[0], {
    gemKey: 'darkCrystal',
    stats: { str: 5 },
    mode: 'probability',
    gradeIndex: 0,
  });
});

test('applyVariableGem defaults missing mode to manual', () => {
  const state = createEnhancementState(7, 80);

  applyVariableGem(state, 0, 'blackAmethyst', { weaponAttack: 1 });

  assert.equal(state.gemSlots[0].mode, 'manual');
});

test('applyVariableGem rejects non-variable gems', () => {
  const state = createEnhancementState(7, 80);
  assert.equal(applyVariableGem(state, 0, 'strCrystal', { str: 3 }), false);
  assert.equal(state.gemSlots[0], null);
});

test('variable gem contributes to accumulated stats', () => {
  const state = createEnhancementState(7, 80);
  applyVariableGem(state, 0, 'darkCrystal', { str: 3, dex: -1, luk: 5 });

  assert.deepEqual(
    computeAccumulatedStats({ str: 10, dex: 10, int: 10, luk: 10 }, state),
    { str: 13, dex: 9, int: 10, luk: 15 },
  );
});

test('variable gem contributes to stat breakdown as maker', () => {
  const state = createEnhancementState(7, 80);
  applyVariableGem(state, 0, 'blackAmethyst', { weaponAttack: 2, magicAttack: -1 });

  assert.deepEqual(
    computeStatBreakdown({ weaponAttack: 50, magicAttack: 30, upgradeSlots: 7 }, state),
    {
      weaponAttack: { original: 50, maker: 2, scroll: 0, total: 52 },
      magicAttack: { original: 30, maker: -1, scroll: 0, total: 29 },
      upgradeSlots: { original: 7, maker: 0, scroll: 0, total: 7 },
    },
  );
});

test('variable gem grade color includes variable contributions', () => {
  const state = createEnhancementState(7, 80);
  applyVariableGem(state, 0, 'darkCrystal', { str: 2, dex: 2, luk: 2 });

  // 2+2+2 = 6 total → #3366ff
  assert.equal(computeGradeColor(state), '#3366ff');
});

test('variable gem rejects duplicate gem key', () => {
  const state = createEnhancementState(7, 80);
  assert.equal(applyVariableGem(state, 0, 'darkCrystal', { str: 1 }), true);
  assert.equal(applyVariableGem(state, 1, 'darkCrystal', { str: 2 }), false);
});

test('blackAmethyst only visible for weapon equipment kinds', async () => {
  const { getVisibleGemTypes } = await import('../src/lib/makerData.mjs');
  const weaponGems = getVisibleGemTypes('한손검', []);
  const armorGems = getVisibleGemTypes('모자', []);

  assert.ok(weaponGems.some((g) => g.key === 'blackAmethyst'));
  assert.ok(!armorGems.some((g) => g.key === 'blackAmethyst'));
});

// --- item level-up tests ---

test('item level-up slots initialize independently from maker slots', () => {
  const state = createEnhancementState(7, 120, { maxLevelUps: 3 });

  assert.equal(state.itemLevelUpSlotCount, 3);
  assert.deepEqual(state.itemLevelUpSlots, [null, null, null]);

  activateMaker(state);
  applyGem(state, 0, 'strCrystal', 2);
  assert.equal(applyItemLevelUp(state, 0, { str: 1, weaponAttack: 2 }), true);

  deactivateMaker(state);
  assert.deepEqual(state.gemSlots.every((slot) => slot === null), true);
  assert.deepEqual(state.itemLevelUpSlots[0], { stats: { str: 1, weaponAttack: 2 } });
});

test('item level-up contributes to accumulated stats and maker breakdown bucket', () => {
  const state = createEnhancementState(7, 120, { maxLevelUps: 3 });

  applyItemLevelUp(state, 0, { str: 1, weaponAttack: 2 });
  applyScroll(state, {
    id: 2040000,
    nameKo: '테스트 주문서',
    stats: { str: 5 },
  });

  assert.deepEqual(
    computeAccumulatedStats({ str: 10, weaponAttack: 50 }, state),
    { str: 16, weaponAttack: 52 },
  );

  assert.deepEqual(
    computeStatBreakdown({ str: 10, weaponAttack: 50 }, state),
    {
      str: { original: 10, maker: 1, scroll: 5, total: 16 },
      weaponAttack: { original: 50, maker: 2, scroll: 0, total: 52 },
    },
  );
});

test('item level-up slot bounds and reset lifecycle', () => {
  const state = createEnhancementState(7, 120, { maxLevelUps: 3 });

  assert.equal(applyItemLevelUp(state, -1, { str: 1 }), false);
  assert.equal(applyItemLevelUp(state, 3, { str: 1 }), false);
  assert.equal(applyItemLevelUp(state, 1, { str: 2, dex: Number.NaN }), true);
  assert.deepEqual(state.itemLevelUpSlots[1], { stats: { str: 2 } });

  clearItemLevelUpSlot(state, 1);
  assert.equal(state.itemLevelUpSlots[1], null);

  applyItemLevelUp(state, 0, { str: 2 });
  resetState(state);
  assert.deepEqual(state.itemLevelUpSlots, [null, null, null]);
});

test('item level-up card metadata shows current level and max exp state', () => {
  const definition = { levelUpKind: 'reverse', maxLevelUps: 3 };
  const state = createEnhancementState(7, 120, definition);

  assert.deepEqual(computeItemLevelUpCardMeta(state, definition), {
    itemLevel: '1',
    itemExp: '0 %',
  });

  applyItemLevelUp(state, 0, { str: 1 });
  applyItemLevelUp(state, 1, { str: 1 });
  assert.deepEqual(computeItemLevelUpCardMeta(state, definition), {
    itemLevel: '3',
    itemExp: '0 %',
  });

  applyItemLevelUp(state, 2, { str: 1 });
  assert.deepEqual(computeItemLevelUpCardMeta(state, definition), {
    itemLevel: 'MAX',
    itemExp: 'MAX',
  });

  assert.equal(computeItemLevelUpCardMeta(state, null), null);
});
