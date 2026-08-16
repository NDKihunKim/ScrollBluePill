import assert from 'node:assert/strict';
import test from 'node:test';

function assertClose(actual, expected, label) {
	assert.ok(
		Math.abs(actual - expected) < 1e-12,
		`${label ?? 'probability'}: expected ${expected}, got ${actual}`,
	);
}

const strRange = { str: { min: 1, max: 3 } };

// ── Aggregate (transferred strategy) level-ups ──────────────────────────

test('aggregate level-up probability convolves uniform rolls', async () => {
	const { computeDirectOutcomeProbability } = await import(
		'../src/lib/expectedValue/directProbability.mjs'
	);

	// sum of 2 rolls in [1,3] equals 4: (1,3), (2,2), (3,1) → 3 × 1/9
	const p = computeDirectOutcomeProbability([], {
		levelUp: { ranges: strRange, aggregate: { levelCount: 2, stats: { str: 4 } } },
	});
	assertClose(p, 1 / 3);
});

test('aggregate at minimum and maximum sums has single-combination probability', async () => {
	const { computeDirectOutcomeProbability } = await import(
		'../src/lib/expectedValue/directProbability.mjs'
	);

	const pMin = computeDirectOutcomeProbability([], {
		levelUp: { ranges: strRange, aggregate: { levelCount: 2, stats: { str: 2 } } },
	});
	const pMax = computeDirectOutcomeProbability([], {
		levelUp: { ranges: strRange, aggregate: { levelCount: 2, stats: { str: 6 } } },
	});
	assertClose(pMin, 1 / 9);
	assertClose(pMax, 1 / 9);
});

test('aggregate outside reachable range returns zero', async () => {
	const { computeDirectOutcomeProbability } = await import(
		'../src/lib/expectedValue/directProbability.mjs'
	);

	// 2 rolls in [1,3] can never sum to 8
	const p = computeDirectOutcomeProbability([], {
		levelUp: { ranges: strRange, aggregate: { levelCount: 2, stats: { str: 8 } } },
	});
	assert.equal(p, 0);
});

test('multiple aggregate keys combine independently', async () => {
	const { computeDirectOutcomeProbability } = await import(
		'../src/lib/expectedValue/directProbability.mjs'
	);

	// P(str sum 4) = 3/9, P(dex sum 2 in [0,2]) = 3/9 → 1/9
	const p = computeDirectOutcomeProbability([], {
		levelUp: {
			ranges: { str: { min: 1, max: 3 }, dex: { min: 0, max: 2 } },
			aggregate: { levelCount: 2, stats: { str: 4, dex: 2 } },
		},
	});
	assertClose(p, 1 / 9);
});

test('aggregate keys without ranges are skipped', async () => {
	const { computeDirectOutcomeProbability } = await import(
		'../src/lib/expectedValue/directProbability.mjs'
	);

	const p = computeDirectOutcomeProbability([], {
		levelUp: {
			ranges: strRange,
			aggregate: { levelCount: 2, stats: { str: 4, jump: 100 } },
		},
	});
	assertClose(p, 1 / 3);
});

// ── Per-slot (native EV) level-ups ──────────────────────────────────────

test('per-slot level-up probability multiplies uniform roll probabilities', async () => {
	const { computeDirectOutcomeProbability } = await import(
		'../src/lib/expectedValue/directProbability.mjs'
	);

	const p = computeDirectOutcomeProbability([], {
		levelUp: {
			ranges: strRange,
			slots: [{ stats: { str: 1 } }, { stats: { str: 3 } }],
		},
	});
	assertClose(p, 1 / 9);
});

test('per-slot value outside range returns zero', async () => {
	const { computeDirectOutcomeProbability } = await import(
		'../src/lib/expectedValue/directProbability.mjs'
	);

	const p = computeDirectOutcomeProbability([], {
		levelUp: { ranges: strRange, slots: [{ stats: { str: 4 } }] },
	});
	assert.equal(p, 0);
});

// ── Composition with other sources ──────────────────────────────────────

test('level-up probability multiplies with scroll probability', async () => {
	const { computeDirectOutcomeProbability } = await import(
		'../src/lib/expectedValue/directProbability.mjs'
	);

	const p = computeDirectOutcomeProbability(
		[{ behavior_type: 'fixed', stats: { str: 2 }, success_rate: 0.6 }],
		{ levelUp: { ranges: strRange, aggregate: { levelCount: 2, stats: { str: 4 } } } },
	);
	assertClose(p, 0.6 * (1 / 3));
});

test('statFilter without level-up keys skips the level-up contribution', async () => {
	const { computeDirectOutcomeProbability } = await import(
		'../src/lib/expectedValue/directProbability.mjs'
	);

	const p = computeDirectOutcomeProbability([], {
		statFilter: new Set(['dex']),
		levelUp: { ranges: strRange, aggregate: { levelCount: 2, stats: { str: 4 } } },
	});
	assertClose(p, 1.0);
});

// ── Exact-outcome eligibility ───────────────────────────────────────────

test('canUseExactOutcome allows probability-mode level-up', async () => {
	const { canUseExactOutcome } = await import(
		'../src/lib/expectedValue/directProbability.mjs'
	);

	assert.equal(
		canUseExactOutcome({
			scrollSequence: [],
			makerChoices: [],
			useStimulant: false,
			useItemLevelUp: true,
		}),
		true,
	);
});
