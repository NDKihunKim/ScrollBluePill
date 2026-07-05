import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { enumerateStrategies, canChaosFillResidual } from '../src/lib/deconstruction/engine.mjs';
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
    cleanStats: { weaponAttack: 1 },
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
    cleanStats: { weaponAttack: 1 },
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

test('allowed sources are permitted with itemLevelUp as base', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    allowedSources: { scrolls: true, stimulant: true, gems: true, itemLevelUp: true },
  }));

  // Every strategy must include itemLevelUp when enabled
  assert.ok(result.strategies.length > 0, 'should produce strategies');
  assert.ok(result.strategies.every(s => s.hasItemLevelUp), 'every strategy must include itemLevelUp');

  // Should find scroll+stim+levelUp combination
  assert.ok(result.strategies.some(s =>
    s.scrolls.length === 1 && s.scrolls[0].id === 7101
    && s.hasStimulant && s.stimulant.stats.str > 0
    && s.hasItemLevelUp), 'should find scroll+stim+levelUp');

  // Should find scroll+gem+levelUp combination
  assert.ok(result.strategies.some(s =>
    s.scrolls.length === 1 && s.gems.length > 0 && s.hasItemLevelUp),
    'should find scroll+gem+levelUp');
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

test('when itemLevelUp is enabled, every strategy includes it', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    allowedSources: { scrolls: true, stimulant: true, gems: true, itemLevelUp: true },
  }));

  assert.ok(result.strategies.length > 0, 'should produce strategies');
  for (const s of result.strategies) {
    assert.ok(s.hasItemLevelUp, 'every strategy must include itemLevelUp');
    assert.ok(s.itemLevelUp !== null, 'itemLevelUp payload must be non-null');
    assert.ok(s.sourceTypes.includes('itemLevelUp'), 'sourceTypes must include itemLevelUp');
  }
});

test('when itemLevelUp is disabled, no strategy includes it', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    allowedSources: { scrolls: true, stimulant: true, gems: true, itemLevelUp: false },
  }));

  assert.ok(result.strategies.length > 0, 'should produce strategies');
  for (const s of result.strategies) {
    assert.ok(!s.hasItemLevelUp, 'no strategy should include itemLevelUp');
    assert.equal(s.itemLevelUp, null);
    assert.ok(!s.sourceTypes.includes('itemLevelUp'));
  }
});

test('itemLevelUp with zero scrolls produces stim and gem combinations', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    targetDeltas: { str: 5 },
    successfulScrollCount: 0,
    allowedSources: { scrolls: false, stimulant: true, gems: true, itemLevelUp: true },
  }));

  assert.ok(result.strategies.length > 0, 'should produce strategies');
  for (const s of result.strategies) {
    assert.ok(s.hasItemLevelUp, 'every strategy must include itemLevelUp');
    assert.equal(s.scrolls.length, 0);
  }
  assert.ok(result.strategies.some(s => s.hasStimulant && s.gems.length === 0), 'should have stim-only result');
  assert.ok(result.strategies.some(s => !s.hasStimulant && s.gems.length > 0), 'should have gem-only result');
});

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

for (const candidateCount of [10000, 10001]) {
  test(`${candidateCount} distinct exact matches obey the result overflow contract`, () => {
    const first = enumerateStrategies(makeLargeFixture(candidateCount));
    const second = enumerateStrategies(makeLargeFixture(candidateCount));

    assert.deepEqual(first, second);
    assert.ok(!Object.hasOwn(first, 'truncated'));

    if (candidateCount === 10000) {
      assert.equal(first.strategies.length, 10000);
      assert.equal(first.total, 10000);
      assert.equal(first.tooManyResults, false);
      assert.ok(first.strategies.every((strategy) => !Object.hasOwn(strategy, 'probability')));
    } else {
      assert.deepEqual(first, {
        strategies: [],
        total: 10001,
        tooManyResults: true,
      });
    }
  });
}

test('enumerateItemLevelContributions appliedLevelCount=0 matches full range (regression)', () => {
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
    appliedLevelCount: 0,
  });
  assert.equal(base.length, withZero.length);
  for (let i = 0; i < base.length; i++) {
    assert.equal(base[i].levelCount, withZero[i].levelCount);
    assert.deepEqual(base[i].stats, withZero[i].stats);
  }
});

