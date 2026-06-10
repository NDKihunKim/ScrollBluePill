# Item Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate item data pipeline from maplestory.io–only to Supabase–backed, mirroring the existing scroll data pattern.

**Architecture:** Two-script pipeline — `seed-item-definitions.mjs` pulls from maplestory.io API and upserts into a new `item_definitions` table; `generate-item-index.mjs` fetches from Supabase (RLS-filtered), applies visibility overrides, deduplicates, and writes the static frontend JSON.

**Tech Stack:** Node.js (ESM), Supabase REST API, maplestory.io API

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/schema.sql` | Modify | Add `item_definitions` table + RLS policy |
| `.env.example` | Modify | Add `SUPABASE_SERVICE_ROLE_KEY` |
| `scripts/seed-item-definitions.mjs` | Create | Pull from maplestory.io → upsert into Supabase |
| `scripts/generate-item-index.mjs` | Modify | Replace maplestory.io calls with Supabase fetch |
| `public/data/items-gms83-ko.json` | Regenerate | Output — shape mostly unchanged (no `typeInfo`) |

---

### Task 1: Add `item_definitions` table to `supabase/schema.sql`

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Append the table DDL, RLS, and policy to schema.sql**

Open `supabase/schema.sql` and append the following after the existing `scroll_definitions` migration block (after line 82):

```sql
create table if not exists public.item_definitions (
    id integer primary key,
    version_tag_id uuid not null references public.version_tags(id),
    name_ko text not null,
    name_en text,
    equipment_kind text not null,
    required_level integer not null default 0,
    required_jobs text[] not null default '{}',
    requirements jsonb not null default '{}'::jsonb,
    stats jsonb not null default '{}'::jsonb,
    aliases text[] not null default '{}',
    published_status text not null default 'draft'
        check (published_status in ('draft', 'published', 'hidden')),
    source_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.item_definitions enable row level security;

create policy "Public can read published items" on public.item_definitions
    for select using (published_status = 'published');
```

- [ ] **Step 2: Verify the file is valid**

```bash
head -n 5 supabase/schema.sql && echo "---" && tail -n 20 supabase/schema.sql
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add item_definitions table with RLS to schema

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Apply schema to Supabase

**Files:**
- No local file changes (DDL executed directly on remote)

- [ ] **Step 1: Verify Supabase CLI or MCP access**

Check that the Supabase project is reachable:

```bash
curl -so /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/"
```
Expected: `200` (or `401` — both mean the project is reachable).

- [ ] **Step 2: Execute the CREATE TABLE DDL**

Run the SQL from Task 1 on the Supabase project. Use the MCP `execute_sql` tool with the following SQL:

```sql
create table if not exists public.item_definitions (
    id integer primary key,
    version_tag_id uuid not null references public.version_tags(id),
    name_ko text not null,
    name_en text,
    equipment_kind text not null,
    required_level integer not null default 0,
    required_jobs text[] not null default '{}',
    requirements jsonb not null default '{}'::jsonb,
    stats jsonb not null default '{}'::jsonb,
    aliases text[] not null default '{}',
    published_status text not null default 'draft'
        check (published_status in ('draft', 'published', 'hidden')),
    source_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.item_definitions enable row level security;

create policy "Public can read published items" on public.item_definitions
    for select using (published_status = 'published');
```

- [ ] **Step 3: Verify the table exists and RLS is active**

Use MCP `execute_sql`:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'item_definitions';
```

Expected: one row with `rowsecurity = true`.

- [ ] **Step 4: Verify the table is empty**

```sql
select count(*) from public.item_definitions;
```

Expected: `0`.

---

### Task 3: Update `.env.example` with service role key

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add SUPABASE_SERVICE_ROLE_KEY to .env.example**

Open `.env.example` and replace its contents:

```
# Supabase project credentials (required for generate:scroll-index)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# Required for seed-item-definitions (write access to item_definitions)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- [ ] **Step 2: Verify .env has the real key set**

Check that the user's actual `.env` includes `SUPABASE_SERVICE_ROLE_KEY`:

```bash
grep -q 'SUPABASE_SERVICE_ROLE_KEY' .env && echo "PRESENT" || echo "MISSING — add it to .env"
```

If missing, the user must add it from their Supabase dashboard (Project Settings > API > service_role key).

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add SUPABASE_SERVICE_ROLE_KEY to .env.example

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Create `scripts/seed-item-definitions.mjs`

**Files:**
- Create: `scripts/seed-item-definitions.mjs`

This is the largest task. The script pulls equip items from maplestory.io, merges with `item-overrides.ko.json`, pre-resolves `attackSpeed`, and batch-upserts into Supabase.

- [ ] **Step 1: Write the script skeleton — imports, constants, env vars**

```js
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const region = 'GMS';
const version = '83';
const koreanNameRegion = 'KMS';
const koreanNameVersion = '284';
const baseUrl = 'https://maplestory.io';
const overridesPath = resolve('data/item-overrides.ko.json');
const detailConcurrency = 16;
const upsertBatchSize = 500;

const equipmentKindBySubCategory = {
    'One-Handed Sword': '한손검',
    'Two-Handed Sword': '두손검',
    'One-Handed Axe': '한손도끼',
    'Two-Handed Axe': '두손도끼',
    'One-Handed Blunt Weapon': '한손둔기',
    'Two-Handed Blunt': '두손둔기',
    Spear: '창',
    'Pole Arm': '폴암',
    Wand: '완드',
    Staff: '스태프',
    Bow: '활',
    Crossbow: '석궁',
    Claw: '아대',
    Dagger: '단검',
    Knuckle: '너클',
    Gun: '총',
    Shield: '방패',
    Hat: '모자',
    'Face Accessory': '얼굴장식',
    'Eye Decoration': '눈장식',
    Ring: '반지',
    Pendant: '펜던트',
    Belt: '벨트',
    Earrings: '귀고리',
    Earring: '귀고리',
    Top: '상의',
    Bottom: '하의',
    Overall: '한벌옷',
    Glove: '장갑',
    Shoes: '신발',
    Cape: '망토',
};

const weaponAttackSpeedBySubCategory = {
    'One-Handed Sword': 5,
    'Two-Handed Sword': 6,
    'One-Handed Axe': 5,
    'Two-Handed Axe': 6,
    'One-Handed Blunt Weapon': 5,
    'Two-Handed Blunt': 6,
    Spear: 7,
    'Pole Arm': 8,
    Wand: 6,
    Staff: 8,
    Bow: 6,
    Crossbow: 6,
    Claw: 4,
    Dagger: 4,
    Knuckle: 5,
    Gun: 5,
};

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
    console.error('Copy .env.example to .env and fill in your Supabase project credentials.');
    process.exit(1);
}
```

- [ ] **Step 2: Write helper functions — fetch, data mapping, attack speed resolution**

Append after the env var check:

```js
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.json();
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
        throw new Error(`Supabase API error ${response.status} on ${url}: ${body}`);
    }

    return response.json();
}

async function fetchEquipItems(itemRegion, itemVersion) {
    const countUrl = new URL(`/api/${itemRegion}/${itemVersion}/item/count`, baseUrl);
    countUrl.searchParams.set('overallCategoryFilter', 'Equip');
    const total = await fetchJson(countUrl);

    const listUrl = new URL(`/api/${itemRegion}/${itemVersion}/item/list`, baseUrl);
    listUrl.searchParams.set('startPosition', '0');
    listUrl.searchParams.set('count', String(total));
    listUrl.searchParams.set('overallCategoryFilter', 'Equip');

    return fetchJson(listUrl);
}

async function mapWithConcurrency(values, concurrency, mapper) {
    const results = new Array(values.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < values.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await mapper(values[index], index);
        }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
}

async function fetchItemDetails(items, itemRegion, itemVersion) {
    let completed = 0;

    return mapWithConcurrency(items, detailConcurrency, async (item) => {
        const detailUrl = new URL(`/api/${itemRegion}/${itemVersion}/item/${item.id}`, baseUrl);
        let detail = null;
        try {
            detail = await fetchJson(detailUrl);
        } catch (error) {
            console.warn(`Unable to fetch item detail for ${item.id}: ${error.message}`);
        }
        completed += 1;

        if (completed % 500 === 0 || completed === items.length) {
            console.log(`Fetched item details: ${completed}/${items.length}`);
        }

        return detail;
    });
}

function definedNumber(value) {
    return Number.isFinite(value) ? value : undefined;
}

function compactNumbers(entries) {
    return Object.fromEntries(entries.filter(([, value]) => Number.isFinite(value)));
}

function mapRequirements(item, metaInfo = {}) {
    return compactNumbers([
        ['str', definedNumber(metaInfo.reqSTR)],
        ['dex', definedNumber(metaInfo.reqDEX)],
        ['int', definedNumber(metaInfo.reqINT)],
        ['luk', definedNumber(metaInfo.reqLUK)],
        ['pop', definedNumber(metaInfo.reqPOP)],
    ]);
}

function mapStats(metaInfo = {}, subCategory) {
    return compactNumbers([
        ['str', definedNumber(metaInfo.incSTR)],
        ['dex', definedNumber(metaInfo.incDEX)],
        ['int', definedNumber(metaInfo.incINT)],
        ['luk', definedNumber(metaInfo.incLUK)],
        ['maxHp', definedNumber(metaInfo.incMHP)],
        ['maxMp', definedNumber(metaInfo.incMMP)],
        ['weaponAttack', definedNumber(metaInfo.incPAD)],
        ['magicAttack', definedNumber(metaInfo.incMAD)],
        ['weaponDefense', definedNumber(metaInfo.incPDD)],
        ['magicDefense', definedNumber(metaInfo.incMDD)],
        ['accuracy', definedNumber(metaInfo.incACC)],
        ['avoidability', definedNumber(metaInfo.incEVA)],
        ['speed', definedNumber(metaInfo.incSpeed)],
        ['jump', definedNumber(metaInfo.incJump)],
        ['attackSpeed', resolveAttackSpeed(metaInfo, subCategory)],
        ['upgradeSlots', definedNumber(metaInfo.tuc)],
    ]);
}

function resolveAttackSpeed(metaInfo, subCategory) {
    if (Number.isFinite(metaInfo.attackSpeed)) {
        return metaInfo.attackSpeed;
    }
    return weaponAttackSpeedBySubCategory[subCategory] ?? null;
}
```

- [ ] **Step 3: Write the version tag resolution and upsert functions**

Append:

```js
async function resolveVersionTagId() {
    const url = new URL('/rest/v1/version_tags', supabaseUrl);
    url.searchParams.set('is_active', 'eq.true');
    url.searchParams.set('limit', '1');
    url.searchParams.set('select', 'id');
    const tags = await fetchSupabase(url);

    if (tags.length > 0) {
        return tags[0].id;
    }

    console.log('No active version tag found. Creating default version tag...');
    const createUrl = new URL('/rest/v1/version_tags', supabaseUrl);
    const [created] = await fetchSupabase(createUrl, {
        method: 'POST',
        body: JSON.stringify({
            label_ko: 'GMS v83 (기본)',
            label_en: 'GMS v83 (default)',
            description: 'Auto-created by seed-item-definitions.mjs',
            is_active: true,
        }),
    });

    if (!created || !created.id) {
        throw new Error('Failed to create default version tag.');
    }

    console.log(`Created version tag: ${created.id}`);
    return created.id;
}

async function upsertItemDefinitions(rows) {
    console.log(`Upserting ${rows.length} item definitions in batches of ${upsertBatchSize}...`);

    for (let i = 0; i < rows.length; i += upsertBatchSize) {
        const batch = rows.slice(i, i + upsertBatchSize);
        const url = new URL('/rest/v1/item_definitions', supabaseUrl);

        await fetchSupabase(url, {
            method: 'POST',
            headers: {
                prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify(batch),
        });

        const done = Math.min(i + upsertBatchSize, rows.length);
        console.log(`Upserted ${done}/${rows.length} items`);
    }
}

async function truncateItemDefinitions() {
    const url = new URL('/rest/v1/item_definitions', supabaseUrl);
    // Delete all rows — only safe for a fresh seed
    await fetchSupabase(url, { method: 'DELETE', headers: { prefer: 'count=exact' } });
    console.log('Truncated existing item_definitions.');
}
```

- [ ] **Step 4: Write the main function**

Append:

```js
async function main() {
    const overrides = JSON.parse(await readFile(overridesPath, 'utf8'));

    // 1. Fetch items from maplestory.io
    console.log('Fetching equip items from maplestory.io...');
    const [items, koreanNameItems] = await Promise.all([
        fetchEquipItems(region, version),
        fetchEquipItems(koreanNameRegion, koreanNameVersion),
    ]);
    console.log(`Fetched ${items.length} items from ${region}/${version}`);
    console.log(`Fetched ${koreanNameItems.length} Korean names from ${koreanNameRegion}/${koreanNameVersion}`);

    // 2. Fetch item details (stats/requirements)
    const itemDetails = await fetchItemDetails(items, region, version);
    const validItemDetails = itemDetails.filter((item) => item && Number.isFinite(item.id));
    const detailById = new Map(validItemDetails.map((item) => [item.id, item]));
    const koreanNameById = new Map(koreanNameItems.map((item) => [item.id, item.name]));

    // 3. Validate override IDs
    const seenIds = new Set(items.map((item) => String(item.id)));
    const missingOverrideIds = Object.keys(overrides).filter((id) => !seenIds.has(id));
    if (missingOverrideIds.length > 0) {
        throw new Error(`Override item ids are missing from MapleStory.io: ${missingOverrideIds.join(', ')}`);
    }

    // 4. Build rows — merge API data with overrides
    const rows = items.map((item) => {
        const override = overrides[String(item.id)] ?? {};
        const detail = detailById.get(item.id) ?? {};
        const metaInfo = detail.metaInfo ?? {};
        const typeInfo = item.typeInfo ?? {};
        const subCategory = typeInfo.subCategory;
        const equipmentKind = override.equipmentKind ?? equipmentKindBySubCategory[subCategory] ?? subCategory;
        const generatedKoreanName = koreanNameById.get(item.id);
        const generatedRequirements = mapRequirements(item, metaInfo);
        const generatedStats = mapStats(metaInfo, subCategory);

        return {
            id: item.id,
            version_tag_id: null, // filled below
            name_ko: override.nameKo ?? generatedKoreanName ?? item.name,
            name_en: item.name ?? null,
            equipment_kind: equipmentKind,
            required_level: metaInfo.reqLevelEquip ?? item.requiredLevel ?? 0,
            required_jobs: item.requiredJobs ?? [],
            requirements: { ...generatedRequirements, ...(override.requirements ?? {}) },
            stats: { ...generatedStats, ...(override.stats ?? {}) },
            aliases: override.aliases ?? [],
            published_status: 'published',
            source_note: `Seeded from maplestory.io ${region}/${version}`,
        };
    });

    // 5. Resolve version tag
    const versionTagId = await resolveVersionTagId();
    for (const row of rows) {
        row.version_tag_id = versionTagId;
    }

    // 6. Upsert into Supabase
    console.log(`Upserting ${rows.length} item definitions to Supabase...`);
    await upsertItemDefinitions(rows);

    // 7. Summary
    const koreanNamedCount = rows.filter((row) => /[가-힣]/.test(row.name_ko)).length;
    const aliasCount = rows.filter((row) => (row.aliases ?? []).length > 0).length;
    const statCount = rows.filter((row) => Object.keys(row.stats ?? {}).length > 0).length;
    const missingDetailCount = items.length - validItemDetails.length;

    console.log(`Seeded ${rows.length} item definitions.`);
    console.log(`Korean names filled: ${koreanNamedCount}/${rows.length}`);
    console.log(`Stats filled: ${statCount}/${rows.length}`);
    console.log(`Missing detail records: ${missingDetailCount}`);
    console.log(`Alias overrides: ${aliasCount}; override records: ${Object.keys(overrides).length}`);
    console.log(`Version tag: ${versionTagId}`);
}

await main();
```

- [ ] **Step 5: Verify the complete script is valid JavaScript**

```bash
node --check scripts/seed-item-definitions.mjs
```

Expected: no output (syntax is valid).

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-item-definitions.mjs
git commit -m "feat: add seed-item-definitions script for Supabase item population

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Run the seed script

**Files:**
- No local changes (data written to Supabase)

- [ ] **Step 1: Verify env vars are set**

```bash
node -e "
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('Missing env vars. Run: export \$(grep -v \"^#\" .env | xargs)');
    process.exit(1);
}
console.log('SUPABASE_URL:', url);
console.log('SUPABASE_SERVICE_ROLE_KEY: present (length ' + key.length + ')');
"
```

Expected: both variables are present.

- [ ] **Step 2: Run the seed script**

```bash
node scripts/seed-item-definitions.mjs
```

Expected output: logs showing fetch progress, upsert progress, and a final summary with item counts.

- [ ] **Step 3: Verify data in Supabase**

Use MCP `execute_sql`:

```sql
select count(*) as total,
       count(*) filter (where published_status = 'published') as published,
       count(*) filter (where name_ko ~ '[가-힣]') as korean_named
from public.item_definitions;
```

Expected: `total` > 3000, `published` equals `total`, `korean_named` is most items.

- [ ] **Step 4: Verify anon access returns only published items**

```bash
curl -s "$SUPABASE_URL/rest/v1/item_definitions?select=id&limit=3" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" | head -c 200
```

Expected: JSON array with items (RLS allows `published` rows through).

---

### Task 6: Modify `generate-item-index.mjs` to fetch from Supabase

**Files:**
- Modify: `scripts/generate-item-index.mjs`

The script needs to replace maplestory.io API calls with a Supabase REST fetch, then transform snake_case DB rows to camelCase for the frontend JSON output.

- [ ] **Step 1: Replace the import block and constants at the top of the file**

Replace lines 1–15 of the current `scripts/generate-item-index.mjs`:

**Old (lines 1–15):**
```js
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { dedupeItems } from '../src/lib/itemDedupe.mjs';

const region = 'GMS';
const version = '83';
const koreanNameRegion = 'KMS';
const koreanNameVersion = '284';
const baseUrl = 'https://maplestory.io';
const outputPath = resolve('public/data/items-gms83-ko.json');
const overridesPath = resolve('data/item-overrides.ko.json');
const visibilityOverridesPath = resolve('data/item-visibility-overrides.json');
const dedupeReportPath = resolve('docs/data-quality/dedupe-resolution-report.md');
const equipmentKindReportPath = resolve('docs/data-quality/equipment-kind-visibility-report.md');
const detailConcurrency = 16;
```

**New:**
```js
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { dedupeItems } from '../src/lib/itemDedupe.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const outputPath = resolve('public/data/items-gms83-ko.json');
const visibilityOverridesPath = resolve('data/item-visibility-overrides.json');
const dedupeReportPath = resolve('docs/data-quality/dedupe-resolution-report.md');
const equipmentKindReportPath = resolve('docs/data-quality/equipment-kind-visibility-report.md');

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required.');
    console.error('Copy .env.example to .env and fill in your Supabase project credentials.');
    process.exit(1);
}
```

- [ ] **Step 2: Delete the now-unused maplestory.io functions**

Remove these entire blocks from the file:
- `equipmentKindBySubCategory` (lines 17–49)
- `fetchJson` (lines 51–58)
- `fetchEquipItems` (lines 60–71)
- `mapWithConcurrency` (lines 73–87)
- `definedNumber` (lines 89–91)
- `compactNumbers` (lines 93–95)
- `mapRequirements` (lines 97–105)
- `mapStats` (lines 107–126)
- `fetchItemDetails` (lines 303–322)

- [ ] **Step 3: Add Supabase fetch and row-transform functions**

After the env var check (new code from Step 1), add:

```js
const supabaseRestUrl = new URL('/rest/v1/item_definitions', supabaseUrl);
supabaseRestUrl.searchParams.set('select', '*');

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

function transformSupabaseRow(row) {
    return {
        id: row.id,
        nameKo: row.name_ko,
        nameEn: row.name_en,
        equipmentKind: row.equipment_kind,
        requiredLevel: row.required_level,
        requiredJobs: row.required_jobs ?? [],
        requirements: row.requirements ?? {},
        stats: row.stats ?? {},
        aliases: row.aliases ?? [],
    };
}
```

- [ ] **Step 4: Rewrite the `main` function**

Replace the entire `main` function (lines 324–401) with:

```js
async function main() {
    const visibilityOverrides = JSON.parse(await readFile(visibilityOverridesPath, 'utf8'));

    console.log('Fetching item definitions from Supabase...');
    const rawRows = await fetchSupabase(supabaseRestUrl);
    console.log(`Fetched ${rawRows.length} item definitions (RLS-filtered to published only).`);

    // Transform snake_case DB rows to camelCase frontend shape
    const rawIndex = rawRows
        .map(transformSupabaseRow)
        .sort((a, b) => a.id - b.id);

    // Validate visibility override IDs exist in the data
    const seenIds = new Set(rawIndex.map((item) => String(item.id)));
    const visibilityOverrideIds = [
        ...(visibilityOverrides.hideItemIds ?? []).map((id) => String(id)),
        ...Object.keys(visibilityOverrides.renameById ?? {}),
    ];
    const missingVisibilityOverrideIds = visibilityOverrideIds.filter((id) => !seenIds.has(id));
    if (missingVisibilityOverrideIds.length > 0) {
        throw new Error(`Visibility override item ids are missing from Supabase data: ${missingVisibilityOverrideIds.join(', ')}`);
    }

    // Apply visibility overrides (unchanged logic)
    const visibilityResult = applyVisibilityOverrides(rawIndex, visibilityOverrides);
    const { items: index, resolutions } = dedupeItems(visibilityResult.items);

    const koreanNamedCount = index.filter((item) => /[가-힣]/.test(item.nameKo)).length;
    const aliasCount = index.filter((item) => (item.aliases ?? []).length > 0).length;
    const statCount = index.filter((item) => Object.keys(item.stats ?? {}).length > 0).length;

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`);
    await writeDedupeReport(resolutions, rawIndex.length, visibilityResult.items.length, index.length, visibilityResult);
    await writeEquipmentKindReport(index, visibilityResult);

    console.log(`Generated ${outputPath} with ${index.length}/${rawIndex.length} items.`);
    console.log(`Korean names filled: ${koreanNamedCount}/${index.length}.`);
    console.log(`Stats filled: ${statCount}/${index.length}.`);
    console.log(`Alias count: ${aliasCount}.`);
    console.log(
        `Visibility overrides: ${visibilityResult.hiddenIds.size} hidden by ID; ` +
        `${visibilityResult.missingKoreanNameHiddenIds.size} missing Korean names hidden; ` +
        `${visibilityResult.equipmentKindHiddenIds.size} equipment-kind hidden; ` +
        `${visibilityResult.zeroStatHiddenIds.size} zero-stat hidden; ` +
        `${visibilityResult.renamedIds.size} renamed from ${visibilityOverridesPath}.`,
    );
    console.log(`Dedupe report: ${dedupeReportPath}`);
    console.log(`Equipment kind report: ${equipmentKindReportPath}`);
}

