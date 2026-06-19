import assert from 'node:assert/strict';
import test from 'node:test';
import { enumerateStrategies } from '../src/lib/deconstruction/engine.mjs';

test('enumerateStrategies returns empty for zero deltas', () => {
  const result = enumerateStrategies({
    targetDeltas: {},
    successfulScrollCount: 0,
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
    successfulScrollCount: 1,
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
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', Array.from({ length: 250 }, (_, index) => ({
    id: 9000 + index,
    nameKo: `힘 주문서 100% ${index}`,
    equipmentKind: 'Glove',
    behavior_type: 'fixed',
    stats: { str: 1 },
  })));

  const result = enumerateStrategies({
    targetDeltas: { str: 1 },
    successfulScrollCount: 1,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: fakeScrolls,
  });

  assert.equal(result.strategies.length, 200);
  assert.equal(result.total, 200);
  assert.equal(result.truncated, true);
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
    successfulScrollCount: 5,
    equipmentKind: 'Cape',
    scrollsByEquipmentKind: fakeScrolls,
  });

  // The exact count requires 5 uses of str+2 (2*5=10).
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
    successfulScrollCount: 2,
    equipmentKind: 'Helm',
    scrollsByEquipmentKind: fakeScrolls,
  });

  // Should find exactly 1 strategy (one of each scroll)
  assert.equal(result.strategies.length, 1);
  assert.equal(result.strategies[0].scrolls.length, 2);
});

test('finds a strategy with the exact successful scroll count', () => {
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
    successfulScrollCount: 3,
    equipmentKind: 'Overall',
    scrollsByEquipmentKind: fakeScrolls,
  });

  assert.equal(result.strategies.length, 1);
  assert.equal(result.strategies[0].scrolls.length, 3);
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
    successfulScrollCount: 3,
    equipmentKind: 'Shield',
    scrollsByEquipmentKind: fakeScrolls,
  });

  // 3 uses of 60% scroll => 0.6^3 = 0.216
  assert.equal(result.strategies.length, 1);
  assert.equal(result.strategies[0].scrolls.length, 3);
  assert.ok(Math.abs(result.strategies[0].probability - 0.216) < 1e-12);
});

test('empty scroll map returns empty', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: 1 },
    successfulScrollCount: 7,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: new Map(),
  });
  assert.deepEqual(result.strategies, []);
  assert.equal(result.total, 0);
  assert.equal(result.truncated, false);
});

test('an insufficient exact successful scroll count returns no strategies', () => {
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
    successfulScrollCount: 3,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: fakeScrolls,
  });
  assert.deepEqual(result.strategies, []);
  assert.equal(result.total, 0);
});

test('requires the exact successful scroll count for a scroll-only target', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 6001,
      nameKo: '공격력 주문서 100%',
      equipmentKind: 'Glove',
      behavior_type: 'fixed',
      stats: { weaponAttack: 2 },
    },
  ]);

  const enumerate = (successfulScrollCount) => enumerateStrategies({
    targetDeltas: { weaponAttack: 6 },
    successfulScrollCount,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: fakeScrolls,
  });

  const exact = enumerate(3);
  assert.equal(exact.strategies.length, 1);
  assert.equal(exact.strategies[0].scrolls.length, 3);
  assert.deepEqual(enumerate(2).strategies, []);
  assert.deepEqual(enumerate(4).strategies, []);
});

test('zero successful scrolls cannot satisfy a positive scroll-only target', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 7001,
      nameKo: '공격력 주문서 100%',
      equipmentKind: 'Glove',
      behavior_type: 'fixed',
      stats: { weaponAttack: 2 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 2 },
    successfulScrollCount: 0,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: fakeScrolls,
  });

  assert.deepEqual(result.strategies, []);
  assert.equal(result.total, 0);
});

test('successful scroll counts normalize to safe non-negative integers', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 8001,
      nameKo: '공격력 주문서 100%',
      equipmentKind: 'Glove',
      behavior_type: 'fixed',
      stats: { weaponAttack: 2 },
    },
  ]);

  const numericString = enumerateStrategies({
    targetDeltas: { weaponAttack: 6 },
    successfulScrollCount: '3.9',
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: fakeScrolls,
  });
  assert.equal(numericString.strategies.length, 1);
  assert.equal(numericString.strategies[0].scrolls.length, 3);

  const invalidCount = {
    valueOf() {
      throw new Error('conversion failed');
    },
  };
  assert.doesNotThrow(() => enumerateStrategies({
    targetDeltas: { weaponAttack: 2 },
    successfulScrollCount: invalidCount,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: fakeScrolls,
  }));
  assert.doesNotThrow(() => enumerateStrategies({
    targetDeltas: { weaponAttack: 2 },
    successfulScrollCount: Symbol('invalid'),
    equipmentKind: 'Glove',
    scrollsByEquipmentKind: fakeScrolls,
  }));
});
