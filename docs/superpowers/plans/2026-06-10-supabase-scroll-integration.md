# Supabase Scroll Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Supabase scroll data pipeline so scroll definitions (allowlist + metadata + stats) come from Supabase, icons come from maplestory.io, and the generated output file matches what the frontend enhancement panel expects.

**Architecture:** Supabase `scroll_definitions` gains a `maplestory_io_item_id` column linking each scroll to its mapleStory.io item for icons. A seed script populates the table with known v83 scrolls. The generation script transforms Supabase rows into the frontend-ready `scrolls-gms83-ko.json` format (`id`, `nameKo`, `equipmentKind`, `stats`). No frontend changes.

**Tech Stack:** Node.js (script), Supabase REST API, maplestory.io API

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `supabase/schema.sql` | Add `maplestory_io_item_id` column |
| Create | `data/scroll-seed.json` | Initial scroll definitions with real item IDs + stats |
| Create | `scripts/seed-scrolls.mjs` | Upsert seed JSON → Supabase REST API |
| Modify | `scripts/generate-scroll-index.mjs` | Output to `scrolls-gms83-ko.json`, transform snake_case → camelCase |

No changes: `src/lib/enhancementPanel.mjs` (already fetches correct path and format), `data/scroll-visibility-overrides.json` (already correct).

---

### Task 1: Research scroll item IDs from maplestory.io

**Files:**
- Reference: `src/lib/maplestoryIo.mjs:1-3`

- [ ] **Step 1: Search maplestory.io for scroll-type items**

maplestory.io items have an `typeInfo.overallCategory` field. Scrolls are under `"Scroll"`. Fetch scroll items to discover their IDs and names:

```bash
# Get total count of Scroll category items in GMS v83
curl -s "https://maplestory.io/api/GMS/83/item/count?overallCategoryFilter=Scroll"
```

Record the total count, then fetch the full list:

```bash
# Replace TOTAL with the count from above
curl -s "https://maplestory.io/api/GMS/83/item/list?startPosition=0&count=TOTAL&overallCategoryFilter=Scroll" | node -e "
  const items = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  items.forEach(i => console.log(i.id, i.name));
"
```

- [ ] **Step 2: Fetch KMS v284 scroll names for Korean names**

```bash
# Get KMS scroll count
curl -s "https://maplestory.io/api/KMS/284/item/count?overallCategoryFilter=Scroll"
```

```bash
# Replace TOTAL with the count. Map KMS names by item ID.
curl -s "https://maplestory.io/api/KMS/284/item/list?startPosition=0&count=TOTAL&overallCategoryFilter=Scroll" | node -e "
  const items = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  items.forEach(i => console.log(i.id, i.name));
"
```

- [ ] **Step 3: Spot-check a few scroll details to see stat structure**

```bash
# Check one scroll item detail (replace ITEM_ID with a real ID from step 1)
curl -s "https://maplestory.io/api/GMS/83/item/ITEM_ID" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log(JSON.stringify({id: d.id, name: d.name, metaInfo: d.metaInfo, typeInfo: d.typeInfo}, null, 2));
"
```

Check `metaInfo` for stat-related fields (`incPAD`, `incSTR`, etc.) — these are the scroll's stat effects.

- [ ] **Step 4: Compile the working scroll list**

From the results, identify which scroll item IDs are relevant (old-school MapleStory scrolls — 10%, 60%, 100% scrolls for weapons, armor, accessories, gloves). Note the pattern:
- `typeInfo.subCategory` gives the scroll type (e.g., "Glove", "One-Handed Weapon")
- `metaInfo` fields like `incPAD`, `incMAD`, `incSTR`, etc. hold the stat deltas
- Korean names come from KMS v284

---

### Task 2: Add maplestory_io_item_id column to schema

**Files:**
- Modify: `supabase/schema.sql:12-24`

- [ ] **Step 1: Add the ALTER TABLE statement after the existing table definition**

After the existing `scroll_definitions` table definition (line 24), append:

```sql
-- Add maplestory.io item ID reference for icon lookup
alter table public.scroll_definitions
    add column if not exists maplestory_io_item_id integer;
```

The `add column if not exists` makes this safe to run against an existing database.

- [ ] **Step 2: Apply the migration to Supabase**

Since this project doesn't use Supabase CLI migrations, run the SQL manually via the Supabase dashboard SQL editor:

