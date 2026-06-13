# Item Level-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Reverse/Timeless `아이템 레벨업` manual outcome entry with Supabase-backed curated data, generated runtime JSON, independent level-up slots, and Maker-bucket stat contribution.

**Architecture:** Store curated item level-up definitions in a repo seed JSON, seed them into Supabase, generate a static runtime JSON, then load that JSON into the enhancement panel. Keep item level-up state separate from Maker state, but add level-up deltas into the existing `maker` breakdown bucket.

**Tech Stack:** Astro static frontend, plain browser DOM modules, Node `node:test`, Supabase REST API, JSONB source data, existing enhancement state modules.

---

## Pre-Execution Notes

The current worktree may already contain unrelated scroll-data edits:

```text
public/data/scrolls-gms83-ko.json
tests/scroll-data-contract.test.mjs
```

Do not revert or mix those changes into this feature. Start execution in an isolated worktree, or explicitly keep commits scoped to the files listed in each task.

The approved design spec is:

```text
docs/superpowers/specs/2026-06-12-item-level-up-design.md
```

---

## File Structure

- Create `data/item-level-up-definitions.seed.json`  
  Reviewable curated source data from the article. Contains templates and item mappings.

- Create `src/lib/itemLevelUpData.mjs`  
  Shared validation/normalization helpers for seed data, Supabase rows, and runtime data.

- Create `scripts/seed-item-level-up-definitions.mjs`  
  Upserts curated seed definitions into Supabase using `SUPABASE_SERVICE_ROLE_KEY`.

- Create `scripts/generate-item-level-up-index.mjs`  
  Reads published Supabase rows using `SUPABASE_ANON_KEY` and writes `public/data/item-level-ups-gms83-ko.json`.

- Modify `supabase/schema.sql`  
  Add `public.item_level_up_definitions`, RLS, public published read policy, and service-role grants.

- Modify `package.json`  
  Add `seed:item-level-ups` and `generate:item-level-ups` scripts.

- Modify `src/lib/enhancementState.mjs`  
  Add item level-up slot APIs and include their stats in accumulated stats, grade color, and maker breakdown.

- Create `src/lib/itemLevelUpPanel.mjs`  
  DOM rendering and interactions for the `아이템 레벨업` button, slots, editor rows, apply, clear, and auto-advance.

- Modify `src/lib/enhancementPanel.mjs`  
  Load runtime level-up JSON and wire `itemLevelUpPanel` into selected item activation/reset.

- Modify `src/pages/index.astro`  
  Add the button/panel containers and CSS.

- Modify tests:
  - `tests/item-level-up-data.test.mjs`
  - `tests/enhancement-state.test.mjs`
  - `tests/calculator-input-contract.test.mjs`

---

### Task 1: Add Supabase Schema Contract

**Files:**
- Modify: `supabase/schema.sql`
- Test: `tests/item-level-up-data.test.mjs`

- [ ] **Step 1: Write the failing schema test**

Create `tests/item-level-up-data.test.mjs` with this initial content:

```js
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
```

- [ ] **Step 2: Run the failing schema test**

Run:

```bash
node --test tests/item-level-up-data.test.mjs
```

Expected: FAIL because `item_level_up_definitions` is not defined.

- [ ] **Step 3: Add the schema**

Append this SQL to `supabase/schema.sql`:

```sql
create table if not exists public.item_level_up_definitions (
    item_id integer primary key references public.item_definitions(id),
    version_tag_id uuid not null references public.version_tags(id),
    level_up_kind text not null check (level_up_kind in ('reverse', 'timeless')),
    max_level_ups integer not null check (max_level_ups in (3, 5)),
    template_key text,
    stat_ranges jsonb not null default '{}'::jsonb,
    source_name_ko text not null,
    source_url text not null,
    source_note text,
    published_status text not null default 'draft'
        check (published_status in ('draft', 'published', 'hidden')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.item_level_up_definitions enable row level security;

create policy "Public can read published item level-up definitions"
on public.item_level_up_definitions
for select
using (published_status = 'published');

grant select on public.item_level_up_definitions to anon, authenticated;
grant select, insert, update, delete on public.item_level_up_definitions to service_role;
```

- [ ] **Step 4: Run the schema test**

Run:

```bash
node --test tests/item-level-up-data.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql tests/item-level-up-data.test.mjs
git commit -m "feat: add item level-up schema contract"
```

---

### Task 2: Add Seed Data Shape And Validation

**Files:**
- Create: `data/item-level-up-definitions.seed.json`
- Create: `src/lib/itemLevelUpData.mjs`
- Modify: `tests/item-level-up-data.test.mjs`

- [ ] **Step 1: Add failing seed validation tests**

Append these tests to `tests/item-level-up-data.test.mjs`:

```js
import {
	knownItemLevelUpStatKeys,
	validateItemLevelUpSeed,
	resolveItemLevelUpRuntimeRows,
} from '../src/lib/itemLevelUpData.mjs';

async function readJson(path) {
	return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

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
```

- [ ] **Step 2: Run the failing seed tests**

Run:

```bash
node --test tests/item-level-up-data.test.mjs
```

