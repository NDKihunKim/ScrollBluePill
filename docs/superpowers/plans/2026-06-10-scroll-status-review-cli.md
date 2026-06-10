# Scroll Status Review CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local admin CLI that reviews Supabase scroll definitions by category and changes selected scrolls between `published`, `hidden`, and `draft`.

**Architecture:** Keep parsing, grouping, validation, and update-payload construction in a pure helper module that can be tested without Supabase. Put terminal prompts and Supabase REST calls in one script that imports those helpers. Add contract tests for service-role usage and update safety.

**Tech Stack:** Node.js ESM, built-in `node:test`, built-in `node:readline/promises`, built-in `fetch`, Supabase REST API, existing `node --env-file=.env` workflow.

---

## File Structure

- Create `src/lib/scrollStatusReview.mjs`: pure helper functions for status validation, category grouping, selection parsing, and update payload construction.
- Create `scripts/review-scroll-status.mjs`: local interactive CLI; validates env, fetches all scroll rows using `SUPABASE_SERVICE_ROLE_KEY`, prompts the admin, confirms, updates only `published_status`, and refetches selected rows.
- Create `tests/scroll-status-review.test.mjs`: tests parsing, grouping, allowed statuses, update payload shape, and script source contracts.
- Modify `package.json`: add `review:scrolls`.
- Modify `.env.example`: document `SUPABASE_SERVICE_ROLE_KEY` as required for both seeding and scroll review.

## Task 1: Add Pure Helper Tests

**Files:**
- Create: `tests/scroll-status-review.test.mjs`
- Create later: `src/lib/scrollStatusReview.mjs`

- [ ] **Step 1: Write the failing helper tests**

Create `tests/scroll-status-review.test.mjs` with:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
	allowedScrollStatuses,
	buildStatusUpdatePayload,
	groupScrollsByCategory,
	parseScrollSelection,
	validateScrollStatus,
} from '../src/lib/scrollStatusReview.mjs';

const sampleScrolls = [
	{
		id: '11111111-1111-4111-8111-111111111111',
		name_ko: '장갑 공격력 주문서 60%',
		category: '장갑',
		behavior_type: 'fixed',
		published_status: 'published',
		affected_stats: ['weaponAttack'],
	},
	{
		id: '22222222-2222-4222-8222-222222222222',
		name_ko: '장갑 민첩성 주문서 10%',
		category: '장갑',
		behavior_type: 'random',
		published_status: 'hidden',
		affected_stats: ['dex'],
	},
	{
		id: '33333333-3333-4333-8333-333333333333',
		name_ko: '귀고리 지력 주문서 60%',
		category: '귀고리',
		behavior_type: 'fixed',
		published_status: 'draft',
		affected_stats: ['int'],
	},
];

test('allowed scroll statuses are exactly the database statuses', () => {
	assert.deepEqual(allowedScrollStatuses, ['draft', 'published', 'hidden']);
	assert.equal(validateScrollStatus('draft'), 'draft');
	assert.equal(validateScrollStatus('published'), 'published');
	assert.equal(validateScrollStatus('hidden'), 'hidden');
	assert.throws(() => validateScrollStatus('archived'), /Invalid scroll status/);
});

test('buildStatusUpdatePayload only includes published_status', () => {
	assert.deepEqual(buildStatusUpdatePayload('hidden'), { published_status: 'hidden' });
	assert.throws(() => buildStatusUpdatePayload('deleted'), /Invalid scroll status/);
});

test('groupScrollsByCategory sorts categories and scroll names using Korean locale', () => {
	const groups = groupScrollsByCategory(sampleScrolls);

	assert.deepEqual(groups.map((group) => group.category), ['귀고리', '장갑']);
	assert.deepEqual(
		groups.find((group) => group.category === '장갑').scrolls.map((scroll) => scroll.name_ko),
		['장갑 공격력 주문서 60%', '장갑 민첩성 주문서 10%'],
	);
});

test('parseScrollSelection accepts single numbers, comma lists, ranges, and UUIDs', () => {
	assert.deepEqual(
		parseScrollSelection('1,2', sampleScrolls).map((scroll) => scroll.id),
		[
			'11111111-1111-4111-8111-111111111111',
			'22222222-2222-4222-8222-222222222222',
		],
	);

	assert.deepEqual(
		parseScrollSelection('1-2', sampleScrolls).map((scroll) => scroll.id),
		[
			'11111111-1111-4111-8111-111111111111',
			'22222222-2222-4222-8222-222222222222',
		],
	);

	assert.deepEqual(
		parseScrollSelection('1,2,2,11111111-1111-4111-8111-111111111111', sampleScrolls).map((scroll) => scroll.id),
		[
			'11111111-1111-4111-8111-111111111111',
			'22222222-2222-4222-8222-222222222222',
		],
	);
});

