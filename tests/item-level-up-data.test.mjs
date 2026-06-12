import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schemaSql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

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
