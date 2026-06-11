import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createEnhancementState,
	activateMaker,
	deactivateMaker,
	applyStimulant,
	clearStimulant,
	resetState,
	computeAccumulatedStats,
	computeGradeColor,
	computeRemainingSlots,
} from '../src/lib/enhancementState.mjs';

test('enhancement state initializes and clears maker stimulant separately from gem slots', () => {
	const state = createEnhancementState(7, 80);

	assert.equal(state.stimulantSlot, null);
	assert.equal(computeRemainingSlots(state), 7);

	activateMaker(state);
	assert.equal(applyStimulant(state, { str: 0, dex: -3, maxHp: 5 }), true);
	assert.deepEqual(state.stimulantSlot, { stats: { str: 0, dex: -3, maxHp: 5 } });
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
