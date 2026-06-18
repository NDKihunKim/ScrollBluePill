import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('filled item level-up slots reveal their delete button on hover', async () => {
	const indexSource = await readFile(new URL('../src/pages/expected-value.astro', import.meta.url), 'utf8');

	assert.match(
		indexSource,
		/:global\(\.item-level-up-slot--filled:hover \.slot-box-x\)\s*\{[^}]*opacity:\s*1;[^}]*pointer-events:\s*auto;/,
	);
});
