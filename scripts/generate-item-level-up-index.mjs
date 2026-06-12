import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const outputPath = resolve('public/data/item-level-ups-gms83-ko.json');

if (!supabaseUrl || !supabaseAnonKey) {
	console.error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required.');
	process.exit(1);
}

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

const runtimeRows = allRows.map(transformRow).sort((a, b) => a.itemId - b.itemId);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(runtimeRows, null, 2)}\n`);

console.log(`Generated ${outputPath} with ${runtimeRows.length} item level-up definitions.`);
