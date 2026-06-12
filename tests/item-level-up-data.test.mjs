import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schemaSql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

test('schema defines published item level-up definitions with RLS', () => {
	assert.match(schemaSql, /create table if not exists public\.item_level_up_definitions/);
	assert.match(schemaSql, /item_id integer primary key references public\.item_definitions\(id\)/);
	assert.match(schemaSql, /level_up_kind text not null check \(level_up_kind in \('reverse', 'timeless'\)\)/);
	assert.match(schemaSql, /max_level_ups integer not null check \(max_level_ups in \(3, 5\)\)/);
	assert.match(schemaSql, /stat_ranges jsonb not null/);
	assert.match(schemaSql, /published_status text not null default 'draft'/);
	assert.match(schemaSql, /alter table public\.item_level_up_definitions enable row level security;/);
	assert.match(
		schemaSql,
		/create policy "Public can read published item level-up definitions"[\s\S]*using \(published_status = 'published'\);/,
	);
	assert.match(schemaSql, /grant select on public\.item_level_up_definitions to anon, authenticated;/);
	assert.match(schemaSql, /grant select, insert, update, delete on public\.item_level_up_definitions to service_role;/);
});
