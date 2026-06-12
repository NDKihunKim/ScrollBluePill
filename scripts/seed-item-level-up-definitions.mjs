import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveItemLevelUpRuntimeRows, validateItemLevelUpSeed } from '../src/lib/itemLevelUpData.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seedPath = resolve('data/item-level-up-definitions.seed.json');
const itemsPath = resolve('public/data/items-gms83-ko.json');
const upsertBatchSize = 250;

if (!supabaseUrl) {
	console.error('SUPABASE_URL environment variable is required.');
	process.exit(1);
}

if (!supabaseServiceRoleKey && process.env.SEED_DRY_RUN !== '1') {
	console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for live seeding.');
	console.error('Set SEED_DRY_RUN=1 to output JSON instead.');
	process.exit(1);
}

async function fetchSupabase(url, options = {}) {
	const response = await fetch(url, {
		...options,
		headers: {
			apikey: supabaseServiceRoleKey,
			authorization: `Bearer ${supabaseServiceRoleKey}`,
			'content-type': 'application/json',
			...(options.headers ?? {}),
		},
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Supabase API error ${response.status}: ${body}`);
	}

	return response.json();
}

async function resolveVersionTagId() {
	const url = new URL('/rest/v1/version_tags', supabaseUrl);
	url.searchParams.set('is_active', 'eq.true');
	url.searchParams.set('limit', '1');
	url.searchParams.set('select', 'id');
	const tags = await fetchSupabase(url);

	if (tags.length > 0) {
		return tags[0].id;
	}

	const createUrl = new URL('/rest/v1/version_tags', supabaseUrl);
	const [created] = await fetchSupabase(createUrl, {
		method: 'POST',
		body: JSON.stringify({
			label_ko: 'GMS v83 (기본)',
			label_en: 'GMS v83 (default)',
			description: 'Auto-created by seed-item-level-up-definitions.mjs',
			is_active: true,
		}),
	});

	if (!created?.id) {
		throw new Error('Failed to create default version tag.');
	}

	return created.id;
}

async function upsertRows(rows) {
	for (let i = 0; i < rows.length; i += upsertBatchSize) {
		const batch = rows.slice(i, i + upsertBatchSize);
		const url = new URL('/rest/v1/item_level_up_definitions', supabaseUrl);
		await fetchSupabase(url, {
			method: 'POST',
			headers: {
				prefer: 'resolution=merge-duplicates',
			},
			body: JSON.stringify(batch),
		});
		console.log(`Upserted ${Math.min(i + upsertBatchSize, rows.length)}/${rows.length} item level-up definitions`);
	}
}

const seed = JSON.parse(await readFile(seedPath, 'utf8'));
const items = JSON.parse(await readFile(itemsPath, 'utf8'));
const validation = validateItemLevelUpSeed(seed, items);

if (validation.errors.length > 0) {
	throw new Error(`Invalid item level-up seed:\n${validation.errors.join('\n')}`);
}

const runtimeRows = resolveItemLevelUpRuntimeRows(seed);
const isDryRun = process.env.SEED_DRY_RUN === '1';
const versionTagId = isDryRun ? '00000000-0000-0000-0000-000000000000' : await resolveVersionTagId();

const rows = runtimeRows.map((row) => ({
	item_id: row.itemId,
	version_tag_id: versionTagId,
	level_up_kind: row.levelUpKind,
	max_level_ups: row.maxLevelUps,
	template_key: row.templateKey,
	stat_ranges: row.statRanges,
	source_name_ko: row.sourceNameKo,
	source_url: row.sourceUrl,
	source_note: row.sourceNote,
	published_status: 'published',
}));

if (isDryRun) {
	const dryRunPath = resolve('scripts/.item-level-up-seed-rows.json');
	await writeFile(dryRunPath, `${JSON.stringify(rows, null, 2)}\n`);
	console.log(`Dry-run: wrote ${rows.length} rows to ${dryRunPath}`);
} else {
	await upsertRows(rows);
	console.log(`Seeded ${rows.length} item level-up definitions.`);
}
