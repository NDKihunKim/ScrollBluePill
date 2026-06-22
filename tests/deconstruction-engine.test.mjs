import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { enumerateStrategies } from '../src/lib/deconstruction/engine.mjs';
import { enumerateItemLevelContributions } from '../src/lib/deconstruction/sourceContributions.mjs';

test('enumerateStrategies returns empty for zero deltas', () => {
  const result = enumerateStrategies({
    targetDeltas: {},
    targetKeys: [],
    successfulScrollCount: 0,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: new Map(),
    levelUpDefinition: null,
  });
  assert.deepEqual(result.strategies, []);
  assert.equal(result.total, 0);
  assert.equal(result.tooManyResults, false);
  assert.ok(!Object.hasOwn(result, 'truncated'));
});

test('each strategy has required shape (no probability)', () => {
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
    targetKeys: ['weaponAttack'],
    successfulScrollCount: 1,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
  });

  assert.ok(result.strategies.length > 0);
  const s = result.strategies[0];
  assert.ok(Array.isArray(s.scrolls));
  assert.equal(s.scrolls.length, 1);
  assert.ok(!Object.hasOwn(s, 'probability'));
  assert.ok(Array.isArray(s.sourceTypes));
  assert.ok('priorityRank' in s);
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
    targetKeys: ['str'],
    successfulScrollCount: 5,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
  });

  assert.ok(result.strategies.length > 0);
  assert.equal(result.tooManyResults, false);

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
    targetKeys: ['weaponDefense', 'maxHp'],
    successfulScrollCount: 2,
    equipmentKind: 'Helm',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
  });

  // Should find at least the scroll-only strategy (one of each scroll)
  // Fallback may add additional strategies (stimulant, gems)
  const scrollOnly = result.strategies.filter((s) => s.priorityRank === 0);
  assert.ok(scrollOnly.length >= 1);
  assert.equal(scrollOnly[0].scrolls.length, 2);
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
    targetKeys: ['luk'],
    successfulScrollCount: 3,
    equipmentKind: 'Overall',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
  });

  // Expect at least one strategy with exactly 3 scrolls (scroll-only or with fallback)
  assert.ok(result.strategies.length >= 1);
  const scrollOnly = result.strategies.find((s) => s.priorityRank === 0);
  assert.ok(scrollOnly);
  assert.equal(scrollOnly.scrolls.length, 3);
});

test('empty scroll map returns empty', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 7,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: new Map(),
    levelUpDefinition: null,
  });
  assert.deepEqual(result.strategies, []);
  assert.equal(result.total, 0);
  assert.equal(result.tooManyResults, false);
});

test('insufficient scroll count may be filled by stimulant', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('한손검', [
    {
      id: 5001,
      nameKo: '공격력 주문서 100%',
      equipmentKind: '한손검',
      behavior_type: 'fixed',
      stats: { weaponAttack: 2 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 10 },
    targetKeys: ['weaponAttack'],
    successfulScrollCount: 3,
    equipmentKind: '한손검',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
  });
  // 3× +2 = 6, remaining 4 is within stimulant range (0..5)
  assert.ok(result.strategies.length > 0);
  // Each strategy has exactly 3 scrolls
  assert.ok(result.strategies.every((s) => s.scrolls.length === 3));
});

test('requires the exact successful scroll count for a scroll-only target', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('한손검', [
    {
      id: 6001,
      nameKo: '공격력 주문서 100%',
      equipmentKind: '한손검',
      behavior_type: 'fixed',
      stats: { weaponAttack: 2 },
    },
  ]);

  const enumerate = (successfulScrollCount) => enumerateStrategies({
    targetDeltas: { weaponAttack: 6 },
    targetKeys: ['weaponAttack'],
    successfulScrollCount,
    equipmentKind: '한손검',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
  });

  const exact = enumerate(3);
  const scrollOnly3 = exact.strategies.find((s) => s.priorityRank === 0);
  assert.ok(scrollOnly3);
  assert.equal(scrollOnly3.scrolls.length, 3);
  // Count 2 works via stimulant fallback (2 scrolls = 4, residual 2 via stimulant)
  assert.ok(enumerate(2).strategies.length > 0);
  // Count 4 cannot produce exactly 4 scrolls from a single scroll type (max 3 copies before overshoot)
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
    targetKeys: ['weaponAttack'],
    successfulScrollCount: 0,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
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
    targetKeys: ['weaponAttack'],
    successfulScrollCount: '3.9',
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
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
    targetKeys: ['weaponAttack'],
    successfulScrollCount: invalidCount,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
  }));
  assert.doesNotThrow(() => enumerateStrategies({
    targetDeltas: { weaponAttack: 2 },
    targetKeys: ['weaponAttack'],
    successfulScrollCount: Symbol('invalid'),
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
  }));
});