await main();
```

- [ ] **Step 5: Verify the remaining helper functions still exist**

Confirm these functions are still present in the file (they should be untouched):
- `formatStats` (line 128)
- `countEquipmentKinds` (line 138)
- `applyVisibilityOverrides` (line 148)
- `writeDedupeReport` (line 194)
- `writeEquipmentKindReport` (line 280)

```bash
grep -n "^async function\|^function" scripts/generate-item-index.mjs
```

Expected output should list:
```
formatStats
countEquipmentKinds
applyVisibilityOverrides
writeDedupeReport
writeEquipmentKindReport
fetchSupabase
transformSupabaseRow
main
```

- [ ] **Step 6: Verify the complete script is valid JavaScript**

```bash
node --check scripts/generate-item-index.mjs
```

Expected: no output (syntax is valid).

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-item-index.mjs
git commit -m "refactor: switch generate-item-index to fetch from Supabase

Replace maplestory.io API calls with Supabase REST fetch.
Keep visibility overrides, deduplication, and report generation unchanged.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Run generate script and verify output

**Files:**
- Regenerate: `public/data/items-gms83-ko.json`
- Regenerate: `docs/data-quality/dedupe-resolution-report.md`
- Regenerate: `docs/data-quality/equipment-kind-visibility-report.md`

- [ ] **Step 1: Run the generate script**

```bash
node scripts/generate-item-index.mjs
```

Expected: logs showing fetch count, visibility override summary, dedupe results, and output path.

- [ ] **Step 2: Verify the output JSON has the correct shape**

```bash
node -e "
const items = JSON.parse(require('fs').readFileSync('public/data/items-gms83-ko.json','utf8'));
const first = items[0];
console.log('Total items:', items.length);
console.log('First item keys:', Object.keys(first).sort().join(', '));
console.log('First item:', JSON.stringify(first, null, 2));
"
```

Expected: `Total items` matches previous count (roughly ~3000). First item has keys: `aliases, equipmentKind, id, nameEn, nameKo, requiredJobs, requiredLevel, requirements, stats`. Note: `typeInfo` is NOT present — this is intentional (frontend doesn't need it with pre-resolved `attackSpeed`).

- [ ] **Step 3: Verify stats.attackSpeed is populated for weapons**

```bash
node -e "
const items = JSON.parse(require('fs').readFileSync('public/data/items-gms83-ko.json','utf8'));
const weapons = items.filter(i => ['한손검','두손검','단검','아대','완드','스태프','활','석궁','창','폴암','너클','총','한손도끼','두손도끼','한손둔기','두손둔기'].includes(i.equipmentKind));
const withSpeed = weapons.filter(w => Number.isFinite(w.stats?.attackSpeed));
console.log('Weapons:', weapons.length);
console.log('With attackSpeed:', withSpeed.length);
console.log('Missing attackSpeed:', weapons.filter(w => !Number.isFinite(w.stats?.attackSpeed)).map(w => w.id + ' ' + w.nameKo));
"
```

Expected: most or all weapons have `attackSpeed` set. Any missing ones are edge cases (e.g., items with no subCategory mapping).

- [ ] **Step 4: Verify generate-scroll-index still works (no regression)**

```bash
node scripts/generate-scroll-index.mjs
```

Expected: scrolls are generated successfully with no errors.

- [ ] **Step 5: Commit regenerated outputs**

```bash
git add public/data/items-gms83-ko.json docs/data-quality/
git commit -m "data: regenerate item index from Supabase

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Test the frontend locally

