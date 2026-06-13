import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const htmlTemplatePath = resolve('outputs/item-review.template.html');
const htmlOutputPath = resolve('outputs/item-review.html');

if (!supabaseUrl) {
	console.error('SUPABASE_URL environment variable is required.');
	process.exit(1);
}

async function fetchAllItems(key) {
	const pageSize = 1000;
	const rows = [];

	while (true) {
		const url = new URL('/rest/v1/item_definitions', supabaseUrl);
		url.searchParams.set('select', '*');
		url.searchParams.set('limit', String(pageSize));
		url.searchParams.set('offset', String(rows.length));
		const res = await fetch(url, {
			headers: { apikey: key, authorization: `Bearer ${key}` },
		});
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			throw new Error(`Supabase error ${res.status}: ${body}`);
		}
		const page = await res.json();
		if (!Array.isArray(page) || page.length === 0) break;
		rows.push(...page);
		console.log(`  Fetched ${rows.length} items...`);
	}
	return rows.map((r) => ({
		id: r.id,
		nameKo: r.name_ko,
		nameEn: r.name_en,
		equipmentKind: r.equipment_kind,
		requiredLevel: r.required_level,
		requiredJobs: r.required_jobs ?? [],
		requirements: r.requirements ?? {},
		stats: r.stats ?? {},
		aliases: r.aliases ?? [],
		publishedStatus: r.published_status,
		sourceNote: r.source_note,
	}));
}

async function fetchAllScrolls(key) {
  const pageSize = 1000;
  const rows = [];

  while (true) {
    const url = new URL('/rest/v1/scroll_definitions', supabaseUrl);
    url.searchParams.set('select', '*');
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(rows.length));
    const res = await fetch(url, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase error ${res.status}: ${body}`);
    }
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    console.log(`  Fetched ${rows.length} scrolls...`);
  }
  return rows.map((r) => ({
    id: r.id,
    displayId: r.maplestory_io_item_id,
    nameKo: r.name_ko,
    category: r.category,
    behaviorType: r.behavior_type,
    publishedStatus: r.published_status,
    affectedStats: r.affected_stats ?? [],
    stats: r.stat_effect_frame ?? {},
    targetItemId: r.target_item_id,
    maxApplications: r.max_applications,
  }));
}

async function main() {
	const key = supabaseServiceRoleKey || (() => {
		console.error('SUPABASE_SERVICE_ROLE_KEY is required to fetch all items.');
		process.exit(1);
	})();

	console.log('Fetching all items from Supabase...');
	const allItems = await fetchAllItems(key);
	console.log(`Fetched ${allItems.length} items total.`);

	console.log('Fetching all scrolls from Supabase...');
	const allScrolls = await fetchAllScrolls(key);
	console.log(`Fetched ${allScrolls.length} scrolls total.`);

	// Read the template HTML
	const template = await readFile(htmlTemplatePath, 'utf8');

	// Embed both datasets as JSON blobs
	const itemsJson = JSON.stringify(allItems);
	const scrollsJson = JSON.stringify(allScrolls);
	const html = template
		.replace(
			'/* __ITEM_DATA_PLACEHOLDER__ */',
			`window.__ITEM_DATA__ = ${itemsJson};`,
		)
		.replace(
			'/* __SCROLL_DATA_PLACEHOLDER__ */',
			`window.__SCROLL_DATA__ = ${scrollsJson};`,
		);

	await mkdir(dirname(htmlOutputPath), { recursive: true });
	await writeFile(htmlOutputPath, html);
	const totalMB = ((itemsJson.length + scrollsJson.length) / 1024 / 1024).toFixed(1);
	console.log(`Generated ${htmlOutputPath} (${(itemsJson.length / 1024 / 1024).toFixed(1)} MB items, ${(scrollsJson.length / 1024 / 1024).toFixed(1)} MB scrolls — ${totalMB} MB total embedded data)`);
	console.log('Open it in your browser or run: npm run review:items');
}

await main();