// ---- Plan 2: exact fallback search tests ----

test('supports exact negative checked deltas and ignores unchecked stats', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: -2 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 5 },
    scrollsByEquipmentKind: new Map([['Cape', [{
      id: 7001, nameKo: '카오스 주문서', behavior_type: 'chaos', stats: { str: 1, dex: 1 },
    }]]]),
    levelUpDefinition: null,
  });
  assert.ok(result.strategies.some((strategy) => strategy.totalStats.str === -2));
});

test('impossible high-branching chaos searches terminate promptly', () => {
  const engineUrl = new URL('../src/lib/deconstruction/engine.mjs', import.meta.url).href;
  const source = `
    import { enumerateStrategies } from ${JSON.stringify(engineUrl)};
    const result = enumerateStrategies({
      targetDeltas: { str: 21, dex: 0 },
      targetKeys: ['str', 'dex'],
      successfulScrollCount: 4,
      equipmentKind: 'Cape',
      scrollsByEquipmentKind: new Map([['Cape', [{
        id: 7003,
        nameKo: '카오스 주문서',
        behavior_type: 'chaos',
        stats: { str: 1, dex: 1 },
      }]]]),
      allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
    });
    process.stdout.write(JSON.stringify(result));
  `;

  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    timeout: 1000,
  });

  assert.notEqual(child.error?.code, 'ETIMEDOUT');
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    strategies: [],
    total: 0,
    tooManyResults: false,
  });
});

test('finds and prioritizes all single and mixed fallback sources', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: 3 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 50,
    cleanStats: { str: 5 },
    scrollsByEquipmentKind: new Map([['Cape', [{
      id: 7002, nameKo: '힘 주문서', behavior_type: 'fixed', stats: { str: 1 },
    }]]]),
    levelUpDefinition: { maxLevelUps: 1, statRanges: { str: { min: 1, max: 1 } } },
  });
  assert.ok(result.strategies.some((strategy) => strategy.hasStimulant));
  assert.ok(result.strategies.some((strategy) => strategy.gems.length > 0));
  assert.ok(result.strategies.some((strategy) => strategy.hasItemLevelUp));
  assert.ok(result.strategies.some((strategy) => strategy.sourceTypes.length > 1));
  assert.deepEqual(result.strategies.map((strategy) => strategy.priorityRank),
    [...result.strategies.map((strategy) => strategy.priorityRank)].sort((a, b) => a - b));
});

function makeAllowedSourcesFixture(overrides = {}) {
  return {
    targetDeltas: { str: 3 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 50,
    cleanStats: { str: 5 },
    scrollsByEquipmentKind: new Map([['Cape', [
      { id: 7101, nameKo: '힘 주문서 +1', behavior_type: 'fixed', stats: { str: 1 } },
      { id: 7102, nameKo: '힘 주문서 +3', behavior_type: 'fixed', stats: { str: 3 } },
    ]]]),
    levelUpDefinition: { maxLevelUps: 1, statRanges: { str: { min: 1, max: 1 } } },
    ...overrides,
  };
}

test('allowed sources are permitted but not required', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    allowedSources: { scrolls: true, stimulant: true, gems: true, itemLevelUp: true },
  }));

  assert.ok(result.strategies.some((strategy) =>
    strategy.sourceTypes.length === 1
    && strategy.sourceTypes[0] === 'scrolls'
    && strategy.scrolls[0].id === 7102));
  assert.ok(result.strategies.some((strategy) =>
    strategy.scrolls.length === 1
    && strategy.scrolls[0].id === 7101
    && strategy.hasStimulant
    && strategy.stimulant.stats.str === 2));
});

for (const [source, payloadIsAbsent] of [
  ['stimulant', (strategy) => !strategy.hasStimulant && strategy.stimulant === null],
  ['gems', (strategy) => strategy.gems.length === 0],
  ['itemLevelUp', (strategy) => !strategy.hasItemLevelUp && strategy.itemLevelUp === null],
]) {
  test(`disabled ${source} source is absent from nonempty results`, () => {
    const result = enumerateStrategies(makeAllowedSourcesFixture({
      allowedSources: { [source]: false },
    }));

    assert.ok(result.strategies.length > 0);
    assert.ok(result.strategies.every(payloadIsAbsent));
    assert.ok(result.strategies.every((strategy) => !strategy.sourceTypes.includes(source)));
  });
}

test('zero successful scrolls supports a stimulant-only exact strategy', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    successfulScrollCount: 0,
    allowedSources: { scrolls: false, stimulant: true, gems: false, itemLevelUp: false },
  }));

  assert.ok(result.strategies.some((strategy) =>
    strategy.sourceTypes.length === 1 && strategy.sourceTypes[0] === 'stimulant'));
});

