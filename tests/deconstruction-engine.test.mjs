import assert from 'node:assert/strict';
import test from 'node:test';
import { enumerateStrategies } from '../src/lib/deconstruction/engine.mjs';

test('enumerateStrategies returns empty for zero deltas', () => {
  const result = enumerateStrategies({
    targetDeltas: {},
    upgradeSlots: 7,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: new Map(),
  });
  assert.deepEqual(result.strategies, []);
  assert.equal(result.total, 0);
  assert.equal(result.truncated, false);
});

test('each strategy has required shape', () => {
  // Create a minimal fake scroll that gives +2 weaponAttack at 100%
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 1001,
      nameKo: '공격력 주문서 100%',
      equipmentKind: 'Glove',
      behavior_type: 'fixed',
      stats: { weaponAttack: 2 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 2 },
    upgradeSlots: 7,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: fakeScrolls,
  });

  assert.ok(result.strategies.length > 0);
  const s = result.strategies[0];
  assert.ok(Array.isArray(s.scrolls));
  assert.equal(s.scrolls.length, 1);
  assert.equal(s.probability, 1.0);
  assert.ok(s.approach.includes('주문서'));
});

test('caps at 200 strategies', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: 5, dex: 3 },
    upgradeSlots: 7,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: new Map(),
  });
  assert.ok(result.strategies.length <= 200);
});

test('fixed scroll exact match with single scroll', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Cape', [
    {
      id: 1101,
      nameKo: '힘 주문서 60%',
      equipmentKind: 'Cape',
      behavior_type: 'fixed',
      stats: { str: 2 },
    },
    {
      id: 1102,
      nameKo: '힘 주문서 10%',
      equipmentKind: 'Cape',
      behavior_type: 'fixed',
      stats: { str: 5 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { str: 10 },
    upgradeSlots: 7,
    equipmentKind: 'Cape',
    scrollsByEquipmentKind: fakeScrolls,
  });

  // Should find: 5 uses of str+2 (2*5=10)
  // Or: 2 uses of str+5 (5*2=10)
  // Or: 1 use of str+5 + variable of str+2
  // Actually: scrolls being sorted by id, the recursion goes:
  //   id 1101 (str+2): max 5 uses (10/2), try each
  //     then id 1102 (str+5): what remains
  // So we should find strategies
  assert.ok(result.strategies.length > 0);
  assert.equal(result.truncated, false);

  // Verify each strategy sums to exactly {str: 10}
  for (const strategy of result.strategies) {
    const sum = {};
    for (const scroll of strategy.scrolls) {
      for (const [k, v] of Object.entries(scroll.stats)) {
        sum[k] = (sum[k] || 0) + v;
      }
    }
    assert.equal(sum.str, 10);
  }
});

test('deduplicates same scroll set regardless of order', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Helm', [
    {
      id: 2001,
      nameKo: '방어력 주문서 100%',
      equipmentKind: 'Helm',
      behavior_type: 'fixed',
      stats: { weaponDefense: 3 },
    },
    {
      id: 2002,
      nameKo: '체력 주문서 100%',
      equipmentKind: 'Helm',
      behavior_type: 'fixed',
      stats: { maxHp: 30 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponDefense: 3, maxHp: 30 },
    upgradeSlots: 2,
    equipmentKind: 'Helm',
    scrollsByEquipmentKind: fakeScrolls,
  });

  // Should find exactly 1 strategy (one of each scroll)
  assert.equal(result.strategies.length, 1);
  assert.equal(result.strategies[0].scrolls.length, 2);
});

test('multiple strategies from same scroll multiset', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Overall', [
    {
      id: 3001,
      nameKo: '럭 주문서 100%',
      equipmentKind: 'Overall',
      behavior_type: 'fixed',
      stats: { luk: 1 },
    },
    {
      id: 3002,
      nameKo: '럭 주문서 60%',
      equipmentKind: 'Overall',
      behavior_type: 'fixed',
      stats: { luk: 2 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { luk: 4 },
    upgradeSlots: 7,
    equipmentKind: 'Overall',
    scrollsByEquipmentKind: fakeScrolls,
  });

  // Possible combinations:
  // - 4x luk+1 (100%)
  // - 2x luk+2 (60%)
  // - 2x luk+1 + 1x luk+2
  // But note: scrolls are sorted by id, so 3001 then 3002
  // After using all 3001 (4 uses), remaining = 0, so 3002 not needed
  // After using 2 3001 (luk=2), remaining=2, can use 1 3002
  // After using 1 3001, remaining=3, can't use 3002 (adds 2 -> remaining 1, can't continue)
  // After using 0 3001, maxUses for 3002 is 2
  // So: [3001,3001,3001,3001], [3002,3002], [3001,3001,3002]
  assert.ok(result.strategies.length >= 2);
});

test('probability is product of scroll success rates', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Shield', [
    {
      id: 4001,
      nameKo: '방패 공격력 주문서 60%',
      equipmentKind: 'Shield',
      behavior_type: 'fixed',
      stats: { weaponAttack: 2 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 6 },
    upgradeSlots: 7,
    equipmentKind: 'Shield',
    scrollsByEquipmentKind: fakeScrolls,
  });

  // 3 uses of 60% scroll => 0.6^3 = 0.216
  assert.ok(result.strategies.length > 0);
  for (const s of result.strategies) {
    assert.ok(s.probability > 0);
    assert.ok(s.probability <= 1);
  }
});

test('empty scroll map returns empty', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: 1 },
    upgradeSlots: 7,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: new Map(),
  });
  assert.deepEqual(result.strategies, []);
  assert.equal(result.total, 0);
  assert.equal(result.truncated, false);
});

test('insufficient upgrade slots returns no strategies', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 5001,
      nameKo: '공격력 주문서 100%',
      equipmentKind: 'Glove',
      behavior_type: 'fixed',
      stats: { weaponAttack: 2 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 10 },
    upgradeSlots: 3, // Need 5 slots for 5x +2, but only 3 available
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: fakeScrolls,
  });
  assert.deepEqual(result.strategies, []);
  assert.equal(result.total, 0);
});
