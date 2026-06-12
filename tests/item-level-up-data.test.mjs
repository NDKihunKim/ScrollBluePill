import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
	knownItemLevelUpStatKeys,
	resolveItemLevelUpRuntimeRows,
	validateItemLevelUpSeed,
} from '../src/lib/itemLevelUpData.mjs';

const schemaSql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

async function readJson(path) {
	return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('schema defines published item level-up definitions with RLS', () => {
	assert.match(schemaSql, /create table if not exists public\.item_level_up_definitions/);
	const itemLevelUpTableSql = schemaSql.match(
		/create table if not exists public\.item_level_up_definitions \([\s\S]*?\n\);/,
	)?.[0] ?? '';

	assert.match(schemaSql, /item_id integer primary key references public\.item_definitions\(id\)/);
	assert.match(schemaSql, /level_up_kind text not null check \(level_up_kind in \('reverse', 'timeless'\)\)/);
	assert.match(schemaSql, /max_level_ups integer not null check \(max_level_ups in \(3, 5\)\)/);
	assert.match(
		itemLevelUpTableSql,
		/constraint item_level_up_definitions_kind_max_level_ups_check\s+check \(\s*\(level_up_kind = 'reverse' and max_level_ups = 3\)\s+or\s+\(level_up_kind = 'timeless' and max_level_ups = 5\)\s*\)/,
	);
	assert.match(
		schemaSql,
		/do \$\$\s+begin\s+alter table public\.item_level_up_definitions\s+add constraint item_level_up_definitions_kind_max_level_ups_check\s+check \(\s*\(level_up_kind = 'reverse' and max_level_ups = 3\)\s+or\s+\(level_up_kind = 'timeless' and max_level_ups = 5\)\s*\);\s+exception\s+when duplicate_object then null;\s+end \$\$;/,
	);
	assert.match(schemaSql, /stat_ranges jsonb not null/);
	assert.match(itemLevelUpTableSql, /published_status text not null default 'draft'/);
	assert.match(schemaSql, /alter table public\.item_level_up_definitions enable row level security;/);
	assert.match(
		schemaSql,
		/create policy "Public can read published item level-up definitions"\s+on public\.item_level_up_definitions\s+for select\s+using \(\s+published_status = 'published'\s+and exists \(\s+select 1\s+from public\.item_definitions\s+where item_definitions\.id = item_level_up_definitions\.item_id\s+and item_definitions\.published_status = 'published'\s+\)\s+\);/,
	);
	assert.match(schemaSql, /grant select on public\.item_level_up_definitions to anon, authenticated;/);
	assert.match(schemaSql, /grant select, insert, update, delete on public\.item_level_up_definitions to service_role;/);
});

test('item level-up seed validates templates and item mappings', async () => {
	const seed = await readJson('data/item-level-up-definitions.seed.json');
	const items = await readJson('public/data/items-gms83-ko.json');
	const result = validateItemLevelUpSeed(seed, items);

	assert.equal(result.itemCount > 0, true);
	assert.equal(result.errors.length, 0, result.errors.join('\n'));
	assert.ok(knownItemLevelUpStatKeys.has('weaponAttack'));
	assert.ok(knownItemLevelUpStatKeys.has('maxHp'));
});

test('item level-up runtime rows are keyed by item id and preserve reverse/timeless slot counts', async () => {
	const seed = await readJson('data/item-level-up-definitions.seed.json');
	const rows = resolveItemLevelUpRuntimeRows(seed);
	const byId = new Map(rows.map((row) => [row.itemId, row]));

	assert.equal(byId.get(1302086).levelUpKind, 'reverse');
	assert.equal(byId.get(1302086).maxLevelUps, 3);
	assert.equal(byId.get(1302081).levelUpKind, 'timeless');
	assert.equal(byId.get(1302081).maxLevelUps, 5);
	assert.deepEqual(byId.get(1302086).statRanges.weaponAttack, { min: 0, max: 2 });
	assert.deepEqual(byId.get(1302086).statRanges.str, { min: 1, max: 2 });
	assert.deepEqual(byId.get(1302086).statRanges.dex, { min: 0, max: 1 });
});

test('package exposes item level-up seed and generate scripts', async () => {
	const packageJson = await readJson('package.json');

	assert.equal(
		packageJson.scripts['seed:item-level-ups'],
		'node --env-file=.env scripts/seed-item-level-up-definitions.mjs',
	);
	assert.equal(
		packageJson.scripts['generate:item-level-ups'],
		'node --env-file=.env scripts/generate-item-level-up-index.mjs',
	);
});

test('item level-up scripts use the correct Supabase keys', async () => {
	const seedSource = await readFile(new URL('../scripts/seed-item-level-up-definitions.mjs', import.meta.url), 'utf8');
	const generateSource = await readFile(new URL('../scripts/generate-item-level-up-index.mjs', import.meta.url), 'utf8');

	assert.match(seedSource, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
	assert.match(seedSource, /item_level_up_definitions/);
	assert.match(seedSource, /resolution=merge-duplicates/);
	assert.match(generateSource, /process\.env\.SUPABASE_ANON_KEY/);
	assert.match(generateSource, /published_status/);
	assert.match(generateSource, /public\/data\/item-level-ups-gms83-ko\.json/);
});