test('parseScrollSelection rejects unsafe or unknown input before writes', () => {
	assert.throws(() => parseScrollSelection('', sampleScrolls), /Select at least one scroll/);
	assert.throws(() => parseScrollSelection('0', sampleScrolls), /Selection number out of range/);
	assert.throws(() => parseScrollSelection('4', sampleScrolls), /Selection number out of range/);
	assert.throws(() => parseScrollSelection('3-1', sampleScrolls), /Range start must be less than or equal to range end/);
	assert.throws(() => parseScrollSelection('abc', sampleScrolls), /Invalid selection token/);
	assert.throws(
		() => parseScrollSelection('99999999-9999-4999-8999-999999999999', sampleScrolls),
		/Unknown scroll id/,
	);
});

test('review script source uses service role and patches only published_status', async () => {
	const source = await readFile(new URL('../scripts/review-scroll-status.mjs', import.meta.url), 'utf8');

	assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
	assert.doesNotMatch(source, /SUPABASE_ANON_KEY/);
	assert.match(source, /buildStatusUpdatePayload/);
	assert.match(source, /method:\s*'PATCH'/);
	assert.doesNotMatch(source, /name_ko:\s*/);
	assert.doesNotMatch(source, /category:\s*/);
	assert.doesNotMatch(source, /behavior_type:\s*/);
	assert.doesNotMatch(source, /affected_stats:\s*/);
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run:

```bash
node --test tests/scroll-status-review.test.mjs
```

Expected: FAIL because `src/lib/scrollStatusReview.mjs` and `scripts/review-scroll-status.mjs` do not exist yet.

## Task 2: Implement Pure Review Helpers

**Files:**
- Create: `src/lib/scrollStatusReview.mjs`
- Test: `tests/scroll-status-review.test.mjs`

- [ ] **Step 1: Create the helper module**

Create `src/lib/scrollStatusReview.mjs`:

```js
export const allowedScrollStatuses = ['draft', 'published', 'hidden'];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateScrollStatus(status) {
	if (!allowedScrollStatuses.includes(status)) {
		throw new Error(`Invalid scroll status: ${status}. Allowed statuses: ${allowedScrollStatuses.join(', ')}`);
	}

	return status;
}

export function buildStatusUpdatePayload(status) {
	return {
		published_status: validateScrollStatus(status),
	};
}

export function groupScrollsByCategory(scrolls) {
	const byCategory = new Map();

	for (const scroll of scrolls) {
		const category = scroll.category || '(none)';

		if (!byCategory.has(category)) {
			byCategory.set(category, []);
		}

		byCategory.get(category).push(scroll);
	}

	return [...byCategory.entries()]
		.sort(([a], [b]) => String(a).localeCompare(String(b), 'ko-KR'))
		.map(([category, categoryScrolls]) => ({
			category,
			scrolls: [...categoryScrolls].sort((a, b) =>
				String(a.name_ko).localeCompare(String(b.name_ko), 'ko-KR') || String(a.id).localeCompare(String(b.id)),
			),
		}));
}

export function parseScrollSelection(input, displayedScrolls) {
	const trimmed = input.trim();

	if (!trimmed) {
		throw new Error('Select at least one scroll.');
	}

	const selected = [];
	const selectedIds = new Set();
	const byId = new Map(displayedScrolls.map((scroll) => [String(scroll.id).toLowerCase(), scroll]));

	function addScroll(scroll) {
		const id = String(scroll.id);

		if (selectedIds.has(id)) {
			return;
		}

		selectedIds.add(id);
		selected.push(scroll);
	}

	for (const token of trimmed.split(',').map((part) => part.trim()).filter(Boolean)) {
		const rangeMatch = token.match(/^(\d+)-(\d+)$/);

		if (rangeMatch) {
			const start = Number(rangeMatch[1]);
			const end = Number(rangeMatch[2]);

			if (start > end) {
				throw new Error(`Range start must be less than or equal to range end: ${token}`);
			}

			for (let number = start; number <= end; number += 1) {
				const scroll = displayedScrolls[number - 1];

				if (!scroll) {
					throw new Error(`Selection number out of range: ${number}`);
				}

				addScroll(scroll);
			}

			continue;
		}

		if (/^\d+$/.test(token)) {
			const number = Number(token);
			const scroll = displayedScrolls[number - 1];

			if (!scroll) {
				throw new Error(`Selection number out of range: ${number}`);
			}

			addScroll(scroll);
			continue;
		}

		if (uuidPattern.test(token)) {
			const scroll = byId.get(token.toLowerCase());

			if (!scroll) {
				throw new Error(`Unknown scroll id: ${token}`);
			}

			addScroll(scroll);
			continue;
		}

		throw new Error(`Invalid selection token: ${token}`);
	}

	if (selected.length === 0) {
		throw new Error('Select at least one scroll.');
	}

	return selected;
}

export function formatAffectedStats(stats) {
	return Array.isArray(stats) && stats.length > 0 ? stats.join(', ') : '-';
}
```

- [ ] **Step 2: Run tests and confirm the remaining failure is the missing script**

Run:

```bash
node --test tests/scroll-status-review.test.mjs
```

Expected: FAIL only in `review script source uses service role and patches only published_status` because `scripts/review-scroll-status.mjs` does not exist yet.

- [ ] **Step 3: Commit helper and tests**

Run:

```bash
git add src/lib/scrollStatusReview.mjs tests/scroll-status-review.test.mjs
git commit -m "test: cover scroll status review helpers"
```

Expected: commit succeeds with the helper module and failing script contract test.

## Task 3: Implement Interactive Supabase CLI

**Files:**
- Create: `scripts/review-scroll-status.mjs`
- Test: `tests/scroll-status-review.test.mjs`

- [ ] **Step 1: Create the CLI script**

Create `scripts/review-scroll-status.mjs`:

```js
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import {
	buildStatusUpdatePayload,
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
		const scrolls = await fetchAllScrolls();

		if (scrolls.length === 0) {
			throw new Error('No scroll definitions found.');
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
```

- [ ] **Step 2: Run the targeted tests**

Run:

```bash
node --test tests/scroll-status-review.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run the no-write help smoke test**

Run:

```bash
node --env-file=.env scripts/review-scroll-status.mjs --help
```

Expected: prints usage and exits without requiring Supabase credentials or writing to Supabase.

- [ ] **Step 4: Commit the CLI script**

Run:

```bash
git add scripts/review-scroll-status.mjs tests/scroll-status-review.test.mjs
git commit -m "feat: add scroll status review cli"
```

Expected: commit succeeds.

## Task 4: Add NPM Script and Env Documentation

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Test: `tests/scroll-status-review.test.mjs`

- [ ] **Step 1: Update `package.json`**

Add the script next to the existing generate scripts:

```json
"review:scrolls": "node --env-file=.env scripts/review-scroll-status.mjs"
```

The scripts block should include:

```json
"scripts": {
	"dev": "astro dev",
	"generate:item-index": "node --env-file=.env scripts/generate-item-index.mjs",
	"generate:scroll-index": "node --env-file=.env scripts/generate-scroll-index.mjs",
	"review:scrolls": "node --env-file=.env scripts/review-scroll-status.mjs",
	"audit:duplicate-items": "node scripts/audit-duplicate-items.mjs",
	"build": "astro build",
	"preview": "astro preview",
	"astro": "astro"
}
```

- [ ] **Step 2: Update `.env.example`**

Change the service-role comment to:

```dotenv
# Required for seed-item-definitions and review:scrolls admin workflows
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- [ ] **Step 3: Add package/env contract assertions**

Append this test to `tests/scroll-status-review.test.mjs`:

```js
test('package exposes review:scrolls and env example documents service role use', async () => {
	const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
	const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');

	assert.equal(packageJson.scripts['review:scrolls'], 'node --env-file=.env scripts/review-scroll-status.mjs');
	assert.match(envExample, /review:scrolls admin workflows/);
	assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=/);
});
```

- [ ] **Step 4: Run the targeted tests**

Run:

```bash
node --test tests/scroll-status-review.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run npm help smoke test**

Run:

```bash
npm run review:scrolls -- --help
```

Expected: prints usage and exits without writing to Supabase.

- [ ] **Step 6: Commit package and env docs**

Run:

```bash
git add package.json .env.example tests/scroll-status-review.test.mjs
git commit -m "chore: expose scroll review command"
```

Expected: commit succeeds.

## Task 5: Final Verification

**Files:**
- Verify: `src/lib/scrollStatusReview.mjs`
- Verify: `scripts/review-scroll-status.mjs`
- Verify: `tests/scroll-status-review.test.mjs`
- Verify: `package.json`
- Verify: `.env.example`

- [ ] **Step 1: Run targeted tests**

Run:

```bash
node --test tests/scroll-status-review.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run existing full test suite**

Run:

```bash
node --test tests/*.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: Astro build completes successfully.

- [ ] **Step 4: Confirm no accidental Supabase write happened during tests**

Run:

```bash
rg -n "method:\\s*'PATCH'|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|published_status" scripts/review-scroll-status.mjs tests/scroll-status-review.test.mjs src/lib/scrollStatusReview.mjs
```

Expected:

- `scripts/review-scroll-status.mjs` contains `method: 'PATCH'` and `SUPABASE_SERVICE_ROLE_KEY`.
- `scripts/review-scroll-status.mjs` does not contain `SUPABASE_ANON_KEY`.
- `tests/scroll-status-review.test.mjs` only reads source files and does not execute the interactive update path.

- [ ] **Step 5: Check working tree**

Run:

```bash
git status --short
```

Expected: clean working tree after the task commits.