test('enumerateItemLevelContributions respects appliedLevelCount', () => {
  const levelUpDef = { maxLevelUps: 5, statRanges: { str: { min: 1, max: 1 }, dex: { min: 0, max: 1 } } };
  const contributions = enumerateItemLevelContributions({
    levelUpDefinition: levelUpDef,
    targetKeys: ['str', 'dex'],
    bounds: { str: { min: -Infinity, max: Infinity }, dex: { min: -Infinity, max: Infinity } },
    appliedLevelCount: 3,
  });
  assert.ok(contributions.length > 0, 'should have contributions for remaining 2 levels');
  for (const c of contributions) {
    assert.ok(c.levelCount <= 2, `levelCount ${c.levelCount} should not exceed remaining levels (2)`);
    assert.ok(c.levelCount >= 1, `levelCount ${c.levelCount} should be at least 1`);
  }
});

test('enumerateItemLevelContributions returns empty when appliedLevelCount equals maxLevelUps', () => {
  const levelUpDef = { maxLevelUps: 5, statRanges: { str: { min: 1, max: 1 } } };
  const contributions = enumerateItemLevelContributions({
    levelUpDefinition: levelUpDef,
    targetKeys: ['str'],
    bounds: { str: { min: -Infinity, max: Infinity } },
    appliedLevelCount: 5,
  });
  assert.equal(contributions.length, 0);
});

test('exact item-level count prevents matching higher total level-up counts', () => {
  const levelUpDef = { maxLevelUps: 5, statRanges: { str: { min: 1, max: 1 } } };
  const result = enumerateStrategies({
    targetDeltas: { str: 2 },
    targetKeys: ['str'],
    successfulScrollCount: 0,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', []]]),
    levelUpDefinition: levelUpDef,
    allowedSources: { scrolls: false, stimulant: false, gems: false, itemLevelUp: true },
    levelUpExactLevelCount: 1,
  });

  assert.equal(result.strategies.length, 0);
});

test('item-level total range constrains exact-count strategy totals', () => {
  const levelUpDef = { maxLevelUps: 5, statRanges: { str: { min: 0, max: 2 } } };
  const result = enumerateStrategies({
    targetDeltas: { str: 4 },
    targetKeys: ['str'],
    successfulScrollCount: 0,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', []]]),
    levelUpDefinition: levelUpDef,
    allowedSources: { scrolls: false, stimulant: false, gems: false, itemLevelUp: true },
    levelUpExactLevelCount: 3,
    levelUpTotalStatRanges: { str: { min: 2, max: 3 } },
  });

  assert.equal(result.strategies.length, 0);
});

test('scrollRateFilter excludes non-matching rate scrolls', () => {
  const scrolls = [
    { id: 1001, nameKo: '힘 주문서 100%', behavior_type: 'fixed', stats: { str: 1 } },
    { id: 1002, nameKo: '힘 주문서 60%', behavior_type: 'fixed', stats: { str: 1 } },
    { id: 1003, nameKo: '힘 주문서 10%', behavior_type: 'fixed', stats: { str: 1 } },
  ];
  const result = enumerateStrategies({
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', scrolls]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
    scrollRateFilter: new Set(['100']),
  });
  assert.ok(result.strategies.length > 0);
  for (const s of result.strategies) {
    assert.ok(s.scrolls.every(sc => sc.id === 1001));
  }
});

test('scrollRateFilter empty set returns no strategies', () => {
  const scrolls = [
    { id: 1001, nameKo: '힘 주문서 100%', behavior_type: 'fixed', stats: { str: 1 } },
  ];
  const result = enumerateStrategies({
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', scrolls]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
    scrollRateFilter: new Set([]),
  });
  assert.equal(result.strategies.length, 0);
});

test('scrollRateFilter null preserves all scrolls (backward compat)', () => {
  const scrolls = [
    { id: 1001, nameKo: '힘 주문서 100%', behavior_type: 'fixed', stats: { str: 1 } },
    { id: 1002, nameKo: '힘 주문서 60%', behavior_type: 'fixed', stats: { str: 1 } },
  ];
  const withFilter = enumerateStrategies({
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', scrolls]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
    scrollRateFilter: null,
  });
  const withoutFilter = enumerateStrategies({
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', scrolls]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
  });
  assert.equal(withFilter.strategies.length, withoutFilter.strategies.length);
});

test('stimulantStatBounds restricts stimulant outcomes', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: 3 },
    targetKeys: ['str'],
    successfulScrollCount: 0,
    equipmentKind: 'Cape',
    requiredLevel: 50,
    cleanStats: { str: 1 },
    scrollsByEquipmentKind: new Map([['Cape', []]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: false, stimulant: true, gems: false, itemLevelUp: false },
    stimulantStatBounds: { str: { min: 2, max: 4 } },
  });
  assert.ok(result.strategies.length > 0);
  for (const s of result.strategies) {
    assert.ok(s.hasStimulant);
    assert.ok(s.stimulant.stats.str >= 2 && s.stimulant.stats.str <= 4,
      `stimulant str ${s.stimulant.stats.str} should be within [2,4]`);
  }
});