**Files:**
- No changes needed (frontend loads the JSON the same way)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the page loads without errors**

Open `http://localhost:4321` in a browser. Check the browser console for errors. Expected: no errors related to missing `typeInfo` or malformed item data.

- [ ] **Step 3: Test item search**

Type "자쿰" in the search box. Expected: "자쿰의 투구" appears in suggestions. Select it and verify the item card shows stats correctly.

- [ ] **Step 4: Test manual filter search**

Click "필터 검색", select a weapon kind (e.g. "한손검"), set level range, and verify filtered results appear.

- [ ] **Step 5: Test scroll enhancement panel**

Select an item, then verify scroll options appear in the enhancement panel. Apply a scroll and verify accumulated stats are displayed.

- [ ] **Step 6: Stop the dev server**

Ctrl+C the dev server.

---

## Completion Checklist

- [ ] `item_definitions` table exists in Supabase with RLS
- [ ] `seed-item-definitions.mjs` runs successfully and populates data
- [ ] `generate-item-index.mjs` fetches from Supabase and produces correct JSON
- [ ] `public/data/items-gms83-ko.json` has correct shape (no `typeInfo`, camelCase keys)
- [ ] Frontend search, filter, and enhancement panel all work
- [ ] `generate-scroll-index.mjs` still works (no regression)
- [ ] All changes committed
