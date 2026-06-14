import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CORE_STAT_KEYS,
  ADVANCED_STAT_KEYS,
  ALL_TARGET_STAT_KEYS,
  computeEnhancementGains,
  getDefaultCheckedStats,
  extractTargetConditions,
} from '../src/lib/expectedValue/targetExtraction.mjs';

// --- stat key sets ---

test('CORE_STAT_KEYS contains the six core stats', () => {
  assert.deepEqual(
    [...CORE_STAT_KEYS].sort(),
    ['dex', 'int', 'luk', 'magicAttack', 'str', 'weaponAttack'],
  );
});

test('ADVANCED_STAT_KEYS contains HP, MP, defenses, accuracy, avoid, speed, jump', () => {
  assert.deepEqual(
    [...ADVANCED_STAT_KEYS].sort(),
    ['accuracy', 'avoidability', 'jump', 'magicDefense', 'maxHp', 'maxMp', 'speed', 'weaponDefense'],
  );
});

test('ALL_TARGET_STAT_KEYS excludes upgradeSlots and attackSpeed', () => {
  assert.ok(!ALL_TARGET_STAT_KEYS.has('upgradeSlots'));
  assert.ok(!ALL_TARGET_STAT_KEYS.has('attackSpeed'));
  // Sanity: it should include core + advanced
  assert.ok(ALL_TARGET_STAT_KEYS.has('str'));
  assert.ok(ALL_TARGET_STAT_KEYS.has('dex'));
  assert.ok(ALL_TARGET_STAT_KEYS.has('maxHp'));
  assert.ok(ALL_TARGET_STAT_KEYS.has('weaponDefense'));
});

// --- computeEnhancementGains ---

test('computeEnhancementGains returns gain over clean base for each stat', () => {
  const clean = { str: 10, dex: 5, weaponAttack: 50 };
  const preview = { str: 15, dex: 5, weaponAttack: 60 };

  const gains = computeEnhancementGains(clean, preview);

  assert.deepEqual(gains, {
    str: 5,
    weaponAttack: 10,
  });
  // dex has gain of 0, should be omitted
  assert.ok(!('dex' in gains));
});

test('computeEnhancementGains includes stats only in preview (treats missing clean as 0)', () => {
  const clean = { str: 10 };
  const preview = { str: 12, weaponAttack: 55 };

  const gains = computeEnhancementGains(clean, preview);

  assert.deepEqual(gains, {
    str: 2,
    weaponAttack: 55,
  });
});

test('computeEnhancementGains omits stats with zero gain', () => {
  const clean = { str: 10, dex: 8, int: 4 };
  const preview = { str: 10, dex: 8, int: 4 };

  const gains = computeEnhancementGains(clean, preview);

  assert.deepEqual(gains, {});
});

test('computeEnhancementGains ignores excluded stats (upgradeSlots, attackSpeed)', () => {
  const clean = { str: 10, upgradeSlots: 7, attackSpeed: 5 };
  const preview = { str: 15, upgradeSlots: 3, attackSpeed: 5 };

  const gains = computeEnhancementGains(clean, preview);

  // upgradeSlots changed but should be excluded
  assert.ok(!('upgradeSlots' in gains));
  assert.ok(!('attackSpeed' in gains));
  assert.equal(gains.str, 5);
});

// --- getDefaultCheckedStats ---

test('getDefaultCheckedStats checks core stats with positive gain, leaves advanced unchecked', () => {
  const gains = {
    str: 5,
    weaponAttack: 3,
    maxHp: 200,
    accuracy: 1,
  };

  const checked = getDefaultCheckedStats(gains);

  // Core with positive gain -> checked
  assert.equal(checked.str, true);
  assert.equal(checked.weaponAttack, true);
  // Advanced stats -> unchecked even with positive gain
  assert.equal(checked.maxHp, false);
  assert.equal(checked.accuracy, false);
  // Grade -> unchecked by default
  assert.equal(checked.grade, false);
});

test('getDefaultCheckedStats: zero-gain core stat is not checked', () => {
  const gains = { str: 5, dex: 0 };

  const checked = getDefaultCheckedStats(gains);

  assert.equal(checked.str, true);
  // dex gain is 0 -> not checked (and not present in result since it's falsy)
  assert.equal(checked.dex, false);
});

test('getDefaultCheckedStats grade defaults to unchecked', () => {
  const gains = { str: 5 };

  const checked = getDefaultCheckedStats(gains);

  assert.equal(checked.grade, false);
});

test('getDefaultCheckedStats returns grade: false even with empty gains', () => {
  const checked = getDefaultCheckedStats({});

  assert.equal(checked.grade, false);
});

// --- extractTargetConditions ---

test('extractTargetConditions builds stat thresholds from checked positive-gain stats', () => {
  const clean = { str: 10, dex: 5, weaponAttack: 50 };
  const preview = { str: 15, dex: 5, weaponAttack: 60 };
  const gains = computeEnhancementGains(clean, preview);
  const checked = { str: true, weaponAttack: true, dex: false, grade: false };

  const conditions = extractTargetConditions(clean, preview, checked, 5);

  assert.deepEqual(conditions, {
    statThresholds: {
      str: 5,
      weaponAttack: 10,
    },
    gradeThreshold: null,
  });
});

test('extractTargetConditions returns null gradeThreshold when grade unchecked', () => {
  const clean = { str: 10 };
  const preview = { str: 12 };
  const checked = { str: true, grade: false };

  const conditions = extractTargetConditions(clean, preview, checked, 7);

  assert.deepEqual(conditions, {
    statThresholds: { str: 2 },
    gradeThreshold: null,
  });
});

test('extractTargetConditions includes gradeThreshold when grade is checked', () => {
  const clean = { str: 10 };
  const preview = { str: 12 };
  const checked = { str: false, grade: true };

  const conditions = extractTargetConditions(clean, preview, checked, 7);

  assert.deepEqual(conditions, {
    statThresholds: {},
    gradeThreshold: 7,
  });
});

test('extractTargetConditions only includes stats with positive gain even if checked', () => {
  const clean = { str: 10, dex: 5 };
  const preview = { str: 10, dex: 5 };
  const checked = { str: true, dex: true, grade: false };

  const conditions = extractTargetConditions(clean, preview, checked, 3);

  assert.deepEqual(conditions, {
    statThresholds: {},
    gradeThreshold: null,
  });
});