Expected: FAIL because `src/lib/itemLevelUpData.mjs` and the seed JSON do not exist.

- [ ] **Step 3: Add `src/lib/itemLevelUpData.mjs`**

Create `src/lib/itemLevelUpData.mjs`:

```js
export const knownItemLevelUpStatKeys = new Set([
	'str',
	'dex',
	'int',
	'luk',
	'maxHp',
	'maxMp',
	'weaponAttack',
	'magicAttack',
	'weaponDefense',
	'magicDefense',
	'accuracy',
	'avoidability',
	'speed',
	'jump',
]);

export function normalizeItemLevelUpRange(range) {
	const min = Number(range?.min);
	const max = Number(range?.max);

	if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
		return null;
	}

	return { min, max };
}

export function resolveStatRanges(seed, entry) {
	const templateRanges = entry.templateKey ? seed.templates?.[entry.templateKey] : null;
	const merged = {
		...(templateRanges ?? {}),
		...(entry.statRanges ?? {}),
	};
	const normalized = {};

	for (const [key, range] of Object.entries(merged)) {
		const normalizedRange = normalizeItemLevelUpRange(range);
		if (normalizedRange) {
			normalized[key] = normalizedRange;
		}
	}

	return normalized;
}

export function resolveItemLevelUpRuntimeRows(seed) {
	return (seed.items ?? []).map((entry) => ({
		itemId: entry.itemId,
		levelUpKind: entry.levelUpKind,
		maxLevelUps: entry.maxLevelUps,
		templateKey: entry.templateKey ?? null,
		statRanges: resolveStatRanges(seed, entry),
		sourceNameKo: entry.sourceNameKo,
		sourceUrl: seed.sourceUrl,
		sourceNote: entry.sourceNote ?? seed.sourceNote ?? null,
	}));
}

export function validateItemLevelUpSeed(seed, items) {
	const errors = [];
	const itemIds = new Set((items ?? []).map((item) => item.id));
	const templateNames = new Set(Object.keys(seed.templates ?? {}));
	const seenItemIds = new Set();

	if (seed.sourceUrl !== 'https://maplekibun.tistory.com/762') {
		errors.push('sourceUrl must be https://maplekibun.tistory.com/762');
	}

	for (const [templateKey, statRanges] of Object.entries(seed.templates ?? {})) {
		for (const [statKey, range] of Object.entries(statRanges ?? {})) {
			if (!knownItemLevelUpStatKeys.has(statKey)) {
				errors.push(`Unknown stat key in template ${templateKey}: ${statKey}`);
			}
			if (!normalizeItemLevelUpRange(range)) {
				errors.push(`Invalid range in template ${templateKey}.${statKey}`);
			}
		}
	}

	for (const entry of seed.items ?? []) {
		if (!Number.isInteger(entry.itemId)) {
			errors.push(`Invalid itemId: ${entry.itemId}`);
			continue;
		}

		if (seenItemIds.has(entry.itemId)) {
			errors.push(`Duplicate itemId: ${entry.itemId}`);
		}
		seenItemIds.add(entry.itemId);

		if (!itemIds.has(entry.itemId)) {
			errors.push(`Seed item_id missing from runtime item data: ${entry.itemId}`);
		}

		if (!['reverse', 'timeless'].includes(entry.levelUpKind)) {
			errors.push(`Invalid levelUpKind for ${entry.itemId}: ${entry.levelUpKind}`);
		}

		const expectedLevels = entry.levelUpKind === 'reverse' ? 3 : 5;
		if (entry.maxLevelUps !== expectedLevels) {
			errors.push(`Invalid maxLevelUps for ${entry.itemId}: expected ${expectedLevels}, got ${entry.maxLevelUps}`);
		}

		if (entry.templateKey && !templateNames.has(entry.templateKey)) {
			errors.push(`Unknown templateKey for ${entry.itemId}: ${entry.templateKey}`);
		}

		const resolvedRanges = resolveStatRanges(seed, entry);
		if (Object.keys(resolvedRanges).length === 0) {
			errors.push(`No stat ranges resolved for ${entry.itemId}`);
		}

		for (const statKey of Object.keys(resolvedRanges)) {
			if (!knownItemLevelUpStatKeys.has(statKey)) {
				errors.push(`Unknown stat key for ${entry.itemId}: ${statKey}`);
			}
		}
	}

	return {
		itemCount: (seed.items ?? []).length,
		errors,
	};
}
```

- [ ] **Step 4: Add the initial curated seed JSON**

Create `data/item-level-up-definitions.seed.json`.

Use this exact top-level structure and include all Reverse/Timeless items from the source article that can be matched to `public/data/items-gms83-ko.json`. The first two entries below are required by tests:

