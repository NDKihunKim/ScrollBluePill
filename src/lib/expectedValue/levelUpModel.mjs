import { normalizeItemLevelUpRange } from '../itemLevelUpData.mjs';

/**
 * Rolls a single level-up event for each stat in the given ranges.
 * Uses the provided rng function (returns [0, 1)) for uniform random rolls.
 * Only includes non-zero values in the result.
 *
 * @param {Object<string, {min: number, max: number}>} ranges
 * @param {() => number} rng
 * @returns {Object<string, number>}
 */
export function rollLevelUpStats(ranges, rng) {
	const result = {};

	for (const [statKey, range] of Object.entries(ranges)) {
		const normalized = normalizeItemLevelUpRange(range);
		if (!normalized) {
			continue;
		}

		const { min, max } = normalized;
		const count = max - min + 1;
		const roll = Math.floor(rng() * count) + min;

		if (roll !== 0) {
			result[statKey] = roll;
		}
	}

	return result;
}

/**
 * Rolls level-up events for the specified number of levels and accumulates
 * the total stat gains.
 *
 * @param {Object<string, {min: number, max: number}>} ranges
 * @param {number} levelCount
 * @param {() => number} rng
 * @returns {Object<string, number>}
 */
export function rollAllLevelUps(ranges, levelCount, rng) {
	if (levelCount === 0) {
		return {};
	}

	const totals = {};

	for (let i = 0; i < levelCount; i++) {
		const levelRoll = rollLevelUpStats(ranges, rng);

		for (const [statKey, value] of Object.entries(levelRoll)) {
			totals[statKey] = (totals[statKey] ?? 0) + value;
		}
	}

	return totals;
}
