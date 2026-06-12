import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { resolveItemLevelUpRuntimeRows } from '../src/lib/itemLevelUpData.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const outputPath = resolve('public/data/item-level-ups-gms83-ko.json');
const LOCAL_MODE = process.env.GENERATE_LOCAL === '1';

async function fetchSupabase(url, options = {}) {
	const response = await fetch(url, {
		...options,
		headers: {
			apikey: supabaseAnonKey,
			authorization: `Bearer ${supabaseAnonKey}`,
			...(options.headers ?? {}),
		},
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Supabase API error ${response.status}: ${body}`);
	}

	return response.json();
}

function transformRow(row) {
	return {
		itemId: row.item_id,
		levelUpKind: row.level_up_kind,
		maxLevelUps: row.max_level_ups,
		statRanges: row.stat_ranges ?? {},
		sourceNameKo: row.source_name_ko,
		sourceUrl: row.source_url,
		sourceNote: row.source_note ?? null,
	};
}

async function fetchFromSupabase() {
	const allRows = [];
	let offset = 0;
	const pageSize = 1000;

	while (true) {
		const url = new URL('/rest/v1/item_level_up_definitions', supabaseUrl);
		url.searchParams.set('select', '*');
		url.searchParams.set('published_status', 'eq.published');
		url.searchParams.set('limit', String(pageSize));
		url.searchParams.set('offset', String(offset));
		const page = await fetchSupabase(url);
		allRows.push(...page);
		if (page.length < pageSize) break;
		offset += pageSize;
	}

	return allRows.map(transformRow);
}

async function generateFromSeed() {
	const seedPath = resolve('data/item-level-up-definitions.seed.json');
	const seed = JSON.parse(await readFile(seedPath, 'utf8'));
	return resolveItemLevelUpRuntimeRows(seed).map((row) => ({
		itemId: row.itemId,
		levelUpKind: row.levelUpKind,
		maxLevelUps: row.maxLevelUps,
		statRanges: row.statRanges,
		sourceNameKo: row.sourceNameKo,
		sourceUrl: row.sourceUrl,
		sourceNote: row.sourceNote,
	}));
}

let runtimeRows;

if (LOCAL_MODE || !supabaseUrl || !supabaseAnonKey) {
	console.log('Generating from local seed data (GENERATE_LOCAL mode)…');
	runtimeRows = await generateFromSeed();
} else {
	try {
		runtimeRows = await fetchFromSupabase();
		if (runtimeRows.length === 0) {
			console.log('Supabase returned no rows — falling back to local seed data…');
			runtimeRows = await generateFromSeed();
		}
	} catch (error) {
		console.warn(`Supabase fetch failed (${error.message}) — falling back to local seed data…`);
		runtimeRows = await generateFromSeed();
	}
}

runtimeRows.sort((a, b) => a.itemId - b.itemId);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(runtimeRows, null, 2)}\n`);

console.log(`Generated ${outputPath} with ${runtimeRows.length} item level-up definitions.`);