```json
{
  "sourceUrl": "https://maplekibun.tistory.com/762",
  "sourceNote": "Curated from 기분안기모띠의 메이플 수첩 article: 옛날메이플 메이커 정보 (리버스와 타임리스). Skill bonuses are intentionally excluded.",
  "templates": {
    "warrior_weapon": {
      "weaponAttack": { "min": 0, "max": 2 },
      "str": { "min": 1, "max": 2 },
      "dex": { "min": 0, "max": 1 }
    },
    "mage_weapon": {
      "magicAttack": { "min": 1, "max": 4 },
      "int": { "min": 1, "max": 2 },
      "luk": { "min": 0, "max": 1 }
    },
    "bowman_weapon": {
      "weaponAttack": { "min": 0, "max": 2 },
      "dex": { "min": 1, "max": 2 },
      "str": { "min": 0, "max": 1 }
    },
    "thief_luk_str_weapon": {
      "weaponAttack": { "min": 0, "max": 2 },
      "luk": { "min": 1, "max": 2 },
      "str": { "min": 0, "max": 1 }
    },
    "thief_luk_dex_weapon": {
      "weaponAttack": { "min": 0, "max": 2 },
      "luk": { "min": 1, "max": 2 },
      "dex": { "min": 0, "max": 1 }
    },
    "pirate_str_weapon": {
      "weaponAttack": { "min": 0, "max": 2 },
      "str": { "min": 1, "max": 2 },
      "dex": { "min": 0, "max": 1 }
    },
    "pirate_dex_weapon": {
      "weaponAttack": { "min": 0, "max": 2 },
      "dex": { "min": 1, "max": 2 },
      "str": { "min": 0, "max": 1 }
    },
    "common_mobility_accessory": {
      "str": { "min": 0, "max": 1 },
      "dex": { "min": 0, "max": 1 },
      "int": { "min": 0, "max": 1 },
      "luk": { "min": 0, "max": 1 },
      "speed": { "min": 0, "max": 2 },
      "jump": { "min": 0, "max": 1 }
    }
  },
  "items": [
    {
      "itemId": 1302086,
      "sourceNameKo": "리버스 엑서큐서너스",
      "levelUpKind": "reverse",
      "maxLevelUps": 3,
      "templateKey": "warrior_weapon"
    },
    {
      "itemId": 1302081,
      "sourceNameKo": "타임리스 엑서큐서너스",
      "levelUpKind": "timeless",
      "maxLevelUps": 5,
      "templateKey": "warrior_weapon"
    }
  ]
}
```

Before this task is complete, create `docs/data-quality/item-level-up-source-review.md` and finish the `items` array for every article-supported Reverse/Timeless row that exists in `public/data/items-gms83-ko.json`. For each source row, record the Korean source name, matched local item ID, selected template key, and whether it is included. Do not create name-only seed entries. If a source row cannot be matched to a local item ID, record it under an `Unmatched Source Rows` section with the exact source name and exclusion reason.

- [ ] **Step 5: Run the seed tests**

Run:

```bash
node --test tests/item-level-up-data.test.mjs
```

Expected: PASS for the initial tested entries and all added seed rows.

- [ ] **Step 6: Commit**

```bash
git add data/item-level-up-definitions.seed.json docs/data-quality/item-level-up-source-review.md src/lib/itemLevelUpData.mjs tests/item-level-up-data.test.mjs
git commit -m "feat: add item level-up seed validation"
```

---

### Task 3: Add Seed And Generate Scripts

**Files:**
- Create: `scripts/seed-item-level-up-definitions.mjs`
- Create: `scripts/generate-item-level-up-index.mjs`
- Modify: `package.json`
- Modify: `tests/item-level-up-data.test.mjs`

- [ ] **Step 1: Add failing script contract tests**

Append to `tests/item-level-up-data.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the failing script tests**

Run:

```bash
node --test tests/item-level-up-data.test.mjs
```

Expected: FAIL because scripts and package commands are missing.

- [ ] **Step 3: Add package scripts**

In `package.json`, add:

```json
"seed:item-level-ups": "node --env-file=.env scripts/seed-item-level-up-definitions.mjs",
"generate:item-level-ups": "node --env-file=.env scripts/generate-item-level-up-index.mjs"
```

Keep comma placement valid.

- [ ] **Step 4: Create the seed script**

Create `scripts/seed-item-level-up-definitions.mjs`:

```js
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
```

- [ ] **Step 5: Create the generate script**

Create `scripts/generate-item-level-up-index.mjs`:

```js
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
```

- [ ] **Step 6: Run script tests**

Run:

```bash
node --test tests/item-level-up-data.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Run dry-run seed**

Run:

```bash
SEED_DRY_RUN=1 SUPABASE_URL=http://localhost node scripts/seed-item-level-up-definitions.mjs
```

Expected: writes `scripts/.item-level-up-seed-rows.json` and exits 0.

Delete the dry-run artifact after inspection:

```bash
rm scripts/.item-level-up-seed-rows.json
```

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/seed-item-level-up-definitions.mjs scripts/generate-item-level-up-index.mjs tests/item-level-up-data.test.mjs
git commit -m "feat: add item level-up data scripts"
```

---

### Task 4: Add Enhancement State Support

**Files:**
- Modify: `src/lib/enhancementState.mjs`
- Modify: `tests/enhancement-state.test.mjs`

- [ ] **Step 1: Write failing state tests**

Modify the import in `tests/enhancement-state.test.mjs` to include:

```js
  createItemLevelUpSlots,
  applyItemLevelUp,
  clearItemLevelUpSlot,
