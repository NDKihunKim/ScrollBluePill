import assert from 'node:assert/strict';
import test from 'node:test';

import {
	statDisplayValue,
	statDeltaFromDisplay,
} from '../src/lib/deconstruction/statEditor.mjs';

// 세라핌즈: weaponAttack clean = 58
test('sum mode displays clean base + delta (세라핌즈 공격력 70 → +12)', () => {
	assert.equal(statDisplayValue('sum', 58, 12), 70);
	assert.equal(statDeltaFromDisplay('sum', 58, 70), 12);
});

test('add mode displays the raw delta', () => {
	assert.equal(statDisplayValue('add', 58, 12), 12);
	assert.equal(statDeltaFromDisplay('add', 58, 12), 12);
});

test('stats absent from the clean item behave identically in both modes (base 0)', () => {
	// 세라핌즈 + DEX 행 추가: clean DEX = 0
	assert.equal(statDisplayValue('sum', 0, 10), 10);
	assert.equal(statDisplayValue('add', 0, 10), 10);
	assert.equal(statDeltaFromDisplay('sum', 0, 10), 10);
});

test('display → delta roundtrip preserves the stored delta in both modes', () => {
	for (const mode of ['add', 'sum']) {
		for (const [base, delta] of [[58, -58], [58, 0], [58, 35], [0, 7]]) {
			const displayed = statDisplayValue(mode, base, delta);
			assert.equal(statDeltaFromDisplay(mode, base, displayed), delta);
		}
	}
});