test('zero successful scrolls supports an exact stimulant and item-level strategy', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    targetDeltas: { str: 6 },
    successfulScrollCount: 0,
    allowedSources: { scrolls: false, stimulant: true, gems: false, itemLevelUp: true },
  }));

  assert.ok(result.strategies.some((strategy) =>
    strategy.sourceTypes.length === 2
    && strategy.sourceTypes.includes('stimulant')
    && strategy.sourceTypes.includes('itemLevelUp')));
});

test('positive successful scroll count with scrolls disabled returns defensively empty', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    allowedSources: { scrolls: false },
  }));

  assert.deepEqual(result, {
    strategies: [],
    total: 0,
    tooManyResults: false,
  });
  assert.ok(!Object.hasOwn(result, 'truncated'));
});

test('omitted allowedSources preserves fallback source behavior', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture());

  assert.ok(result.strategies.some((strategy) => strategy.sourceTypes.includes('stimulant')));
  assert.ok(result.strategies.some((strategy) => strategy.sourceTypes.includes('gems')));
  assert.ok(result.strategies.some((strategy) => strategy.sourceTypes.includes('itemLevelUp')));
});

function makeLargeFixture(candidateCount) {
  const scrolls = Array.from({ length: candidateCount }, (_, index) => ({
    id: 8000 + index,
    nameKo: `힘 주문서 ${index}`,
    behavior_type: 'fixed',
    stats: { str: 1 },
  }));
  return {
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: '망토',
    requiredLevel: 0,
    cleanStats: { str: 1 },
    scrollsByEquipmentKind: new Map([['망토', scrolls]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
  };
}

for (const candidateCount of [1000, 1001]) {
  test(`${candidateCount} distinct exact matches obey the result overflow contract`, () => {
    const first = enumerateStrategies(makeLargeFixture(candidateCount));
    const second = enumerateStrategies(makeLargeFixture(candidateCount));

    assert.deepEqual(first, second);
    assert.ok(!Object.hasOwn(first, 'truncated'));

    if (candidateCount === 1000) {
      assert.equal(first.strategies.length, 1000);
      assert.equal(first.total, 1000);
      assert.equal(first.tooManyResults, false);
      assert.ok(first.strategies.every((strategy) => !Object.hasOwn(strategy, 'probability')));
    } else {
      assert.deepEqual(first, {
        strategies: [],
        total: 1001,
        tooManyResults: true,
      });
    }
  });
}

test('enumerateItemLevelContributions alreadyAppliedLevels=0 matches full range (regression)', () => {
  const levelUpDef = { maxLevelUps: 2, statRanges: { str: { min: 1, max: 1 } } };
  const base = enumerateItemLevelContributions({
    levelUpDefinition: levelUpDef,
    targetKeys: ['str'],
    bounds: { str: { min: -Infinity, max: Infinity } },
  });
  const withZero = enumerateItemLevelContributions({
    levelUpDefinition: levelUpDef,
    targetKeys: ['str'],
    bounds: { str: { min: -Infinity, max: Infinity } },
    alreadyAppliedLevels: 0,
  });
  assert.equal(base.length, withZero.length);
  for (let i = 0; i < base.length; i++) {
    assert.equal(base[i].levelCount, withZero[i].levelCount);
    assert.deepEqual(base[i].stats, withZero[i].stats);
  }
});

test('enumerateItemLevelContributions respects alreadyAppliedLevels', () => {
  const levelUpDef = { maxLevelUps: 5, statRanges: { str: { min: 1, max: 1 }, dex: { min: 0, max: 1 } } };
  const contributions = enumerateItemLevelContributions({
    levelUpDefinition: levelUpDef,
    targetKeys: ['str', 'dex'],
    bounds: { str: { min: -Infinity, max: Infinity }, dex: { min: -Infinity, max: Infinity } },
    alreadyAppliedLevels: 3,
  });
  assert.ok(contributions.length > 0, 'should have contributions for remaining 2 levels');
  for (const c of contributions) {
    assert.ok(c.levelCount <= 2, `levelCount ${c.levelCount} should not exceed remaining levels (2)`);
    assert.ok(c.levelCount >= 1, `levelCount ${c.levelCount} should be at least 1`);
  }
});

test('enumerateItemLevelContributions returns empty when alreadyAppliedLevels equals maxLevelUps', () => {
  const levelUpDef = { maxLevelUps: 5, statRanges: { str: { min: 1, max: 1 } } };
  const contributions = enumerateItemLevelContributions({
    levelUpDefinition: levelUpDef,
    targetKeys: ['str'],
    bounds: { str: { min: -Infinity, max: Infinity } },
    alreadyAppliedLevels: 5,
  });
  assert.equal(contributions.length, 0);
});