```

Append:

```js
test('item level-up slots initialize independently from maker slots', () => {
  const state = createEnhancementState(7, 120, { maxLevelUps: 3 });

  assert.equal(state.itemLevelUpSlotCount, 3);
  assert.deepEqual(state.itemLevelUpSlots, [null, null, null]);

  activateMaker(state);
  applyGem(state, 0, 'strCrystal', 2);
  assert.equal(applyItemLevelUp(state, 0, { str: 1, weaponAttack: 2 }), true);

  deactivateMaker(state);
  assert.deepEqual(state.gemSlots.every((slot) => slot === null), true);
  assert.deepEqual(state.itemLevelUpSlots[0], { stats: { str: 1, weaponAttack: 2 } });
});

test('item level-up contributes to accumulated stats and maker breakdown bucket', () => {
  const state = createEnhancementState(7, 120, { maxLevelUps: 3 });

  applyItemLevelUp(state, 0, { str: 1, weaponAttack: 2 });
  applyScroll(state, {
    id: 2040000,
    nameKo: '테스트 주문서',
    stats: { str: 5 },
  });

  assert.deepEqual(
    computeAccumulatedStats({ str: 10, weaponAttack: 50 }, state),
    { str: 16, weaponAttack: 52 },
  );

  assert.deepEqual(
    computeStatBreakdown({ str: 10, weaponAttack: 50 }, state),
    {
      str: { original: 10, maker: 1, scroll: 5, total: 16 },
      weaponAttack: { original: 50, maker: 2, scroll: 0, total: 52 },
    },
  );
});

test('item level-up slot bounds and reset lifecycle', () => {
  const state = createEnhancementState(7, 120, { maxLevelUps: 3 });

  assert.equal(applyItemLevelUp(state, -1, { str: 1 }), false);
  assert.equal(applyItemLevelUp(state, 3, { str: 1 }), false);
  assert.equal(applyItemLevelUp(state, 1, { str: 2, dex: Number.NaN }), true);
  assert.deepEqual(state.itemLevelUpSlots[1], { stats: { str: 2 } });

  clearItemLevelUpSlot(state, 1);
  assert.equal(state.itemLevelUpSlots[1], null);

  applyItemLevelUp(state, 0, { str: 2 });
  resetState(state);
  assert.deepEqual(state.itemLevelUpSlots, [null, null, null]);
});
```

- [ ] **Step 2: Run failing state tests**

Run:

```bash
node --test tests/enhancement-state.test.mjs
```

Expected: FAIL because item level-up APIs do not exist.

- [ ] **Step 3: Implement state APIs**

In `src/lib/enhancementState.mjs`, change `createEnhancementState` to accept an optional definition:

```js
export function createItemLevelUpSlots(levelUpDefinition = null) {
  const slotCount = Number.isInteger(levelUpDefinition?.maxLevelUps) ? levelUpDefinition.maxLevelUps : 0;
  return new Array(slotCount).fill(null);
}

export function createEnhancementState(upgradeSlots, requiredLevel, levelUpDefinition = null) {
  const scrollState = _createScrollState(upgradeSlots);
  const gemSlotCount = computeGemSlotCount(requiredLevel);
  const gemSlots = new Array(gemSlotCount).fill(null);
  const makerActive = false;
  const stimulantSlot = null;
  const itemLevelUpSlots = createItemLevelUpSlots(levelUpDefinition);
  const itemLevelUpSlotCount = itemLevelUpSlots.length;

  return { scrollState, gemSlots, gemSlotCount, makerActive, stimulantSlot, itemLevelUpSlots, itemLevelUpSlotCount };
}
```

Add these helpers:

```js
export function applyItemLevelUp(state, slotIndex, stats) {
  if (slotIndex < 0 || slotIndex >= state.itemLevelUpSlotCount) {
    return false;
  }

  const normalizedStats = {};
  for (const [key, value] of Object.entries(stats ?? {})) {
    if (Number.isFinite(value)) {
      normalizedStats[key] = value;
    }
  }

  state.itemLevelUpSlots[slotIndex] = { stats: normalizedStats };
  return true;
}

export function clearItemLevelUpSlot(state, slotIndex) {
  if (slotIndex < 0 || slotIndex >= state.itemLevelUpSlotCount) {
    return;
  }
  state.itemLevelUpSlots[slotIndex] = null;
}

export function resetItemLevelUps(state) {
  for (let i = 0; i < state.itemLevelUpSlots.length; i++) {
    state.itemLevelUpSlots[i] = null;
  }
}
```

In `computeAccumulatedStats`, add this after stimulant/gem processing or before return:

```js
  for (const slot of state.itemLevelUpSlots ?? []) {
    if (!slot?.stats) continue;
    for (const [key, value] of Object.entries(slot.stats)) {
      if (Number.isFinite(value)) {
        accumulated[key] = (accumulated[key] ?? 0) + value;
      }
    }
  }
```

In `computeStatBreakdown`, add level-up values to `entry.maker` and `entry.total`:

```js
  for (const slot of state.itemLevelUpSlots ?? []) {
    if (!slot?.stats) continue;
    for (const [key, value] of Object.entries(slot.stats)) {
      if (!Number.isFinite(value)) continue;
      const entry = ensureEntry(key);
      entry.maker += value;
      entry.total += value;
    }
  }
