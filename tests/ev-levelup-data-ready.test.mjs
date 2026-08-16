import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

// The item level-up data loads asynchronously. The 레벨업 toggle must not be
// permanently hidden when an eligible item is selected (or a decon transfer
// applied) before the data arrives — the panel must re-activate on load, and
// the transfer must wait for the data so its probability uses real ranges.

test('enhancement panel exposes data-ready state and re-activates level-up UI after load', async () => {
	const source = await readFile(
		new URL('../src/lib/enhancementPanel.mjs', import.meta.url),
		'utf8',
	);

	assert.match(source, /window\.__evIsEnhancementDataLoaded\s*=\s*\(\)\s*=>\s*enhancementDataLoaded/);
	assert.match(source, /enhancementDataLoaded\s*=\s*true/);

	// Re-activation with the loaded definition when a state is already active
	assert.match(source, /supportsItemLevelUp\(loadedDefinition\)/);
	assert.match(
		source,
		/itemLevelUpPanel\.activate\(\s*enhancementState,\s*selectedBaseItem,\s*selectedItemLevelUpDefinition/,
	);
});

test('EV transfer waits for enhancement data before applying', async () => {
	const source = await readFile(
		new URL('../src/pages/expected-value.astro', import.meta.url),
		'utf8',
	);

	assert.match(source, /__evIsEnhancementDataLoaded/);
	assert.match(
		source,
		/pendingDeconTransfer\s*=\s*\{\s*targetItem,\s*strategy:\s*transferPayload\.strategy\s*\}/,
	);
});
