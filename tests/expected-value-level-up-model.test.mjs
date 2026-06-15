import assert from 'node:assert/strict';
import test from 'node:test';

test('rollLevelUpStats returns a stat roll within the defined range', async () => {
	const { rollLevelUpStats } = await import('../src/lib/expectedValue/levelUpModel.mjs');

	const ranges = { str: { min: 1, max: 5 } };

	// rng = 0.0 should give the minimum value
	const resultMin = rollLevelUpStats(ranges, () => 0.0);
	assert.equal(resultMin.str, 1);

	// rng just below 1.0 should give the maximum value
	const resultMax = rollLevelUpStats(ranges, () => 0.9999);
	assert.equal(resultMax.str, 5);
});

test('rollLevelUpStats returns integer values across full range', async () => {
	const { rollLevelUpStats } = await import('../src/lib/expectedValue/levelUpModel.mjs');

	// Use range 1..6 to avoid conflict with zero-value omission
	const ranges = { stat: { min: 1, max: 6 } };
	const seen = new Set();

	for (let i = 0; i < 100; i++) {
		const r = rollLevelUpStats(ranges, () => i / 100);
		seen.add(r.stat);
	}

	// All values 1..6 should appear across 100 samples
	for (let i = 1; i <= 6; i++) {
		assert.ok(seen.has(i), `expected value ${i} to appear`);
	}
});

test('rollAllLevelUps rolls each level independently and accumulates', async () => {
	const { rollAllLevelUps } = await import('../src/lib/expectedValue/levelUpModel.mjs');

	const ranges = { str: { min: 1, max: 1 } };
	const result = rollAllLevelUps(ranges, 3, () => 0.0);

	assert.equal(result.str, 3);
});

test('rollAllLevelUps handles multiple stats', async () => {
	const { rollAllLevelUps } = await import('../src/lib/expectedValue/levelUpModel.mjs');

	const ranges = { str: { min: 1, max: 1 }, dex: { min: 2, max: 2 } };
	const result = rollAllLevelUps(ranges, 4, () => 0.0);

	assert.equal(result.str, 4);
	assert.equal(result.dex, 8);
});

test('rollAllLevelUps with 0 levels returns empty object', async () => {
	const { rollAllLevelUps } = await import('../src/lib/expectedValue/levelUpModel.mjs');

	const ranges = { str: { min: 1, max: 5 } };
	const result = rollAllLevelUps(ranges, 0, () => 0.0);

	assert.deepEqual(result, {});
});

test('rollAllLevelUps handles empty ranges', async () => {
	const { rollAllLevelUps } = await import('../src/lib/expectedValue/levelUpModel.mjs');

	const result = rollAllLevelUps({}, 5, () => 0.0);

	assert.deepEqual(result, {});
});

test('rollLevelUpStats omits zero-value stats from result', async () => {
	const { rollLevelUpStats } = await import('../src/lib/expectedValue/levelUpModel.mjs');

	const ranges = { str: { min: 0, max: 0 } };
	const result = rollLevelUpStats(ranges, () => 0.0);

	assert.deepEqual(result, {});
});

test('rollLevelUpStats handles invalid ranges gracefully', async () => {
	const { rollLevelUpStats } = await import('../src/lib/expectedValue/levelUpModel.mjs');

	const ranges = { str: { min: 1, max: 5 }, invalidStat: null };
	const result = rollLevelUpStats(ranges, () => 0.0);

	// Should include the valid stat and skip null range
	assert.equal(result.str, 1);
	assert.equal(Object.keys(result).length, 1);
});