```

In `computeGradeColor`, include item level-up values:

```js
  for (const slot of state.itemLevelUpSlots ?? []) {
    if (!slot?.stats) continue;
    for (const [key, value] of Object.entries(slot.stats)) {
      if (!Number.isFinite(value)) continue;
      if (HP_MP_KEYS.has(key)) {
        totalAddedConstants += Math.round(value / 10);
      } else {
        totalAddedConstants += value;
      }
    }
  }
```

In `resetState`, clear item level-ups after resetting Maker:

```js
export function resetState(state) {
  _resetScrollState(state.scrollState);
  resetGems(state);
  deactivateMaker(state);
  resetItemLevelUps(state);
}
```

- [ ] **Step 4: Run state tests**

Run:

```bash
node --test tests/enhancement-state.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/enhancementState.mjs tests/enhancement-state.test.mjs
git commit -m "feat: add item level-up state"
```

---

### Task 5: Add Item Level-Up Panel DOM Contracts

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Add failing markup/CSS contract tests**

Append to `tests/calculator-input-contract.test.mjs`:

```js
test('item level-up panel source contract is present beside maker controls', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');

	assert.match(indexSource, /data-item-level-up-toggle/);
	assert.match(indexSource, /아이템 레벨업/);
	assert.match(indexSource, /data-item-level-up-area/);
	assert.match(indexSource, /data-item-level-up-slots/);
	assert.match(indexSource, /data-item-level-up-editor/);
	assert.ok(indexSource.indexOf('data-maker-toggle') < indexSource.indexOf('data-item-level-up-toggle'));
	assert.match(indexSource, /:global\(\.item-level-up-slot\)/);
	assert.match(indexSource, /:global\(\.item-level-up-editor\)/);
	assert.match(enhancementPanelSource, /initItemLevelUpPanel/);
});
```

- [ ] **Step 2: Run failing contract test**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: FAIL because the markup and integration are missing. Existing unrelated failures may already exist in this file; confirm this new test fails on missing item-level-up strings.

- [ ] **Step 3: Add markup beside Maker**

In `src/pages/index.astro`, replace the current maker toggle row:

```astro
<div class="maker-toggle-row">
	<button type="button" class="maker-toggle-button" data-maker-toggle disabled>
		메이커
	</button>
</div>
```

with:

```astro
<div class="maker-toggle-row enhancement-toggle-row">
	<button type="button" class="maker-toggle-button" data-maker-toggle disabled>
		메이커
	</button>
	<button type="button" class="maker-toggle-button item-level-up-toggle" data-item-level-up-toggle hidden>
		아이템 레벨업
	</button>
</div>
<div class="item-level-up-area" data-item-level-up-area hidden>
	<p class="enhancement-section-label">아이템 레벨업</p>
	<div class="item-level-up-slots" data-item-level-up-slots></div>
	<div class="item-level-up-editor" data-item-level-up-editor hidden></div>
</div>
```

- [ ] **Step 4: Add CSS**

In the Maker CSS section of `src/pages/index.astro`, add:

```css
:global(.enhancement-toggle-row) {
	display: flex;
	gap: 8px;
	align-items: center;
	flex-wrap: wrap;
}

:global(.item-level-up-area) {
	margin-top: 12px;
}

:global(.item-level-up-slots) {
	display: flex;
	gap: 10px;
	margin-bottom: 14px;
	flex-wrap: wrap;
}

:global(.item-level-up-slot) {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 80px;
	height: 80px;
	border: 1px solid var(--line);
	border-radius: 6px;
	background: var(--surface);
	cursor: pointer;
	gap: 4px;
	font-size: 0.8rem;
	text-align: center;
	position: relative;
	transition: border-color 0.15s;
}

:global(.item-level-up-slot:hover) {
	border-color: var(--green);
}

:global(.item-level-up-slot--filled) {
	border-color: var(--green);
}

:global(.item-level-up-slot--active) {
	border-color: #5b9bd5;
	background: rgba(91, 155, 213, 0.08);
}

:global(.item-level-up-slot-label) {
	font-weight: 700;
}

:global(.item-level-up-slot-summary) {
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 0.62rem;
	color: var(--green);
}

