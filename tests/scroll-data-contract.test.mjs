import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readJson(relativePath) {
	const url = new URL(`../${relativePath}`, import.meta.url);
	return JSON.parse(await readFile(url, 'utf8'));
}

test('gun attack scroll data includes real 10/60/100 percent entries only', async () => {
	const scrolls = await readJson('public/data/scrolls-gms83-ko.json');
	const gunAttackScrolls = scrolls.filter((scroll) =>
		scroll.equipmentKind === '총' && scroll.nameKo?.startsWith('총 공격력 주문서 '),
	);

	assert.deepEqual(
		gunAttackScrolls.map((scroll) => scroll.nameKo),
		['총 공격력 주문서 100%', '총 공격력 주문서 60%', '총 공격력 주문서 10%'],
	);

	assert.deepEqual(gunAttackScrolls.map((scroll) => scroll.id), [2044900, 2044901, 2044902]);
	assert.deepEqual(gunAttackScrolls[0].stats, { weaponAttack: 1 });
	assert.deepEqual(gunAttackScrolls[1].stats, { accuracy: 1, weaponAttack: 2 });
	assert.deepEqual(gunAttackScrolls[2].stats, { accuracy: 3, dex: 1, weaponAttack: 5 });
	assert.ok(
		!gunAttackScrolls.some((scroll) =>
			scroll.nameKo === '총 공격력 주문서 100%' &&
			scroll.stats?.accuracy === 1 &&
			scroll.stats?.weaponAttack === 2,
		),
	);
});
