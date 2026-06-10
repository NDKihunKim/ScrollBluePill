import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import {
	buildStatusUpdatePayload,
	filterDesiredPercentScrolls,
	formatAffectedStats,
	groupScrollsByCategory,
	parseScrollSelection,
	validateScrollStatus,
} from '../src/lib/scrollStatusReview.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function usage() {
	console.log('Usage: npm run review:scrolls');
	console.log('');
	console.log('Reviews Supabase scroll_definitions by category and updates selected published_status values.');
	console.log('Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.');
}

function requireEnv() {
	if (!supabaseUrl) {
		throw new Error('SUPABASE_URL is required.');
	}

	if (!serviceRoleKey) {
		throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
	}
}

async function fetchSupabase(path, options = {}) {
	const url = new URL(path, supabaseUrl);
	const response = await fetch(url, {
		...options,
		headers: {
			apikey: serviceRoleKey,
			authorization: `Bearer ${serviceRoleKey}`,
			...(options.headers ?? {}),
		},
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Supabase API error ${response.status}: ${body}`);
	}

	return response.json();
}

async function fetchAllScrolls() {
	const rows = [];
	let offset = 0;
	const pageSize = 1000;

	while (true) {
		const params = new URLSearchParams({
			select: 'id,name_ko,category,behavior_type,published_status,affected_stats',
			order: 'category.asc,name_ko.asc',
			limit: String(pageSize),
			offset: String(offset),
		});
		const page = await fetchSupabase(`/rest/v1/scroll_definitions?${params}`);

		rows.push(...page);

		if (page.length < pageSize) {
			break;
		}

		offset += pageSize;
	}

	return rows;
}

async function updateScrollStatuses(ids, status) {
	const payload = buildStatusUpdatePayload(status);
	const params = new URLSearchParams({
		id: `in.(${ids.join(',')})`,
		select: 'id,name_ko,category,behavior_type,published_status,affected_stats',
	});

	return fetchSupabase(`/rest/v1/scroll_definitions?${params}`, {
		method: 'PATCH',
		headers: {
			'content-type': 'application/json',
			prefer: 'return=representation',
		},
		body: JSON.stringify(payload),
	});
}

async function refetchScrolls(ids) {
	const params = new URLSearchParams({
		select: 'id,name_ko,category,behavior_type,published_status,affected_stats',
		id: `in.(${ids.join(',')})`,
	});

	return fetchSupabase(`/rest/v1/scroll_definitions?${params}`);
}

function printCategoryList(groups) {
	console.log('');
	console.log('Categories');
	console.log('----------');

	groups.forEach((group, index) => {
		const statusCounts = group.scrolls.reduce((counts, scroll) => {
			counts[scroll.published_status] = (counts[scroll.published_status] ?? 0) + 1;
			return counts;
		}, {});

		console.log(
			`${index + 1}. ${group.category} (${group.scrolls.length}) ` +
				`draft:${statusCounts.draft ?? 0} published:${statusCounts.published ?? 0} hidden:${statusCounts.hidden ?? 0}`,
		);
	});
}

function printScrollList(scrolls) {
	console.log('');
	console.log('Scrolls');
	console.log('-------');

	scrolls.forEach((scroll, index) => {
		console.log(
			`${index + 1}. [${scroll.published_status}] ${scroll.name_ko} | ${scroll.behavior_type} | ` +
				`${formatAffectedStats(scroll.affected_stats)} | ${scroll.id}`,
		);
	});
}

function printSummary(selectedScrolls, targetStatus) {
	console.log('');
	console.log(`Target status: ${targetStatus}`);
	console.log('Selected scrolls:');

	for (const scroll of selectedScrolls) {
		console.log(`- [${scroll.published_status} -> ${targetStatus}] ${scroll.name_ko} | ${scroll.id}`);
	}
}

async function main() {
	if (process.argv.includes('--help') || process.argv.includes('-h')) {
		usage();
		return;
	}

	requireEnv();

	const rl = createInterface({ input, output });

	try {
		console.log('Fetching all scroll definitions from Supabase...');
		const allScrolls = await fetchAllScrolls();

		if (allScrolls.length === 0) {
			throw new Error('No scroll definitions found.');
		}

		const scrolls = filterDesiredPercentScrolls(allScrolls);
		console.log(`Filtered to ${scrolls.length} scrolls (kept 10%, 60%, 100% only; removed ${allScrolls.length - scrolls.length}).`);

		if (scrolls.length === 0) {
			throw new Error('No scroll definitions remaining after percent filter.');
		}

		const groups = groupScrollsByCategory(scrolls);
		printCategoryList(groups);

		const categoryAnswer = await rl.question('\nChoose a category number: ');
		const categoryNumber = Number(categoryAnswer.trim());
		const categoryGroup = groups[categoryNumber - 1];

		if (!Number.isInteger(categoryNumber) || !categoryGroup) {
			throw new Error(`Category choice out of range: ${categoryAnswer}`);
		}

		printScrollList(categoryGroup.scrolls);

		const selectionAnswer = await rl.question('\nSelect scroll numbers/UUIDs (example: 1,3-5): ');
		const selectedScrolls = parseScrollSelection(selectionAnswer, categoryGroup.scrolls);

		const statusAnswer = await rl.question('Set selected scrolls to status (draft/published/hidden): ');
		const targetStatus = validateScrollStatus(statusAnswer.trim());

		printSummary(selectedScrolls, targetStatus);

		const confirmAnswer = await rl.question('\nApply these Supabase updates? Type yes to continue: ');

		if (confirmAnswer.trim().toLowerCase() !== 'yes') {
			console.log('No changes written.');
			return;
		}

		const ids = selectedScrolls.map((scroll) => scroll.id);
		const updatedRows = await updateScrollStatuses(ids, targetStatus);
		console.log(`Updated rows returned by Supabase: ${updatedRows.length}`);

		const finalRows = await refetchScrolls(ids);
		console.log('');
		console.log('Final statuses');
		console.log('--------------');
		for (const row of finalRows) {
			console.log(`[${row.published_status}] ${row.name_ko} | ${row.id}`);
		}
	} finally {
		rl.close();
	}
}

await main();