:global(.item-level-up-editor) {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
```

- [ ] **Step 5: Run contract test**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: the new contract test still FAILS only because `initItemLevelUpPanel` is missing.

- [ ] **Step 6: Commit markup and CSS**

```bash
git add src/pages/index.astro tests/calculator-input-contract.test.mjs
git commit -m "feat: add item level-up panel shell"
```

---

### Task 6: Implement Item Level-Up Panel Module

**Files:**
- Create: `src/lib/itemLevelUpPanel.mjs`
- Modify: `src/lib/enhancementPanel.mjs`
- Modify: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Add source contract tests for panel behavior**

Append to `tests/calculator-input-contract.test.mjs`:

```js
test('item level-up panel applies bounded slot values and auto-advances', async () => {
	const panelSource = await readFile(new URL('../src/lib/itemLevelUpPanel.mjs', import.meta.url), 'utf8');

	assert.match(panelSource, /applyItemLevelUp/);
	assert.match(panelSource, /clearItemLevelUpSlot/);
	assert.match(panelSource, /Math\.max\(range\.min,\s*Math\.min\(range\.max,/);
	assert.match(panelSource, /minBtn\.textContent\s*=\s*'MIN'/);
	assert.match(panelSource, /maxBtn\.textContent\s*=\s*'MAX'/);
	assert.match(panelSource, /findNextEmptySlotIndex/);
	assert.match(panelSource, /renderEditor\(nextEmpty\)/);
	assert.match(panelSource, /editor\.hidden\s*=\s*true/);
});
```

- [ ] **Step 2: Run failing panel tests**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: FAIL because `itemLevelUpPanel.mjs` does not exist.

- [ ] **Step 3: Create `src/lib/itemLevelUpPanel.mjs`**

Create:

```js
import { applyItemLevelUp, clearItemLevelUpSlot, computeAccumulatedStats, computeStatBreakdown, computeAppliedScrollCount, computeRemainingSlots, computeGradeColor } from './enhancementState.mjs';
import { statLabelByKey } from './makerData.mjs';
import { HP_MP_KEYS } from './enhancementState.mjs';

function formatSigned(value) {
	return value > 0 ? `+${value}` : String(value);
}

function summarizeStats(stats = {}) {
	const parts = [];
	for (const [key, value] of Object.entries(stats)) {
		if (!Number.isFinite(value) || value === 0) continue;
		const label = statLabelByKey[key] ?? key;
		const shortLabel = label.length >= 3 ? label[0] : label;
		parts.push(`${shortLabel}${formatSigned(value)}`);
	}
	return parts.join(' ') || '적용됨';
}

export function initItemLevelUpPanel({
	toggle,
	area,
	slots,
	editor,
	renderEnhancedItemCard,
}) {
	let enhancementState = null;
	let selectedBaseItem = null;
	let definition = null;
	let activeSlotIndex = -1;

	const refreshEnhancedCard = () => {
		if (!selectedBaseItem || !enhancementState) return;
		const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
		const statBreakdown = computeStatBreakdown(selectedBaseItem.stats, enhancementState);
		const remaining = computeRemainingSlots(enhancementState);
		const appliedCount = computeAppliedScrollCount(enhancementState);
		const gradeColor = computeGradeColor(enhancementState);
		renderEnhancedItemCard(selectedBaseItem, accumulatedStats, remaining, appliedCount, gradeColor, statBreakdown);
	};

	const findNextEmptySlotIndex = () => {
		if (!enhancementState) return -1;
		return enhancementState.itemLevelUpSlots.findIndex((slot) => slot === null);
	};

	const hideEditor = () => {
		activeSlotIndex = -1;
		if (editor instanceof HTMLElement) {
			editor.hidden = true;
			editor.replaceChildren();
		}
	};

	const clampValue = (value, range) => Math.max(range.min, Math.min(range.max, value));

	const renderSlots = () => {
		if (!(slots instanceof HTMLElement) || !enhancementState || !definition) return;
		slots.replaceChildren();

		for (let i = 0; i < enhancementState.itemLevelUpSlotCount; i++) {
			const slot = enhancementState.itemLevelUpSlots[i];
			const box = document.createElement('div');
			box.className = 'item-level-up-slot';
			box.setAttribute('role', 'button');
			box.setAttribute('tabindex', '0');

			if (slot) box.classList.add('item-level-up-slot--filled');
			if (i === activeSlotIndex) box.classList.add('item-level-up-slot--active');

			const label = document.createElement('span');
			label.className = 'item-level-up-slot-label';
			label.textContent = `Lv ${i + 1}`;
			box.append(label);

			const summary = document.createElement('span');
			summary.className = 'item-level-up-slot-summary';
			summary.textContent = slot ? summarizeStats(slot.stats) : '(입력)';
			box.append(summary);

			if (slot) {
				const xBtn = document.createElement('span');
				xBtn.setAttribute('role', 'button');
				xBtn.setAttribute('tabindex', '0');
				xBtn.className = 'slot-box-x';
				xBtn.setAttribute('aria-label', `아이템 레벨업 ${i + 1} 지우기`);
				xBtn.textContent = '×';
				xBtn.addEventListener('click', (event) => {
					event.stopPropagation();
					clearItemLevelUpSlot(enhancementState, i);
					hideEditor();
					renderSlots();
					refreshEnhancedCard();
				});
				xBtn.addEventListener('keydown', (event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						xBtn.click();
					}
				});
				box.append(xBtn);
			}

			box.addEventListener('click', () => {
				renderEditor(i);
			});
			box.addEventListener('keydown', (event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					box.click();
				}
			});

			slots.append(box);
		}
	};

	const renderEditor = (slotIndex) => {
		if (!(editor instanceof HTMLElement) || !enhancementState || !definition) return;
		activeSlotIndex = slotIndex;
		editor.hidden = false;
		editor.replaceChildren();
		renderSlots();

		const currentStats = enhancementState.itemLevelUpSlots[slotIndex]?.stats ?? {};
		const values = new Map();

		for (const [key, range] of Object.entries(definition.statRanges ?? {})) {
			values.set(key, Number.isFinite(currentStats[key]) ? currentStats[key] : range.min);

			const row = document.createElement('div');
			row.className = 'chaos-stat-row item-level-up-stat-row';

			const label = document.createElement('span');
			label.className = 'chaos-stat-label';
			label.textContent = statLabelByKey[key] ?? key;

			const updateDisplay = () => {
				valueDisplay.textContent = formatSigned(values.get(key) ?? 0);
			};

			const step = HP_MP_KEYS.has(key) ? 10 : 1;

			const minBtn = document.createElement('button');
			minBtn.type = 'button';
			minBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
			minBtn.textContent = 'MIN';
			minBtn.addEventListener('click', () => {
				values.set(key, range.min);
				updateDisplay();
			});

			const minusBtn = document.createElement('button');
			minusBtn.type = 'button';
			minusBtn.className = 'chaos-stepper-btn';
			minusBtn.textContent = '−';
			minusBtn.addEventListener('click', () => {
				values.set(key, clampValue((values.get(key) ?? 0) - step, range));
				updateDisplay();
			});

			const valueDisplay = document.createElement('span');
			valueDisplay.className = 'chaos-stepper-value item-level-up-stepper-value';
			updateDisplay();

			const plusBtn = document.createElement('button');
			plusBtn.type = 'button';
			plusBtn.className = 'chaos-stepper-btn';
			plusBtn.textContent = '+';
			plusBtn.addEventListener('click', () => {
				values.set(key, clampValue((values.get(key) ?? 0) + step, range));
				updateDisplay();
			});

			const maxBtn = document.createElement('button');
			maxBtn.type = 'button';
			maxBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
			maxBtn.textContent = 'MAX';
			maxBtn.addEventListener('click', () => {
				values.set(key, range.max);
				updateDisplay();
			});

			row.append(label, minBtn, minusBtn, valueDisplay, plusBtn, maxBtn);
			editor.append(row);
		}

		const applyBtn = document.createElement('button');
		applyBtn.type = 'button';
		applyBtn.className = 'chaos-apply-button item-level-up-apply-button';
		applyBtn.textContent = '적용';
		applyBtn.addEventListener('click', () => {
			const stats = {};
			for (const [key, value] of values.entries()) {
				stats[key] = value;
			}
			applyItemLevelUp(enhancementState, slotIndex, stats);
			renderSlots();
			refreshEnhancedCard();
			const nextEmpty = findNextEmptySlotIndex();
			if (nextEmpty >= 0) {
				renderEditor(nextEmpty);
			} else {
				hideEditor();
				renderSlots();
			}
		});

		editor.append(applyBtn);
	};

	if (toggle instanceof HTMLElement) {
		toggle.addEventListener('click', () => {
			if (!definition || !enhancementState) return;
			if (area instanceof HTMLElement) {
				area.hidden = !area.hidden;
				if (!area.hidden && findNextEmptySlotIndex() >= 0) {
					renderEditor(findNextEmptySlotIndex());
				}
			}
		});
	}

	return {
		activate(enhState, item, levelUpDefinition) {
			enhancementState = enhState;
			selectedBaseItem = item;
			definition = levelUpDefinition ?? null;
			hideEditor();

			if (toggle instanceof HTMLElement) {
				toggle.hidden = !definition;
			}

			if (area instanceof HTMLElement) {
				area.hidden = true;
			}

			if (definition) {
				renderSlots();
			}
		},
		reset() {
			hideEditor();
			if (area instanceof HTMLElement) area.hidden = true;
			renderSlots();
		},
		deactivate() {
			enhancementState = null;
			selectedBaseItem = null;
			definition = null;
			hideEditor();
			if (toggle instanceof HTMLElement) toggle.hidden = true;
			if (area instanceof HTMLElement) area.hidden = true;
			if (slots instanceof HTMLElement) slots.replaceChildren();
		},
	};
}
```

- [ ] **Step 4: Wire DOM nodes in `enhancementPanel.mjs`**

At the top, import:

```js
import { initItemLevelUpPanel } from './itemLevelUpPanel.mjs';
```

Near the maker DOM queries, add:

```js
  const itemLevelUpToggle = enhancementPanel?.querySelector('[data-item-level-up-toggle]');
  const itemLevelUpArea = enhancementPanel?.querySelector('[data-item-level-up-area]');
  const itemLevelUpSlots = enhancementPanel?.querySelector('[data-item-level-up-slots]');
  const itemLevelUpEditor = enhancementPanel?.querySelector('[data-item-level-up-editor]');
```

After `makerPanel`, initialize:

```js
  const itemLevelUpPanel = initItemLevelUpPanel({
    toggle: itemLevelUpToggle,
    area: itemLevelUpArea,
    slots: itemLevelUpSlots,
    editor: itemLevelUpEditor,
    renderEnhancedItemCard,
  });
```

Add the runtime definition lookup. It starts empty and Task 7 populates it from the generated runtime JSON:

```js
  let itemLevelUpByItemId = new Map();
```

In `activatePanel2`, before `createEnhancementState`, add:

```js
    const itemLevelUpDefinition = itemLevelUpByItemId.get(item.id) ?? null;
```

Then change state creation:

```js
    enhancementState = createEnhancementState(upgradeSlots, item.requiredLevel ?? 0, itemLevelUpDefinition);
```

After `makerPanel.activate(enhancementState, item);`, add:

```js
    itemLevelUpPanel.activate(enhancementState, item, itemLevelUpDefinition);
```

In the non-enhanceable branch and dormant/deactivate paths, call:

```js
      itemLevelUpPanel.deactivate();
```

In reset, after `makerPanel.resetMakerUI();`, add:

```js
    itemLevelUpPanel.reset();
```

- [ ] **Step 5: Run panel contract tests**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: the item-level-up tests pass. Existing unrelated failures in this file may remain.

- [ ] **Step 6: Run focused state and data tests**

Run:

```bash
node --test tests/item-level-up-data.test.mjs tests/enhancement-state.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/itemLevelUpPanel.mjs src/lib/enhancementPanel.mjs tests/calculator-input-contract.test.mjs
git commit -m "feat: add item level-up panel"
```

---

### Task 7: Load Runtime Item Level-Up JSON

**Files:**
- Modify: `src/lib/enhancementPanel.mjs`
- Test: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Add failing runtime-load source test**

Append to `tests/calculator-input-contract.test.mjs`:

```js
test('enhancement panel loads item level-up runtime data', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');

	assert.match(enhancementPanelSource, /fetch\('\/data\/item-level-ups-gms83-ko\.json'\)/);
	assert.match(enhancementPanelSource, /itemLevelUpByItemId\s*=\s*new Map/);
	assert.match(enhancementPanelSource, /levelUpDefinition\.itemId/);
});
```

- [ ] **Step 2: Run failing runtime-load test**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: FAIL because runtime JSON is not fetched yet.

- [ ] **Step 3: Update `Promise.all` data loading**

In `src/lib/enhancementPanel.mjs`, change the data load to include:

```js
    fetch('/data/item-level-ups-gms83-ko.json').then((r) => {
      if (!r.ok) return [];
      return r.json();
    }).catch(() => []),