1. Open Supabase dashboard at https://supabase.com/dashboard
2. Navigate to the project `ruiyundsvqflqtcltkbv`
3. SQL Editor → New Query
4. Paste:

```sql
alter table public.scroll_definitions
    add column if not exists maplestory_io_item_id integer;
```

5. Click Run

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add maplestory_io_item_id column to scroll_definitions"
```

---

### Task 3: Create scroll seed data

**Files:**
- Create: `data/scroll-seed.json`

- [ ] **Step 1: Write the seed JSON with known v83 scrolls**

Create `data/scroll-seed.json` with the scroll definitions discovered in Task 1. Each entry has:
- `maplestory_io_item_id` — numeric item ID from maplestory.io (for icon lookup)
- `name_ko` — Korean name from KMS v284
- `category` — equipment kind the scroll applies to (frontend `equipmentKind`)
- `behavior_type` — `"fixed"` (100%), `"random"` (10%/60%/70%), or `"unknown"`
- `affected_stats` — array of stat keys affected
- `stat_effect_frame` — JSON object with stat deltas (e.g., `{"weaponAttack": 2}`)
- `published_status` — `"published"` (visible) or `"draft"` (hidden)

```json
[
  {
    "name_ko": "장갑 공격력 주문서 60%",
    "category": "장갑",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040801,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "장갑 공격력 주문서 10%",
    "category": "장갑",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040802,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 3 },
    "published_status": "published"
  },
  {
    "name_ko": "장갑 공격력 주문서 100%",
    "category": "장갑",
    "behavior_type": "fixed",
    "maplestory_io_item_id": 2040803,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 1 },
    "published_status": "published"
  },
  {
    "name_ko": "장갑 마력 주문서 60%",
    "category": "장갑",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040804,
    "affected_stats": ["magicAttack"],
    "stat_effect_frame": { "magicAttack": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "장갑 마력 주문서 10%",
    "category": "장갑",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040805,
    "affected_stats": ["magicAttack"],
    "stat_effect_frame": { "magicAttack": 3 },
    "published_status": "published"
  },
  {
    "name_ko": "장갑 마력 주문서 100%",
    "category": "장갑",
    "behavior_type": "fixed",
    "maplestory_io_item_id": 2040806,
    "affected_stats": ["magicAttack"],
    "stat_effect_frame": { "magicAttack": 1 },
    "published_status": "published"
  },
  {
    "name_ko": "한손검 공격력 주문서 60%",
    "category": "한손검",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040001,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "한손검 공격력 주문서 10%",
    "category": "한손검",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040002,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 3 },
    "published_status": "published"
  },
  {
    "name_ko": "한손검 공격력 주문서 100%",
    "category": "한손검",
    "behavior_type": "fixed",
    "maplestory_io_item_id": 2040003,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 1 },
    "published_status": "published"
  },
  {
    "name_ko": "한손무기 공격력 주문서 60%",
    "category": "한손검",
    "behavior_type": "random",
    "maplestory_io_item_id": 2043001,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "한손무기 공격력 주문서 10%",
    "category": "한손검",
    "behavior_type": "random",
    "maplestory_io_item_id": 2043002,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 3 },
    "published_status": "published"
  },
  {
    "name_ko": "한손무기 공격력 주문서 100%",
    "category": "한손검",
    "behavior_type": "fixed",
    "maplestory_io_item_id": 2043004,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 1 },
    "published_status": "published"
  },
  {
    "name_ko": "한손무기 마력 주문서 60%",
    "category": "한손검",
    "behavior_type": "random",
    "maplestory_io_item_id": 2043101,
    "affected_stats": ["magicAttack"],
    "stat_effect_frame": { "magicAttack": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "한손무기 마력 주문서 10%",
    "category": "한손검",
    "behavior_type": "random",
    "maplestory_io_item_id": 2043102,
    "affected_stats": ["magicAttack"],
    "stat_effect_frame": { "magicAttack": 3 },
    "published_status": "published"
  },
  {
    "name_ko": "한손무기 마력 주문서 100%",
    "category": "한손검",
    "behavior_type": "fixed",
    "maplestory_io_item_id": 2043104,
    "affected_stats": ["magicAttack"],
    "stat_effect_frame": { "magicAttack": 1 },
    "published_status": "published"
  },
  {
    "name_ko": "두손무기 공격력 주문서 60%",
    "category": "두손검",
    "behavior_type": "random",
    "maplestory_io_item_id": 2043201,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "두손무기 공격력 주문서 10%",
    "category": "두손검",
    "behavior_type": "random",
    "maplestory_io_item_id": 2043202,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 3 },
    "published_status": "published"
  },
  {
    "name_ko": "두손무기 공격력 주문서 100%",
    "category": "두손검",
    "behavior_type": "fixed",
    "maplestory_io_item_id": 2043204,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 1 },
    "published_status": "published"
  },
  {
    "name_ko": "두손무기 마력 주문서 60%",
    "category": "두손검",
    "behavior_type": "random",
    "maplestory_io_item_id": 2043301,
    "affected_stats": ["magicAttack"],
    "stat_effect_frame": { "magicAttack": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "두손무기 마력 주문서 10%",
    "category": "두손검",
    "behavior_type": "random",
    "maplestory_io_item_id": 2043302,
    "affected_stats": ["magicAttack"],
    "stat_effect_frame": { "magicAttack": 3 },
    "published_status": "published"
  },
  {
    "name_ko": "두손무기 마력 주문서 100%",
    "category": "두손검",
    "behavior_type": "fixed",
    "maplestory_io_item_id": 2043304,
    "affected_stats": ["magicAttack"],
    "stat_effect_frame": { "magicAttack": 1 },
    "published_status": "published"
  },
  {
    "name_ko": "망토 힘 주문서 60%",
    "category": "망토",
    "behavior_type": "random",
    "maplestory_io_item_id": 2041001,
    "affected_stats": ["str"],
    "stat_effect_frame": { "str": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "망토 힘 주문서 10%",
    "category": "망토",
    "behavior_type": "random",
    "maplestory_io_item_id": 2041002,
    "affected_stats": ["str"],
    "stat_effect_frame": { "str": 3 },
    "published_status": "published"
  },
  {
    "name_ko": "망토 힘 주문서 100%",
    "category": "망토",
    "behavior_type": "fixed",
    "maplestory_io_item_id": 2041003,
    "affected_stats": ["str"],
    "stat_effect_frame": { "str": 1 },
    "published_status": "published"
  },
  {
    "name_ko": "망토 민첩성 주문서 60%",
    "category": "망토",
    "behavior_type": "random",
    "maplestory_io_item_id": 2041004,
    "affected_stats": ["dex"],
    "stat_effect_frame": { "dex": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "망토 지력 주문서 60%",
    "category": "망토",
    "behavior_type": "random",
    "maplestory_io_item_id": 2041007,
    "affected_stats": ["int"],
    "stat_effect_frame": { "int": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "망토 행운 주문서 60%",
    "category": "망토",
    "behavior_type": "random",
    "maplestory_io_item_id": 2041010,
    "affected_stats": ["luk"],
    "stat_effect_frame": { "luk": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "상의 힘 주문서 60%",
    "category": "상의",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040501,
    "affected_stats": ["str"],
    "stat_effect_frame": { "str": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "상의 힘 주문서 100%",
    "category": "상의",
    "behavior_type": "fixed",
    "maplestory_io_item_id": 2040503,
    "affected_stats": ["str"],
    "stat_effect_frame": { "str": 1 },
    "published_status": "published"
  },
  {
    "name_ko": "상의 민첩성 주문서 60%",
    "category": "상의",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040504,
    "affected_stats": ["dex"],
    "stat_effect_frame": { "dex": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "하의 힘 주문서 60%",
    "category": "하의",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040601,
    "affected_stats": ["str"],
    "stat_effect_frame": { "str": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "하의 민첩성 주문서 60%",
    "category": "하의",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040604,
    "affected_stats": ["dex"],
    "stat_effect_frame": { "dex": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "한벌옷 힘 주문서 60%",
    "category": "한벌옷",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040701,
    "affected_stats": ["str"],
    "stat_effect_frame": { "str": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "한벌옷 민첩성 주문서 60%",
    "category": "한벌옷",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040704,
    "affected_stats": ["dex"],
    "stat_effect_frame": { "dex": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "한벌옷 지력 주문서 60%",
    "category": "한벌옷",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040707,
    "affected_stats": ["int"],
    "stat_effect_frame": { "int": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "한벌옷 행운 주문서 60%",
    "category": "한벌옷",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040710,
    "affected_stats": ["luk"],
    "stat_effect_frame": { "luk": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "신발 민첩성 주문서 60%",
    "category": "신발",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040204,
    "affected_stats": ["dex"],
    "stat_effect_frame": { "dex": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "신발 점프력 주문서 60%",
    "category": "신발",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040207,
    "affected_stats": ["jump"],
    "stat_effect_frame": { "jump": 1 },
    "published_status": "published"
  },
  {
    "name_ko": "신발 이동속도 주문서 60%",
    "category": "신발",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040210,
    "affected_stats": ["speed"],
    "stat_effect_frame": { "speed": 1 },
    "published_status": "published"
  },
  {
    "name_ko": "귀고리 지력 주문서 60%",
    "category": "귀고리",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040301,
    "affected_stats": ["int"],
    "stat_effect_frame": { "int": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "모자 방어력 주문서 60%",
    "category": "모자",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040101,
    "affected_stats": ["weaponDefense"],
    "stat_effect_frame": { "weaponDefense": 2 },
    "published_status": "published"
  },
  {
    "name_ko": "모자 HP 주문서 60%",
    "category": "모자",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040104,
    "affected_stats": ["maxHp"],
    "stat_effect_frame": { "maxHp": 5 },
    "published_status": "published"
  },
  {
    "name_ko": "방패 방어력 주문서 60%",
    "category": "방패",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040901,
    "affected_stats": ["weaponDefense"],
    "stat_effect_frame": { "weaponDefense": 2 },
    "published_status": "published"
  }
]
```

**Note:** The maplestory.io item IDs listed above are nominal for the plan structure. Task 1 research may reveal different IDs. Replace any IDs that don't match the actual API results. The critical pattern: `category` must match one of the `equipmentKind` values in `src/lib/calculatorInput.mjs` (weapon kinds + armor kinds).

- [ ] **Step 2: Commit**

```bash
git add data/scroll-seed.json
git commit -m "feat: add scroll seed data for Supabase population"
```

---

### Task 4: Create seed script

**Files:**
- Create: `scripts/seed-scrolls.mjs`

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-scrolls.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const seedPath = resolve('data/scroll-seed.json');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required.');
  console.error('Copy .env.example to .env and fill in your Supabase project credentials.');
  process.exit(1);
}

async function upsertScroll(scroll) {
  const url = new URL('/rest/v1/scroll_definitions', supabaseUrl);
  // Use maplestory_io_item_id as conflict key. If a row with that item ID
  // already exists, update it. Otherwise, insert.
  url.searchParams.set('on_conflict', 'maplestory_io_item_id');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify(scroll),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase API error ${response.status}: ${body}`);
  }

  return response.json();
}

async function main() {
  const raw = await readFile(seedPath, 'utf8');
  const scrolls = JSON.parse(raw);

  if (!Array.isArray(scrolls) || scrolls.length === 0) {
    console.error('Seed file contains no scrolls.');
    process.exit(1);
  }

  console.log(`Seeding ${scrolls.length} scrolls to Supabase...`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const scroll of scrolls) {
    try {
      const result = await upsertScroll(scroll);
      if (result && result.length > 0) {
        const action = result[0].created_at === result[0].updated_at ? 'INSERTED' : 'UPDATED';
        if (action === 'INSERTED') inserted++;
        else updated++;
        console.log(`  [${action}] ${scroll.name_ko} (ID: ${scroll.maplestory_io_item_id})`);
      }
    } catch (error) {
      failed++;
      console.error(`  [FAILED] ${scroll.name_ko}: ${error.message}`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Updated: ${updated}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

await main();
```

- [ ] **Step 2: Add npm script**

Add to `package.json` scripts section (after `"generate:scroll-index"`):

```json
"seed:scrolls": "node scripts/seed-scrolls.mjs"
```

- [ ] **Step 3: Run the seed script**

```bash
npm run seed:scrolls
```

Expected: Each scroll logs `[INSERTED]` with its name and maplestory.io item ID, followed by a success summary.

- [ ] **Step 4: Verify rows in Supabase dashboard**

Open the Supabase table editor for `scroll_definitions`. Confirm all rows from `scroll-seed.json` are present with the correct `maplestory_io_item_id` and `stat_effect_frame` values.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-scrolls.mjs package.json
git commit -m "feat: add seed-scrolls script with Supabase upsert"
```

---

### Task 5: Update generate-scroll-index script

**Files:**
- Modify: `scripts/generate-scroll-index.mjs`

- [ ] **Step 1: Change output path**

On line 6, change:

```js
const outputPath = resolve('public/data/scrolls.json');
```

To:

```js
const outputPath = resolve('public/data/scrolls-gms83-ko.json');
```

- [ ] **Step 2: Add transform step after applying visibility overrides**

After line 133 (`const { scrolls } = visibilityResult;`), insert the transform:

```js
// Transform Supabase row format to frontend format
const transformed = scrolls.map((scroll) => ({
  id: scroll.maplestory_io_item_id,
  nameKo: scroll.name_ko,
  equipmentKind: scroll.category,
  behavior_type: scroll.behavior_type,
  stats: scroll.stat_effect_frame ?? {},
}));
```

Then update line 136 to use `transformed` instead of `scrolls`:

```js
const sorted = [...transformed].sort((a, b) => a.nameKo.localeCompare(b.nameKo, 'ko-KR'));
```

- [ ] **Step 3: Add skip logic for rows without maplestory_io_item_id**

Before the transform step, filter out rows missing the item ID:

```js
const withItemId = scrolls.filter((scroll) => {
  if (scroll.maplestory_io_item_id == null) {
    console.warn(`Skipping scroll "${scroll.name_ko}" — missing maplestory_io_item_id`);
    return false;
  }
  return true;
});
```

Then change the transform to use `withItemId`:

```js
const transformed = withItemId.map((scroll) => ({ ... }));
```

- [ ] **Step 4: Verify the full updated file**

The final `scripts/generate-scroll-index.mjs` should have these sections in order:

1. Imports and constants (lines 1-8): same as before, with output path `scrolls-gms83-ko.json`
2. `fetchSupabase` function (unchanged)
3. `applyVisibilityOverrides` function (unchanged, still operates on Supabase row format)
4. `writeReport` function (unchanged, reads `category` and `behavior_type` from original rows)
5. `main` function:
   - Fetch from Supabase (unchanged)
   - Apply visibility overrides (unchanged)
   - Filter rows without `maplestory_io_item_id` (new)
   - Transform to frontend format (new)
   - Sort by `nameKo` (updated to use transformed array)
   - Write output file (unchanged)
   - Write report (unchanged, still uses pre-transform `scrolls` for category counts)

- [ ] **Step 5: Run the generation script**

```bash
npm run generate:scroll-index
```

Expected: Script logs the fetch, transform, and write. Output file `public/data/scrolls-gms83-ko.json` should contain entries like:

```json
[
  {
    "id": 2043201,
    "nameKo": "두손무기 공격력 주문서 60%",
    "equipmentKind": "두손검",
    "behavior_type": "random",
    "stats": { "weaponAttack": 2 }
  }
]
```

- [ ] **Step 6: Verify the output file exists and has correct format**

```bash
node -e "const d = require('./public/data/scrolls-gms83-ko.json'); console.log('Count:', d.length); d.slice(0, 2).forEach(s => console.log(JSON.stringify(s, null, 2)));"
```

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-scroll-index.mjs public/data/scrolls-gms83-ko.json
git commit -m "feat: generate scrolls-gms83-ko.json from Supabase with frontend format"
```

---

### Task 6: End-to-end smoke test

**Files:**
- No code changes — verification only

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: Build succeeds without errors.

- [ ] **Step 2: Verify scroll-gms83-ko.json is in the dist output**

```bash
ls -la dist/data/scrolls-gms83-ko.json
node -e "const d = require('./dist/data/scrolls-gms83-ko.json'); console.log('Scrolls in dist:', d.length);"
```

Expected: File exists with the same count as the public/ version.

- [ ] **Step 3: Start dev server and check browser console**

```bash
npm run dev
```

Open the browser. Select an equipment item with upgrade slots (e.g., a glove). The enhancement panel (Panel 2) should show scroll options with:
- Correct Korean names
- Stat descriptions (e.g., "공격력 +2")
- Icons from maplestory.io

Open browser DevTools → Network tab → filter by "scrolls-gms83". Confirm the file is fetched successfully (200 OK).

- [ ] **Step 4: Commit if any final tweaks were needed**

```bash
git add -A
git commit -m "chore: final adjustments from smoke test"
```