test('stimulantStatBounds outside default range is clamped', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: 3 },
    targetKeys: ['str'],
    successfulScrollCount: 0,
    equipmentKind: 'Cape',
    requiredLevel: 50,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', []]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: false, stimulant: true, gems: false, itemLevelUp: false },
    stimulantStatBounds: { str: { min: -100, max: 100 } },
  });
  for (const s of result.strategies) {
    if (s.hasStimulant) {
      assert.ok(s.stimulant.stats.str >= -5 && s.stimulant.stats.str <= 5);
    }
  }
});

test('levelUpSlotStatRanges overrides per-slot stat ranges', () => {
  const levelUpDef = { maxLevelUps: 2, statRanges: { str: { min: 0, max: 3 } } };
  const result = enumerateStrategies({
    targetDeltas: { str: 2 },
    targetKeys: ['str'],
    successfulScrollCount: 0,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', []]]),
    levelUpDefinition: levelUpDef,
    allowedSources: { scrolls: false, stimulant: false, gems: false, itemLevelUp: true },
    appliedLevelCount: 0,
    levelUpSlotStatRanges: [
      { str: { min: 1, max: 1 } },
      { str: { min: 1, max: 1 } },
    ],
  });
  for (const s of result.strategies) {
    if (s.hasItemLevelUp) {
      assert.equal(s.itemLevelUp.stats.str, 2);
    }
  }
});

test('levelUpSlotStatRanges missing slot falls back to definition', () => {
  const levelUpDef = { maxLevelUps: 2, statRanges: { str: { min: 0, max: 2 } } };
  const result = enumerateStrategies({
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 0,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', []]]),
    levelUpDefinition: levelUpDef,
    allowedSources: { scrolls: true, stimulant: true, gems: true, itemLevelUp: true },
    appliedLevelCount: 0,
    levelUpSlotStatRanges: [],
  });
  assert.ok(result.strategies.length > 0);
  // Every strategy should include itemLevelUp when enabled
  assert.ok(result.strategies.every(s => s.hasItemLevelUp));
});

// ── canChaosFillResidual ──