```

Change the `.then` parameters from:

```js
    .then(([scrolls, overrides]) => {
```

to:

```js
    .then(([scrolls, overrides, itemLevelUps]) => {
```

Inside the `.then`, after `scrollsByEquipmentKind = new Map();`, add:

```js
      itemLevelUpByItemId = new Map(
        (Array.isArray(itemLevelUps) ? itemLevelUps : [])
          .filter((levelUpDefinition) => Number.isInteger(levelUpDefinition.itemId))
          .map((levelUpDefinition) => [levelUpDefinition.itemId, levelUpDefinition]),
      );
```

- [ ] **Step 4: Generate runtime JSON**

After Task 3 has seeded Supabase, generate `public/data/item-level-ups-gms83-ko.json` from `public.item_level_up_definitions`:

```bash
npm run generate:item-level-ups
```

The generated file must contain every published row from the curated seed, sorted by `itemId`. Do not hand-author this runtime JSON; if Supabase generation fails, stop and fix the seed/generator path before continuing.

- [ ] **Step 5: Run runtime-load test**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: item-level-up runtime-load test passes. Existing unrelated failures may remain.

- [ ] **Step 6: Commit**

```bash
git add src/lib/enhancementPanel.mjs public/data/item-level-ups-gms83-ko.json tests/calculator-input-contract.test.mjs
git commit -m "feat: load item level-up data"
```

---

### Task 8: Full Verification

**Files:**
- No new files unless fixes are required.

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test tests/item-level-up-data.test.mjs tests/enhancement-state.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run contract tests**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: all new item-level-up tests pass. If pre-existing unrelated failures remain, record their names and confirm they existed before this feature.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS, static site builds.

- [ ] **Step 4: Manual app verification**

Run:

```bash
npm run dev
```

Open the local URL and test:

1. Search/select `리버스 엑서큐서너스`.
2. Confirm `아이템 레벨업` appears beside `메이커`.
3. Click it and confirm 3 slots.
4. Apply Lv 1 with `weaponAttack +2`, `str +2`, `dex +1`.
5. Confirm it auto-advances to Lv 2.
6. Confirm the item card total updates.
7. Confirm the breakdown still displays `기본 + 메이커 + 주문서`, with level-up included in `메이커`.
8. Toggle Maker off and confirm item level-up remains.
9. Reset and confirm item level-up clears.
10. Select `타임리스 엑서큐서너스` and confirm 5 slots.

- [ ] **Step 5: Stop dev server**

If `npm run dev` is still running in a terminal session, stop it before final response.

- [ ] **Step 6: Final diff check**

Run:

```bash
git status --short
git diff --check
```

Expected: no whitespace errors; only intentional files changed.

---

## Final Notes

Do not use runtime article parsing. The article is an external source for curation only.

Do not add random rolling. Every level-up result is manually entered by the user within validated min/max ranges.

Do not create a new item-card contribution bucket. Item level-up remains independent state, but its contribution is folded into the existing `maker` bucket for display.
