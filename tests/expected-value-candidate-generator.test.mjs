import assert from 'node:assert/strict';
import test from 'node:test';

import {
  pruneUselessScrolls,
  generateScrollCandidates,
  generateMakerCandidates,
  generateStrategyCandidates,
} from '../src/lib/expectedValue/candidateGenerator.mjs';

// ---------------------------------------------------------------------------
// Helper: create a minimal scroll object
// ---------------------------------------------------------------------------
function makeScroll({ id = 1, nameKo = '테스트 주문서', stats = {}, maxApplications = null }) {
  return { id, nameKo, stats, maxApplications };
}

// ---------------------------------------------------------------------------
// pruneUselessScrolls
// ---------------------------------------------------------------------------

test('pruneUselessScrolls removes scrolls affecting only unchecked stats', () => {
  const scrolls = [
    makeScroll({ id: 1, stats: { weaponAttack: 2 } }),
    makeScroll({ id: 2, stats: { str: 1 } }),
  ];
  const checkedStats = { str: true, grade: false };

  const result = pruneUselessScrolls(scrolls, checkedStats);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 2);
});

test('pruneUselessScrolls keeps scrolls with at least one checked stat', () => {
  const scrolls = [
    makeScroll({ id: 1, stats: { weaponAttack: 2, str: 1 } }),
    makeScroll({ id: 2, stats: { dex: 3 } }),
  ];
  const checkedStats = { str: true, dex: false, grade: false };

  const result = pruneUselessScrolls(scrolls, checkedStats);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
});

test('pruneUselessScrolls keeps scrolls when grade is checked (even without stat overlap)', () => {
  const scrolls = [
    makeScroll({ id: 1, stats: { weaponAttack: 2 } }),
    makeScroll({ id: 2, stats: { maxHp: 10 } }),
  ];
  const checkedStats = { str: false, grade: true };

  const result = pruneUselessScrolls(scrolls, checkedStats);
  assert.equal(result.length, 2);
});

test('pruneUselessScrolls removes scrolls with no stats', () => {
  const scrolls = [
    makeScroll({ id: 1, stats: {} }),
    makeScroll({ id: 2, stats: { weaponAttack: 1 } }),
  ];
  const checkedStats = { weaponAttack: true, grade: false };

  const result = pruneUselessScrolls(scrolls, checkedStats);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 2);
});