test('canChaosFillResidual: zero chaos, zero residual returns true', () => {
  const result = canChaosFillResidual(
    { weaponAttack: 0 },
    0,
    ['weaponAttack'],
    null,
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: zero chaos, non-zero residual returns false', () => {
  const result = canChaosFillResidual(
    { weaponAttack: 5 },
    0,
    ['weaponAttack'],
    null,
  );
  assert.equal(result, false);
});

test('canChaosFillResidual: single key in range', () => {
  // 3 scrolls × [-5,+5] = [-15,+15], need +9 → in range
  const result = canChaosFillResidual(
    { weaponAttack: 9 },
    3,
    ['weaponAttack'],
    null,
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: single key above max returns false', () => {
  // 3 scrolls × [+5 max] = +15 max, need +16 → out of range
  const result = canChaosFillResidual(
    { weaponAttack: 16 },
    3,
    ['weaponAttack'],
    null,
  );
  assert.equal(result, false);
});

test('canChaosFillResidual: single key below min returns false', () => {
  // 3 scrolls × [-5 min] = -15 min, need -16 → out of range
  const result = canChaosFillResidual(
    { weaponAttack: -16 },
    3,
    ['weaponAttack'],
    null,
  );
  assert.equal(result, false);
});

test('canChaosFillResidual: at exact boundary', () => {
  // 3 scrolls × [+5 max] = +15 max, need +15 → at boundary, in range
  const result = canChaosFillResidual(
    { weaponAttack: 15 },
    3,
    ['weaponAttack'],
    null,
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: multi-key all in range', () => {
  // 2 scrolls × [-5,+5] per key = [-10,+10] per key
  const result = canChaosFillResidual(
    { weaponAttack: 7, str: -4 },
    2,
    ['weaponAttack', 'str'],
    null,
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: multi-key one out of range returns false', () => {
  // 2 scrolls × [+5 max on str] = +10 max, need +12 → str out of range
  const result = canChaosFillResidual(
    { weaponAttack: 7, str: 12 },
    2,
    ['weaponAttack', 'str'],
    null,
  );
  assert.equal(result, false);
});

test('canChaosFillResidual: custom bounds applied — in range', () => {
  // Custom bounds {weaponAttack: {min:0, max:3}}
  // 3 scrolls × [0,+3] = [0,+9], need +9 → in range
  const result = canChaosFillResidual(
    { weaponAttack: 9 },
    3,
    ['weaponAttack'],
    { weaponAttack: { min: 0, max: 3 } },
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: custom bounds reject — above max', () => {
  // Custom bounds {weaponAttack: {min:0, max:3}}
  // 3 scrolls × [0,+3] = [0,+9], need +12 → out of range
  const result = canChaosFillResidual(
    { weaponAttack: 12 },
    3,
    ['weaponAttack'],
    { weaponAttack: { min: 0, max: 3 } },
  );
  assert.equal(result, false);
});

test('canChaosFillResidual: HP/MP wider default range', () => {
  // 1 scroll × [-50,+50], need +40 → in range
  const result = canChaosFillResidual(
    { maxHp: 40 },
    1,
    ['maxHp'],
    null,
  );
  assert.equal(result, true);
});

test('canChaosFillResidual: HP/MP out of range returns false', () => {
  // 1 scroll × [-50,+50], need +60 → out of range
  const result = canChaosFillResidual(
    { maxHp: 60 },
    1,
    ['maxHp'],
    null,
  );
  assert.equal(result, false);
});

// ── Aggregate chaos integration tests ──

test('chaos aggregate entry has isAggregate and aggregateCount', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 2001,
      nameKo: '장갑 혼돈의 주문서 60%',
      equipmentKind: 'Glove',
      behavior_type: 'chaos',
      stats: { weaponAttack: 0, str: 0, dex: 0, int: 0, luk: 0 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 5 },
    targetKeys: ['weaponAttack'],
    successfulScrollCount: 1,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
    scrollRateFilter: new Set(['chaos']),
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
  });

  assert.ok(result.strategies.length > 0, 'should find at least one chaos strategy');
  const chaosScrolls = result.strategies[0].scrolls.filter(s => s.behavior_type === 'chaos');
  assert.equal(chaosScrolls.length, 1, 'should have exactly one aggregate chaos entry');
  assert.equal(chaosScrolls[0].isAggregate, true);
  assert.equal(chaosScrolls[0].aggregateCount, 1);
  assert.equal(chaosScrolls[0].stats.weaponAttack, 5);
});

test('chaos-only strategy with multiple slots produces single aggregate entry', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 2001,
      nameKo: '장갑 혼돈의 주문서 60%',
      equipmentKind: 'Glove',
      behavior_type: 'chaos',
      stats: { weaponAttack: 0 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 8 },
    targetKeys: ['weaponAttack'],
    successfulScrollCount: 3,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
    scrollRateFilter: new Set(['chaos']),
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
  });

  assert.ok(result.strategies.length > 0, 'should find at least one strategy');
  const chaosScrolls = result.strategies[0].scrolls.filter(s => s.behavior_type === 'chaos');
  assert.equal(chaosScrolls.length, 1, 'should have exactly one aggregate chaos entry');
  assert.equal(chaosScrolls[0].aggregateCount, 3);
  assert.equal(chaosScrolls[0].stats.weaponAttack, 8);
});

test('chaos insufficient to fill residual returns no strategies', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 2001,
      nameKo: '장갑 혼돈의 주문서 60%',
      equipmentKind: 'Glove',
      behavior_type: 'chaos',
      stats: { weaponAttack: 0 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 20 },
    targetKeys: ['weaponAttack'],
    successfulScrollCount: 1,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
    scrollRateFilter: new Set(['chaos']),
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
  });

  assert.equal(result.strategies.length, 0, 'chaos cannot produce +20 from 1 scroll');
});

test('fixed + chaos aggregate produces correct structure', () => {
  const fakeScrolls = new Map();
  fakeScrolls.set('Glove', [
    {
      id: 1001,
      nameKo: '장갑 공격력 주문서 100%',
      equipmentKind: 'Glove',
      behavior_type: 'fixed',
      stats: { weaponAttack: 2 },
    },
    {
      id: 2001,
      nameKo: '장갑 혼돈의 주문서 60%',
      equipmentKind: 'Glove',
      behavior_type: 'chaos',
      stats: { weaponAttack: 0 },
    },
  ]);

  const result = enumerateStrategies({
    targetDeltas: { weaponAttack: 9 },
    targetKeys: ['weaponAttack'],
    successfulScrollCount: 3,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    cleanStats: {},
    scrollsByEquipmentKind: fakeScrolls,
    levelUpDefinition: null,
    scrollRateFilter: new Set(['100', 'chaos']),
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
  });

  assert.ok(result.strategies.length > 0, 'should find strategies');
  // Should find: 2x fixed (+4) + 1x chaos agg (+5) = +9
  const hasExpected = result.strategies.some(s => {
    const fixed = s.scrolls.filter(sc => sc.behavior_type !== 'chaos');
    const chaos = s.scrolls.filter(sc => sc.isAggregate);
    return fixed.length === 2 && chaos.length === 1 && chaos[0].aggregateCount === 1;
  });
  assert.ok(hasExpected, 'should find 2 fixed + 1 aggregate chaos strategy');
});
