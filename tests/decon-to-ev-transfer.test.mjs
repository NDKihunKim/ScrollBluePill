import assert from 'node:assert/strict';
import test from 'node:test';

// ── Fixtures ────────────────────────────────────────────────────────────

const item = {
	id: 1000001,
	nameKo: '테스트 무기',
	equipmentKind: 'weapon',
	requiredLevel: 120,
	requiredJobs: [],
	stats: { upgradeSlots: 7 },
};

const levelUpDefinition = {
	levelUpKind: 'timeless',
	maxLevelUps: 5,
	statRanges: {
		str: { min: 1, max: 3 },
		dex: { min: 0, max: 2 },
	},
};

const baseStrategy = {
	scrolls: [],
	stimulant: null,
	gems: [],
	sourceTypes: [],
};

// ── Tests ───────────────────────────────────────────────────────────────

test('spreads remaining level-up aggregate across levelCount slots', async () => {
	const { buildEnhancementStateFromStrategy } = await import(
		'../src/lib/deconToEvTransfer.mjs'
	);

	const state = buildEnhancementStateFromStrategy(
		{
			...baseStrategy,
			itemLevelUp: { levelCount: 3, stats: { str: 6, dex: 3 } },
		},
		item,
		levelUpDefinition,
	);

	const filled = state.itemLevelUpSlots.filter((slot) => slot !== null);
	assert.equal(state.itemLevelUpSlotCount, 5);
	assert.equal(filled.length, 3);
	assert.equal(state.itemLevelUpSlots[3], null);
	assert.equal(state.itemLevelUpSlots[4], null);

	// Every slot's stats stay inside the per-level ranges
	for (const slot of filled) {
		assert.ok(slot.stats.str >= 1 && slot.stats.str <= 3, 'str stays in range');
		assert.ok(slot.stats.dex >= 0 && slot.stats.dex <= 2, 'dex stays in range');
	}

	// Slots sum exactly to the aggregate
	const sums = { str: 0, dex: 0 };
	for (const slot of filled) {
		sums.str += slot.stats.str;
		sums.dex += slot.stats.dex;
	}
	assert.deepEqual(sums, { str: 6, dex: 3 });
});

test('keeps applied levels separate and avoids double counting', async () => {
	const { buildEnhancementStateFromStrategy } = await import(
		'../src/lib/deconToEvTransfer.mjs'
	);

	const state = buildEnhancementStateFromStrategy(
		{
			...baseStrategy,
			itemLevelUp: {
				levelCount: 3,
				stats: { str: 4, dex: 2 },
				appliedLevelCount: 1,
				appliedStats: { str: 1, dex: 0 },
			},
		},
		item,
		levelUpDefinition,
	);

	const filled = state.itemLevelUpSlots.filter((slot) => slot !== null);
	assert.equal(filled.length, 3, '1 applied + 2 remaining slots');
	assert.deepEqual(state.itemLevelUpSlots[0].stats, { str: 1 }, 'applied slot holds applied stats');

	const sums = { str: 0, dex: 0 };
	for (const slot of filled) {
		sums.str += slot.stats.str ?? 0;
		sums.dex += slot.stats.dex ?? 0;
	}
	assert.deepEqual(sums, { str: 4, dex: 2 }, 'total equals strategy stats with no double counting');
});

test('records remaining aggregate for exact probability computation', async () => {
	const { buildEnhancementStateFromStrategy } = await import(
		'../src/lib/deconToEvTransfer.mjs'
	);

	const state = buildEnhancementStateFromStrategy(
		{
			...baseStrategy,
			itemLevelUp: {
				levelCount: 3,
				stats: { str: 4, dex: 2 },
				appliedLevelCount: 1,
				appliedStats: { str: 1, dex: 0 },
			},
		},
		item,
		levelUpDefinition,
	);

	// Remaining = total − applied, over levelCount − appliedLevelCount levels
	assert.deepEqual(state.itemLevelUpAggregate, {
		levelCount: 2,
		stats: { str: 3, dex: 2 },
	});
});

test('defaults transferred level-up mode to probability', async () => {
	const { buildEnhancementStateFromStrategy } = await import(
		'../src/lib/deconToEvTransfer.mjs'
	);

	const state = buildEnhancementStateFromStrategy(
		{
			...baseStrategy,
			itemLevelUp: { levelCount: 2, stats: { str: 2 } },
		},
		item,
		levelUpDefinition,
	);

	assert.equal(state.itemLevelUpMode, 'probability');
});

test('leaves aggregate null when strategy has no level-up', async () => {
	const { buildEnhancementStateFromStrategy } = await import(
		'../src/lib/deconToEvTransfer.mjs'
	);

	const state = buildEnhancementStateFromStrategy(baseStrategy, item, levelUpDefinition);

	assert.equal(state.itemLevelUpAggregate, null);
	assert.ok(state.itemLevelUpSlots.every((slot) => slot === null));
});

test('all levels applied leaves no remaining aggregate', async () => {
	const { buildEnhancementStateFromStrategy } = await import(
		'../src/lib/deconToEvTransfer.mjs'
	);

	const state = buildEnhancementStateFromStrategy(
		{
			...baseStrategy,
			itemLevelUp: {
				levelCount: 2,
				stats: { str: 2 },
				appliedLevelCount: 2,
				appliedStats: { str: 2 },
			},
		},
		item,
		levelUpDefinition,
	);

	assert.equal(state.itemLevelUpAggregate, null);
	assert.equal(state.itemLevelUpSlots.filter((slot) => slot !== null).length, 2);
});