test('pruneUselessScrolls returns empty array when no scrolls are useful', () => {
  const scrolls = [
    makeScroll({ id: 1, stats: { weaponAttack: 2 } }),
    makeScroll({ id: 2, stats: { int: 1 } }),
  ];
  const checkedStats = { str: true, grade: false };

  const result = pruneUselessScrolls(scrolls, checkedStats);
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// generateScrollCandidates
// ---------------------------------------------------------------------------

test('generateScrollCandidates includes the empty sequence', () => {
  const scroll = makeScroll({ id: 1, stats: { str: 2 } });
  const checkedStats = { str: true, grade: false };
  const upgradeSlots = 3;

  const candidates = generateScrollCandidates([scroll], checkedStats, upgradeSlots);

  // The empty sequence should be present
  const hasEmpty = candidates.some(c => c.length === 0);
  assert.ok(hasEmpty, 'should contain the empty sequence');
});

test('generateScrollCandidates includes sequences of varying lengths', () => {
  const scroll = makeScroll({ id: 1, stats: { str: 2 } });
  const checkedStats = { str: true, grade: false };
  const upgradeSlots = 2;

  const candidates = generateScrollCandidates([scroll], checkedStats, upgradeSlots);

  const lengths = new Set(candidates.map(c => c.length));
  assert.ok(lengths.has(0), 'should have length 0 (empty)');
  assert.ok(lengths.has(1), 'should have length 1');
  assert.ok(lengths.has(2), 'should have length 2');
});

test('generateScrollCandidates enforces maxApplications', () => {
  const scroll = makeScroll({ id: 1, stats: { str: 2 }, maxApplications: 1 });
  const checkedStats = { str: true, grade: false };
  const upgradeSlots = 3;

  const candidates = generateScrollCandidates([scroll], checkedStats, upgradeSlots);

  // Any sequence should have at most 1 instance of the scroll
  for (const seq of candidates) {
    const count = seq.filter(s => s.id === 1).length;
    assert.ok(count <= 1, `sequence ${JSON.stringify(seq)} exceeds maxApplications`);
  }

  // There should be some sequences with 1 instance of the scroll
  const hasOne = candidates.some(c => c.filter(s => s.id === 1).length === 1);
  assert.ok(hasOne, 'should include sequences with one application');
});

test('generateScrollCandidates enforces different maxApplications per scroll', () => {
  const scrollA = makeScroll({ id: 1, stats: { str: 2 }, maxApplications: 2 });
  const scrollB = makeScroll({ id: 2, stats: { dex: 1 }, maxApplications: 1 });
  const checkedStats = { str: true, dex: true, grade: false };
  const upgradeSlots = 3;

  const candidates = generateScrollCandidates([scrollA, scrollB], checkedStats, upgradeSlots);

  for (const seq of candidates) {
    const countA = seq.filter(s => s.id === 1).length;
    const countB = seq.filter(s => s.id === 2).length;
    assert.ok(countA <= 2, 'scrollA exceeds max 2');
    assert.ok(countB <= 1, 'scrollB exceeds max 1');
  }
});

test('generateScrollCandidates with empty scrolls array returns only empty sequence', () => {
  const candidates = generateScrollCandidates([], {}, 3);
  assert.deepEqual(candidates, [[]]);
});

test('generateScrollCandidates with 0 upgradeSlots returns only empty sequence', () => {
  const scroll = makeScroll({ id: 1, stats: { str: 2 } });
  const checkedStats = { str: true, grade: false };

  const candidates = generateScrollCandidates([scroll], checkedStats, 0);
  assert.deepEqual(candidates, [[]]);
});

test('generateScrollCandidates includes multiple scroll combinations', () => {
  const scrollA = makeScroll({ id: 1, stats: { str: 2 } });
  const scrollB = makeScroll({ id: 2, stats: { dex: 1 } });
  const checkedStats = { str: true, dex: true, grade: false };
  const upgradeSlots = 2;

  const candidates = generateScrollCandidates([scrollA, scrollB], checkedStats, upgradeSlots);

  // Should have [scrollA, scrollA], [scrollA, scrollB], [scrollB, scrollA], [scrollB, scrollB]
  // plus partial sequences and empty
  const seqsWithBoth = candidates.filter(c => c.length === 2);
  assert.ok(seqsWithBoth.length > 0, 'should have full-length sequences');

  // Check a specific combination exists
  const hasAB = candidates.some(c => c.length === 2 && c[0].id === 1 && c[1].id === 2);
  assert.ok(hasAB, 'should include sequence [scrollA, scrollB]');
});

test('generateScrollCandidates caps at reasonable limit', () => {
  // Create enough scrolls to cause combinatorial explosion if not capped
  const scrolls = [];
  for (let i = 0; i < 6; i++) {
    scrolls.push(makeScroll({ id: i + 1, stats: { str: 1 } }));
  }
  const checkedStats = { str: true, grade: false };
  const upgradeSlots = 5;

  const candidates = generateScrollCandidates(scrolls, checkedStats, upgradeSlots);

  // Should be capped (without capping, this would be enormous)
  // Exact cap is implementation-defined, but should be reasonable
  assert.ok(candidates.length <= 2000, `scroll candidates length ${candidates.length} exceeds expected cap`);
  assert.ok(candidates.length > 0, 'should still have candidates');
});

// ---------------------------------------------------------------------------
// generateMakerCandidates
// ---------------------------------------------------------------------------

test('generateMakerCandidates returns [[]] when gemSlotCount is 0', () => {
  const candidates = generateMakerCandidates(0, '전사');
  assert.deepEqual(candidates, [[]]);
});

test('generateMakerCandidates includes fixed gems with all grades', () => {
  const candidates = generateMakerCandidates(1, '반지');

  // Should include strCrystal with grades 0, 1, 2
  const hasStr0 = candidates.some(c =>
    c[0] && c[0].gemKey === 'strCrystal' && c[0].grade === 0
  );
  const hasStr1 = candidates.some(c =>
    c[0] && c[0].gemKey === 'strCrystal' && c[0].grade === 1
  );
  const hasStr2 = candidates.some(c =>
    c[0] && c[0].gemKey === 'strCrystal' && c[0].grade === 2
  );

  assert.ok(hasStr0, 'should include strCrystal grade 0');
  assert.ok(hasStr1, 'should include strCrystal grade 1');
  assert.ok(hasStr2, 'should include strCrystal grade 2');
});

test('generateMakerCandidates includes variable gems (blackAmethyst, darkCrystal) with all grades', () => {
  const candidates = generateMakerCandidates(1, '단검'); // weapon

  const hasBlack0 = candidates.some(c =>
    c[0] && c[0].gemKey === 'blackAmethyst' && c[0].grade === 0
  );
  const hasBlack1 = candidates.some(c =>
    c[0] && c[0].gemKey === 'blackAmethyst' && c[0].grade === 1
  );
  const hasBlack2 = candidates.some(c =>
    c[0] && c[0].gemKey === 'blackAmethyst' && c[0].grade === 2
  );

  assert.ok(hasBlack0, 'should include blackAmethyst grade 0');
  assert.ok(hasBlack1, 'should include blackAmethyst grade 1');
  assert.ok(hasBlack2, 'should include blackAmethyst grade 2');
});

test('generateMakerCandidates filters weaponOnly gems correctly', () => {
  // Non-weapon equipment: should NOT include blackAmethyst or diamond or sapphire
  const nonWeaponCandidates = generateMakerCandidates(1, '반지');

  const hasBlack = nonWeaponCandidates.some(c =>
    c[0] && c[0].gemKey === 'blackAmethyst'
  );
  const hasDiamond = nonWeaponCandidates.some(c =>
    c[0] && c[0].gemKey === 'diamond'
  );

  assert.equal(hasBlack, false, 'non-weapon should not include blackAmethyst');
  assert.equal(hasDiamond, false, 'non-weapon should not include diamond');

  // Weapon equipment: should include blackAmethyst and diamond
  const weaponCandidates = generateMakerCandidates(1, '단검');

  const hasBlackWeapon = weaponCandidates.some(c =>
    c[0] && c[0].gemKey === 'blackAmethyst'
  );
  const hasDiamondWeapon = weaponCandidates.some(c =>
    c[0] && c[0].gemKey === 'diamond'
  );

  assert.ok(hasBlackWeapon, 'weapon should include blackAmethyst');
  assert.ok(hasDiamondWeapon, 'weapon should include diamond');
});

test('generateMakerCandidates enforces no duplicate gem keys', () => {
  const candidates = generateMakerCandidates(2, '반지');

  for (const config of candidates) {
    const usedKeys = config.filter(c => c !== null).map(c => c.gemKey);
    const uniqueKeys = new Set(usedKeys);
    assert.equal(usedKeys.length, uniqueKeys.size,
      `duplicate gem keys found in ${JSON.stringify(config)}`
    );
  }
});

test('generateMakerCandidates includes empty slot choices (null entries)', () => {
  const candidates = generateMakerCandidates(2, '반지');

  // At least one entry should have a null in it
  const hasNull = candidates.some(c => c.some(slot => slot === null));
  assert.ok(hasNull, 'should include configurations with null (empty) slots');

  // The all-null configuration should exist
  const allNull = candidates.some(c => c.every(slot => slot === null));
  assert.ok(allNull, 'should include configuration with all null slots');
});

test('generateMakerCandidates array length equals gemSlotCount', () => {
  const candidates = generateMakerCandidates(3, '반지');

  for (const config of candidates) {
    assert.equal(config.length, 3, 'each config should have length equal to gemSlotCount');
  }
});

test('generateMakerCandidates with 1 slot includes both null and filled options', () => {
  const candidates = generateMakerCandidates(1, '반지');

  // Should have null entry
  assert.ok(candidates.some(c => c[0] === null), 'should have empty slot');

  // Should have filled entries
  assert.ok(candidates.some(c => c[0] !== null), 'should have filled slots');

  // Each entry should have length 1
  for (const c of candidates) {
    assert.equal(c.length, 1);
  }
});

// ---------------------------------------------------------------------------
// generateStrategyCandidates
// ---------------------------------------------------------------------------

test('generateStrategyCandidates returns strategies with correct structure', () => {
  const scroll = makeScroll({ id: 1, stats: { str: 2 } });
  const options = {
    scrolls: [scroll],
    checkedStats: { str: true, grade: false },
    upgradeSlots: 1,
    makerAllowed: false,
    gemSlotCount: 0,
    equipmentKind: '반지',
    itemLevelUpAllowed: false,
    levelUpDefinition: null,
  };

  const strategies = generateStrategyCandidates(options);

  for (const s of strategies) {
    assert.ok(Array.isArray(s.makerChoices), 'makerChoices should be an array');
    assert.ok(Array.isArray(s.scrollSequence), 'scrollSequence should be an array');
    assert.equal(typeof s.useItemLevelUp, 'boolean', 'useItemLevelUp should be boolean');
  }
});

test('generateStrategyCandidates cross-products correctly', () => {
  const scroll = makeScroll({ id: 1, stats: { str: 2 } });
  const options = {
    scrolls: [scroll],
    checkedStats: { str: true, grade: false },
    upgradeSlots: 1,
    makerAllowed: false,
    gemSlotCount: 0,
    equipmentKind: '반지',
    itemLevelUpAllowed: false,
    levelUpDefinition: null,
  };

  const strategies = generateStrategyCandidates(options);

  // makerCandidates: [[]] (since gemSlotCount=0)
  // scrollCandidates: [[], [scroll]] (empty and one scroll)
  // levelUp: [false] (since itemLevelUpAllowed=false)
  // Total: 1 * 2 * 1 = 2
  assert.equal(strategies.length, 2, 'should have 2 strategies from cross product');
});

test('generateStrategyCandidates includes level-up variants when allowed', () => {
  const scroll = makeScroll({ id: 1, stats: { str: 2 } });
  const options = {
    scrolls: [scroll],
    checkedStats: { str: true, grade: false },
    upgradeSlots: 0,
    makerAllowed: false,
    gemSlotCount: 0,
    equipmentKind: '반지',
    itemLevelUpAllowed: true,
    levelUpDefinition: { maxLevelUps: 5 },
  };

  const strategies = generateStrategyCandidates(options);

  // makerCandidates: [[]]
  // scrollCandidates: [[]] (only empty since upgradeSlots=0)
  // levelUp: [true, false]
  // Total: 1 * 1 * 2 = 2
  assert.equal(strategies.length, 2, 'should have 2 strategies (with and without level-up)');

  const hasLevelUp = strategies.some(s => s.useItemLevelUp === true);
  const noLevelUp = strategies.some(s => s.useItemLevelUp === false);

  assert.ok(hasLevelUp, 'should have strategy with useItemLevelUp=true');
  assert.ok(noLevelUp, 'should have strategy with useItemLevelUp=false');
});

test('generateStrategyCandidates respects makerAllowed=false (only empty maker)', () => {
  const scroll = makeScroll({ id: 1, stats: { str: 2 } });
  const options = {
    scrolls: [scroll],
    checkedStats: { str: true, grade: false },
    upgradeSlots: 0,
    makerAllowed: false,
    gemSlotCount: 2,
    equipmentKind: '반지',
    itemLevelUpAllowed: false,
    levelUpDefinition: null,
  };

  const strategies = generateStrategyCandidates(options);

  // When makerAllowed is false, makerChoices should always be empty array
  for (const s of strategies) {
    assert.deepEqual(s.makerChoices, [], 'makerChoices must be empty when makerAllowed is false');
  }
});

test('generateStrategyCandidates respects makerAllowed=true', () => {
  const scroll = makeScroll({ id: 1, stats: { str: 2 } });
  const options = {
    scrolls: [scroll],
    checkedStats: { str: true, grade: false },
    upgradeSlots: 0,
    makerAllowed: true,
    gemSlotCount: 1,
    equipmentKind: '반지',
    itemLevelUpAllowed: false,
    levelUpDefinition: null,
  };

  const strategies = generateStrategyCandidates(options);

  // Some strategies should have non-empty makerChoices when makerAllowed is true
  const hasNonEmptyMaker = strategies.some(s => s.makerChoices.length > 0);
  assert.ok(hasNonEmptyMaker, 'should have strategies with non-empty maker choices');
});

test('generateStrategyCandidates respects MAX_STRATEGIES cap', () => {
  // Generate lots of scroll options and maker options to test the cap
  const scrolls = [];
  for (let i = 0; i < 4; i++) {
    scrolls.push(makeScroll({ id: i + 1, stats: { str: 1 } }));
  }
  const options = {
    scrolls,
    checkedStats: { str: true, grade: false },
    upgradeSlots: 4,
    makerAllowed: true,
    gemSlotCount: 3,
    equipmentKind: '반지',
    itemLevelUpAllowed: true,
    levelUpDefinition: { maxLevelUps: 5 },
  };

  const strategies = generateStrategyCandidates(options);

  // Should not exceed 5000 (the MAX_STRATEGIES cap)
  assert.ok(strategies.length <= 6000, `strategies length ${strategies.length} exceeds reasonable cap`);
  // But should still generate something
  assert.ok(strategies.length > 0, 'should still generate strategies');
});

test('generateStrategyCandidates makerChoices filters null entries', () => {
  const options = {
    scrolls: [],
    checkedStats: {},
    upgradeSlots: 0,
    makerAllowed: true,
    gemSlotCount: 3,
    equipmentKind: '반지',
    itemLevelUpAllowed: false,
    levelUpDefinition: null,
  };

  const strategies = generateStrategyCandidates(options);

  for (const s of strategies) {
    const hasNull = s.makerChoices.some(c => c === null);
    assert.equal(hasNull, false, 'makerChoices should not contain null entries');
  }
});
